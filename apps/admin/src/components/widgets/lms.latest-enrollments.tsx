'use client';

import { PaginationFooter } from '@/components/entity-list';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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
import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

interface Props {
  widget?: { name?: string };
  onRemove?: () => void;
}

type EnrollmentItem = {
  id: number;
  studentName: string;
  email: string;
  courseTitle: string;
  enrolledAt: string;
  status: string;
};

type Data = { latestEnrollments?: EnrollmentItem[] };

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

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

function statusColor(status: string) {
  if (['confirmed', 'active', 'completed'].includes(status)) return 'bg-emerald-100 text-emerald-700';
  if (['pending', 'paused', 'open'].includes(status)) return 'bg-amber-100 text-amber-700';
  return 'bg-red-100 text-red-700';
}

export default function LatestEnrollments({ widget, onRemove }: Props) {
  const t = useTranslations('lms.DashboardPage');
  const locale = useLocale();
  const dateLocale = locale.startsWith('pt') ? ptBR : enUS;
  const [page, setPage] = useState(1);

  const { data, isLoading, isAccessDenied, isError } = useWidgetData<Data>({
    endpoint: '/lms/dashboard',
    queryKey: 'lms-dashboard',
    select: (d) => ({ latestEnrollments: (d as any)?.latestEnrollments }),
  });

  const enrollments = useMemo(
    () =>
      (data?.latestEnrollments ?? []).map((item) => ({
        id: item.id,
        aluno: item.studentName,
        email: item.email,
        curso: item.courseTitle,
        data: format(
          parseApiDateTime(item.enrolledAt),
          locale.startsWith('pt') ? 'dd/MM/yyyy' : 'MM/dd/yyyy',
          { locale: dateLocale }
        ),
        status: item.status,
      })),
    [data, dateLocale, locale]
  );

  const paged = enrollments.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  return (
    <WidgetWrapper
      isLoading={isLoading}
      isAccessDenied={isAccessDenied}
      isError={isError}
      widgetName={widget?.name || t('tables.latestEnrollments.title')}
      onRemove={onRemove}
    >
      <Card className="h-full flex flex-col overflow-hidden border-border/70">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">
            {t('tables.latestEnrollments.title')}
          </CardTitle>
          <CardDescription>
            {t('tables.latestEnrollments.description', { count: enrollments.length })}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('tables.latestEnrollments.columns.student')}</TableHead>
                  <TableHead className="hidden sm:table-cell">{t('tables.latestEnrollments.columns.email')}</TableHead>
                  <TableHead>{t('tables.latestEnrollments.columns.course')}</TableHead>
                  <TableHead className="hidden md:table-cell">{t('tables.latestEnrollments.columns.date')}</TableHead>
                  <TableHead>{t('tables.latestEnrollments.columns.status')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <Avatar className="size-8">
                          <AvatarFallback className="bg-foreground text-[10px] font-medium text-background">
                            {getInitials(m.aluno)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{m.aluno}</span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground sm:table-cell">{m.email}</TableCell>
                    <TableCell>{m.curso}</TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">{m.data}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusColor(m.status)}`}>
                        {t(`statuses.${m.status}`)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="mt-auto border-t pt-4">
            <PaginationFooter
              currentPage={page}
              pageSize={ITEMS_PER_PAGE}
              totalItems={enrollments.length}
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
