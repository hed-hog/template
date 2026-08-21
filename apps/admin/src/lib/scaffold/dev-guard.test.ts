import { afterEach, describe, expect, it, vi } from 'vitest';

const resolveMonorepoRoot = vi.hoisted(() => vi.fn());

vi.mock('./paths', () => ({ resolveMonorepoRoot }));

function setNodeEnv(value: string) {
  vi.stubEnv('NODE_ENV', value as 'development' | 'production' | 'test');
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  resolveMonorepoRoot.mockReset();
});

async function loadGuard() {
  vi.resetModules();
  return import('./dev-guard');
}

describe('resolveScaffoldRoot', () => {
  it('devolve a raiz do monorepo em desenvolvimento', async () => {
    setNodeEnv('development');
    resolveMonorepoRoot.mockReturnValue('/repo');

    const { resolveScaffoldRoot } = await loadGuard();

    expect(resolveScaffoldRoot()).toBe('/repo');
  });

  it('recusa em produção mesmo dentro do monorepo', async () => {
    setNodeEnv('production');
    resolveMonorepoRoot.mockReturnValue('/repo');

    const { resolveScaffoldRoot } = await loadGuard();

    expect(resolveScaffoldRoot()).toBeNull();
    expect(resolveMonorepoRoot).not.toHaveBeenCalled();
  });

  it('recusa quando o monorepo não é encontrado', async () => {
    setNodeEnv('development');
    resolveMonorepoRoot.mockReturnValue(null);

    const { resolveScaffoldRoot } = await loadGuard();

    expect(resolveScaffoldRoot()).toBeNull();
  });
});
