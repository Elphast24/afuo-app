import { start } from './server.js';

start().catch((err) => {
  console.error('Failed to start the API:', err);
  process.exit(1);
});
