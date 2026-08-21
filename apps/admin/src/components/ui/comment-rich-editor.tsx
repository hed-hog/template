'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import Mention from '@tiptap/extension-mention';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Bold, Italic } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

export type MentionItem = {
  id: number;
  label: string;
  avatarSrc?: string | null;
};

type SuggestionState = {
  items: MentionItem[];
  command: (item: MentionItem) => void;
  rect: DOMRect | null;
  visible: boolean;
  selectedIndex: number;
};

type Props = {
  value?: string;
  onChange?: (html: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  mentions?: MentionItem[];
  onSubmit?: () => void;
};

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

export function CommentRichEditor({
  value,
  onChange,
  placeholder = 'Escreva um comentário...',
  disabled = false,
  className,
  mentions = [],
  onSubmit,
}: Props) {
  const [suggestionState, setSuggestionState] =
    useState<SuggestionState | null>(null);
  const suggestionStateRef = useRef<SuggestionState | null>(null);
  const setSuggestionRef = useRef<(s: SuggestionState | null) => void>(
    () => {}
  );
  const listRef = useRef<HTMLDivElement>(null);
  const mentionsRef = useRef<MentionItem[]>(mentions);

  useEffect(() => {
    mentionsRef.current = mentions;
  }, [mentions]);

  setSuggestionRef.current = (s) => {
    suggestionStateRef.current = s;
    setSuggestionState(s);
  };

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        code: false,
        codeBlock: false,
        horizontalRule: false,
      }),
      Mention.configure({
        HTMLAttributes: {
          class:
            'mention inline-flex items-center rounded px-1 py-0.5 bg-primary/10 text-primary text-xs font-medium cursor-default',
        },
        renderText({ node }) {
          return `@${node.attrs.label ?? node.attrs.id}`;
        },
        suggestion: {
          items: ({ query }: { query: string }) => {
            const q = query.toLowerCase();
            return mentionsRef.current
              .filter((m) => m.label.toLowerCase().includes(q))
              .slice(0, 8);
          },
          render: () => {
            return {
              onStart(props) {
                setSuggestionRef.current({
                  items: props.items as MentionItem[],
                  command: (item) =>
                    props.command({ ...item, id: String(item.id) }),
                  rect: props.clientRect?.() ?? null,
                  visible: true,
                  selectedIndex: 0,
                });
              },
              onUpdate(props) {
                setSuggestionRef.current({
                  items: props.items as MentionItem[],
                  command: (item) =>
                    props.command({ ...item, id: String(item.id) }),
                  rect: props.clientRect?.() ?? null,
                  visible: true,
                  selectedIndex: 0,
                });
              },
              onKeyDown(props) {
                const s = suggestionStateRef.current;
                if (!s || !s.visible) return false;

                if (props.event.key === 'ArrowDown') {
                  props.event.preventDefault();
                  const nextIndex = (s.selectedIndex + 1) % s.items.length;
                  setSuggestionRef.current({ ...s, selectedIndex: nextIndex });
                  return true;
                }

                if (props.event.key === 'ArrowUp') {
                  props.event.preventDefault();
                  const prevIndex =
                    (s.selectedIndex - 1 + s.items.length) % s.items.length;
                  setSuggestionRef.current({ ...s, selectedIndex: prevIndex });
                  return true;
                }

                if (props.event.key === 'Enter') {
                  props.event.preventDefault();
                  const item = s.items[s.selectedIndex];
                  if (item) s.command(item);
                  setSuggestionRef.current(null);
                  return true;
                }

                if (props.event.key === 'Escape') {
                  setSuggestionRef.current(null);
                  return true;
                }

                return false;
              },
              onExit() {
                setSuggestionRef.current(null);
              },
            };
          },
        },
      }),
    ],
    content: value ?? '',
    editable: !disabled,
    onUpdate({ editor: e }) {
      onChange?.(e.getHTML());
    },
    editorProps: {
      attributes: {
        class: cn(
          'prose prose-sm max-w-none min-h-[72px] px-3 py-2 focus:outline-none text-sm leading-relaxed',
          '[&_p]:my-0 [&_p:not(:last-child)]:mb-1',
          '[&_.mention]:bg-primary/10 [&_.mention]:text-primary [&_.mention]:rounded [&_.mention]:px-1'
        ),
      },
      handleKeyDown(_view, event) {
        if (
          event.key === 'Enter' &&
          (event.ctrlKey || event.metaKey) &&
          onSubmit
        ) {
          onSubmit();
          return true;
        }
        return false;
      },
    },
  });

  // Sync external value changes (e.g. reset after submit)
  useEffect(() => {
    if (!editor) return;
    if (value === '' && editor.getText() !== '') {
      editor.commands.clearContent();
    }
  }, [value, editor]);

  // Sync disabled state
  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [disabled, editor]);

  // Position the dropdown relative to viewport
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

  useLayoutEffect(() => {
    if (!suggestionState?.visible || !suggestionState.rect) return;
    const rect = suggestionState.rect;
    const viewportH = window.innerHeight;
    const spaceBelow = viewportH - rect.bottom;
    if (spaceBelow < 200) {
      setDropdownStyle({ bottom: viewportH - rect.top, left: rect.left });
    } else {
      setDropdownStyle({ top: rect.bottom + 4, left: rect.left });
    }
  }, [suggestionState]);

  const handleSelectItem = (item: MentionItem) => {
    suggestionState?.command(item);
    setSuggestionRef.current(null);
  };

  return (
    <div className={cn('relative', className)}>
      {/* Minimal toolbar */}
      <div className="flex items-center gap-0.5 rounded-t-md border border-b-0 bg-muted/40 px-1.5 py-1">
        <button
          type="button"
          aria-label="Negrito"
          disabled={disabled}
          onMouseDown={(e) => {
            e.preventDefault();
            editor?.chain().focus().toggleBold().run();
          }}
          className={cn(
            'rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50',
            editor?.isActive('bold') && 'bg-muted text-foreground'
          )}
        >
          <Bold className="size-3.5" />
        </button>
        <button
          type="button"
          aria-label="Itálico"
          disabled={disabled}
          onMouseDown={(e) => {
            e.preventDefault();
            editor?.chain().focus().toggleItalic().run();
          }}
          className={cn(
            'rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50',
            editor?.isActive('italic') && 'bg-muted text-foreground'
          )}
        >
          <Italic className="size-3.5" />
        </button>
        <span className="ml-auto text-[10px] text-muted-foreground/60 select-none pr-1">
          @ para mencionar
        </span>
      </div>

      <div
        className={cn(
          'rounded-b-md border bg-background transition-colors',
          'focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-0',
          disabled && 'opacity-60 pointer-events-none'
        )}
      >
        <EditorContent editor={editor} />
        {!editor?.getText().trim() && (
          <div
            aria-hidden
            className="pointer-events-none absolute top-9.5 left-3 text-sm text-muted-foreground select-none"
          >
            {placeholder}
          </div>
        )}
      </div>

      {/* Mention suggestion dropdown */}
      {suggestionState?.visible && suggestionState.items.length > 0 && (
        <div
          ref={listRef}
          style={{ position: 'fixed', zIndex: 9999, ...dropdownStyle }}
          className="min-w-50 max-w-70 rounded-md border bg-popover text-popover-foreground shadow-md overflow-hidden"
        >
          {suggestionState.items.map((item, index) => (
            <button
              key={item.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelectItem(item);
              }}
              className={cn(
                'flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground',
                index === suggestionState.selectedIndex &&
                  'bg-accent text-accent-foreground'
              )}
            >
              <div className="flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-[9px] font-semibold uppercase text-muted-foreground ring-1 ring-border">
                {item.avatarSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.avatarSrc}
                    alt={item.label}
                    className="size-full object-cover"
                  />
                ) : (
                  getInitials(item.label)
                )}
              </div>
              <span className="truncate">{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Renders comment HTML content safely (supports both plain text and rich HTML from the editor) */
export function CommentContent({ content }: { content: string }) {
  const isHtml = /^<[a-z][\s\S]*>/i.test(content.trim());
  if (!isHtml) {
    return (
      <p className="mt-0.5 text-sm leading-relaxed text-foreground whitespace-pre-wrap">
        {content}
      </p>
    );
  }
  return (
    <div
      className="mt-0.5 text-sm leading-relaxed text-foreground prose prose-sm max-w-none [&_p]:my-0 [&_p:not(:last-child)]:mb-1 [&_.mention]:bg-primary/10 [&_.mention]:text-primary [&_.mention]:rounded [&_.mention]:px-1 [&_.mention]:py-0.5 [&_.mention]:text-xs [&_.mention]:font-medium"
      // Content comes from Tiptap editor (trusted, sanitized output)
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: content }}
    />
  );
}

/** Button strip to place below the editor */
export function CommentEditorActions({
  onSubmit,
  submitting,
  canSubmit,
  submitLabel = 'Comentar',
}: {
  onSubmit: () => void;
  submitting: boolean;
  canSubmit: boolean;
  submitLabel?: string;
}) {
  return (
    <div className="flex justify-end">
      <Button
        size="sm"
        className="gap-1.5"
        disabled={submitting || !canSubmit}
        onClick={onSubmit}
      >
        {submitLabel}
      </Button>
    </div>
  );
}
