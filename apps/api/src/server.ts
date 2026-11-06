import http from 'node:http';
import { createApp } from './app.js';
import { config } from './config/index.js';
import { logger } from './config/logger.js';
import { closeDb, runMigrations } from './db/index.js';
import { realtime } from './websocket/index.js';
import { adminService } from './services/admin.service.js';

export async function start() {
  await runMigrations();
  await adminService.ensureAdmin();

  const app = createApp();
  const server = http.createServer(app);
  realtime.attach(server);

  await new Promise<void>((resolve) => server.listen(config.port, resolve));
  logger.info(`AgriMatch API listening on http://localhost:${config.port}/v1 (${config.env})`);

  const shutdown = async (signal: string) => {
    logger.info(`${signal} received, shutting down`);
    server.close();
    await realtime.close();
    await closeDb();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  return server;
}
