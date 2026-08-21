import { resolveMonorepoRoot } from './paths';

/**
 * O scaffolding escreve no repositório e por isso só existe em desenvolvimento,
 * rodando dentro do monorepo. Em qualquer outro cenário os handlers respondem 404.
 */
export function resolveScaffoldRoot(): string | null {
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return resolveMonorepoRoot();
}
