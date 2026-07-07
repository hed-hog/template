import { cn } from '@/lib/utils';

function formatarDataHora(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

interface AuditEvent {
  id: string;
  data: string;
  usuarioId: string;
  usuarioNome?: string;
  acao: string;
  detalhes: string;
  antes?: string;
  depois?: string;
}

interface AuditTimelineProps {
  events: AuditEvent[];
  className?: string;
}

const acaoConfig: Record<string, { label: string; color: string }> = {
  CREATE: { label: 'Criação', color: 'bg-green-500' },
  UPDATE: { label: 'Alteração', color: 'bg-blue-500' },
  DELETE: { label: 'Exclusão', color: 'bg-red-500' },
  LIQUIDACAO: { label: 'Liquidação', color: 'bg-purple-500' },
  ESTORNO: { label: 'Estorno', color: 'bg-orange-500' },
  CONCILIACAO: { label: 'Conciliação', color: 'bg-teal-500' },
  APROVACAO: { label: 'Aprovação', color: 'bg-emerald-500' },
  FECHAMENTO: { label: 'Fechamento', color: 'bg-slate-500' },
};

export function AuditTimeline({ events, className }: AuditTimelineProps) {
  return (
    <div className={cn('space-y-4', className)}>
      {events.map((event, index) => {
        const config = acaoConfig[event.acao] || {
          label: event.acao,
          color: 'bg-gray-500',
        };

        return (
          <div key={event.id} className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className={cn('h-3 w-3 rounded-full', config.color)} />
              {index < events.length - 1 && (
                <div className="w-px flex-1 bg-border" />
              )}
            </div>
            <div className="flex-1 pb-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{config.label}</span>
                <span className="text-xs text-muted-foreground">
                  {formatarDataHora(event.data)}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">{event.detalhes}</p>
              <p className="text-xs text-muted-foreground">
                por {event.usuarioNome || event.usuarioId || 'Sistema'}
              </p>
              {event.antes && event.depois && (
                <div className="mt-2 rounded-md border border-border bg-muted/50 p-2 text-xs">
                  <span className="text-muted-foreground">Antes:</span>{' '}
                  <span className="line-through">{event.antes}</span>
                  <span className="mx-2">→</span>
                  <span className="text-muted-foreground">Depois:</span>{' '}
                  <span>{event.depois}</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
