'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { html } from '@codemirror/lang-html';
import { EditorView } from '@codemirror/view';
import Color from '@tiptap/extension-color';
import FontFamily from '@tiptap/extension-font-family';
import Highlight from '@tiptap/extension-highlight';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Mention from '@tiptap/extension-mention';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import Underline from '@tiptap/extension-underline';
import { EditorContent, Extension, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import CodeMirror from '@uiw/react-codemirror';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Code,
  Code2,
  Ellipsis,
  Eraser,
  Heading2,
  Highlighter,
  ImagePlus,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Palette,
  Redo,
  Type,
  Underline as UnderlineIcon,
  Undo,
  Unlink,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';

const FontSize = Extension.create({
  name: 'fontSize',

  addOptions() {
    return {
      types: ['textStyle'],
    };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) =>
              element.style.fontSize?.replace(/['";]/g, ''),
            renderHTML: (attributes) => {
              if (!attributes.fontSize) {
                return {};
              }
              return {
                style: `font-size: ${attributes.fontSize}`,
              };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setFontSize:
        (fontSize: string) =>
        ({ chain }) => {
          return chain().setMark('textStyle', { fontSize }).run();
        },
      unsetFontSize:
        () =>
        ({ chain }) => {
          return chain()
            .setMark('textStyle', { fontSize: null })
            .removeEmptyTextStyle()
            .run();
        },
    };
  },
});

const PreserveAttributes = Extension.create({
  name: 'preserveAttributes',

  addGlobalAttributes() {
    return [
      {
        types: [
          'heading',
          'paragraph',
          'listItem',
          'bulletList',
          'orderedList',
          'codeBlock',
          'blockquote',
          'horizontalRule',
        ],
        attributes: {
          style: {
            default: null,
            parseHTML: (element) => element.getAttribute('style'),
            renderHTML: (attributes) => {
              if (!attributes.style) {
                return {};
              }
              return { style: attributes.style };
            },
          },
          class: {
            default: null,
            parseHTML: (element) => element.getAttribute('class'),
            renderHTML: (attributes) => {
              if (!attributes.class) {
                return {};
              }
              return { class: attributes.class };
            },
          },
          id: {
            default: null,
            parseHTML: (element) => element.getAttribute('id'),
            renderHTML: (attributes) => {
              if (!attributes.id) {
                return {};
              }
              return { id: attributes.id };
            },
          },
        },
      },
    ];
  },
});

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

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  editorClassName?: string;
  mentions?: MentionItem[];
  onCtrlEnter?: () => void;
  showHtmlModeButton?: boolean;
  htmlModeButtonLabel?: string;
}

export function RichTextEditor({
  value,
  onChange,
  className,
  editorClassName,
  mentions = [],
  onCtrlEnter,
  showHtmlModeButton = false,
  htmlModeButtonLabel,
}: RichTextEditorProps) {
  const t = useTranslations('core.RichTextEditor');
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
  const [advancedMode, setAdvancedMode] = useState(false);
  const [tempHtmlValue, setTempHtmlValue] = useState('');
  const [editorZoom, setEditorZoom] = useState(100);
  const [isExpanded, setIsExpanded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const suppressOnUpdateRef = useRef(false);
  const onCtrlEnterRef = useRef(onCtrlEnter);
  useEffect(() => {
    onCtrlEnterRef.current = onCtrlEnter;
  }, [onCtrlEnter]);

  // Mention state
  const [suggestionState, setSuggestionState] =
    useState<SuggestionState | null>(null);
  const suggestionStateRef = useRef<SuggestionState | null>(null);
  // This initial callback is always synchronously replaced by the effect
  // below before mount completes, so it's never actually invoked in practice.
  /* v8 ignore next 4 */
  const setSuggestionRef = useRef<(s: SuggestionState | null) => void>((s) => {
    suggestionStateRef.current = s;
    setSuggestionState(s);
  });
  const mentionListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSuggestionRef.current = (s) => {
      suggestionStateRef.current = s;
      setSuggestionState(s);
    };
  }, []);

  const formatHTML = (html: string) => {
    let formatted = '';
    let indent = 0;
    const tab = '  ';

    const cleaned = html.replace(/>\s+</g, '><').trim();
    const inlineTags = ['span', 'strong', 'em', 'b', 'i', 'u', 'small', 'code'];
    const tokens = cleaned.split(/(<\/?[^>]+>)/g).filter((t) => t);
    let lineBuffer = '';

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];

      // `tokens` is pre-filtered with `.filter((t) => t)`, so `token` is
      // always truthy here — the `?.` fallback for a nullish token is unreachable.
      /* v8 ignore next */
      if (!token?.trim()) continue;
      if (token.match(/^<\/(\w+)>/)) {
        // The outer `if` already confirmed this regex matches with its
        // mandatory `(\w+)` group, so `?.[1]` is always defined here.
        /* v8 ignore next */
        const tagName = token.match(/^<\/(\w+)>/)?.[1] || '';
        const isInline = inlineTags.includes(tagName);

        if (isInline) {
          lineBuffer += token;
        } else if (tagName === 'a') {
          lineBuffer += token;
          if (lineBuffer.trim()) {
            formatted += tab.repeat(indent) + lineBuffer.trim() + '\n';
            lineBuffer = '';
          }
        } else {
          if (lineBuffer.trim()) {
            formatted += tab.repeat(indent) + lineBuffer.trim() + '\n';
            lineBuffer = '';
          }
          indent = Math.max(0, indent - 1);
          formatted += tab.repeat(indent) + token + '\n';
        }
      } else if (token.match(/^<\w+[^>]*\/>/) || token.match(/^<!DOCTYPE/i)) {
        if (lineBuffer.trim()) {
          formatted += tab.repeat(indent) + lineBuffer.trim() + '\n';
          lineBuffer = '';
        }
        formatted += tab.repeat(indent) + token + '\n';
      } else if (token.match(/^<(\w+)[^>]*>/)) {
        // Same reasoning as the closing-tag branch above: the outer `if`
        // already confirmed a match with a mandatory `(\w+)` group.
        /* v8 ignore next */
        const tagName = token.match(/^<(\w+)[^>]*>/)?.[1] || '';
        const isInline = inlineTags.includes(tagName);

        if (isInline) {
          lineBuffer += token;
        } else if (tagName === 'a') {
          if (lineBuffer.trim()) {
            formatted += tab.repeat(indent) + lineBuffer.trim() + '\n';
            lineBuffer = '';
          }
          lineBuffer = token;
        } else {
          if (lineBuffer.trim()) {
            formatted += tab.repeat(indent) + lineBuffer.trim() + '\n';
            lineBuffer = '';
          }
          formatted += tab.repeat(indent) + token + '\n';
          indent++;
        }
      } else {
        const content = token.trim();
        if (content) {
          lineBuffer += content;
        }
      }
    }

    if (lineBuffer.trim()) {
      formatted += tab.repeat(indent) + lineBuffer.trim() + '\n';
    }

    return formatted.trim();
  };

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        hardBreak: {
          keepMarks: true,
        },
        link: false,
        underline: false,
      }),
      Underline,
      TextStyle,
      FontSize,
      Color,
      Highlight.configure({
        multicolor: true,
      }),
      FontFamily,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-primary underline',
        },
      }),
      Image.configure({
        inline: true,
        allowBase64: true,
      }),
      PreserveAttributes,
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
            return mentions
              .filter((m) => m.label.toLowerCase().includes(q))
              .slice(0, 8);
          },
          render: () => ({
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
                setSuggestionRef.current({
                  ...s,
                  selectedIndex: (s.selectedIndex + 1) % s.items.length,
                });
                return true;
              }
              if (props.event.key === 'ArrowUp') {
                props.event.preventDefault();
                setSuggestionRef.current({
                  ...s,
                  selectedIndex:
                    (s.selectedIndex - 1 + s.items.length) % s.items.length,
                });
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
          }),
        },
      }),
    ],
    content: value,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          'prose prose-sm max-w-none min-w-0 w-full wrap-anywhere focus:outline-none px-4 py-3',
      },
      handleKeyDown: (_view, event) => {
        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
          onCtrlEnterRef.current?.();
          return true;
        }
        return false;
      },
    },
    parseOptions: {
      preserveWhitespace: 'full',
    },
    onUpdate: ({ editor }) => {
      if (suppressOnUpdateRef.current) {
        suppressOnUpdateRef.current = false;
        return;
      }
      onChange(editor.getHTML());
    },
  });

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [value, editor]);

  const handleCodeMirrorChange = (newValue: string) => {
    setTempHtmlValue(newValue);
  };

  const openAdvancedMode = () => {
    if (editor) {
      const formatted = formatHTML(editor.getHTML());
      setTempHtmlValue(formatted);
    }
    setAdvancedMode(true);
  };

  const closeAdvancedMode = () => {
    if (editor && tempHtmlValue) {
      onChange(tempHtmlValue);
      suppressOnUpdateRef.current = true;
      editor.commands.setContent(tempHtmlValue);
    }
    setAdvancedMode(false);
  };

  const handleZoomIn = () => {
    setEditorZoom((prev) => Math.min(prev + 10, 200));
  };

  const handleZoomOut = () => {
    setEditorZoom((prev) => Math.max(prev - 10, 50));
  };

  const handleResetZoom = () => {
    setEditorZoom(100);
  };

  const handleImageUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert(t('imageFileOnly'));
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      if (base64 && editor) {
        editor.chain().focus().setImage({ src: base64 }).run();
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  if (!mounted || !editor) {
    return null;
  }

  const handleSelectMention = (item: MentionItem) => {
    suggestionState?.command(item);
    setSuggestionRef.current(null);
  };

  return (
    <div
      onFocusCapture={() => setIsExpanded(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setIsExpanded(false);
        }
      }}
      className={cn(
        'min-w-0 w-full max-w-full overflow-hidden rounded-md border bg-background transition-shadow',
        isExpanded && 'shadow-sm',
        className
      )}
    >
      <div
        className={cn(
          'flex w-full min-w-0 flex-nowrap items-center gap-0.5 overflow-x-auto border-b bg-muted/50 px-0.5 py-0.5 transition-all duration-200',
          isExpanded
            ? 'max-h-16 opacity-100'
            : 'max-h-0 overflow-hidden border-b-0 py-0 opacity-0 pointer-events-none'
        )}
      >
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBold().run()}
          disabled={!editor.can().chain().focus().toggleBold().run()}
          className={editor.isActive('bold') ? 'bg-muted' : ''}
          title={t('bold')}
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          disabled={!editor.can().chain().focus().toggleItalic().run()}
          className={editor.isActive('italic') ? 'bg-muted' : ''}
          title={t('italic')}
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          disabled={!editor.can().chain().focus().toggleUnderline().run()}
          className={editor.isActive('underline') ? 'bg-muted' : ''}
          title={t('underline')}
        >
          <UnderlineIcon className="h-4 w-4" />
        </Button>

        <div className="mx-0.5 w-px bg-border" />

        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              title={t('textColor')}
            >
              <Palette className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64">
            <div className="space-y-3">
              <div>
                <Label htmlFor="text-color">{t('textColor')}</Label>
                <div className="flex gap-2">
                  <Input
                    id="text-color"
                    type="color"
                    value={editor.getAttributes('textStyle').color || '#000000'}
                    onChange={(e) =>
                      editor.chain().focus().setColor(e.target.value).run()
                    }
                    className="h-10 w-full"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => editor.chain().focus().unsetColor().run()}
                    title={t('removeColor')}
                  >
                    <Eraser className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-6 gap-2">
                {[
                  '#000000',
                  '#e60000',
                  '#ff9900',
                  '#ffff00',
                  '#008a00',
                  '#0066cc',
                  '#9933ff',
                  '#ffffff',
                  '#facccc',
                  '#ffebcc',
                  '#ffffcc',
                  '#cce8cc',
                  '#cce0f5',
                  '#ebd6ff',
                ].map((color) => (
                  <button
                    key={color}
                    type="button"
                    className="h-8 w-8 rounded border border-border hover:scale-110 transition-transform"
                    style={{ backgroundColor: color }}
                    onClick={() => editor.chain().focus().setColor(color).run()}
                    title={color}
                  />
                ))}
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              title={t('highlightText')}
            >
              <Highlighter className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64">
            <div className="space-y-3">
              <div>
                <Label htmlFor="highlight-color">{t('highlightColor')}</Label>
                <div className="flex gap-2">
                  <Input
                    id="highlight-color"
                    type="color"
                    value={editor.getAttributes('highlight').color || '#ffff00'}
                    onChange={(e) =>
                      editor
                        .chain()
                        .focus()
                        .toggleHighlight({ color: e.target.value })
                        .run()
                    }
                    className="h-10 w-full"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      editor.chain().focus().unsetHighlight().run()
                    }
                    title={t('removeHighlight')}
                  >
                    <Eraser className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-6 gap-2">
                {[
                  '#ffff00',
                  '#00ffff',
                  '#ff00ff',
                  '#00ff00',
                  '#ff8800',
                  '#8800ff',
                  '#facccc',
                  '#cce0f5',
                  '#ffffcc',
                  '#cce8cc',
                  '#ffebcc',
                  '#ebd6ff',
                ].map((color) => (
                  <button
                    key={color}
                    type="button"
                    className="h-8 w-8 rounded border border-border hover:scale-110 transition-transform"
                    style={{ backgroundColor: color }}
                    onClick={() =>
                      editor.chain().focus().toggleHighlight({ color }).run()
                    }
                    title={color}
                  />
                ))}
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <div className="mx-0.5 w-px bg-border" />

        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              title={t('textSize')}
            >
              <Type className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48">
            <div className="space-y-2">
              <Label>{t('fontSize')}</Label>
              <div className="space-y-1">
                {[
                  { label: t('verySmall'), size: '0.75rem' },
                  { label: t('small'), size: '0.875rem' },
                  { label: t('normal'), size: '1rem' },
                  { label: t('large'), size: '1.25rem' },
                  { label: t('veryLarge'), size: '1.5rem' },
                  { label: t('extraLarge'), size: '2rem' },
                ].map((item) => (
                  <Button
                    key={item.size}
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start"
                    style={{ fontSize: item.size }}
                    onClick={() =>
                      editor.chain().focus().setFontSize(item.size).run()
                    }
                  >
                    {item.label}
                  </Button>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => editor.chain().focus().unsetFontSize().run()}
              >
                <Eraser className="mr-2 h-4 w-4" />
                {t('clearSize')}
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        <div className="mx-0.5 w-px bg-border" />

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
          disabled={
            !editor.can().chain().focus().toggleHeading({ level: 2 }).run()
          }
          className={editor.isActive('heading', { level: 2 }) ? 'bg-muted' : ''}
          title={t('heading')}
        >
          <Heading2 className="h-4 w-4" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={
                editor.isActive({ textAlign: 'left' }) ||
                editor.isActive({ textAlign: 'center' }) ||
                editor.isActive({ textAlign: 'right' }) ||
                editor.isActive({ textAlign: 'justify' })
                  ? 'bg-muted'
                  : ''
              }
              title={t('alignment')}
            >
              <AlignLeft className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>{t('alignment')}</DropdownMenuLabel>
            <DropdownMenuItem
              onSelect={() => editor.chain().focus().setTextAlign('left').run()}
            >
              <AlignLeft className="h-4 w-4" />
              {t('alignLeft')}
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() =>
                editor.chain().focus().setTextAlign('center').run()
              }
            >
              <AlignCenter className="h-4 w-4" />
              {t('alignCenter')}
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() =>
                editor.chain().focus().setTextAlign('right').run()
              }
            >
              <AlignRight className="h-4 w-4" />
              {t('alignRight')}
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() =>
                editor.chain().focus().setTextAlign('justify').run()
              }
            >
              <AlignJustify className="h-4 w-4" />
              {t('justify')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          disabled={!editor.can().chain().focus().toggleBulletList().run()}
          className={editor.isActive('bulletList') ? 'bg-muted' : ''}
          title={t('bulletList')}
        >
          <List className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          disabled={!editor.can().chain().focus().toggleOrderedList().run()}
          className={editor.isActive('orderedList') ? 'bg-muted' : ''}
          title={t('numberedList')}
        >
          <ListOrdered className="h-4 w-4" />
        </Button>

        <div className="mx-1 w-px bg-border" />

        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={editor.isActive('link') ? 'bg-muted' : ''}
              title={t('addLink')}
            >
              <LinkIcon className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80">
            <div className="space-y-3">
              <div>
                <Label htmlFor="link-url">{t('url')}</Label>
                <Input
                  id="link-url"
                  type="url"
                  placeholder={t('urlPlaceholder')}
                  defaultValue={editor.getAttributes('link').href || ''}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const url = e.currentTarget.value;
                      if (url) {
                        editor.chain().focus().setLink({ href: url }).run();
                      }
                    }
                  }}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    const url = document.getElementById(
                      'link-url'
                    ) as HTMLInputElement;
                    if (url?.value) {
                      editor.chain().focus().setLink({ href: url.value }).run();
                    }
                  }}
                >
                  {t('applyLink')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => editor.chain().focus().unsetLink().run()}
                  disabled={!editor.isActive('link')}
                >
                  <Unlink className="mr-2 h-4 w-4" />
                  {t('removeLink')}
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="sm" title={t('more')}>
              <Ellipsis className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{t('more')}</DropdownMenuLabel>
            <DropdownMenuItem
              onSelect={() => editor.chain().focus().toggleCodeBlock().run()}
            >
              <Code className="h-4 w-4" />
              {t('codeBlock')}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={handleImageUpload}>
              <ImagePlus className="h-4 w-4" />
              {t('addImage')}
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() =>
                editor.chain().focus().clearNodes().unsetAllMarks().run()
              }
            >
              <Eraser className="h-4 w-4" />
              {t('clearFormatting')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => editor.chain().focus().undo().run()}
              disabled={!editor.can().chain().focus().undo().run()}
            >
              <Undo className="h-4 w-4" />
              {t('undo')}
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => editor.chain().focus().redo().run()}
              disabled={!editor.can().chain().focus().redo().run()}
            >
              <Redo className="h-4 w-4" />
              {t('redo')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={openAdvancedMode}>
              <Code2 className="h-4 w-4" />
              {t('advancedMode')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {showHtmlModeButton && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={openAdvancedMode}
            title={htmlModeButtonLabel ?? t('advancedMode')}
          >
            <Code2 className="mr-1 h-4 w-4" />
            {htmlModeButtonLabel ?? t('advancedMode')}
          </Button>
        )}
      </div>
      <div className={cn('relative min-w-0 w-full max-w-full overflow-x-hidden overflow-y-auto max-h-[40vh]', editorClassName)}>
        {!isExpanded && editor.isEmpty && (
          <div className="pointer-events-none absolute left-4 top-3 text-sm text-muted-foreground">
            {t('emptyPlaceholder')}
          </div>
        )}
        <EditorContent
          editor={editor}
          className={cn(
            '[&_.ProseMirror]:min-w-0 [&_.ProseMirror]:w-full [&_.ProseMirror]:max-w-full [&_.ProseMirror]:overflow-x-hidden [&_.ProseMirror]:wrap-anywhere [&_.ProseMirror_*]:max-w-full [&_.ProseMirror_img]:h-auto [&_.ProseMirror_img]:max-w-full [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:pl-6 [&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:pl-6 [&_.ProseMirror_li]:ml-0',
            isExpanded
              ? '[&_.ProseMirror]:min-h-75'
              : '[&_.ProseMirror]:min-h-11 [&_.ProseMirror]:cursor-text'
          )}
        />
      </div>

      <Dialog open={advancedMode} onOpenChange={closeAdvancedMode}>
        <DialogContent className="max-w-[90vw] max-h-[98vh] w-full h-full overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>{t('advancedModeTitle')}</span>
              <div className="absolute top-12 right-6 flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleZoomOut}
                  disabled={editorZoom <= 50}
                  title={t('decreaseZoom')}
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleResetZoom}
                  title={t('resetZoom')}
                  className="min-w-15"
                >
                  {editorZoom}%
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleZoomIn}
                  disabled={editorZoom >= 200}
                  title={t('increaseZoom')}
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
              </div>
            </DialogTitle>
            <DialogDescription>
              {t('advancedModeDescription')}
            </DialogDescription>
          </DialogHeader>
          <div
            className="flex-1 overflow-hidden"
            style={{ fontSize: `${editorZoom}%` }}
          >
            <CodeMirror
              value={tempHtmlValue}
              height="calc(98vh - 150px)"
              extensions={[EditorView.lineWrapping, html()]}
              onChange={handleCodeMirrorChange}
              theme="dark"
              className="overflow-auto"
              basicSetup={{
                lineNumbers: true,
                foldGutter: true,
                highlightActiveLineGutter: true,
                highlightActiveLine: true,
                indentOnInput: true,
                bracketMatching: true,
                closeBrackets: true,
                autocompletion: true,
              }}
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" onClick={closeAdvancedMode}>
              {t('saveAndClose')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Mention suggestion dropdown */}
      {suggestionState?.visible && suggestionState.items.length > 0 && (
        <MentionDropdown
          ref={mentionListRef}
          state={suggestionState}
          onSelect={handleSelectMention}
        />
      )}
    </div>
  );
}

function MentionDropdown({
  state,
  onSelect,
  ref,
}: {
  state: SuggestionState;
  onSelect: (item: MentionItem) => void;
  ref: React.RefObject<HTMLDivElement | null>;
}) {
  const style = useMemo<React.CSSProperties>(() => {
    if (!state.rect || typeof window === 'undefined') return {};

    const rect = state.rect;
    const viewportH = window.innerHeight;
    const spaceBelow = viewportH - rect.bottom;

    if (spaceBelow < 200) {
      return { bottom: viewportH - rect.top, left: rect.left };
    }

    return { top: rect.bottom + 4, left: rect.left };
  }, [state.rect]);

  return (
    <div
      ref={ref}
      style={{ position: 'fixed', zIndex: 9999, ...style }}
      className="min-w-50 max-w-70 rounded-md border bg-popover text-popover-foreground shadow-md overflow-hidden"
    >
      {state.items.map((item, index) => (
        <button
          key={item.id}
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            onSelect(item);
          }}
          className={cn(
            'flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground',
            index === state.selectedIndex && 'bg-accent text-accent-foreground'
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
  );
}
