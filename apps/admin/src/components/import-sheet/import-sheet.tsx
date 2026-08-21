'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ResizableSheetContent } from '@/components/ui/resizable-sheet-content';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { useApp } from '@hed-hog/next-app-provider';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  FileText,
  Info,
  Loader2,
  Plus,
  Tag as TagIcon,
  Upload,
  Wand2,
  X,
  XCircle,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CUSTOM_OPTION,
  CUSTOM_PREFIX,
  IGNORE_VALUE,
  customKeyOf,
  detectMapping,
  isCustomValue,
  normalizeCustomKey,
  type ColumnMapping,
  type ImportField,
} from './detect-mapping';

// ─── Types ──────────────────────────────────────────────────────────────────

export type { ColumnMapping, ImportField } from './detect-mapping';

export type ImportPreview = {
  fileName: string;
  totalEstimated: number;
  columns: string[];
  preview: Record<string, string>[];
};

export type ImportResult = {
  imported: number;
  /** Rows matched to a record the base already had, so nothing was duplicated. */
  updated?: number;
  /** How many of those had at least one empty field filled in. */
  enriched?: number;
  skipped: number;
  errors: Array<{ row: number; message: string }>;
};

/** A tag offered by the backend catalog for the batch picker. */
export type ImportTagOption = {
  id: number | string;
  slug: string;
  color?: string | null;
};

/** Axes the backend uses to recognise a row as an existing record. */
export type ImportDedupeAxis = 'document' | 'email' | 'phone';

export const IMPORT_DEDUPE_AXES: ImportDedupeAxis[] = [
  'document',
  'email',
  'phone',
];

/** Marks applied to every row of the file, collected on the confirm step. */
type BatchMarks = {
  tags: string[];
  fields: Array<{ key: string; value: string }>;
  dedupeBy: ImportDedupeAxis[];
  enrichExisting: boolean;
  overwriteExisting: boolean;
};

const EMPTY_BATCH_MARKS: BatchMarks = {
  tags: [],
  fields: [],
  dedupeBy: IMPORT_DEDUPE_AXES,
  enrichExisting: true,
  // Destructive, so it is always an explicit choice — never carried over.
  overwriteExisting: false,
};

type WizardStep = 'upload' | 'preview' | 'mapping' | 'confirm' | 'result';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export function getImportErrorMessage(error: unknown, fallback: string) {
  if (typeof error === 'object' && error !== null) {
    const response = 'response' in error ? error.response : undefined;
    if (typeof response === 'object' && response !== null && 'data' in response) {
      const data = response.data;
      if (typeof data === 'object' && data !== null && 'message' in data) {
        const message = data.message;
        if (typeof message === 'string') return message;
      }
    }
    if ('message' in error && typeof error.message === 'string') {
      return error.message;
    }
  }
  return fallback;
}

// ─── Step indicator ──────────────────────────────────────────────────────────

const STEPS: { key: WizardStep; labelKey: string; icon: React.ElementType }[] = [
  { key: 'upload', labelKey: 'stepUpload', icon: Upload },
  { key: 'preview', labelKey: 'stepPreview', icon: FileText },
  { key: 'mapping', labelKey: 'stepMapping', icon: FileSpreadsheet },
  { key: 'confirm', labelKey: 'stepConfirm', icon: CheckCircle2 },
  { key: 'result', labelKey: 'stepResult', icon: CheckCircle2 },
];

function StepIndicator({ current }: { current: WizardStep }) {
  const t = useTranslations('import-sheet');
  const currentIndex = STEPS.findIndex((s) => s.key === current);

  return (
    <div className="grid grid-cols-5 gap-1.5 px-4 py-3 border-b bg-muted/30">
      {STEPS.map((step, index) => {
        const Icon = step.icon;
        const isCurrent = step.key === current;
        const isPast = index < currentIndex;

        return (
          <div
            key={step.key}
            className={cn(
              'flex flex-col items-center gap-1 rounded-xl border px-1.5 py-2 text-center transition-colors',
              isCurrent
                ? 'border-primary bg-primary/10 text-primary'
                : isPast
                  ? 'border-green-500/30 bg-green-500/10 text-green-600'
                  : 'border-border/50 bg-transparent text-muted-foreground'
            )}
          >
            {isPast ? (
              <CheckCircle2 className="size-3.5" />
            ) : (
              <Icon className="size-3.5" />
            )}
            <span className="text-[10px] font-medium leading-tight hidden sm:block">
              {t(step.labelKey as never)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Step 0: Upload ──────────────────────────────────────────────────────────

function UploadStep({
  file,
  onFileChange,
  error,
}: {
  file: File | null;
  onFileChange: (f: File | null) => void;
  error: string | null;
}) {
  const t = useTranslations('import-sheet');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] ?? null;
    if (selected) {
      const ext = selected.name.split('.').pop()?.toLowerCase();
      if (ext !== 'csv') {
        onFileChange(null);
        return;
      }
    }
    onFileChange(selected);
    e.target.value = '';
  };

  return (
    <div className="space-y-4">
      <label
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-4 py-10 text-center transition-colors',
          file
            ? 'border-primary/40 bg-primary/5'
            : 'border-border hover:border-primary/40 hover:bg-accent/20'
        )}
      >
        <div
          className={cn(
            'flex h-12 w-12 items-center justify-center rounded-xl border',
            file ? 'border-primary/30 bg-primary/10' : 'border-border bg-muted'
          )}
        >
          <FileSpreadsheet
            className={cn(
              'size-6',
              file ? 'text-primary' : 'text-muted-foreground'
            )}
          />
        </div>

        {file ? (
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">{file.name}</p>
            <p className="text-xs text-muted-foreground">{t('fileSelected')}</p>
          </div>
        ) : (
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">
              {t('dropzoneLabel')}
            </p>
            <p className="text-xs text-muted-foreground">{t('dropzoneHint')}</p>
          </div>
        )}

        {file && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 rounded-lg text-xs"
            onClick={(e) => {
              e.preventDefault();
              inputRef.current?.click();
            }}
          >
            <Upload className="mr-1.5 h-3 w-3" />
            {t('dropzoneChange')}
          </Button>
        )}

        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={handleFileChange}
        />
      </label>

      {error && (
        <Alert variant="destructive" className="py-2">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-xs">{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}

// ─── Step 1: Preview ─────────────────────────────────────────────────────────

function PreviewStep({
  preview,
  isLoading,
  error,
}: {
  preview: ImportPreview | null;
  isLoading: boolean;
  error: string | null;
}) {
  const t = useTranslations('import-sheet');
  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className="py-2">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription className="text-xs">{error}</AlertDescription>
      </Alert>
    );
  }

  if (!preview) return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-muted/30 px-3 py-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
              {t('confirmFile')}
            </p>
            <p className="text-xs font-semibold text-foreground truncate max-w-40">
              {preview.fileName}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-muted/30 px-3 py-2">
          <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
              {t('totalEstimated')}
            </p>
            <p className="text-xs font-semibold text-foreground">
              {preview.totalEstimated.toLocaleString()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-muted/30 px-3 py-2">
          <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
              {t('columnsDetected')}
            </p>
            <p className="text-xs font-semibold text-foreground">
              {preview.columns.length}
            </p>
          </div>
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium text-muted-foreground">
          {t('previewDescription')}
        </p>
        <div className="overflow-x-auto rounded-xl border border-border/70">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                {preview.columns.map((col) => (
                  <TableHead
                    key={col}
                    className="whitespace-nowrap text-xs font-semibold"
                  >
                    {col}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {preview.preview.slice(0, 5).map((row, i) => (
                <TableRow key={i} className="text-xs">
                  {preview.columns.map((col) => (
                    <TableCell key={col} className="max-w-32 truncate py-1.5">
                      {row[col] || (
                        <span className="text-muted-foreground/50">—</span>
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

// ─── Step 2: Mapping ─────────────────────────────────────────────────────────

function MappingStep({
  fields,
  columns,
  sampleRow,
  mapping,
  onMappingChange,
  autoDetected,
  customLabels,
  onCustomLabelChange,
  customErrors,
  allowCustomFields,
  onRedetect,
  onClearAll,
  validationError,
}: {
  fields: ImportField[];
  columns: string[];
  sampleRow: Record<string, string> | undefined;
  mapping: ColumnMapping;
  onMappingChange: (mapping: ColumnMapping) => void;
  autoDetected: Record<string, boolean>;
  customLabels: Record<string, string>;
  onCustomLabelChange: (csvCol: string, label: string) => void;
  customErrors: Record<string, string>;
  allowCustomFields: boolean;
  onRedetect: () => void;
  onClearAll: () => void;
  validationError: string | null;
}) {
  const t = useTranslations('import-sheet');

  // Fields that should not be mapped to more than one column.
  const uniqueFields = useMemo(
    () =>
      fields
        .filter((f) => f.value !== IGNORE_VALUE && !f.allowMultiple)
        .map((f) => f.value),
    [fields]
  );

  const mappedValues = useMemo(
    () => Object.values(mapping).filter((v) => v !== IGNORE_VALUE),
    [mapping]
  );

  const duplicateFields = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const val of mappedValues) {
      counts[val] = (counts[val] ?? 0) + 1;
    }
    return Object.entries(counts)
      .filter(([field, count]) => count > 1 && uniqueFields.includes(field))
      .map(([field]) => field);
  }, [mappedValues, uniqueFields]);

  const autoCount = useMemo(
    () =>
      columns.filter(
        (col) => autoDetected[col] && (mapping[col] ?? IGNORE_VALUE) !== IGNORE_VALUE
      ).length,
    [columns, autoDetected, mapping]
  );

  const handleChange = (csvCol: string, field: string) => {
    // Picking "custom field" starts with an empty key on purpose: it is
    // invalid until the user names it, which is what blocks the Next button.
    const next = field === CUSTOM_OPTION ? CUSTOM_PREFIX : field;
    onMappingChange({ ...mapping, [csvCol]: next });
  };

  return (
    <div className="space-y-3">
      {validationError && (
        <Alert variant="destructive" className="py-2">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            {validationError}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/70 bg-muted/30 px-3 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <Wand2 className="h-4 w-4 shrink-0 text-primary" />
          <p className="text-xs text-muted-foreground">
            {autoCount > 0
              ? t('mappingAutoSummary', {
                  detected: autoCount,
                  total: columns.length,
                })
              : t('mappingAutoNone')}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={onRedetect}
          >
            <Wand2 className="mr-1 h-3 w-3" />
            {t('mappingRedetect')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground"
            onClick={onClearAll}
          >
            {t('mappingClearAll')}
          </Button>
        </div>
      </div>

      {duplicateFields.length > 0 && (
        <Alert className="border-amber-500/30 bg-amber-500/10 py-2">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-xs text-amber-700">
            {duplicateFields
              .map((field) => {
                const fieldDef = fields.find((f) => f.value === field);
                const label = fieldDef ? fieldDef.label : field;
                return t('mappingDuplicateWarning', { field: label });
              })
              .join(' ')}
          </AlertDescription>
        </Alert>
      )}

      <div className="rounded-xl border border-border/70 overflow-hidden">
        <div className="grid grid-cols-2 gap-0 bg-muted/40 px-3 py-2 border-b text-xs font-semibold text-muted-foreground uppercase tracking-widest">
          <span>{t('mappingColumnLabel')}</span>
          <span>{t('mappingFieldLabel')}</span>
        </div>
        <div className="divide-y divide-border/50">
          {columns.map((col) => {
            const currentValue = mapping[col] ?? IGNORE_VALUE;
            const isCustom = isCustomValue(currentValue);
            const isDuplicate =
              currentValue !== IGNORE_VALUE &&
              duplicateFields.includes(currentValue);
            const isAuto = Boolean(autoDetected[col]) && currentValue !== IGNORE_VALUE;
            const sample = sampleRow?.[col];
            const customError = customErrors[col];

            return (
              <div
                key={col}
                className={cn(
                  'grid grid-cols-2 items-start gap-3 px-3 py-2',
                  isDuplicate && 'bg-amber-500/5'
                )}
              >
                <div className="flex min-w-0 flex-col gap-0.5 py-1">
                  <div className="flex items-center gap-2 min-w-0">
                    {isDuplicate && (
                      <AlertTriangle className="h-3 w-3 shrink-0 text-amber-500" />
                    )}
                    <span className="truncate text-sm font-medium">{col}</span>
                    {isAuto && (
                      <Badge
                        variant="outline"
                        className="shrink-0 border-primary/30 bg-primary/5 text-[10px] text-primary px-1.5 py-0"
                      >
                        {t('mappingAutoBadge')}
                      </Badge>
                    )}
                    {currentValue === IGNORE_VALUE && (
                      <Badge
                        variant="outline"
                        className="shrink-0 border-border/50 text-[10px] text-muted-foreground px-1.5 py-0"
                      >
                        {t('mappingIgnore')}
                      </Badge>
                    )}
                  </div>
                  {sample ? (
                    <span className="truncate text-[10px] text-muted-foreground/70">
                      {t('mappingSample')}: {sample}
                    </span>
                  ) : null}
                </div>

                <div className="space-y-1.5">
                  <Select
                    value={isCustom ? CUSTOM_OPTION : currentValue}
                    onValueChange={(val) => handleChange(col, val)}
                  >
                    <SelectTrigger
                      className={cn(
                        'h-8 text-xs w-full',
                        isDuplicate && 'border-amber-500/50 bg-amber-500/5',
                        customError && 'border-destructive/60'
                      )}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {fields.map((field) => (
                        <SelectItem
                          key={field.value}
                          value={field.value}
                          className="text-xs"
                        >
                          {field.label}
                        </SelectItem>
                      ))}
                      {allowCustomFields && (
                        <>
                          <SelectSeparator />
                          <SelectItem value={CUSTOM_OPTION} className="text-xs">
                            {t('mappingCustomOption')}
                          </SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>

                  {isCustom && (
                    <div className="space-y-1">
                      <Input
                        value={customLabels[col] ?? ''}
                        onChange={(event) =>
                          onCustomLabelChange(col, event.target.value)
                        }
                        placeholder={t('mappingCustomPlaceholder')}
                        className={cn(
                          'h-8 text-xs',
                          customError && 'border-destructive/60'
                        )}
                      />
                      {customError ? (
                        <p className="text-[10px] text-destructive">
                          {customError}
                        </p>
                      ) : (
                        <p className="text-[10px] text-muted-foreground">
                          {t('mappingCustomKeyHint', {
                            key: customKeyOf(currentValue),
                          })}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Batch marks (confirm step) ──────────────────────────────────────────────

/**
 * Tag picker for the batch. Values travel as names, not ids: the backend
 * resolves an existing tag by slug or creates it, so typing a tag nobody
 * registered yet just works.
 */
function BatchTagPicker({
  value,
  options,
  onChange,
}: {
  value: string[];
  options: ImportTagOption[];
  onChange: (next: string[]) => void;
}) {
  const t = useTranslations('import-sheet');
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const toggle = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onChange(
      value.some((tag) => tag.toLowerCase() === trimmed.toLowerCase())
        ? value.filter((tag) => tag.toLowerCase() !== trimmed.toLowerCase())
        : [...value, trimmed]
    );
    setSearch('');
  };

  const term = search.trim();
  const isNewTag =
    term.length > 0 &&
    !options.some((option) => option.slug.toLowerCase() === term.toLowerCase()) &&
    !value.some((tag) => tag.toLowerCase() === term.toLowerCase());

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {value.map((tag) => (
          <Badge
            key={tag}
            variant="secondary"
            className="gap-1 pl-2 pr-1 text-[11px]"
          >
            {tag}
            <button
              type="button"
              aria-label={t('batchTagRemove', { tag })}
              className="rounded-full p-0.5 hover:bg-muted-foreground/20 cursor-pointer"
              onClick={() => toggle(tag)}
            >
              <X className="size-3" />
            </button>
          </Badge>
        ))}

        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="gap-1.5">
              <TagIcon className="size-3.5" />
              {t('batchTagsAdd')}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-0" align="start">
            <Command shouldFilter>
              <CommandInput
                placeholder={t('batchTagsSearch')}
                value={search}
                onValueChange={setSearch}
              />
              <CommandList>
                <CommandEmpty>{t('batchTagsEmpty')}</CommandEmpty>
                {isNewTag ? (
                  <CommandGroup forceMount>
                    <CommandItem
                      forceMount
                      value={term}
                      onSelect={() => toggle(term)}
                    >
                      <Plus className="mr-2 size-3.5 shrink-0" />
                      <span className="truncate">
                        {t('batchTagsCreate', { tag: term })}
                      </span>
                    </CommandItem>
                  </CommandGroup>
                ) : null}
                <CommandGroup>
                  {options.map((option) => {
                    const checked = value.some(
                      (tag) => tag.toLowerCase() === option.slug.toLowerCase()
                    );
                    return (
                      <CommandItem
                        key={String(option.id)}
                        value={option.slug}
                        onSelect={() => toggle(option.slug)}
                      >
                        <Checkbox checked={checked} className="mr-2 shrink-0" />
                        {option.color ? (
                          <span
                            className="mr-1.5 inline-block size-2 shrink-0 rounded-full"
                            style={{ backgroundColor: option.color }}
                          />
                        ) : null}
                        <span className="truncate">{option.slug}</span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

/**
 * "Apply to every record" block: the tags and fixed key/value pairs that mark a
 * whole file, plus which axes count as a duplicate.
 *
 * Distinct from the `custom:` mapping of the previous step — that one reads a
 * value per row from a column, this one is the same value for the entire file.
 */
function BatchMarksSection({
  value,
  onChange,
  tagOptions,
  enableTags,
  enableFields,
  enableDedupe,
  reservedKeys,
}: {
  value: BatchMarks;
  onChange: (next: BatchMarks) => void;
  tagOptions: ImportTagOption[];
  enableTags: boolean;
  enableFields: boolean;
  enableDedupe: boolean;
  reservedKeys: Set<string>;
}) {
  const t = useTranslations('import-sheet');

  const setFieldAt = (index: number, patch: Partial<{ key: string; value: string }>) => {
    const fields = value.fields.map((field, i) =>
      i === index ? { ...field, ...patch } : field
    );
    onChange({ ...value, fields });
  };

  const fieldError = (index: number) => {
    const key = value.fields[index]?.key.trim() ?? '';
    if (!key) return null;
    if (!/^[a-z][a-z0-9_]{0,63}$/.test(key)) return t('batchFieldKeyInvalid');
    if (reservedKeys.has(key)) return t('mappingCustomKeyReserved', { key });
    if (
      value.fields.some((field, i) => i !== index && field.key.trim() === key)
    ) {
      return t('mappingCustomKeyDuplicate', { key });
    }
    return null;
  };

  return (
    <div className="rounded-xl border border-border/70 overflow-hidden">
      <div className="bg-muted/40 px-3 py-2 border-b">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
          {t('batchTitle')}
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {t('batchDescription')}
        </p>
      </div>

      <div className="space-y-4 px-3 py-3">
        {enableTags ? (
          <div className="space-y-2">
            <p className="text-xs font-medium text-foreground">
              {t('batchTagsLabel')}
            </p>
            <BatchTagPicker
              value={value.tags}
              options={tagOptions}
              onChange={(tags) => onChange({ ...value, tags })}
            />
          </div>
        ) : null}

        {enableFields ? (
          <div className="space-y-2">
            <p className="text-xs font-medium text-foreground">
              {t('batchFieldsLabel')}
            </p>

            {value.fields.map((field, index) => {
              const error = fieldError(index);
              return (
                <div key={index} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Input
                      value={field.key}
                      placeholder={t('batchFieldKeyPlaceholder')}
                      className={cn('h-8 text-xs', error && 'border-destructive')}
                      onChange={(e) =>
                        setFieldAt(index, {
                          key: normalizeCustomKey(e.target.value),
                        })
                      }
                    />
                    <Input
                      value={field.value}
                      placeholder={t('batchFieldValuePlaceholder')}
                      className="h-8 text-xs"
                      onChange={(e) => setFieldAt(index, { value: e.target.value })}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 shrink-0 cursor-pointer"
                      aria-label={t('batchFieldRemove')}
                      onClick={() =>
                        onChange({
                          ...value,
                          fields: value.fields.filter((_, i) => i !== index),
                        })
                      }
                    >
                      <X className="size-3.5" />
                    </Button>
                  </div>
                  {error ? (
                    <p className="text-[11px] text-destructive">{error}</p>
                  ) : null}
                </div>
              );
            })}

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5 cursor-pointer"
              onClick={() =>
                onChange({
                  ...value,
                  fields: [...value.fields, { key: '', value: '' }],
                })
              }
            >
              <Plus className="size-3.5" />
              {t('batchFieldAdd')}
            </Button>
          </div>
        ) : null}

        {enableDedupe ? (
          <div className="space-y-2">
            <p className="text-xs font-medium text-foreground">
              {t('batchDedupeLabel')}
            </p>
            <div className="flex flex-wrap gap-3">
              {IMPORT_DEDUPE_AXES.map((axis) => (
                <label
                  key={axis}
                  className="flex items-center gap-1.5 text-xs cursor-pointer"
                >
                  <Checkbox
                    checked={value.dedupeBy.includes(axis)}
                    onCheckedChange={(checked) =>
                      onChange({
                        ...value,
                        dedupeBy: checked
                          ? [...value.dedupeBy, axis]
                          : value.dedupeBy.filter((item) => item !== axis),
                      })
                    }
                  />
                  {t(`batchDedupe_${axis}` as never)}
                </label>
              ))}
            </div>

            <label className="flex items-start gap-1.5 text-xs cursor-pointer pt-1">
              <Checkbox
                checked={value.enrichExisting}
                className="mt-0.5"
                onCheckedChange={(checked) =>
                  onChange({
                    ...value,
                    enrichExisting: checked === true,
                    // Overwriting without filling is not a state that means
                    // anything, so the switch resets with the checkbox.
                    overwriteExisting: checked === true && value.overwriteExisting,
                  })
                }
              />
              <span>{t('batchEnrichLabel')}</span>
            </label>

            {value.enrichExisting ? (
              <div className="flex items-start gap-2 pl-6">
                <Switch
                  id="import-overwrite-existing"
                  checked={value.overwriteExisting}
                  className="mt-0.5"
                  onCheckedChange={(checked) =>
                    onChange({ ...value, overwriteExisting: checked })
                  }
                />
                <label
                  htmlFor="import-overwrite-existing"
                  className="text-xs cursor-pointer"
                >
                  <span className="block">{t('batchOverwriteLabel')}</span>
                  <span className="block text-[11px] text-muted-foreground">
                    {t('batchOverwriteHint')}
                  </span>
                </label>
              </div>
            ) : null}

            {/* Spells out what happens to a record that already exists, before
                the file is sent — the rules are not guessable from the UI. */}
            <Alert
              className="py-2"
              variant={value.overwriteExisting ? 'destructive' : 'default'}
            >
              {value.overwriteExisting ? (
                <AlertTriangle className="h-4 w-4" />
              ) : (
                <Info className="h-4 w-4" />
              )}
              <AlertDescription className="text-[11px] leading-relaxed">
                <span className="block">{t('batchDedupeNoticeDuplicate')}</span>
                <span className="block">
                  {value.enrichExisting
                    ? t('batchDedupeNoticeEnrichOn')
                    : t('batchDedupeNoticeEnrichOff')}
                </span>
                <span className="block">
                  {value.overwriteExisting
                    ? t('batchDedupeNoticeOverwrite')
                    : t('batchDedupeNoticeNeverOverwrite')}
                </span>
              </AlertDescription>
            </Alert>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ─── Step 3: Confirm ─────────────────────────────────────────────────────────

function ConfirmStep({
  fields,
  preview,
  mapping,
  renderConfirmExtras,
  batchMarks,
}: {
  fields: ImportField[];
  preview: ImportPreview;
  mapping: ColumnMapping;
  renderConfirmExtras?: () => React.ReactNode;
  batchMarks?: React.ReactNode;
}) {
  const t = useTranslations('import-sheet');
  const mappedFields = Object.entries(mapping).filter(
    ([, v]) => v !== IGNORE_VALUE
  );

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="space-y-2">
        <div className="flex items-center justify-between rounded-xl border border-border/70 bg-muted/30 px-3 py-2">
          <span className="text-xs text-muted-foreground">
            {t('confirmFile')}
          </span>
          <span className="text-xs font-semibold truncate max-w-48">
            {preview.fileName}
          </span>
        </div>
        <div className="flex items-center justify-between rounded-xl border border-border/70 bg-muted/30 px-3 py-2">
          <span className="text-xs text-muted-foreground">
            {t('totalEstimated')}
          </span>
          <span className="text-xs font-semibold">
            {preview.totalEstimated.toLocaleString()}
          </span>
        </div>
        <div className="flex items-center justify-between rounded-xl border border-border/70 bg-muted/30 px-3 py-2">
          <span className="text-xs text-muted-foreground">
            {t('confirmMappedFields')}
          </span>
          <span className="text-xs font-semibold">{mappedFields.length}</span>
        </div>
      </div>

      {/* Mapping summary */}
      <div className="rounded-xl border border-border/70 overflow-hidden">
        <div className="bg-muted/40 px-3 py-2 border-b">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
            {t('mappingTitle')}
          </p>
        </div>
        <div className="divide-y divide-border/50 max-h-36 overflow-y-auto">
          {mappedFields.map(([col, field]) => {
            const isCustom = isCustomValue(field);
            const label = isCustom
              ? t('confirmCustomField', { key: customKeyOf(field) })
              : (fields.find((f) => f.value === field)?.label ?? field);

            return (
              <div
                key={col}
                className="flex items-center justify-between px-3 py-1.5"
              >
                <span className="text-xs text-muted-foreground truncate">
                  {col}
                </span>
                <Badge
                  variant="outline"
                  className={cn(
                    'text-[10px] px-1.5 py-0',
                    isCustom
                      ? 'border-violet-500/30 bg-violet-500/5 text-violet-600'
                      : 'border-primary/30 bg-primary/5 text-primary'
                  )}
                >
                  {label}
                </Badge>
              </div>
            );
          })}
        </div>
      </div>

      {/* Marks applied to the whole file */}
      {batchMarks}

      {/* Caller-provided extras (e.g. domain-specific pickers) */}
      {renderConfirmExtras?.()}
    </div>
  );
}

// ─── Step 4: Result ──────────────────────────────────────────────────────────

function ResultStep({
  result,
  isLoading,
  error,
}: {
  result: ImportResult | null;
  isLoading: boolean;
  error: string | null;
}) {
  const t = useTranslations('import-sheet');
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-sm font-medium text-muted-foreground">
          {t('start')}…
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className="py-2">
        <XCircle className="h-4 w-4" />
        <AlertDescription className="text-xs">{error}</AlertDescription>
      </Alert>
    );
  }

  if (!result) return null;

  const hasErrors = result.errors.length > 0;

  return (
    <div className="space-y-4">
      <div
        className={cn(
          'flex items-center gap-3 rounded-xl border px-4 py-3',
          !hasErrors
            ? 'border-green-500/30 bg-green-500/10'
            : 'border-amber-500/30 bg-amber-500/10'
        )}
      >
        {!hasErrors ? (
          <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
        ) : (
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
        )}
        <p
          className={cn(
            'text-sm font-semibold',
            !hasErrors ? 'text-green-700' : 'text-amber-700'
          )}
        >
          {!hasErrors
            ? t('resultSuccess')
            : t('resultPartial', {
                imported: result.imported,
                errors: result.errors.length,
              })}
        </p>
      </div>

      <div
        className={cn(
          'grid gap-2',
          result.updated === undefined ? 'grid-cols-3' : 'grid-cols-4'
        )}
      >
        <div className="flex flex-col items-center rounded-xl border border-green-500/20 bg-green-500/10 px-3 py-3 text-center">
          <span className="text-xl font-bold text-green-700">
            {result.imported}
          </span>
          <span className="text-[11px] text-green-600">
            {t('resultImported')}
          </span>
        </div>
        {result.updated === undefined ? null : (
          <div className="flex flex-col items-center rounded-xl border border-blue-500/20 bg-blue-500/10 px-3 py-3 text-center">
            <span className="text-xl font-bold text-blue-700">
              {result.updated}
            </span>
            <span className="text-[11px] text-blue-600">
              {t('resultUpdated')}
            </span>
            {result.enriched ? (
              <span className="text-[10px] text-blue-500">
                {t('resultEnriched', { count: result.enriched })}
              </span>
            ) : null}
          </div>
        )}
        <div className="flex flex-col items-center rounded-xl border border-slate-500/20 bg-slate-500/10 px-3 py-3 text-center">
          <span className="text-xl font-bold text-slate-600">
            {result.skipped}
          </span>
          <span className="text-[11px] text-slate-500">
            {t('resultSkipped')}
          </span>
        </div>
        <div className="flex flex-col items-center rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-3 text-center">
          <span className="text-xl font-bold text-red-600">
            {result.errors.length}
          </span>
          <span className="text-[11px] text-red-500">{t('resultErrors')}</span>
        </div>
      </div>

      {hasErrors && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
            {t('resultErrorsLabel')}
          </p>
          <div className="max-h-40 overflow-y-auto rounded-xl border border-red-500/20 divide-y divide-border/50">
            {result.errors.slice(0, 50).map((err) => (
              <div key={err.row} className="flex items-start gap-2 px-3 py-1.5">
                <span className="shrink-0 text-[10px] font-semibold text-red-500 mt-0.5">
                  {t('resultRow', { row: err.row })}
                </span>
                <span className="text-xs text-muted-foreground">
                  {err.message}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Sheet ──────────────────────────────────────────────────────────────

export type ImportSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (result?: ImportResult) => void;

  /** Backend endpoints. Preview parses the file; import performs the insert. */
  previewUrl: string;
  importUrl: string;

  /** Target-field catalog. Must include `{ value: '_ignore', label: … }`. */
  fields: ImportField[];

  /** Field that must be mapped before the user can proceed. Default `'name'`. */
  requiredField?: string;

  /** Extra fields appended to the import FormData (e.g. a scoping id). */
  extraFormData?: Record<string, string>;

  /** Optional extra content rendered at the bottom of the confirm step. */
  renderConfirmExtras?: () => React.ReactNode;

  /**
   * Lets the user map a column to a field of their own naming, sent to the
   * backend as `custom:<key>`. Only enable it where the backend accepts them.
   */
  allowCustomFields?: boolean;

  /** Custom-field keys the backend refuses because they carry their own meaning. */
  reservedCustomKeys?: string[];

  /**
   * Lets the user tag every record of the file. Sent as `batch_tags`, a JSON
   * array of tag names the backend resolves or creates.
   */
  enableBatchTags?: boolean;

  /**
   * Lets the user attach fixed key/value pairs to every record of the file.
   * Sent as `batch_fields`, a JSON object.
   */
  enableBatchFields?: boolean;

  /**
   * Lets the user choose which axes make a row count as an existing record.
   * Sent as `dedupe_by`, a JSON array. All three are on by default.
   */
  enableDedupe?: boolean;

  /** Endpoint listing the tags already registered, for the batch picker. */
  tagOptionsUrl?: string;

  /** Escape hatch to start every column on "ignore" instead of suggesting. */
  autoDetect?: boolean;

  /** Persistence key for the resizable sheet width. */
  sheetId?: string;

  title?: string;
  description?: string;
};

export function ImportSheet({
  open,
  onOpenChange,
  onSuccess,
  previewUrl,
  importUrl,
  fields,
  requiredField = 'name',
  extraFormData,
  renderConfirmExtras,
  allowCustomFields = false,
  reservedCustomKeys,
  enableBatchTags = false,
  enableBatchFields = false,
  enableDedupe = false,
  tagOptionsUrl,
  autoDetect = true,
  sheetId = 'import-sheet',
  title,
  description,
}: ImportSheetProps) {
  const t = useTranslations('import-sheet');
  const { request } = useApp();

  // Wizard state
  const [step, setStep] = useState<WizardStep>('upload');

  // Step 0: Upload
  const [file, setFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Step 1: Preview
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Step 2: Mapping
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [mappingError, setMappingError] = useState<string | null>(null);
  /** Columns whose current value came from the suggestion, not from the user. */
  const [autoDetected, setAutoDetected] = useState<Record<string, boolean>>({});
  /** Raw text typed for each custom field, kept so the input does not jump. */
  const [customLabels, setCustomLabels] = useState<Record<string, string>>({});

  // Step 3: Marks applied to the whole file
  const [batchMarks, setBatchMarks] = useState<BatchMarks>(EMPTY_BATCH_MARKS);
  const [tagOptions, setTagOptions] = useState<ImportTagOption[]>([]);

  // Step 4: Result
  const [result, setResult] = useState<ImportResult | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const showBatchMarks = enableBatchTags || enableBatchFields || enableDedupe;

  const requiredFieldLabel = useMemo(
    () => fields.find((f) => f.value === requiredField)?.label ?? requiredField,
    [fields, requiredField]
  );

  const reservedKeys = useMemo(
    () =>
      new Set([
        ...(reservedCustomKeys ?? []),
        ...fields.map((field) => field.value),
      ]),
    [reservedCustomKeys, fields]
  );

  /** A batch key that is filled in but malformed, reserved or repeated. */
  const hasInvalidBatchField = useMemo(() => {
    if (!enableBatchFields) return false;

    const keys = batchMarks.fields
      .map((field) => field.key.trim())
      .filter((key) => key.length > 0);

    return (
      keys.some(
        (key) => !/^[a-z][a-z0-9_]{0,63}$/.test(key) || reservedKeys.has(key)
      ) || new Set(keys).size !== keys.length
    );
  }, [enableBatchFields, batchMarks.fields, reservedKeys]);

  /** Per-column validation of the user-named custom fields. */
  const customErrors = useMemo(() => {
    const errors: Record<string, string> = {};
    const keyOwners: Record<string, string[]> = {};

    for (const [col, value] of Object.entries(mapping)) {
      if (!isCustomValue(value)) continue;

      const key = customKeyOf(value);
      if (!key) {
        errors[col] = t('mappingCustomKeyRequired');
        continue;
      }
      if (reservedKeys.has(key)) {
        errors[col] = t('mappingCustomKeyReserved', { key });
        continue;
      }
      (keyOwners[key] ??= []).push(col);
    }

    for (const [key, cols] of Object.entries(keyOwners)) {
      if (cols.length < 2) continue;
      for (const col of cols) {
        errors[col] = t('mappingCustomKeyDuplicate', { key });
      }
    }

    return errors;
  }, [mapping, reservedKeys, t]);

  // ── Reset on close ──
  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        setStep('upload');
        setFile(null);
        setUploadError(null);
        setPreview(null);
        setPreviewError(null);
        setPreviewLoading(false);
        setMapping({});
        setMappingError(null);
        setAutoDetected({});
        setCustomLabels({});
        setBatchMarks(EMPTY_BATCH_MARKS);
        setResult(null);
        setImportError(null);
        setImportLoading(false);
      }
      onOpenChange(nextOpen);
    },
    [onOpenChange]
  );

  // Tag catalog for the batch picker. A base with no tag yet is normal — the
  // user can still type new ones, so a failure here only costs the suggestions.
  useEffect(() => {
    if (!open || !enableBatchTags || !tagOptionsUrl) return;

    let active = true;
    void (async () => {
      try {
        const res = await request<{ data: ImportTagOption[] }>({
          url: tagOptionsUrl,
          method: 'GET',
        });
        if (active) setTagOptions(res.data?.data ?? []);
      } catch {
        if (active) setTagOptions([]);
      }
    })();

    return () => {
      active = false;
    };
  }, [open, enableBatchTags, tagOptionsUrl, request]);

  // ── Initialise mapping from columns, suggesting what we can recognise ──
  const initMapping = useCallback(
    (columns: string[]) => {
      const initial = autoDetect
        ? detectMapping(columns, fields)
        : columns.reduce<ColumnMapping>((acc, col) => {
            acc[col] = IGNORE_VALUE;
            return acc;
          }, {});

      const detected: Record<string, boolean> = {};
      for (const col of columns) {
        detected[col] = initial[col] !== IGNORE_VALUE;
      }

      setMapping(initial);
      setAutoDetected(detected);
      setCustomLabels({});
      setMappingError(null);
    },
    [autoDetect, fields]
  );

  const handleMappingChange = useCallback((next: ColumnMapping) => {
    setMapping((previous) => {
      // Any column the user touched loses its "Auto" badge, so what is left
      // badged is exactly what still needs reviewing.
      const touched = Object.keys(next).filter(
        (col) => next[col] !== previous[col]
      );
      if (touched.length > 0) {
        setAutoDetected((flags) => {
          const updated = { ...flags };
          for (const col of touched) updated[col] = false;
          return updated;
        });
      }
      return next;
    });
    setMappingError(null);
  }, []);

  const handleCustomLabelChange = useCallback(
    (csvCol: string, label: string) => {
      setCustomLabels((previous) => ({ ...previous, [csvCol]: label }));
      setMapping((previous) => ({
        ...previous,
        [csvCol]: `${CUSTOM_PREFIX}${normalizeCustomKey(label)}`,
      }));
      setMappingError(null);
    },
    []
  );

  const handleClearAll = useCallback(() => {
    setMapping((previous) => {
      const cleared: ColumnMapping = {};
      for (const col of Object.keys(previous)) cleared[col] = IGNORE_VALUE;
      return cleared;
    });
    setAutoDetected({});
    setCustomLabels({});
    setMappingError(null);
  }, []);

  // ── Navigation ──
  const canGoNext = (): boolean => {
    if (step === 'upload') return !!file;
    if (step === 'preview') return !!preview && !previewError;
    if (step === 'mapping') {
      if (!Object.values(mapping).includes(requiredField)) return false;
      return Object.keys(customErrors).length === 0;
    }
    // A half-typed batch field would be rejected by the backend after the file
    // is already uploaded, so it blocks the button instead.
    if (step === 'confirm') return !hasInvalidBatchField;
    return false;
  };

  const handleNext = async () => {
    if (step === 'upload') {
      if (!file) {
        setUploadError(t('errorFileRequired'));
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        setUploadError(t('errorFileTooLarge'));
        return;
      }
      setUploadError(null);
      await fetchPreview();
    } else if (step === 'preview') {
      setStep('mapping');
    } else if (step === 'mapping') {
      if (!Object.values(mapping).includes(requiredField)) {
        setMappingError(
          t('mappingRequiredField', { field: requiredFieldLabel })
        );
        return;
      }
      const firstCustomError = Object.values(customErrors)[0];
      if (firstCustomError) {
        setMappingError(firstCustomError);
        return;
      }
      setMappingError(null);
      setStep('confirm');
    } else if (step === 'confirm') {
      await runImport();
    }
  };

  const handleBack = () => {
    if (step === 'preview') setStep('upload');
    else if (step === 'mapping') setStep('preview');
    else if (step === 'confirm') setStep('mapping');
  };

  // ── Fetch preview ──
  const fetchPreview = async () => {
    if (!file) return;
    setPreviewLoading(true);
    setPreviewError(null);
    setStep('preview');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await request<ImportPreview>({
        url: previewUrl,
        method: 'POST',
        data: formData,
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setPreview(res.data);
      initMapping(res.data.columns);
    } catch (err: unknown) {
      setPreviewError(getImportErrorMessage(err, t('errorGeneric')));
    } finally {
      setPreviewLoading(false);
    }
  };

  // ── Run import ──
  const runImport = async () => {
    if (!file) return;
    setImportLoading(true);
    setImportError(null);
    setStep('result');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('mapping', JSON.stringify(mapping));

      if (enableBatchTags && batchMarks.tags.length > 0) {
        formData.append('batch_tags', JSON.stringify(batchMarks.tags));
      }
      if (enableBatchFields) {
        const fields = Object.fromEntries(
          batchMarks.fields
            .map((field) => [field.key.trim(), field.value.trim()] as const)
            .filter(([key, value]) => key && value)
        );
        if (Object.keys(fields).length > 0) {
          formData.append('batch_fields', JSON.stringify(fields));
        }
      }
      if (enableDedupe) {
        formData.append('dedupe_by', JSON.stringify(batchMarks.dedupeBy));
        formData.append(
          'enrich_existing',
          batchMarks.enrichExisting ? 'true' : 'false'
        );
        formData.append(
          'overwrite_existing',
          batchMarks.enrichExisting && batchMarks.overwriteExisting
            ? 'true'
            : 'false'
        );
      }

      if (extraFormData) {
        for (const [key, value] of Object.entries(extraFormData)) {
          formData.append(key, value);
        }
      }

      const res = await request<ImportResult>({
        url: importUrl,
        method: 'POST',
        data: formData,
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setResult(res.data);
      onSuccess(res.data);
    } catch (err: unknown) {
      setImportError(getImportErrorMessage(err, t('errorGeneric')));
    } finally {
      setImportLoading(false);
    }
  };

  const isLastActionStep = step === 'confirm';
  const showBack = step !== 'upload' && step !== 'result';

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <ResizableSheetContent
        sheetId={sheetId}
        defaultWidth={1024}
        minWidth={720}
        maxWidth={1440}
        className="flex h-full w-full flex-col gap-0 overflow-hidden p-0"
      >
        {/* Header */}
        <SheetHeader className="border-b px-4 py-4 text-left">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/20 bg-primary/10">
              <Upload className="h-4 w-4 text-primary" />
            </div>
            <div>
              <SheetTitle className="text-base">
                {title ?? t('sheetTitle')}
              </SheetTitle>
              <SheetDescription className="text-xs">
                {description ?? t('sheetDescription')}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {/* Step indicator */}
        <StepIndicator current={step} />

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {step === 'upload' && (
            <UploadStep
              file={file}
              onFileChange={(f) => {
                setFile(f);
                setUploadError(null);
              }}
              error={uploadError}
            />
          )}

          {step === 'preview' && (
            <PreviewStep
              preview={preview}
              isLoading={previewLoading}
              error={previewError}
            />
          )}

          {step === 'mapping' && preview && (
            <MappingStep
              fields={fields}
              columns={preview.columns}
              sampleRow={preview.preview[0]}
              mapping={mapping}
              onMappingChange={handleMappingChange}
              autoDetected={autoDetected}
              customLabels={customLabels}
              onCustomLabelChange={handleCustomLabelChange}
              customErrors={customErrors}
              allowCustomFields={allowCustomFields}
              onRedetect={() => initMapping(preview.columns)}
              onClearAll={handleClearAll}
              validationError={mappingError}
            />
          )}

          {step === 'confirm' && preview && (
            <ConfirmStep
              fields={fields}
              preview={preview}
              mapping={mapping}
              renderConfirmExtras={renderConfirmExtras}
              batchMarks={
                showBatchMarks ? (
                  <BatchMarksSection
                    value={batchMarks}
                    onChange={setBatchMarks}
                    tagOptions={tagOptions}
                    enableTags={enableBatchTags}
                    enableFields={enableBatchFields}
                    enableDedupe={enableDedupe}
                    reservedKeys={reservedKeys}
                  />
                ) : null
              }
            />
          )}

          {step === 'result' && (
            <ResultStep
              result={result}
              isLoading={importLoading}
              error={importError}
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t px-4 py-3">
          <div>
            {showBack && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleBack}
                disabled={previewLoading || importLoading}
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                {t('back')}
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {step === 'result' ? (
              <Button
                type="button"
                size="sm"
                onClick={() => handleOpenChange(false)}
              >
                {t('close')}
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleOpenChange(false)}
                  disabled={previewLoading || importLoading}
                >
                  <X className="mr-1 h-4 w-4" />
                  {t('cancel')}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleNext}
                  disabled={!canGoNext() || previewLoading || importLoading}
                >
                  {previewLoading || importLoading ? (
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  ) : isLastActionStep ? null : (
                    <ChevronRight className="ml-1 h-4 w-4 order-last" />
                  )}
                  {isLastActionStep ? (
                    <>
                      <Upload className="mr-1.5 h-4 w-4" />
                      {t('start')}
                    </>
                  ) : (
                    t('next')
                  )}
                </Button>
              </>
            )}
          </div>
        </div>
      </ResizableSheetContent>
    </Sheet>
  );
}
