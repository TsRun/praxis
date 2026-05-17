import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchExplorer, clearExplorerCache } from '../../../src/lib/lichess';

const okResponse = (body: object) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

const validReply = {
  fen: 'startpos',
  epd: 'startpos',
  games: 100,
  white: 40,
  draws: 25,
  black: 35,
  moves: [
    {
      uci: 'e2e4',
      san: 'e4',
      child_fen: 'after-e4',
      games: 50,
      white: 22,
      draws: 12,
      black: 16,
      avg_elo: 2200,
    },
  ],
};

describe('fetchExplorer', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    clearExplorerCache();
  });

  it('hits /api/explorer with FEN', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse(validReply));
    await fetchExplorer({ source: 'otb', fen: 'startpos' });
    expect(spy).toHaveBeenCalledTimes(1);
    const url = String(spy.mock.calls[0][0]);
    expect(url).toMatch(/\/api\/explorer/);
    expect(url).toMatch(/fen=startpos/);
  });

  it('caches by FEN so a second call does not refetch', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => okResponse(validReply));
    await fetchExplorer({ source: 'otb', fen: 'X' });
    await fetchExplorer({ source: 'otb', fen: 'X' });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('throws on HTTP error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('boom', { status: 500 }));
    await expect(fetchExplorer({ source: 'otb', fen: 'Z' })).rejects.toThrow(/500/);
  });

  it('returns parsed moves with avg_elo and per-side counts', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse(validReply));
    const r = await fetchExplorer({ source: 'otb', fen: 'W' });
    expect(r.moves).toHaveLength(1);
    expect(r.moves[0].san).toBe('e4');
    expect(r.moves[0].avg_elo).toBe(2200);
    expect(r.games).toBe(100);
  });
});
