import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { AppError, RateLimitError } from '../utils/errors.js';
import { logger } from '../config/logger.js';
import { config } from '../config/index.js';

export function notFound(req: Request, _res: Response, next: NextFunction) {
  next(new AppError(404, 'NOT_FOUND', `Route not found: ${req.method} ${req.path}`));
}

const body = (code: string, message: string, details?: unknown) => ({
  success: false,
  error: { code, message, ...(details !== undefined ? { details } : {}) },
});

// Express identifies error handlers by their 4 parameters
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof RateLimitError) {
    res.setHeader('Retry-After', String(err.retryAfter));
    return res.status(429).json(body(err.code, err.message, err.details));
  }

  if (err instanceof AppError) {
    return res.status(err.statusCode).json(body(err.code, err.message, err.details));
  }

  if (err instanceof multer.MulterError) {
    const tooBig = err.code === 'LIMIT_FILE_SIZE';
    const message = tooBig
      ? 'Each image must be 5MB or smaller'
      : err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE'
        ? 'At most 5 images per upload (field name: images)'
        : err.message;
    return res.status(tooBig ? 413 : 400).json(body(tooBig ? 'FILE_TOO_LARGE' : 'BAD_UPLOAD', message));
  }

  // body-parser errors carry a status and type
  const e = err as { status?: number; type?: string };
  if (e?.type === 'entity.too.large') return res.status(413).json(body('PAYLOAD_TOO_LARGE', 'Request body is too large (10KB max)'));
  if (e?.type === 'entity.parse.failed') return res.status(400).json(body('INVALID_JSON', 'Request body is not valid JSON'));

  logger.error('Unhandled error', { path: req.path, method: req.method, error: err instanceof Error ? err.stack : err });
  return res
    .status(500)
    .json(body('INTERNAL_ERROR', config.isProd ? 'Something went wrong' : err instanceof Error ? err.message : 'Error'));
}
