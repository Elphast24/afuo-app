/*
  Realtime hub (Socket.IO). Each signed-in user joins a private room "user:{id}".
  Services call realtime.emitToUsers(...); it is a no-op until attach() has run (e.g. in unit tests).
*/
import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { config } from '../config/index.js';
import { logger } from '../config/logger.js';
import { authService } from '../services/auth.service.js';

function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return undefined;
}

class Realtime {
  private io: Server | null = null;

  attach(server: HttpServer) {
    const io = new Server(server, {
      cors: { origin: config.corsOrigins, credentials: true },
    });

    // Same JWT as the REST API: access-token cookie, or handshake auth { token }
    io.use((socket, next) => {
      try {
        const token =
          (socket.handshake.auth?.token as string | undefined) ??
          readCookie(socket.handshake.headers.cookie, 'accessToken');
        if (!token) return next(new Error('UNAUTHORIZED'));
        socket.data.user = authService.verifyAccessToken(token);
        next();
      } catch {
        next(new Error('UNAUTHORIZED'));
      }
    });

    io.on('connection', (socket) => {
      socket.join(`user:${socket.data.user.sub}`);
      logger.debug(`socket connected: ${socket.data.user.sub}`);
    });

    this.io = io;
    return io;
  }

  emitToUsers(userIds: string[], event: string, payload: unknown) {
    if (!this.io) return;
    for (const id of new Set(userIds)) this.io.to(`user:${id}`).emit(event, payload);
  }

  async close() {
    await this.io?.close();
    this.io = null;
  }
}

export const realtime = new Realtime();
