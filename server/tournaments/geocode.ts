import { parseGeocodeContext } from './parse.js';

export interface GeoResult {
  lat: number | null;
  lon: number | null;
  region: string | null;
  department: string | null;
  resolved: boolean;
}

export interface GeoCache {
  get(query: string): Promise<GeoResult | null>;
  put(query: string, value: GeoResult): Promise<void>;
}

const MISS: GeoResult = { lat: null, lon: null, region: null, department: null, resolved: false };

/**
 * Geocode a French city to lat/lon + region/department using the free, key-less
 * official French address API. Results (hits AND misses) are memoized via the
 * injected cache so re-ingests don't re-hit the API. France-only for now;
 * worldwide rows keep NULL coords until a global geocoder is added.
 */
export async function geocodeCity(
  city: string,
  cache: GeoCache,
  fetchFn: typeof fetch = fetch,
): Promise<GeoResult> {
  const query = city.trim().toLowerCase();
  if (!query) return MISS;

  const hit = await cache.get(query);
  if (hit) return hit;

  let result: GeoResult = { ...MISS };
  try {
    const url = `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(city)}&type=municipality&limit=1`;
    const res = await fetchFn(url, { headers: { 'User-Agent': 'praxis-tournaments/1.0' } });
    if (res.ok) {
      const data = (await res.json()) as {
        features?: { geometry?: { coordinates?: [number, number] }; properties?: { context?: string } }[];
      };
      const f = data.features?.[0];
      if (f?.geometry?.coordinates) {
        const [lon, lat] = f.geometry.coordinates;
        const { region, department } = parseGeocodeContext(f.properties?.context ?? '');
        result = { lat, lon, region, department, resolved: true };
      }
    }
  } catch {
    // network error: leave unresolved, still cache as miss to avoid hammering
  }
  await cache.put(query, result);
  return result;
}
