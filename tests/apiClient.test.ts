import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { apiClient } from '../services/apiClient';

const jsonResponse = (data: any, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });

describe('apiClient', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('deduplicates concurrent GET calls with same key', async () => {
    (fetch as any as Mock).mockResolvedValue(jsonResponse({ ok: true }));

    const [first, second] = await Promise.all([
      apiClient.get('/dedupe-test', { dedupeKey: 'same' }),
      apiClient.get('/dedupe-test', { dedupeKey: 'same' })
    ]);

    expect((fetch as any as Mock).mock.calls.length).toBe(1);
    expect(first.data.ok).toBe(true);
    expect(second.data.ok).toBe(true);
  });

  it('throws mapped error for server failures', async () => {
    (fetch as any as Mock).mockResolvedValue(new Response('fail', { status: 500 }));
    await expect(apiClient.get('/fail')).rejects.toThrow();
  });
});
