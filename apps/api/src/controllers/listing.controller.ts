import type { Request, Response } from 'express';
import { listingService } from '../services/listing.service.js';

export const listingController = {
  async create(req: Request, res: Response) {
    const listing = await listingService.create(req.user!, req.body);
    res.status(201).json({ success: true, data: { listing } });
  },

  async list(req: Request, res: Response) {
    const data = await listingService.list(req.query as never);
    res.json({ success: true, data });
  },

  async mine(req: Request, res: Response) {
    const listings = await listingService.mine(req.user!.sub);
    res.json({ success: true, data: { listings } });
  },

  async get(req: Request<{ id: string }>, res: Response) {
    const listing = await listingService.getById(req.params.id, req.user!.sub);
    res.json({ success: true, data: { listing } });
  },

  async update(req: Request<{ id: string }>, res: Response) {
    const listing = await listingService.update(req.user!, req.params.id, req.body);
    res.json({ success: true, data: { listing } });
  },

  async remove(req: Request<{ id: string }>, res: Response) {
    await listingService.remove(req.user!, req.params.id);
    res.json({ success: true, message: 'Listing deleted' });
  },

  async addImages(req: Request<{ id: string }>, res: Response) {
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    const images = await listingService.addImages(req.user!, req.params.id, files);
    res.status(201).json({ success: true, data: { images } });
  },

  async removeImage(req: Request<{ id: string; imgId: string }>, res: Response) {
    await listingService.removeImage(req.user!, req.params.id, req.params.imgId);
    res.json({ success: true, message: 'Image removed' });
  },
};
