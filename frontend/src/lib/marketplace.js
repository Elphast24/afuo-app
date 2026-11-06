/** Storefront helpers: category look-and-feel and which photo to show for a listing */
import { assetUrl } from './api.js';

export const CATEGORY_META = {
  VEGETABLES: { label: 'Vegetables', tint: 'var(--tint-green)', image: '/images/market/vegetables.jpg' },
  FRUITS: { label: 'Fruits', tint: 'var(--tint-butter)', image: '/images/market/fruits.jpg' },
  GRAINS: { label: 'Grains', tint: 'var(--tint-peach)', image: '/images/market/grains.jpg' },
  LEGUMES: { label: 'Legumes', tint: 'var(--tint-sky)', image: '/images/market/legumes.jpg' },
  DAIRY: { label: 'Dairy', tint: 'var(--tint-gray)', image: '/images/market/dairy.jpg' },
  LIVESTOCK: { label: 'Livestock', tint: 'var(--tint-peach)', image: '/images/market/livestock.jpg' },
  OTHER: { label: 'Other produce', tint: 'var(--tint-gray)', image: '/images/market/other.jpg' }
};

export const CATEGORY_KEYS = Object.keys(CATEGORY_META);

// Produce that has its own stock photo; everything else falls back to its category photo
const PRODUCE_IMAGES = {
  tomatoes: 'tomatoes',
  maize: 'maize',
  plantain: 'plantain',
  pineapples: 'pineapples',
  cassava: 'cassava',
  yam: 'yam'
};

export const categoryMeta = (category) => CATEGORY_META[category] ?? CATEGORY_META.OTHER;

/** The farmer's own photo if there is one, otherwise a stock photo of that produce or category */
export function listingImage(listing) {
  if (listing.imageUrl) return assetUrl(listing.imageUrl);
  const own = listing.images?.find((i) => i.isPrimary)?.url ?? listing.images?.[0]?.url;
  if (own) return assetUrl(own);
  const stock = PRODUCE_IMAGES[String(listing.produceType).trim().toLowerCase()];
  return stock ? `/images/market/${stock}.jpg` : categoryMeta(listing.category).image;
}

export const isRecent = (createdAt, days = 3) => Date.now() - new Date(createdAt).getTime() < days * 86_400_000;
