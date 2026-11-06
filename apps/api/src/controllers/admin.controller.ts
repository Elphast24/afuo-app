import type { Request, Response } from 'express';
import { adminService } from '../services/admin.service.js';
import { setAuthCookies } from './auth.controller.js';
import { userRepository, toProfile } from '../repositories/user.repository.js';
import { NotFoundError } from '../utils/errors.js';

export const adminController = {
  async login(req: Request, res: Response) {
    const { user, tokens } = await adminService.login(req.body.username, req.body.password);
    setAuthCookies(res, tokens);
    res.json({ success: true, data: { user, tokens } });
  },

  async changePassword(req: Request, res: Response) {
    const tokens = await adminService.changePassword(req.user!.sub, req.body.currentPassword, req.body.newPassword);
    setAuthCookies(res, tokens);
    res.json({ success: true, message: 'Password changed. Other sessions were signed out.', data: { tokens } });
  },

  async me(req: Request, res: Response) {
    const user = await userRepository.findById(req.user!.sub);
    if (!user) throw new NotFoundError('User not found');
    res.json({ success: true, data: { user: { ...toProfile(user), username: user.username } } });
  },

  async stats(_req: Request, res: Response) {
    res.json({ success: true, data: await adminService.stats() });
  },

  async users(req: Request, res: Response) {
    res.json({ success: true, data: await adminService.listUsers(req.query as never) });
  },

  async updateUser(req: Request<{ id: string }>, res: Response) {
    res.json({ success: true, data: { user: await adminService.updateUser(req.user!.sub, req.params.id, req.body) } });
  },

  async listings(req: Request, res: Response) {
    res.json({ success: true, data: await adminService.listListings(req.query as never) });
  },

  async setListingStatus(req: Request<{ id: string }>, res: Response) {
    res.json({ success: true, data: { listing: await adminService.setListingStatus(req.params.id, req.body.status) } });
  },

  async deleteListing(req: Request<{ id: string }>, res: Response) {
    await adminService.deleteListing(req.user!.sub, req.params.id);
    res.json({ success: true, message: 'Listing deleted' });
  },
};
