'use client';

import type { HtmlEditorVariable } from '@/components/html-code-editor';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  AlertCircle,
  Columns3,
  FileText,
  Loader2,
  Maximize2,
  Minimize2,
  Rows3,
  Sparkles,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { useEffect, useState, type ReactNode } from 'react';
import { toast } from 'sonner';

const RichTextEditor = dynamic(
  () =>
    import('@/components/rich-text-editor').then((mod) => ({
      default: mod.RichTextEditor,
    })),
  {
    ssr: false,
    loading: () => <div className="min-h-48 animate-pulse rounded-md bg-muted" />,
  }
);

const HtmlCodeEditor = dynamic(
  () =>
    import('@/components/html-code-editor').then((mod) => ({
      default: mod.HtmlCodeEditor,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="h-full min-h-40 animate-pulse rounded-md bg-muted" />
    ),
  }
);

export type HtmlContentEditorTab = 'preview' | 'editor' | 'code';

/**
 * HTML que o editor visual (TipTap) não consegue representar. O schema do
 * ProseMirror não tem node spec para `<style>`, `<head>` ou `<script>`, então
 * abrir esse conteúdo no modo visual o descarta silenciosamente.
 */
export function isComplexHtml(html?: string | null): boolean {
  if (!html) return false;
  const lower = html.toLowerCase();
  return (
    lower.includes('<!doctype') ||
    lower.includes('<html') ||
    lower.includes('<head>') ||
    lower.includes('<head ') ||
    lower.includes('<body>') ||
    lower.includes('<body ') ||
    lower.includes('<style>') ||
    lower.includes('<style ') ||
    lower.includes('<script>') ||
    lower.includes('<script ')
  );
}

/** Espelha `isFullHtmlDocument` do packages/api-mail: corpo assim pula o layout base. */
export function isFullHtmlDocument(html?: string | null): boolean {
  if (!html) return false;
  return /<!doctype\s+html|<html[\s>]/i.test(html);
}

export interface HtmlContentEditorAiEditConfig {
  /**
   * Chama o backend específico da tela e retorna o HTML já ajustado. Erros
   * lançados aqui são capturados pelo componente (toast via sonner) — a tela
   * não precisa de try/catch próprio.
   */
  onSubmit: (instruction: string, currentHtml: string) => Promise<string>;
  /** Sobrescreve o placeholder padrão do textarea de instrução. */
  instructionPlaceholder?: string;
  /** Sobrescreve o título padrão ("Ajustar HTML com IA"). */
  title?: string;
  /** Mensagem do toast de sucesso. Default: string genérica do componente. */
  successMessage?: string;
  /** Deriva a mensagem do toast de erro a partir do erro capturado. Default:
   * `err?.response?.data?.message ?? err?.message ?? <string genérica>`. */
  getErrorMessage?: (error: unknown) => string;
}

export interface HtmlContentEditorProps {
  value: string;
  onChange: (value: string) => void;
  variables?: HtmlEditorVariable[];
  /**
   * HTML renderizado no servidor para a aba de preview. Sem isso o preview cai
   * para o próprio `value`, que não reflete layout nem variáveis.
   */
  previewHtml?: string;
  previewLoading?: boolean;
  /**
   * `false` remove a aba do editor visual. Obrigatório para conteúdo que contém
   * `<style>`/`<head>` (o wrapper do layout base), que o TipTap destruiria.
   */
  allowRichText?: boolean;
  defaultTab?: HtmlContentEditorTab;
  /** Avisos exibidos acima das abas. */
  warnings?: ReactNode;
  className?: string;
  zoomStorageKey?: string;
  previewTitle?: string;
  /**
   * Esconde as abas Editor e Código, mostrando só o Preview — para estados em
   * que o conteúdo não pode mais ser editado (ex.: campanha já enviada).
   * Reage a mudanças em runtime (força a aba de volta para "preview").
   */
  previewOnly?: boolean;
  /**
   * Ação renderizada à direita da barra de abas (ex.: botão de salvar).
   * Recebe a aba ativa para o consumidor decidir quando aparecer. Ignorado
   * quando `previewOnly` é true.
   */
  renderTabBarActions?: (tab: HtmlContentEditorTab) => ReactNode;
  /**
   * Ativa a caixa "Ajustar HTML com IA" abaixo das abas (vale para as 3
   * sub-abas). Ignorado quando `previewOnly` é true.
   */
  aiEdit?: HtmlContentEditorAiEditConfig;
}

/**
 * Editor de HTML com três modos — visualizar, editar (WYSIWYG) e código.
 *
 * Origem: o bloco de abas que existia duplicado em campaign-templates.tsx e
 * campaign-detail.tsx, com nomes de aba e atributos de sandbox divergentes.
 */
export function HtmlContentEditor({
  value,
  onChange,
  variables,
  previewHtml,
  previewLoading = false,
  allowRichText = true,
  defaultTab,
  warnings,
  className,
  zoomStorageKey,
  previewTitle,
  previewOnly = false,
  renderTabBarActions,
  aiEdit,
}: HtmlContentEditorProps) {
  const t = useTranslations('core.HtmlContentEditor');
  const [tab, setTab] = useState<HtmlContentEditorTab>(
    previewOnly ? 'preview' : defaultTab ?? (allowRichText ? 'editor' : 'code')
  );

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [layout, setLayout] = useState<'tabs' | 'split'>('tabs');

  useEffect(() => {
    if (previewOnly) {
      setTab('preview');
      setLayout('tabs');
    }
  }, [previewOnly]);

  // Trava o scroll da página por trás enquanto o overlay de tela cheia estiver
  // aberto, e permite fechar com Esc (padrão de qualquer modal/overlay).
  useEffect(() => {
    if (!isFullscreen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFullscreen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isFullscreen]);

  const showEditorTab = allowRichText && !previewOnly;
  const showCodeTab = !previewOnly;
  const showAiEdit = Boolean(aiEdit) && !previewOnly;
  // Visualização lado a lado (Preview | HTML | IA) — o editor visual fica de
  // fora, os 3 painéis já cobrem o ciclo "ver → ajustar código/IA → ver".
  const canSplit = !previewOnly;
  const showSplit = layout === 'split' && canSplit;

  const hasComplexHtml = showEditorTab && isComplexHtml(value);
  // Enquanto a renderização do servidor não chega, mostra o próprio conteúdo em
  // vez de "sem conteúdo" — evita um piscar de estado vazio a cada digitação.
  const resolvedPreview = previewHtml || value;
  const hasPreview = Boolean(resolvedPreview.trim());

  const [aiInstruction, setAiInstruction] = useState('');
  const [aiApplying, setAiApplying] = useState(false);

  const handleAiSubmit = async () => {
    if (!aiEdit || !aiInstruction.trim() || aiApplying) return;
    setAiApplying(true);
    try {
      const next = await aiEdit.onSubmit(aiInstruction.trim(), value);
      onChange(next ?? '');
      setAiInstruction('');
      setTab('preview');
      toast.success(aiEdit.successMessage ?? t('aiEditAppliedDefault'));
    } catch (err: any) {
      const message = aiEdit.getErrorMessage
        ? aiEdit.getErrorMessage(err)
        : err?.response?.data?.message ?? err?.message ?? t('aiEditErrorDefault');
      toast.error(message);
    } finally {
      setAiApplying(false);
    }
  };

  const previewPanel = hasPreview ? (
    <div className="relative h-full min-h-64 overflow-hidden rounded-lg border bg-white">
      {previewLoading && (
        <div className="absolute right-2 top-2 z-10 rounded-full bg-background/90 p-1 shadow-sm">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        </div>
      )}
      <iframe
        srcDoc={resolvedPreview}
        sandbox=""
        className="h-full w-full border-0"
        title={previewTitle ?? t('previewTitle')}
        style={{ colorScheme: 'light' }}
      />
    </div>
  ) : (
    <div className="flex h-full min-h-40 flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-sm text-muted-foreground">
      <FileText className="h-8 w-8 opacity-30" />
      <span>{t('noContent')}</span>
    </div>
  );

  const codePanel = (
    <HtmlCodeEditor
      value={value}
      onChange={onChange}
      variables={variables}
      zoomStorageKey={zoomStorageKey}
    />
  );

  const aiPanelBody = aiEdit && (
    <>
      <Textarea
        value={aiInstruction}
        onChange={(e) => setAiInstruction(e.target.value)}
        placeholder={aiEdit.instructionPlaceholder ?? t('aiInstructionPlaceholder')}
        disabled={aiApplying}
        className="min-h-16 resize-none bg-background text-sm"
        onKeyDown={(e) => {
          if (
            (e.metaKey || e.ctrlKey) &&
            e.key === 'Enter' &&
            aiInstruction.trim()
          ) {
            e.preventDefault();
            void handleAiSubmit();
          }
        }}
      />
      <div className="flex justify-end">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={aiApplying || !aiInstruction.trim()}
          onClick={() => void handleAiSubmit()}
        >
          {aiApplying ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="mr-2 h-4 w-4" />
          )}
          {aiApplying ? t('aiApplying') : t('aiApplyButton')}
        </Button>
      </div>
    </>
  );

  // Em split view não há uma "aba ativa" — passa 'code' para quem consome
  // renderTabBarActions (ex.: botão de salvar) tratar como conteúdo editável.
  const toolbarActions = (
    <div className="flex items-center gap-1.5">
      {!previewOnly &&
        renderTabBarActions &&
        renderTabBarActions(showSplit ? 'code' : tab)}
      {canSplit && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => setLayout(showSplit ? 'tabs' : 'split')}
          title={showSplit ? t('exitSplitView') : t('enterSplitView')}
        >
          {showSplit ? (
            <Rows3 className="h-3.5 w-3.5" />
          ) : (
            <Columns3 className="h-3.5 w-3.5" />
          )}
        </Button>
      )}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={() => setIsFullscreen((v) => !v)}
        title={isFullscreen ? t('exitFullscreen') : t('enterFullscreen')}
      >
        {isFullscreen ? (
          <Minimize2 className="h-3.5 w-3.5" />
        ) : (
          <Maximize2 className="h-3.5 w-3.5" />
        )}
      </Button>
    </div>
  );

  return (
    <div
      className={cn(
        'flex flex-col gap-2 overflow-hidden',
        isFullscreen ? 'fixed inset-0 z-[100] bg-background p-4' : className
      )}
    >
      {warnings}

      {showSplit ? (
        <div className="flex flex-1 flex-col gap-2 overflow-hidden">
          <div className="relative flex h-9 shrink-0 items-center rounded-t-md border-b bg-muted/30 px-3">
            <span className="text-xs font-medium text-muted-foreground">
              {t('splitViewLabel')}
            </span>
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {toolbarActions}
            </div>
          </div>
          <div className="grid flex-1 gap-3 overflow-hidden lg:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_320px]">
            <div className="flex min-h-64 flex-col overflow-hidden rounded-lg border">
              <div className="shrink-0 border-b bg-muted/30 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                {t('tabPreview')}
              </div>
              <div className="flex-1 overflow-hidden p-2">{previewPanel}</div>
            </div>
            <div className="flex min-h-64 flex-col overflow-hidden rounded-lg border">
              <div className="shrink-0 border-b bg-muted/30 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                {t('tabCode')}
              </div>
              <div className="flex-1 overflow-hidden">{codePanel}</div>
            </div>
            {showAiEdit && aiEdit && (
              <div className="flex min-h-64 flex-col overflow-hidden rounded-lg border">
                <div className="flex shrink-0 items-center gap-1.5 border-b bg-muted/30 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                  <Sparkles className="h-3.5 w-3.5 text-violet-600" />
                  {aiEdit.title ?? t('aiEditTitle')}
                </div>
                <div className="flex-1 space-y-2 overflow-y-auto p-3">
                  {aiPanelBody}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as HtmlContentEditorTab)}
          className="flex flex-1 flex-col gap-2 overflow-hidden"
        >
          <div className="relative">
            <TabsList className="w-full">
              <TabsTrigger value="preview" className="flex-1">
                {t('tabPreview')}
              </TabsTrigger>
              {showEditorTab && (
                <TabsTrigger value="editor" className="flex-1">
                  {t('tabEditor')}
                </TabsTrigger>
              )}
              {showCodeTab && (
                <TabsTrigger value="code" className="flex-1">
                  {t('tabCode')}
                </TabsTrigger>
              )}
            </TabsList>
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {toolbarActions}
            </div>
          </div>

          <TabsContent value="preview" className="mt-0 flex-1 overflow-hidden">
            {previewPanel}
          </TabsContent>

          {showEditorTab && (
            <TabsContent
              value="editor"
              className="mt-0 flex flex-1 flex-col overflow-hidden"
            >
              {hasComplexHtml && (
                <div className="mb-2 flex items-start gap-2 rounded-lg border border-amber-400/30 bg-amber-50 p-2.5 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    <span className="font-medium">
                      {t('complexHtmlWarningTitle')}
                    </span>
                    {' — '}
                    {t('complexHtmlWarningDesc')}
                  </span>
                </div>
              )}
              <RichTextEditor
                value={value}
                onChange={onChange}
                fill
                className="min-h-0 flex-1"
              />
            </TabsContent>
          )}

          {showCodeTab && (
            <TabsContent value="code" className="mt-0 flex-1 overflow-hidden">
              <div className="h-full min-h-64 overflow-hidden rounded-lg border">
                {codePanel}
              </div>
            </TabsContent>
          )}
        </Tabs>
      )}

      {!showSplit && showAiEdit && aiEdit && (
        <div className="shrink-0 space-y-2 border-t pt-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Sparkles className="h-4 w-4 text-violet-600" />
            {aiEdit.title ?? t('aiEditTitle')}
          </div>
          {aiPanelBody}
        </div>
      )}
    </div>
  );
}
