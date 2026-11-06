/** Display helpers + the vocabularies the API uses */

export const UNITS = {
  KG: { label: 'Kilograms (kg)', short: 'kg', per: 'kg' },
  TONS: { label: 'Tons', short: 'tons', per: 'ton' },
  CRATES: { label: 'Crates', short: 'crates', per: 'crate' },
  BAGS_90KG: { label: 'Bags (90kg)', short: 'bags', per: 'bag' },
  PIECES: { label: 'Pieces', short: 'pieces', per: 'piece' },
  LITRES: { label: 'Litres', short: 'litres', per: 'litre' },
  BUNCHES: { label: 'Bunches', short: 'bunches', per: 'bunch' }
};

export const unitLabel = (u) => UNITS[u]?.short ?? String(u).toLowerCase();
export const perUnit = (u) => UNITS[u]?.per ?? String(u).toLowerCase();

export const CATEGORIES = {
  VEGETABLES: 'Vegetables',
  FRUITS: 'Fruits',
  GRAINS: 'Grains',
  LEGUMES: 'Legumes',
  DAIRY: 'Dairy',
  LIVESTOCK: 'Livestock',
  OTHER: 'Other'
};

/** Produce offered in the pickers, grouped by the API's categories */
export const PRODUCE = {
  VEGETABLES: ['Tomatoes', 'Onions', 'Pepper', 'Okra', 'Garden Eggs', 'Cabbages', 'Carrots', 'Cassava', 'Yam'],
  FRUITS: ['Pineapples', 'Mangoes', 'Plantain', 'Oranges', 'Pawpaw', 'Watermelons'],
  GRAINS: ['Maize', 'Rice', 'Sorghum', 'Millet'],
  LEGUMES: ['Cowpeas', 'Groundnuts', 'Soybeans', 'Bambara Beans']
};
export const ALL_PRODUCE = Object.values(PRODUCE).flat();

export const categoryOf = (produce) =>
  Object.entries(PRODUCE).find(([, list]) => list.includes(produce))?.[0] ?? 'OTHER';

/** Major Ghanaian market towns (same table the API uses to resolve coordinates) */
export const CITIES = [
  'Accra', 'Kumasi', 'Tamale', 'Takoradi', 'Cape Coast', 'Sunyani',
  'Techiman', 'Ho', 'Koforidua', 'Wa', 'Bolgatanga', 'Tema'
];

export function money(amount, currency = 'GHS') {
  const n = Number(amount);
  return `${currency} ${n.toLocaleString('en-GH', { maximumFractionDigits: 2 })}`;
}

/** 'YYYY-MM-DD' -> '5 Nov 2026' */
export function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(`${String(iso).slice(0, 10)}T00:00:00`);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function timeAgo(value) {
  const then = new Date(value).getTime();
  const secs = Math.round((Date.now() - then) / 1000);
  if (secs < 60) return 'just now';
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days} d ago`;
  return new Date(then).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export const clockTime = (value) =>
  new Date(value).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

export const monthLabel = (ym) =>
  new Date(`${ym}-01T00:00:00`).toLocaleDateString('en-GB', { month: 'short' });

export const today = (offsetDays = 0) =>
  new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);

export const initials = (name) =>
  String(name || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');
