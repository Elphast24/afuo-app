import { Router } from 'express';
import { config } from '../config/index.js';
import { authenticate, authorize, requireAdmin } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { uploadListingImages } from '../middleware/upload.js';
import { authController } from '../controllers/auth.controller.js';
import { listingController } from '../controllers/listing.controller.js';
import { adminController } from '../controllers/admin.controller.js';
import {
  analyticsController,
  conversationController,
  matchController,
  reviewController,
} from '../controllers/market.controller.js';
import { refreshSchema, sendOtpSchema, updateMeSchema, verifyOtpSchema } from '../validations/auth.js';
import {
  createListingSchema,
  listingImageParams,
  listingQuerySchema,
  updateListingSchema,
} from '../validations/listing.js';
import { matchSchema } from '../validations/match.js';
import {
  adminListingStatusSchema,
  adminListingsQuerySchema,
  adminLoginSchema,
  adminUpdateUserSchema,
  adminUsersQuerySchema,
  changePasswordSchema,
} from '../validations/admin.js';
import {
  createReviewSchema,
  messagesQuerySchema,
  priceHistoryQuerySchema,
  produceParam,
  sendMessageSchema,
  startConversationSchema,
  userIdParam,
} from '../validations/messaging.js';
import { uuidParam } from '../validations/common.js';
import { dbKind } from '../db/index.js';

const { windowSeconds, general, otp } = config.rateLimit;

export const v1 = Router();

// ─── Public ──────────────────────────────

v1.get('/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok', database: dbKind, uptime: Math.round(process.uptime()) } });
});

const auth = Router();
const otpLimit = rateLimit({ name: 'otp', max: otp, windowSeconds });
auth.post('/otp/send', otpLimit, validate({ body: sendOtpSchema }), authController.sendOtp);
auth.post('/otp/verify', otpLimit, validate({ body: verifyOtpSchema }), authController.verifyOtp);
auth.post('/refresh', validate({ body: refreshSchema }), authController.refresh);
auth.post('/logout', validate({ body: refreshSchema }), authController.logout);
auth.get('/me', authenticate, authController.me);
auth.patch('/me', authenticate, validate({ body: updateMeSchema }), authController.updateMe);
v1.use('/auth', auth);

// Admin sign-in is public but tightly limited per IP (and per username, see AdminService)
v1.post('/admin/auth/login', rateLimit({ name: 'admin-login', max: config.isTest ? 1_000_000 : 10, windowSeconds }), validate({ body: adminLoginSchema }), adminController.login);

// ─── Protected (everything below needs a valid access token) ───

v1.use(authenticate, rateLimit({ name: 'api', max: general, windowSeconds }));

const listings = Router();
listings.post('/', authorize('FARMER'), validate({ body: createListingSchema }), listingController.create);
listings.get('/', validate({ query: listingQuerySchema }), listingController.list);
// "/my" must be registered before "/:id" or it would be read as an id
listings.get('/my', authorize('FARMER'), listingController.mine);
listings.get('/:id', validate({ params: uuidParam }), listingController.get);
listings.patch('/:id', authorize('FARMER'), validate({ params: uuidParam, body: updateListingSchema }), listingController.update);
listings.delete('/:id', authorize('FARMER'), validate({ params: uuidParam }), listingController.remove);
listings.post('/:id/images', authorize('FARMER'), validate({ params: uuidParam }), uploadListingImages, listingController.addImages);
listings.delete('/:id/images/:imgId', authorize('FARMER'), validate({ params: listingImageParams }), listingController.removeImage);
v1.use('/listings', listings);

v1.post('/match', validate({ body: matchSchema }), matchController.match);

const analytics = Router();
analytics.get('/summary', analyticsController.summary);
analytics.get('/prices', analyticsController.prices);
analytics.get('/prices/:produce', validate({ params: produceParam, query: priceHistoryQuerySchema }), analyticsController.priceHistory);
analytics.get('/locations', analyticsController.locations);
analytics.get('/insights', analyticsController.insights);
v1.use('/analytics', analytics);

const conversations = Router();
conversations.post('/', validate({ body: startConversationSchema }), conversationController.start);
conversations.get('/', conversationController.list);
conversations.get('/:id/messages', validate({ params: uuidParam, query: messagesQuerySchema }), conversationController.messages);
conversations.post('/:id/messages', validate({ params: uuidParam, body: sendMessageSchema }), conversationController.send);
conversations.patch('/:id/read', validate({ params: uuidParam }), conversationController.markRead);
v1.use('/conversations', conversations);

const reviews = Router();
reviews.post('/', validate({ body: createReviewSchema }), reviewController.create);
reviews.get('/users/:userId', validate({ params: userIdParam }), reviewController.forUser);
v1.use('/reviews', reviews);

// ─── Admin dashboard (ADMIN role only) ───

const admin = Router();
admin.use(requireAdmin);
admin.get('/me', adminController.me);
admin.post('/password', validate({ body: changePasswordSchema }), adminController.changePassword);
admin.get('/stats', adminController.stats);
admin.get('/users', validate({ query: adminUsersQuerySchema }), adminController.users);
admin.patch('/users/:id', validate({ params: uuidParam, body: adminUpdateUserSchema }), adminController.updateUser);
admin.get('/listings', validate({ query: adminListingsQuerySchema }), adminController.listings);
admin.patch('/listings/:id', validate({ params: uuidParam, body: adminListingStatusSchema }), adminController.setListingStatus);
admin.delete('/listings/:id', validate({ params: uuidParam }), adminController.deleteListing);
v1.use('/admin', admin);
