import { describe, it, expect, vi } from 'vitest';
import { geocodeCity, type GeoResult } from './geocode.js';

const apiResponse = {
  features: [{
    geometry: { coordinates: [-1.1, 49.1] },
    properties: { context: '50, Manche, Normandie' },
  }],
};

describe('geocodeCity', () => {
  it('returns coords + region from the address API and caches them', async () => {
    const cache = new Map<string, GeoResult>();
    const fetchFn = vi.fn().mockResolvedValue({ ok: true, json: async () => apiResponse });
    const r = await geocodeCity('AGNEAUX', {
      get: async (q) => cache.get(q) ?? null,
      put: async (q, v) => { cache.set(q, v); },
    }, fetchFn as unknown as typeof fetch);
    expect(r).toEqual({ lat: 49.1, lon: -1.1, region: 'Normandie', department: 'Manche (50)', resolved: true });
    expect(cache.get('agneaux')?.resolved).toBe(true);
  });

  it('does not call the API on a cache hit', async () => {
    const cached: GeoResult = { lat: 1, lon: 2, region: 'X', department: 'Y', resolved: true };
    const fetchFn = vi.fn();
    const r = await geocodeCity('Paris', { get: async () => cached, put: async () => {} }, fetchFn as unknown as typeof fetch);
    expect(r).toEqual(cached);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('caches a miss when the API has no match', async () => {
    const cache = new Map<string, GeoResult>();
    const fetchFn = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ features: [] }) });
    const r = await geocodeCity('Nowhereville', {
      get: async (q) => cache.get(q) ?? null,
      put: async (q, v) => { cache.set(q, v); },
    }, fetchFn as unknown as typeof fetch);
    expect(r.resolved).toBe(false);
    expect(cache.get('nowhereville')?.resolved).toBe(false);
  });
});
