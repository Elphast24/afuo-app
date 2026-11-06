import { conversationRepository } from '../repositories/conversation.repository.js';
import { listingRepository } from '../repositories/listing.repository.js';
import { realtime } from '../websocket/index.js';
import { ForbiddenError, NotFoundError } from '../utils/errors.js';

class MessagingService {
  /** A buyer opens (or re-opens) a conversation about a listing, optionally with a first message */
  async start(buyerId: string, listingId: string, firstMessage?: string) {
    const listing = await listingRepository.findRaw(listingId);
    if (!listing) throw new NotFoundError('Listing not found');
    if (listing.farmerId === buyerId) throw new ForbiddenError('You cannot start a conversation about your own listing');

    let conversation = await conversationRepository.findByBuyerAndListing(buyerId, listingId);
    const created = !conversation;
    if (!conversation) conversation = await conversationRepository.create(buyerId, listingId);

    const message = firstMessage
      ? await this.deliver(conversation.id, buyerId, listing.farmerId, firstMessage)
      : null;

    return { conversation, message, created };
  }

  list(userId: string) {
    return conversationRepository.listForUser(userId);
  }

  async getMessages(userId: string, conversationId: string, limit: number, before?: Date) {
    await this.requireParticipant(userId, conversationId);
    return conversationRepository.listMessages(conversationId, limit, before);
  }

  async send(userId: string, conversationId: string, content: string) {
    const convo = await this.requireParticipant(userId, conversationId);
    const recipient = convo.buyerId === userId ? convo.farmerId : convo.buyerId;
    return this.deliver(conversationId, userId, recipient, content);
  }

  async markRead(userId: string, conversationId: string) {
    const convo = await this.requireParticipant(userId, conversationId);
    const updated = await conversationRepository.markRead(conversationId, userId);
    if (updated > 0) {
      const other = convo.buyerId === userId ? convo.farmerId : convo.buyerId;
      realtime.emitToUsers([other], 'messages:read', { conversationId, readerId: userId });
    }
    return { updated };
  }

  private async deliver(conversationId: string, senderId: string, recipientId: string, content: string) {
    const message = await conversationRepository.createMessage(conversationId, senderId, content);
    realtime.emitToUsers([senderId, recipientId], 'message:new', message);
    return message;
  }

  private async requireParticipant(userId: string, conversationId: string) {
    const convo = await conversationRepository.findWithParties(conversationId);
    if (!convo) throw new NotFoundError('Conversation not found');
    if (convo.buyerId !== userId && convo.farmerId !== userId) {
      // Same answer as "missing" so ids cannot be probed
      throw new NotFoundError('Conversation not found');
    }
    return convo;
  }
}

export const messagingService = new MessagingService();
