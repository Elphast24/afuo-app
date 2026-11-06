import path from 'node:path';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { config } from './config/index.js';
import { logger } from './config/logger.js';
import { v1 } from './routes/index.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';

export function createApp() {
  const app = express();

  // Behind a proxy in production (Railway/Fly): trust one hop so req.ip is the client
  if (config.isProd) app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(
    helmet({
      // Listing images are loaded by the web app from another origin
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  );
  app.use(cors({ origin: config.corsOrigins, credentials: true }));
  if (!config.isTest) {
    app.use(morgan('tiny', { stream: { write: (line) => logger.http(line.trim()) } }));
  }
  app.use(express.json({ limit: '10kb' }));
  app.use(cookieParser());

  // Processed listing images
  app.use('/uploads', express.static(path.resolve(config.uploadDir), { maxAge: '7d', index: false }));

  app.use('/v1', v1);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
