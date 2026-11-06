import type { ProduceListing } from '../db/schema.js';

type Category = ProduceListing['category'];

/** Used to infer a category when a farmer does not send one */
const PRODUCE_CATEGORIES: Record<string, Category> = {
  tomatoes: 'VEGETABLES', onions: 'VEGETABLES', pepper: 'VEGETABLES', okra: 'VEGETABLES',
  'garden eggs': 'VEGETABLES', cabbages: 'VEGETABLES', carrots: 'VEGETABLES', cassava: 'VEGETABLES',
  yam: 'VEGETABLES', cocoyam: 'VEGETABLES', spinach: 'VEGETABLES',
  pineapples: 'FRUITS', mangoes: 'FRUITS', plantain: 'FRUITS', bananas: 'FRUITS', oranges: 'FRUITS',
  pawpaw: 'FRUITS', watermelons: 'FRUITS', avocados: 'FRUITS',
  maize: 'GRAINS', rice: 'GRAINS', sorghum: 'GRAINS', millet: 'GRAINS',
  cowpeas: 'LEGUMES', groundnuts: 'LEGUMES', soybeans: 'LEGUMES', 'bambara beans': 'LEGUMES', beans: 'LEGUMES',
  milk: 'DAIRY', eggs: 'LIVESTOCK', goats: 'LIVESTOCK', chickens: 'LIVESTOCK',
};

export function inferCategory(produceType: string): Category {
  return PRODUCE_CATEGORIES[produceType.trim().toLowerCase()] ?? 'OTHER';
}
