'use client';

import { Button } from '@/components/ui/button';
import { useThemeMode } from '@/hooks/use-theme-mode';
import { cn } from '@/lib/utils';
import {
  autocompletion,
  type CompletionContext,
  type CompletionResult,
} from '@codemirror/autocomplete';
import { html, htmlCompletionSource } from '@codemirror/lang-html';
import { search } from '@codemirror/search';
import { EditorView } from '@codemirror/view';
import CodeMirror from '@uiw/react-codemirror';
import { ZoomIn, ZoomOut } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';

export interface HtmlEditorVariable {
  /** Token completo, ex.: `{{firstName}}`. */
  label: string;
  detail?: string;
}

export interface HtmlCodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  /** Tokens oferecidos no autocomplete ao digitar `{{`. */
  variables?: HtmlEditorVariable[];
  /** Chave de localStorage do zoom, para telas com preferências independentes. */
  zoomStorageKey?: string;
  readOnly?: boolean;
  className?: string;
}

const DEFAULT_ZOOM_KEY = 'html-editor-zoom';

function buildVariableCompletion(variables: HtmlEditorVariable[]) {
  return (context: CompletionContext): CompletionResult | null => {
    if (!variables.length) return null;
    const word = context.matchBefore(/\{\{[\w]*/);
    if (!word || (word.from === word.to && !context.explicit)) return null;
    return {
      from: word.from,
      options: variables.map((v) => ({
        label: v.label,
        type: 'variable',
        detail: v.detail,
      })),
    };
  };
}

/**
 * Editor de HTML cru (CodeMirror 6) com autocomplete de tags e de variáveis
 * `{{token}}`. Promovido de campaign para uso compartilhado.
 */
export function HtmlCodeEditor({
  value,
  onChange,
  variables,
  zoomStorageKey = DEFAULT_ZOOM_KEY,
  readOnly = false,
  className,
}: HtmlCodeEditorProps) {
  const t = useTranslations('core.HtmlCodeEditor');
  const theme = useThemeMode();

  const [zoom, setZoom] = useState(() => {
    try {
      const saved = localStorage.getItem(zoomStorageKey);
      return saved ? Math.min(200, Math.max(50, parseInt(saved, 10))) : 100;
    } catch {
      return 100;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(zoomStorageKey, String(zoom));
    } catch {}
  }, [zoom, zoomStorageKey]);

  const extensions = useMemo(() => {
    const overrides = variables?.length
      ? [buildVariableCompletion(variables), htmlCompletionSource]
      : [htmlCompletionSource];

    return [
      EditorView.lineWrapping,
      html(),
      autocompletion({ override: overrides, activateOnTyping: true }),
      search({ top: false }),
    ];
  }, [variables]);

  const zoomOut = () => setZoom((z) => Math.max(50, z - 10));
  const zoomIn = () => setZoom((z) => Math.min(200, z + 10));
  const resetZoom = () => setZoom(100);

  return (
    <div className={cn('flex h-full flex-col overflow-hidden', className)}>
      <div className="flex shrink-0 items-center gap-0.5 border-b bg-muted/50 px-1 py-0.5">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={zoomOut}
          disabled={zoom <= 50}
          title={t('zoomOut')}
        >
          <ZoomOut className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 min-w-12 px-1 text-xs tabular-nums"
          onClick={resetZoom}
          title={t('resetZoom')}
        >
          {zoom}%
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={zoomIn}
          disabled={zoom >= 200}
          title={t('zoomIn')}
        >
          <ZoomIn className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div
        className="min-h-0 flex-1 overflow-hidden"
        style={{ fontSize: `${zoom}%` }}
      >
        <CodeMirror
          value={value}
          onChange={onChange}
          height="100%"
          style={{ height: '100%' }}
          extensions={extensions}
          theme={theme}
          readOnly={readOnly}
          basicSetup={{
            lineNumbers: true,
            foldGutter: true,
            highlightActiveLineGutter: true,
            highlightActiveLine: true,
            indentOnInput: true,
            bracketMatching: true,
            closeBrackets: true,
            autocompletion: false,
            searchKeymap: true,
          }}
        />
      </div>
    </div>
  );
}
