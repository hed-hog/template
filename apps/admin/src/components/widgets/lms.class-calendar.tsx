'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { WidgetWrapper } from '@/app/(app)/(libraries)/core/dashboard/components';
import { useWidgetData } from '@/hooks/use-widget-data';
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { enUS } from 'date-fns/locale/en-US';
import { ptBR } from 'date-fns/locale/pt-BR';
import {
  BookOpen,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  User,
  Video,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useMemo, useState } from 'react';

interface Props {
  widget?: { name?: string };
  onRemove?: () => void;
}

type CalendarEventResource = {
  id: string;
  cor: string;
  curso: string;
  professor: string;
  tipo: string;
  local: string;
  vagas: number;
  matriculados: number;
  status: string;
  turmaName: string;
};

type CalendarEvent = {
  id?: number;
  title: string;
  start: Date;
  end: Date;
  resource: CalendarEventResource;
};

type RawEvent = {
  id: number;
  title: string;
  start: string;
  end: string;
  resource: CalendarEventResource;
};

type Data = { calendarEvents?: RawEvent[] };

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
    return new Date(
      Number(dt[1]),
      Number(dt[2]) - 1,
      Number(dt[3]),
      Number(dt[4]),
      Number(dt[5]),
      Number(dt[6] ?? '0'),
      0
    );
  }
  return new Date(raw);
}

function statusColor(status: string) {
  if (['confirmed', 'active', 'completed'].includes(status)) return 'bg-emerald-100 text-emerald-700';
  if (['pending', 'paused', 'open'].includes(status)) return 'bg-amber-100 text-amber-700';
  return 'bg-red-100 text-red-700';
}

export default function ClassCalendar({ widget, onRemove }: Props) {
  const t = useTranslations('lms.DashboardPage');
  const locale = useLocale();
  const dateLocale = locale.startsWith('pt') ? ptBR : enUS;

  const { data, isLoading, isAccessDenied, isError } = useWidgetData<Data>({
    endpoint: '/lms/dashboard',
    queryKey: 'lms-dashboard',
    select: (d) => ({ calendarEvents: (d as any)?.calendarEvents }),
  });

  const events: CalendarEvent[] = useMemo(
    () =>
      (data?.calendarEvents ?? []).map((e) => ({
        ...e,
        start: parseApiDateTime(e.start),
        end: parseApiDateTime(e.end),
      })),
    [data]
  );

  const [calendarDate, setCalendarDate] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const handleSelectEvent = useCallback((event: CalendarEvent) => {
    setSelectedEvent(event);
    setSheetOpen(true);
  }, []);

  const monthStart = startOfMonth(calendarDate);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: addDays(gridStart, 41) });
  const dayHeaders = locale.startsWith('pt')
    ? ['S', 'T', 'Q', 'Q', 'S', 'S', 'D']
    : ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  const getEventsForDay = (day: Date) => events.filter((e) => isSameDay(e.start, day));
  const selectedDayEvents = selectedDay ? getEventsForDay(selectedDay) : [];

  return (
    <WidgetWrapper
      isLoading={isLoading}
      isAccessDenied={isAccessDenied}
      isError={isError}
      widgetName={widget?.name || t('charts.globalCalendar.title')}
      onRemove={onRemove}
    >
      <Card className="h-full flex flex-col overflow-hidden border-border/70">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">
            {t('charts.globalCalendar.title')}
          </CardTitle>
          <CardDescription>{t('charts.globalCalendar.description')}</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 overflow-auto">
          <div className="space-y-4">
            {/* Month nav */}
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-muted/20 px-3 py-2.5">
              <button
                type="button"
                onClick={() => { setCalendarDate((d) => subMonths(d, 1)); setSelectedDay(null); }}
                aria-label={t('calendar.messages.previous')}
                className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <ChevronLeft className="size-4" />
              </button>
              <p className="truncate text-sm font-semibold capitalize text-foreground">
                {format(calendarDate, locale.startsWith('pt') ? "MMMM 'de' yyyy" : 'MMMM yyyy', { locale: dateLocale })}
              </p>
              <button
                type="button"
                onClick={() => { setCalendarDate((d) => addMonths(d, 1)); setSelectedDay(null); }}
                aria-label={t('calendar.messages.next')}
                className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>

            {/* Grid */}
            <div className="rounded-3xl border border-border/70 bg-card p-3 shadow-xs lg:p-4">
              <div className="mb-2 grid grid-cols-7">
                {dayHeaders.map((h, i) => (
                  <div key={`${h}-${i}`} className="py-1 text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {h}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1 lg:gap-2">
                {days.map((day) => {
                  const dayEvents = getEventsForDay(day);
                  const inMonth = isSameMonth(day, calendarDate);
                  const isTodayDay = isToday(day);
                  const isSelected = selectedDay !== null && isSameDay(day, selectedDay);
                  const visible = dayEvents.slice(0, 3);
                  const hidden = Math.max(dayEvents.length - 3, 0);

                  return (
                    <div
                      key={day.toISOString()}
                      className={[
                        'rounded-2xl border border-border/60 p-1.5 transition-colors lg:min-h-32 lg:p-2',
                        inMonth ? 'bg-background/90 hover:border-border hover:bg-muted/30' : 'bg-muted/20 opacity-30',
                        isSelected ? 'ring-1 ring-primary/35' : '',
                      ].join(' ')}
                    >
                      <button
                        type="button"
                        disabled={!inMonth}
                        onClick={() => setSelectedDay((cur) => cur && isSameDay(cur, day) ? null : day)}
                        className={['flex w-full rounded-xl transition-colors', inMonth ? 'cursor-pointer' : 'cursor-default', 'justify-center lg:justify-start'].join(' ')}
                      >
                        <span className={['flex size-8 items-center justify-center rounded-full text-sm transition-colors lg:size-9', isTodayDay ? 'bg-primary font-semibold text-primary-foreground' : '', isSelected && !isTodayDay ? 'bg-muted font-semibold text-foreground' : '', !isTodayDay && !isSelected && inMonth ? 'text-foreground' : ''].join(' ')}>
                          {format(day, 'd')}
                        </span>
                      </button>
                      <div className="mt-1 flex h-2 items-center justify-center gap-1 lg:hidden">
                        {dayEvents.slice(0, 3).map((event, idx) => (
                          <span key={`${event.id ?? event.title}-${idx}`} className="size-1.5 rounded-full" style={{ backgroundColor: event.resource.cor || '#3b82f6' }} />
                        ))}
                      </div>
                      {inMonth && dayEvents.length > 0 && (
                        <div className="mt-2 hidden space-y-1 lg:block">
                          {visible.map((event, idx) => (
                            <button
                              key={`${event.id ?? event.title}-${idx}`}
                              type="button"
                              onClick={() => handleSelectEvent(event)}
                              className="flex w-full cursor-pointer items-center rounded-md px-2 py-1 text-left text-[10px] font-medium text-white shadow-sm transition-opacity hover:opacity-90"
                              style={{ backgroundColor: event.resource.cor || '#3b82f6' }}
                              title={event.title}
                            >
                              <span className="truncate">{event.title}</span>
                            </button>
                          ))}
                          {hidden > 0 && (
                            <button
                              type="button"
                              onClick={() => setSelectedDay(day)}
                              className="flex w-full cursor-pointer items-center justify-center rounded-md border border-dashed border-border/80 px-2 py-1 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
                            >
                              +{hidden}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Selected day panel */}
            {selectedDay && (
              <div className="rounded-2xl border border-border/70 bg-card p-3">
                <div className="mb-3 flex items-center justify-between gap-2 border-b border-border/60 pb-2">
                  <p className="text-sm font-semibold text-foreground">
                    {format(selectedDay, locale.startsWith('pt') ? "dd 'de' MMMM" : 'MMMM dd', { locale: dateLocale })}
                  </p>
                  <span className="text-xs text-muted-foreground">{selectedDayEvents.length}</span>
                </div>
                {selectedDayEvents.length === 0 ? (
                  <p className="py-3 text-center text-sm text-muted-foreground">{t('calendar.messages.noEventsInRange')}</p>
                ) : (
                  <div className="space-y-2">
                    {selectedDayEvents.map((event) => (
                      <button
                        key={event.id ?? `${event.title}-${event.start.toISOString()}`}
                        type="button"
                        onClick={() => handleSelectEvent(event)}
                        className="flex w-full cursor-pointer items-center gap-3 rounded-2xl border border-border/60 bg-muted/20 px-3 py-3 text-left transition-colors hover:bg-muted/50"
                      >
                        <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: event.resource.cor || '#3b82f6' }} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">{event.title}</p>
                          <p className="text-xs text-muted-foreground">{format(event.start, 'HH:mm')} - {format(event.end, 'HH:mm')}</p>
                        </div>
                        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Event detail sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {selectedEvent && (
            <>
              <SheetHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div
                    className="flex size-12 shrink-0 items-center justify-center rounded-xl"
                    style={{ backgroundColor: `${selectedEvent.resource.cor}20` }}
                  >
                    <BookOpen className="size-6" style={{ color: selectedEvent.resource.cor }} />
                  </div>
                  <div>
                    <SheetTitle className="text-left">{selectedEvent.resource.turmaName}</SheetTitle>
                    <SheetDescription className="text-left">{selectedEvent.resource.curso}</SheetDescription>
                  </div>
                </div>
              </SheetHeader>
              <Separator className="my-4" />
              <div className="mb-6 px-4">
                <Badge
                  className={`text-sm ${statusColor(selectedEvent.resource.status)}`}
                  variant="outline"
                >
                  {t(`statuses.${selectedEvent.resource.status}`)}
                </Badge>
              </div>
              <div className="space-y-4 px-4">
                <h4 className="text-sm font-semibold text-foreground">{t('sheet.lessonDetails')}</h4>
                <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="flex size-9 items-center justify-center rounded-lg bg-indigo-100">
                      <BookOpen className="size-4 text-indigo-600" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{t('sheet.fields.lesson')}</p>
                      <p className="text-sm font-medium">{selectedEvent.title}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex size-9 items-center justify-center rounded-lg bg-blue-100">
                      <CalendarDays className="size-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{t('sheet.fields.date')}</p>
                      <p className="text-sm font-medium">
                        {format(selectedEvent.start, locale.startsWith('pt') ? "EEEE, dd 'de' MMMM 'de' yyyy" : 'EEEE, MMMM dd, yyyy', { locale: dateLocale })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex size-9 items-center justify-center rounded-lg bg-amber-100">
                      <Clock className="size-4 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{t('sheet.fields.time')}</p>
                      <p className="text-sm font-medium">{format(selectedEvent.start, 'HH:mm')} - {format(selectedEvent.end, 'HH:mm')}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex size-9 items-center justify-center rounded-lg bg-purple-100">
                      <User className="size-4 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{t('sheet.fields.teacher')}</p>
                      <p className="text-sm font-medium">{selectedEvent.resource.professor}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-100">
                      {selectedEvent.resource.tipo === 'online' ? (
                        <Video className="size-4 text-emerald-600" />
                      ) : (
                        <MapPin className="size-4 text-emerald-600" />
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        {selectedEvent.resource.tipo === 'online'
                          ? t('sheet.fields.classLink')
                          : selectedEvent.resource.tipo === 'inPerson'
                            ? t('sheet.fields.location')
                            : t('sheet.fields.locationOrLink')}
                      </p>
                      {selectedEvent.resource.tipo === 'online' ? (
                        <a href={selectedEvent.resource.local} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-blue-600 hover:underline">
                          {t('sheet.accessVirtualRoom')}
                        </a>
                      ) : (
                        <p className="text-sm font-medium">{selectedEvent.resource.local}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <Separator className="my-6" />
              <div className="space-y-4 px-4">
                <h4 className="text-sm font-semibold text-foreground">{t('sheet.classInfo')}</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border bg-linear-to-br from-blue-50/50 to-blue-100/30 p-3 text-center">
                    <p className="text-2xl font-bold text-blue-700">{selectedEvent.resource.matriculados}</p>
                    <p className="text-xs text-muted-foreground">{t('sheet.enrolledStudents')}</p>
                  </div>
                  <div className="rounded-lg border bg-linear-to-br from-emerald-50/50 to-emerald-100/30 p-3 text-center">
                    <p className="text-2xl font-bold text-emerald-700">{selectedEvent.resource.vagas - selectedEvent.resource.matriculados}</p>
                    <p className="text-xs text-muted-foreground">{t('sheet.availableSeats')}</p>
                  </div>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3">
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{t('sheet.occupancy')}</span>
                    <span className="font-semibold">
                      {Math.round((selectedEvent.resource.matriculados / selectedEvent.resource.vagas) * 100)}%
                    </span>
                  </div>
                  <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${(selectedEvent.resource.matriculados / selectedEvent.resource.vagas) * 100}%`,
                        backgroundColor: selectedEvent.resource.cor,
                      }}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">{t('sheet.modality')}</span>
                  <Badge variant="outline" className="capitalize">
                    {selectedEvent.resource.tipo === 'online' && <Video className="mr-1 size-3" />}
                    {selectedEvent.resource.tipo === 'inPerson' && <MapPin className="mr-1 size-3" />}
                    {t(`types.${selectedEvent.resource.tipo}`)}
                  </Badge>
                </div>
              </div>
              <Separator className="my-6" />
            </>
          )}
        </SheetContent>
      </Sheet>
    </WidgetWrapper>
  );
}
