import { describe, expect, it } from 'vitest';

import { GET } from './route';

describe('GET /health', () => {
  it('retorna status ok com status HTTP 200', async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: 'ok' });
  });
});
