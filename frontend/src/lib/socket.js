/*
  Realtime connection (Socket.IO). Connects while signed in, using the same auth cookie as the REST API.
  Components subscribe with onSocket('message:new', handler) and get an unsubscribe function back.
*/
import { io } from 'socket.io-client';
import { writable, get } from 'svelte/store';
import { api, refresh } from './api.js';
import { session } from './auth.js';
import { showToast } from './toast.js';

let socket = null;
const handlers = new Map();

/** Total unread messages across conversations (shown on the nav) */
export const unreadTotal = writable(0);
/** The conversation currently open in the chat view, so its messages are not counted as unread */
export const activeConversationId = writable(null);

export function onSocket(event, handler) {
  if (!handlers.has(event)) handlers.set(event, new Set());
  handlers.get(event).add(handler);
  return () => handlers.get(event)?.delete(handler);
}

export async function refreshUnread() {
  try {
    const { conversations } = await api.conversations.list();
    unreadTotal.set(conversations.reduce((n, c) => n + c.unreadCount, 0));
  } catch {
    /* the badge is a nicety */
  }
}

function connect() {
  if (socket) return;
  socket = io({ withCredentials: true, transports: ['websocket', 'polling'] });

  socket.onAny((event, ...args) => handlers.get(event)?.forEach((h) => h(...args)));

  socket.on('message:new', (message) => {
    const me = get(session);
    if (!me || message.senderId === me.id) return;
    if (get(activeConversationId) === message.conversationId) return;
    unreadTotal.update((n) => n + 1);
    showToast('New message', 'info');
  });

  // The access cookie may have expired while connected: refresh it and try again once
  socket.on('connect_error', async (err) => {
    if (err.message === 'UNAUTHORIZED' && (await refresh())) socket?.connect();
  });
}

function disconnect() {
  socket?.close();
  socket = null;
  unreadTotal.set(0);
}

// Follow the session: connect when signed in, disconnect when signed out
session.subscribe((user) => {
  if (user) {
    connect();
    refreshUnread();
  } else {
    disconnect();
  }
});
