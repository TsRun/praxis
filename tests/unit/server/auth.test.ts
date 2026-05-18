import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, newToken } from '../../../server/auth';

describe('auth helpers', () => {
  it('hashPassword + verifyPassword roundtrip', async () => {
    const h = await hashPassword('hunter2');
    expect(h).not.toBe('hunter2');
    expect(await verifyPassword('hunter2', h)).toBe(true);
    expect(await verifyPassword('wrong', h)).toBe(false);
  });

  it('newToken returns a fresh 64-char hex string each call', () => {
    const a = newToken();
    const b = newToken();
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toBe(b);
  });
});
