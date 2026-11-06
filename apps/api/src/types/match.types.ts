export interface MatchWeights {
  produce: number;
  quantity: number;
  location: number;
  price: number;
  availability: number;
}

export interface MatchQuery {
  produce?: string;
  quantity?: number;
  maxPrice?: number;
  location?: string;
  latitude?: number;
  longitude?: number;
  /** ISO date (YYYY-MM-DD) the buyer needs the produce by */
  requiredBy?: string;
  organicOnly?: boolean;
  /** Relative priorities; any scale, they are normalised to sum to 1 */
  weights?: Partial<MatchWeights>;
  limit?: number;
}

export type MatchTier = 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';

export interface MatchBreakdown {
  produceScore: number;
  quantityScore: number;
  locationScore: number;
  priceScore: number;
  availabilityScore: number;
}

export interface MatchResult {
  rank: number;
  matchScore: number;
  matchPercentage: number;
  matchTier: MatchTier;
  /** km from the buyer, or null if the buyer's location is unknown */
  distance: number | null;
  breakdown: MatchBreakdown;
  listing: {
    id: string;
    produceType: string;
    category: string;
    quantity: number;
    unit: string;
    pricePerUnit: number;
    currency: string;
    location: string;
    latitude: number;
    longitude: number;
    availableFrom: string;
    availableTo: string;
    isOrganic: boolean;
    description: string | null;
    farmer: { id: string; name: string | null; phone: string; avatarUrl: string | null };
  };
}
