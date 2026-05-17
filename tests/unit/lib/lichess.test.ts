import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchExplorer, clearExplorerCache } from '../../../src/lib/lichess';

const okResponse = (body: object) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });

describe('fetchExplorer', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    clearExplorerCache();
  });

  it('hits /masters when source=masters with the FEN', async () => {
    const spy = vi.spyOn(global, 'fetch').mockResolvedValue(
      okResponse({ white: 1, draws: 1, black: 1, moves: [] }),
    );
    await fetchExplorer({ source: 'masters', fen: 'startpos' });
    expect(spy).toHaveBeenCalledTimes(1);
    const url = String(spy.mock.calls[0][0]);
    expect(url).toMatch(/explorer\.lichess\.ovh\/masters/);
    expect(url).toMatch(/fen=startpos/);
  });

  it('hits /lichess when source=lichess', async () => {
    const spy = vi.spyOn(global, 'fetch').mockResolvedValue(
      okResponse({ white: 0, draws: 0, black: 0, moves: [] }),
    );
    await fetchExplorer({ source: 'lichess', fen: 'startpos' });
    const url = String(spy.mock.calls[0][0]);
    expect(url).toMatch(/explorer\.lichess\.ovh\/lichess/);
  });

  it('caches by (source,fen) so a second call does not refetch', async () => {
    const spy = vi.spyOn(global, 'fetch').mockResolvedValue(
      okResponse({ white: 0, draws: 0, black: 0, moves: [] }),
    );
    await fetchExplorer({ source: 'masters', fen: 'X' });
    await fetchExplorer({ source: 'masters', fen: 'X' });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('differentiates cache by source', async () => {
    const spy = vi.spyOn(global, 'fetch').mockImplementation(
      async () => okResponse({ white: 0, draws: 0, black: 0, moves: [] }),
    );
    await fetchExplorer({ source: 'masters', fen: 'Y' });
    await fetchExplorer({ source: 'lichess', fen: 'Y' });
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('throws on non-OK response', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(new Response('rate limited', { status: 429 }));
    await expect(fetchExplorer({ source: 'masters', fen: 'Z' })).rejects.toThrow(/429/);
  });
});
