'use client';

import { Skeleton } from '@/components/ui/skeleton';

type IntegrationProfileFormSkeletonProps = {
  /**
   * Quantos campos de credencial desenhar. Quando o provider já é conhecido
   * (sheets travados num provider), passar o número exato elimina o salto de altura
   * na troca pelo formulário real.
   */
  fieldCount?: number;
  /** 'catalog' | 'profile' — qual etapa está carregando. Usado pelos testes. */
  stage?: string;
  label?: string;
};

/**
 * Placeholder do formulário de perfil de integração.
 *
 * Espelha o layout real (nome/slug, tipo/provider, card de credenciais, switch de
 * ativo, rodapé) para que a troca pelo formulário preenchido não desloque nada.
 * Fica junto do sheet, e não em `ui/skeletons`, porque é específico deste layout.
 */
export function IntegrationProfileFormSkeleton({
  fieldCount = 6,
  stage,
  label,
}: IntegrationProfileFormSkeletonProps) {
  return (
    <div
      className="flex flex-col gap-6 px-3 pb-8 sm:px-4"
      data-testid="integration-profile-form-skeleton"
      data-stage={stage}
      aria-busy="true"
      aria-live="polite"
      aria-label={label}
    >
      {/* Nome + slug */}
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <div key={index} className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-9 w-full" />
          </div>
        ))}
      </div>

      {/* Tipo + provedor */}
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <div key={index} className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-9 w-full" />
          </div>
        ))}
      </div>

      {/* Card de credenciais */}
      <div className="rounded-lg border">
        <div className="border-b px-4 py-3">
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="grid gap-4 p-4 sm:grid-cols-2">
          {Array.from({ length: Math.max(1, fieldCount) }).map((_, index) => (
            <div key={index} className="space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
        </div>
      </div>

      {/* Switch de ativo */}
      <div className="flex items-center justify-between rounded-md border px-4 py-3">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-[1.15rem] w-8 rounded-full" />
      </div>

      {/* Rodapé (testar + salvar) */}
      <div className="flex justify-end gap-2 border-t pt-4">
        <Skeleton className="h-9 w-36" />
        <Skeleton className="h-9 w-40" />
      </div>
    </div>
  );
}
