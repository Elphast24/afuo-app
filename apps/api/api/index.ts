/*
  Vercel serverless entry. Vercel cannot run src/index.ts (it starts its own long-lived server), so this wraps the same
  Express app as a request handler. Needs DATABASE_URL (Neon) and the UPSTASH_* variables: the embedded database and the
  in-process key-value store do not work across serverless instances.
  Not available here: live chat over Socket.IO (messages still save, clients just do not get pushed updates) and
  durable image storage (uploads go to /tmp and disappear).
*/
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createApp } from '../src/app.js';
import { runMigrations } from '../src/db/index.js';
import { adminService } from '../src/services/admin.service.js';

let ready: Promise<ReturnType<typeof createApp>> | undefined;

function boot() {
  return (async () => {
    await runMigrations();
    await adminService.ensureAdmin();
    return createApp();
  })();
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    ready ??= boot();
    const app = await ready;
    app(req as never, res as never);
  } catch (err) {
    ready = undefined; // try again on the next request
    console.error('API failed to start:', err);
    res.statusCode = 500;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ success: false, error: { code: 'STARTUP_FAILED', message: 'The API could not start.' } }));
  }
}
