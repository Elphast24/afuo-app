import type { Request, Response } from 'express';
import { matchingService } from '../services/matching.service.js';
import { analyticsService } from '../services/analytics.service.js';
import { messagingService } from '../services/messaging.service.js';
import { reviewService } from '../services/review.service.js';

export const matchController = {
  async match(req: Request, res: Response) {
    const data = await matchingService.findMatches(req.body);
    res.json({ success: true, data });
  },
};

export const analyticsController = {
  async summary(_req: Request, res: Response) {
    res.json({ success: true, data: await analyticsService.getMarketSummary() });
  },

  async prices(_req: Request, res: Response) {
    res.json({ success: true, data: { prices: await analyticsService.getAveragePrices() } });
  },

  async priceHistory(req: Request<{ produce: string }>, res: Response) {
    const months = (req.query as unknown as { months: number }).months;
    res.json({ success: true, data: await analyticsService.getPriceHistory(req.params.produce, months) });
  },

  async insights(_req: Request, res: Response) {
    res.json({ success: true, data: await analyticsService.getInsights() });
  },

  async locations(_req: Request, res: Response) {
    res.json({ success: true, data: { locations: await analyticsService.getListingsByLocation() } });
  },
};

export const conversationController = {
  async start(req: Request, res: Response) {
    const result = await messagingService.start(req.user!.sub, req.body.listingId, req.body.message);
    res.status(result.created ? 201 : 200).json({ success: true, data: result });
  },

  async list(req: Request, res: Response) {
    res.json({ success: true, data: { conversations: await messagingService.list(req.user!.sub) } });
  },

  async messages(req: Request<{ id: string }>, res: Response) {
    const { limit, before } = req.query as unknown as { limit: number; before?: string };
    const messages = await messagingService.getMessages(
      req.user!.sub,
      req.params.id,
      limit,
      before ? new Date(before) : undefined
    );
    res.json({ success: true, data: { messages } });
  },

  async send(req: Request<{ id: string }>, res: Response) {
    const message = await messagingService.send(req.user!.sub, req.params.id, req.body.content);
    res.status(201).json({ success: true, data: { message } });
  },

  async markRead(req: Request<{ id: string }>, res: Response) {
    res.json({ success: true, data: await messagingService.markRead(req.user!.sub, req.params.id) });
  },
};

export const reviewController = {
  async create(req: Request, res: Response) {
    const review = await reviewService.create(req.user!.sub, req.body);
    res.status(201).json({ success: true, data: { review } });
  },

  async forUser(req: Request<{ userId: string }>, res: Response) {
    res.json({ success: true, data: await reviewService.forUser(req.params.userId) });
  },
};
