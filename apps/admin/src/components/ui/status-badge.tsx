import { cn } from '@/lib/utils';

type StatusTitulo =
  | 'rascunho'
  | 'aprovado'
  | 'aberto'
  | 'parcial'
  | 'liquidado'
  | 'cancelado'
  | 'vencido';

type StatusConciliacao =
  | 'importado'
  | 'pendente'
  | 'conciliado'
  | 'estornado'
  | 'ajustado';

const statusTituloConfig: Record<
  StatusTitulo,
  { label: string; className: string }
> = {
  rascunho: { label: 'Rascunho', className: 'bg-muted text-muted-foreground' },
  aprovado: { label: 'Aprovado', className: 'bg-blue-100 text-blue-700' },
  aberto: { label: 'Aberto', className: 'bg-yellow-100 text-yellow-700' },
  parcial: { label: 'Parcial', className: 'bg-orange-100 text-orange-700' },
  liquidado: { label: 'Liquidado', className: 'bg-green-100 text-green-700' },
  cancelado: { label: 'Cancelado', className: 'bg-red-100 text-red-700' },
  vencido: { label: 'Vencido', className: 'bg-red-100 text-red-700' },
};

const statusConciliacaoConfig: Record<
  StatusConciliacao,
  { label: string; className: string }
> = {
  importado: { label: 'Importado', className: 'bg-blue-100 text-blue-700' },
  pendente: { label: 'Pendente', className: 'bg-yellow-100 text-yellow-700' },
  conciliado: { label: 'Conciliado', className: 'bg-green-100 text-green-700' },
  estornado: { label: 'Estornado', className: 'bg-red-100 text-red-700' },
  ajustado: { label: 'Ajustado', className: 'bg-purple-100 text-purple-700' },
};

interface StatusBadgeProps {
  status: StatusTitulo | StatusConciliacao;
  type?: 'titulo' | 'conciliacao';
  className?: string;
}

export function StatusBadge({
  status,
  type = 'titulo',
  className,
}: StatusBadgeProps) {
  const config =
    type === 'titulo'
      ? statusTituloConfig[status as StatusTitulo]
      : statusConciliacaoConfig[status as StatusConciliacao];

  if (!config) return null;

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}
