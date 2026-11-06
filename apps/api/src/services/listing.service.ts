import { listingRepository, toListingDto, type ListingFilters } from '../repositories/listing.repository.js';
import { imageService, MAX_IMAGES_PER_LISTING } from './image.service.js';
import { inferCategory } from '../utils/categories.js';
import { findCity } from '../utils/ghana.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../utils/errors.js';
import type { AccessPayload } from './auth.service.js';
import type { CreateListingInput, UpdateListingInput } from '../validations/listing.js';
import type { NewProduceListing } from '../db/schema.js';

type Actor = Pick<AccessPayload, 'sub' | 'role'>;

class ListingService {
  async create(actor: Actor, input: CreateListingInput) {
    const coords = this.resolveCoordinates(input.location, input.latitude, input.longitude);

    const created = await listingRepository.create({
      farmerId: actor.sub,
      produceType: input.produceType,
      category: input.category ?? inferCategory(input.produceType),
      quantity: String(input.quantity),
      unit: input.unit,
      pricePerUnit: String(input.pricePerUnit),
      currency: input.currency,
      location: input.location,
      latitude: String(coords.latitude),
      longitude: String(coords.longitude),
      availableFrom: input.availableFrom,
      availableTo: input.availableTo,
      isOrganic: input.isOrganic,
      description: input.description ?? null,
    });
    return toListingDto(created);
  }

  list(filters: ListingFilters) {
    return listingRepository.findAll(filters);
  }

  mine(farmerId: string) {
    return listingRepository.findByFarmer(farmerId);
  }

  /** Full details incl. the farmer's phone (callers are authenticated). Views by others are counted. */
  async getById(id: string, viewerId: string) {
    const found = await listingRepository.findById(id);
    if (!found) throw new NotFoundError('Listing not found');

    if (found.listing.farmerId !== viewerId) {
      await listingRepository.incrementViewCount(id);
      found.listing.viewCount += 1;
    }
    return { ...toListingDto(found.listing), farmer: found.farmer, images: found.images };
  }

  async update(actor: Actor, id: string, input: UpdateListingInput) {
    const existing = await this.requireOwned(actor, id);

    const patch: Partial<NewProduceListing> = {};
    if (input.produceType !== undefined) patch.produceType = input.produceType;
    if (input.category !== undefined) patch.category = input.category;
    else if (input.produceType !== undefined) patch.category = inferCategory(input.produceType);
    if (input.quantity !== undefined) patch.quantity = String(input.quantity);
    if (input.unit !== undefined) patch.unit = input.unit;
    if (input.pricePerUnit !== undefined) patch.pricePerUnit = String(input.pricePerUnit);
    if (input.currency !== undefined) patch.currency = input.currency;
    if (input.isOrganic !== undefined) patch.isOrganic = input.isOrganic;
    if (input.description !== undefined) patch.description = input.description;
    if (input.status !== undefined) patch.status = input.status;

    if (input.location !== undefined || input.latitude !== undefined || input.longitude !== undefined) {
      const name = input.location ?? existing.location;
      const coords =
        input.latitude !== undefined && input.longitude !== undefined
          ? { latitude: input.latitude, longitude: input.longitude }
          : input.location !== undefined
            ? this.resolveCoordinates(name, undefined, undefined)
            : { latitude: Number(existing.latitude), longitude: Number(existing.longitude) };
      patch.location = name;
      patch.latitude = String(coords.latitude);
      patch.longitude = String(coords.longitude);
    }

    const from = input.availableFrom ?? existing.availableFrom;
    const to = input.availableTo ?? existing.availableTo;
    if (input.availableFrom !== undefined || input.availableTo !== undefined) {
      if (to < from) throw new BadRequestError('availableTo must be on or after availableFrom');
      patch.availableFrom = from;
      patch.availableTo = to;
    }

    const updated = await listingRepository.update(id, patch);
    return toListingDto(updated!);
  }

  async remove(actor: Actor, id: string) {
    await this.requireOwned(actor, id);
    await listingRepository.delete(id);
    await imageService.removeListingDir(id);
  }

  // ─── Images ────────────────────────────

  async addImages(actor: Actor, id: string, files: { buffer: Buffer }[]) {
    await this.requireOwned(actor, id);
    if (!files.length) throw new BadRequestError('Attach at least one image in the "images" field');

    const existing = await listingRepository.imagesFor(id);
    if (existing.length + files.length > MAX_IMAGES_PER_LISTING) {
      throw new BadRequestError(
        `A listing can have at most ${MAX_IMAGES_PER_LISTING} images (it has ${existing.length}).`
      );
    }

    const urls: string[] = [];
    try {
      for (const file of files) urls.push(await imageService.saveListingImage(id, file.buffer));
    } catch (err) {
      await Promise.all(urls.map((u) => imageService.removeByUrl(u)));
      throw err;
    }

    const start = existing.length ? Math.max(...existing.map((i) => i.sortOrder)) + 1 : 0;
    return listingRepository.addImages(
      id,
      urls.map((url, i) => ({ url, sortOrder: start + i, isPrimary: existing.length === 0 && i === 0 }))
    );
  }

  async removeImage(actor: Actor, listingId: string, imageId: string) {
    await this.requireOwned(actor, listingId);
    const image = await listingRepository.findImage(listingId, imageId);
    if (!image) throw new NotFoundError('Image not found');

    await listingRepository.deleteImage(imageId);
    await imageService.removeByUrl(image.url);

    // Keep a primary image if any remain
    if (image.isPrimary) {
      const remaining = await listingRepository.imagesFor(listingId);
      if (remaining.length) await listingRepository.setPrimaryImage(listingId, remaining[0].id);
    }
  }

  // ─── helpers ───────────────────────────

  private async requireOwned(actor: Actor, id: string) {
    const listing = await listingRepository.findRaw(id);
    if (!listing) throw new NotFoundError('Listing not found');
    if (listing.farmerId !== actor.sub && actor.role !== 'ADMIN') {
      throw new ForbiddenError('You can only change your own listings');
    }
    return listing;
  }

  /** Use explicit coordinates, else look the location up in the Ghana city table */
  private resolveCoordinates(location: string, lat?: number, lng?: number) {
    if (lat !== undefined && lng !== undefined) return { latitude: lat, longitude: lng };
    const city = findCity(location);
    if (!city) {
      throw new BadRequestError(
        `Unknown location "${location}". Send latitude and longitude, or use a known town (e.g. Accra, Kumasi, Tamale).`
      );
    }
    return { latitude: city.latitude, longitude: city.longitude };
  }
}

export const listingService = new ListingService();
