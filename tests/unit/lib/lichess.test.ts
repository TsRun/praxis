import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchExplorer, clearExplorerCache } from '../../../src/lib/lichess';

const okResponse = (body: object) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

const validChessdbReply = {
  status: 'ok',
  moves: [
    { uci: 'e2e4', san: 'e4', score: 5, rank: 2, winrate: '52.00' },
    { uci: 'd2d4', san: 'd4', score: 3, rank: 1, winrate: '51.00' },
    { uci: 'g1f3', san: 'Nf3', score: 0, rank: 0, winrate: '50.00' },
  ],
};

describe('fetchExplorer', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    clearExplorerCache();
  });

  it('hits /api/chessdb with FEN', async () => {
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(okResponse(validChessdbReply));
    await fetchExplorer({ source: 'chessdb', fen: 'startpos' });
    expect(spy).toHaveBeenCalledTimes(1);
    const url = String(spy.mock.calls[0][0]);
    expect(url).toMatch(/\/api\/chessdb/);
    expect(url).toMatch(/board=startpos/);
  });

  it('caches by FEN so a second call does not refetch', async () => {
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () => okResponse(validChessdbReply));
    await fetchExplorer({ source: 'chessdb', fen: 'X' });
    await fetchExplorer({ source: 'chessdb', fen: 'X' });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('returns empty result on non-ok chessdb status', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      okResponse({ status: 'unknown' }),
    );
    const r = await fetchExplorer({ source: 'chessdb', fen: 'Y' });
    expect(r.moves).toEqual([]);
  });

  it('throws on HTTP error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('boom', { status: 500 }),
    );
    await expect(fetchExplorer({ source: 'chessdb', fen: 'Z' })).rejects.toThrow(/500/);
  });

  it('derives white/draws/black counts so the tree has differentiation', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse(validChessdbReply));
    const r = await fetchExplorer({ source: 'chessdb', fen: 'W' });
    expect(r.moves.length).toBe(3);
    // Top-ranked move should have the most plays
    expect(r.moves[0].white + r.moves[0].draws + r.moves[0].black)
      .toBeGreaterThan(r.moves[2].white + r.moves[2].draws + r.moves[2].black);
    // Higher winrate → more white wins relative to black
    expect(r.moves[0].white).toBeGreaterThan(r.moves[0].black);
  });
});
