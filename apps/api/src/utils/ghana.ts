export interface City {
  name: string;
  region: string;
  latitude: number;
  longitude: number;
}

/** Major Ghanaian market towns; used to resolve a location name to coordinates */
export const GHANA_CITIES: City[] = [
  { name: 'Accra', region: 'Greater Accra', latitude: 5.6037, longitude: -0.187 },
  { name: 'Tema', region: 'Greater Accra', latitude: 5.6698, longitude: -0.0166 },
  { name: 'Kumasi', region: 'Ashanti', latitude: 6.6885, longitude: -1.6244 },
  { name: 'Tamale', region: 'Northern', latitude: 9.4034, longitude: -0.8424 },
  { name: 'Takoradi', region: 'Western', latitude: 4.8845, longitude: -1.7554 },
  { name: 'Cape Coast', region: 'Central', latitude: 5.1053, longitude: -1.2466 },
  { name: 'Sunyani', region: 'Bono', latitude: 7.3349, longitude: -2.3123 },
  { name: 'Techiman', region: 'Bono East', latitude: 7.5833, longitude: -1.9333 },
  { name: 'Ho', region: 'Volta', latitude: 6.6008, longitude: 0.4713 },
  { name: 'Koforidua', region: 'Eastern', latitude: 6.0784, longitude: -0.2713 },
  { name: 'Wa', region: 'Upper West', latitude: 10.0601, longitude: -2.5099 },
  { name: 'Bolgatanga', region: 'Upper East', latitude: 10.7856, longitude: -0.8514 },
];

export function findCity(name: string | undefined | null): City | undefined {
  if (!name) return undefined;
  const n = name.trim().toLowerCase();
  return GHANA_CITIES.find((c) => c.name.toLowerCase() === n);
}
