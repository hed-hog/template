'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ResizableSheetContent } from '@/components/ui/resizable-sheet-content';
import {
  Select,
  SelectContent,
  SelectItem,
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
  Loader2,
  Upload,
  X,
  XCircle,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useMemo, useRef, useState } from 'react';

// ─── Types ──────────────────────────────────────────────────────────────────

export type ImportField = {
  /** Value sent to the backend as the target field for a mapped column. */
  value: string;
  /** Already-resolved, human-readable label shown in the UI. */
  label: string;
  /** When false, mapping this field to more than one column raises a warning. */
  allowMultiple?: boolean;
};

export type ImportPreview = {
  fileName: string;
  totalEstimated: number;
  columns: string[];
  preview: Record<string, string>[];
};

export type ImportResult = {
  imported: number;
  skipped: number;
  errors: Array<{ row: number; message: string }>;
};

type ColumnMapping = Record<string, string>;

type WizardStep = 'upload' | 'preview' | 'mapping' | 'confirm' | 'result';

const IGNORE_VALUE = '_ignore';
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
  mapping,
  onMappingChange,
  validationError,
}: {
  fields: ImportField[];
  columns: string[];
  mapping: ColumnMapping;
  onMappingChange: (mapping: ColumnMapping) => void;
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

  const handleChange = (csvCol: string, field: string) => {
    onMappingChange({ ...mapping, [csvCol]: field });
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
            const isDuplicate =
              currentValue !== IGNORE_VALUE &&
              duplicateFields.includes(currentValue);

            return (
              <div
                key={col}
                className={cn(
                  'grid grid-cols-2 items-center gap-3 px-3 py-2',
                  isDuplicate && 'bg-amber-500/5'
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {isDuplicate && (
                    <AlertTriangle className="h-3 w-3 shrink-0 text-amber-500" />
                  )}
                  <span className="truncate text-sm font-medium">{col}</span>
                  {currentValue === IGNORE_VALUE && (
                    <Badge
                      variant="outline"
                      className="shrink-0 border-border/50 text-[10px] text-muted-foreground px-1.5 py-0"
                    >
                      {t('mappingIgnore')}
                    </Badge>
                  )}
                </div>
                <Select
                  value={currentValue}
                  onValueChange={(val) => handleChange(col, val)}
                >
                  <SelectTrigger
                    className={cn(
                      'h-8 text-xs w-full',
                      isDuplicate && 'border-amber-500/50 bg-amber-500/5'
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
                  </SelectContent>
                </Select>
              </div>
            );
          })}
        </div>
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
}: {
  fields: ImportField[];
  preview: ImportPreview;
  mapping: ColumnMapping;
  renderConfirmExtras?: () => React.ReactNode;
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
            const fieldDef = fields.find((f) => f.value === field);
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
                  className="text-[10px] border-primary/30 bg-primary/5 text-primary px-1.5 py-0"
                >
                  {fieldDef ? fieldDef.label : field}
                </Badge>
              </div>
            );
          })}
        </div>
      </div>

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

      <div className="grid grid-cols-3 gap-2">
        <div className="flex flex-col items-center rounded-xl border border-green-500/20 bg-green-500/10 px-3 py-3 text-center">
          <span className="text-xl font-bold text-green-700">
            {result.imported}
          </span>
          <span className="text-[11px] text-green-600">
            {t('resultImported')}
          </span>
        </div>
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

  // Step 4: Result
  const [result, setResult] = useState<ImportResult | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const requiredFieldLabel = useMemo(
    () => fields.find((f) => f.value === requiredField)?.label ?? requiredField,
    [fields, requiredField]
  );

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
        setResult(null);
        setImportError(null);
        setImportLoading(false);
      }
      onOpenChange(nextOpen);
    },
    [onOpenChange]
  );

  // ── Auto-initialise mapping from columns ──
  const initMapping = useCallback((columns: string[]) => {
    const initial: ColumnMapping = {};
    columns.forEach((col) => {
      initial[col] = IGNORE_VALUE;
    });
    setMapping(initial);
  }, []);

  // ── Navigation ──
  const canGoNext = (): boolean => {
    if (step === 'upload') return !!file;
    if (step === 'preview') return !!preview && !previewError;
    if (step === 'mapping') return Object.values(mapping).includes(requiredField);
    if (step === 'confirm') return true;
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
              mapping={mapping}
              onMappingChange={(m) => {
                setMapping(m);
                setMappingError(null);
              }}
              validationError={mappingError}
            />
          )}

          {step === 'confirm' && preview && (
            <ConfirmStep
              fields={fields}
              preview={preview}
              mapping={mapping}
              renderConfirmExtras={renderConfirmExtras}
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
