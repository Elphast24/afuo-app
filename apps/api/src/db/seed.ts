/*
  Sample data for development: Ghanaian farmers, buyers and listings, plus six months of past listings
  so the price-history analytics have something to show. Clears existing data first (dev only).

  Note: the embedded database allows one process at a time, so stop the API before seeding.
*/
import { closeDb, db, runMigrations } from './index.js';
import { conversations, listingImages, messages, produceListings, refreshTokens, reviews, users } from './schema.js';
import { findCity } from '../utils/ghana.js';
import { adminService } from '../services/admin.service.js';
import { config } from '../config/index.js';
import { inferCategory } from '../utils/categories.js';
import type { NewProduceListing } from './schema.js';

if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to seed in production.');
  process.exit(1);
}

await runMigrations();

console.log('Seeding database...');

await db.delete(messages);
await db.delete(conversations);
await db.delete(reviews);
await db.delete(listingImages);
await db.delete(produceListings);
await db.delete(refreshTokens);
await db.delete(users);

const coords = (name: string) => {
  const c = findCity(name)!;
  return { location: name, latitude: String(c.latitude), longitude: String(c.longitude) };
};

const [kwame, ama, kofi, akosua, yaw] = await db
  .insert(users)
  .values([
    { phone: '+233241234567', name: 'Kwame Mensah', role: 'FARMER', phoneVerified: true, ...coords('Techiman') },
    { phone: '+233242345678', name: 'Ama Serwaa', role: 'FARMER', phoneVerified: true, ...coords('Tamale') },
    { phone: '+233243456789', name: 'Kofi Boateng', role: 'FARMER', phoneVerified: true, ...coords('Kumasi') },
    { phone: '+233244567890', name: 'Akosua Owusu', role: 'FARMER', phoneVerified: true, ...coords('Accra') },
    { phone: '+233245678901', name: 'Yaw Asante', role: 'FARMER', phoneVerified: true, ...coords('Wa') },
    { phone: '+233501234567', name: 'Efua Quaye', role: 'BUYER', phoneVerified: true, ...coords('Accra') },
    { phone: '+233502345678', name: 'Nana Adjei', role: 'BUYER', phoneVerified: true, ...coords('Kumasi') },
  ])
  .returning();

const day = 86_400_000;
const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * day).toISOString().slice(0, 10);

type Seed = Pick<NewProduceListing, 'produceType' | 'quantity' | 'unit' | 'pricePerUnit' | 'isOrganic' | 'description'> & {
  farmer: typeof kwame;
  town: string;
};

const current: Seed[] = [
  { farmer: kwame, town: 'Techiman', produceType: 'Tomatoes', quantity: '800', unit: 'KG', pricePerUnit: '22', isOrganic: false, description: 'Firm Grade A tomatoes from Techiman market gardens' },
  { farmer: kwame, town: 'Techiman', produceType: 'Maize', quantity: '60', unit: 'BAGS_90KG', pricePerUnit: '480', isOrganic: false, description: 'Dry white maize, 12% moisture' },
  { farmer: ama, town: 'Tamale', produceType: 'Maize', quantity: '120', unit: 'BAGS_90KG', pricePerUnit: '455', isOrganic: true, description: 'Organic yellow maize from the Northern Region' },
  { farmer: ama, town: 'Tamale', produceType: 'Groundnuts', quantity: '500', unit: 'KG', pricePerUnit: '26', isOrganic: true, description: 'Shelled groundnuts, sun dried' },
  { farmer: ama, town: 'Tamale', produceType: 'Cowpeas', quantity: '400', unit: 'KG', pricePerUnit: '19', isOrganic: false, description: 'Black-eyed cowpeas for waakye' },
  { farmer: kofi, town: 'Kumasi', produceType: 'Plantain', quantity: '300', unit: 'BUNCHES', pricePerUnit: '38', isOrganic: false, description: 'Apem plantain, harvested weekly' },
  { farmer: kofi, town: 'Kumasi', produceType: 'Cassava', quantity: '2000', unit: 'KG', pricePerUnit: '4', isOrganic: false, description: 'Fresh cassava roots' },
  { farmer: kofi, town: 'Kumasi', produceType: 'Pepper', quantity: '250', unit: 'KG', pricePerUnit: '32', isOrganic: false, description: 'Hot pepper, red and green' },
  { farmer: akosua, town: 'Accra', produceType: 'Okra', quantity: '150', unit: 'KG', pricePerUnit: '14', isOrganic: true, description: 'Fresh organic okra, picked daily' },
  { farmer: akosua, town: 'Accra', produceType: 'Garden Eggs', quantity: '200', unit: 'KG', pricePerUnit: '11', isOrganic: false, description: 'Local garden eggs' },
  { farmer: akosua, town: 'Accra', produceType: 'Pineapples', quantity: '1500', unit: 'PIECES', pricePerUnit: '8', isOrganic: false, description: 'Sweet MD2 pineapples for export or juice' },
  { farmer: yaw, town: 'Wa', produceType: 'Rice', quantity: '90', unit: 'BAGS_90KG', pricePerUnit: '620', isOrganic: false, description: 'Locally milled rice, stone free' },
];

await db.insert(produceListings).values(
  current.map((s) => ({
    farmerId: s.farmer.id,
    produceType: s.produceType,
    category: inferCategory(s.produceType),
    quantity: s.quantity,
    unit: s.unit,
    pricePerUnit: s.pricePerUnit,
    ...coords(s.town),
    availableFrom: iso(-5),
    availableTo: iso(45),
    isOrganic: s.isOrganic,
    description: s.description,
  }))
);

// Six months of past (sold) listings so /analytics/prices/:produce shows a trend
const history = [
  { farmer: kwame, town: 'Techiman', produceType: 'Tomatoes', unit: 'KG' as const, base: 22, drift: [-3, 1, -2, 2, 0] },
  { farmer: ama, town: 'Tamale', produceType: 'Maize', unit: 'BAGS_90KG' as const, base: 455, drift: [-30, -10, 10, 25, 15] },
  { farmer: kofi, town: 'Kumasi', produceType: 'Plantain', unit: 'BUNCHES' as const, base: 38, drift: [-4, -2, 0, 3, 1] },
];

const past: NewProduceListing[] = [];
for (const h of history) {
  h.drift.forEach((delta, i) => {
    const monthsAgo = 5 - i;
    const when = new Date(Date.now() - monthsAgo * 30 * day);
    past.push({
      farmerId: h.farmer.id,
      produceType: h.produceType,
      category: inferCategory(h.produceType),
      quantity: '300',
      unit: h.unit,
      pricePerUnit: String(h.base + delta),
      ...coords(h.town),
      availableFrom: when.toISOString().slice(0, 10),
      availableTo: new Date(when.getTime() + 20 * day).toISOString().slice(0, 10),
      status: 'SOLD',
      createdAt: when,
      updatedAt: when,
    });
  });
}
await db.insert(produceListings).values(past);

await adminService.ensureAdmin();

console.log(`Seeded ${7} users, ${current.length} active listings and ${past.length} past listings.`);
console.log('\nSign in (the OTP is printed in the server log):');
console.log('  Farmer: 024 123 4567   (Kwame Mensah, Techiman)');
console.log('  Buyer:  050 123 4567   (Efua Quaye, Accra)');
if (config.admin.password) {
  console.log('\nAdmin dashboard (/admin/login):');
  console.log(`  Username: ${config.admin.username}`);
  console.log(`  Password: ${config.admin.usingDevPassword ? config.admin.password : '(your ADMIN_PASSWORD)'}`);
}

await closeDb();
