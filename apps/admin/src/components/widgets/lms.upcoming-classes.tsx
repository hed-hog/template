'use client';

import { PaginationFooter } from '@/components/entity-list';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { WidgetWrapper } from '@/app/(app)/(libraries)/core/dashboard/components';
import { useWidgetData } from '@/hooks/use-widget-data';
import { format } from 'date-fns';
import { enUS } from 'date-fns/locale/en-US';
import { ptBR } from 'date-fns/locale/pt-BR';
import { BookOpen } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

interface Props {
  widget?: { name?: string };
  onRemove?: () => void;
}

type ClassItem = {
  id: number;
  className: string;
  subject: string;
  teacher: string;
  date: string;
  startTime: string;
  endTime: string;
};

type Data = { upcomingClasses?: ClassItem[] };

const ITEMS_PER_PAGE = 5;

function parseApiDateTime(value: string): Date {
  const raw = String(value ?? '').trim();
  if (!raw) return new Date(NaN);
  const hasTimezone = /[zZ]$|[+-]\d{2}:\d{2}$/.test(raw);
  if (hasTimezone) return new Date(raw);
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (dateOnly) {
    return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]), 12, 0, 0, 0);
  }
  const dt = /^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?/.exec(raw);
  if (dt) {
    return new Date(Number(dt[1]), Number(dt[2]) - 1, Number(dt[3]), Number(dt[4]), Number(dt[5]), Number(dt[6] ?? '0'), 0);
  }
  return new Date(raw);
}

export default function UpcomingClasses({ widget, onRemove }: Props) {
  const t = useTranslations('lms.DashboardPage');
  const locale = useLocale();
  const dateLocale = locale.startsWith('pt') ? ptBR : enUS;
  const [page, setPage] = useState(1);

  const { data, isLoading, isAccessDenied, isError } = useWidgetData<Data>({
    endpoint: '/lms/dashboard',
    queryKey: 'lms-dashboard',
    select: (d) => ({ upcomingClasses: (d as any)?.upcomingClasses }),
  });

  const classes = useMemo(
    () =>
      (data?.upcomingClasses ?? []).map((item) => ({
        id: item.id,
        turma: item.className,
        disciplina: item.subject,
        professor: item.teacher,
        data: format(
          parseApiDateTime(item.date),
          locale.startsWith('pt') ? 'dd/MM/yyyy' : 'MM/dd/yyyy',
          { locale: dateLocale }
        ),
        horario: `${item.startTime} - ${item.endTime}`,
      })),
    [data, dateLocale, locale]
  );

  const paged = classes.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  return (
    <WidgetWrapper
      isLoading={isLoading}
      isAccessDenied={isAccessDenied}
      isError={isError}
      widgetName={widget?.name || t('tables.upcomingClasses.title')}
      onRemove={onRemove}
    >
      <Card className="h-full flex flex-col overflow-hidden border-border/70">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">
            {t('tables.upcomingClasses.title')}
          </CardTitle>
          <CardDescription>{t('tables.upcomingClasses.description')}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('tables.upcomingClasses.columns.class')}</TableHead>
                  <TableHead>{t('tables.upcomingClasses.columns.subject')}</TableHead>
                  <TableHead className="hidden sm:table-cell">{t('tables.upcomingClasses.columns.teacher')}</TableHead>
                  <TableHead>{t('tables.upcomingClasses.columns.date')}</TableHead>
                  <TableHead className="hidden md:table-cell">{t('tables.upcomingClasses.columns.time')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((aula) => (
                  <TableRow key={aula.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="flex size-8 items-center justify-center rounded-lg bg-muted">
                          <BookOpen className="size-3.5 text-muted-foreground" />
                        </div>
                        <span className="font-medium">{aula.turma}</span>
                      </div>
                    </TableCell>
                    <TableCell>{aula.disciplina}</TableCell>
                    <TableCell className="hidden text-muted-foreground sm:table-cell">{aula.professor}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs font-normal">{aula.data}</Badge>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">{aula.horario}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="mt-auto border-t pt-4">
            <PaginationFooter
              currentPage={page}
              pageSize={ITEMS_PER_PAGE}
              totalItems={classes.length}
              onPageChange={setPage}
              onPageSizeChange={() => undefined}
              pageSizeOptions={[ITEMS_PER_PAGE]}
            />
          </div>
        </CardContent>
      </Card>
    </WidgetWrapper>
  );
}
