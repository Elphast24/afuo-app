import { runMigrations, closeDb } from './index.js';

console.log('Running migrations...');
await runMigrations();
console.log('Migrations applied.');
await closeDb();
