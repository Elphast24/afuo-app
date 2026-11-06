import type { AccessPayload } from '../services/auth.service.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Set by the authenticate middleware */
      user?: AccessPayload;
    }
  }
}

export {};
