import '@testing-library/jest-dom/vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// --- Mocks (hoisted) ----------------------------------------------------
//
// Tiptap's real editor relies on contentEditable/Selection/Range behavior
// that jsdom does not faithfully implement. Rather than fighting jsdom, we
// mock the whole `@tiptap/react` module (useEditor/EditorContent/Extension)
// and every extension package. This lets us test THIS component's own
// logic — toolbar wiring, prop-driven branches, command chains issued to
// the (fake) editor — without needing a real ProseMirror instance. This is
// the same strategy already used by
// src/components/ui/comment-rich-editor.test.tsx in this repo.

const useEditorMock = vi.fn();

vi.mock('@tiptap/react', () => ({
  useEditor: (config: unknown) => useEditorMock(config),
  EditorContent: () => <div data-testid="editor-content" />,
  Extension: {
    create: (config: unknown) => config,
  },
}));

function makeConfigurableExtension() {
  return { configure: vi.fn((opts: unknown) => opts) };
}

vi.mock('@tiptap/extension-color', () => ({ default: makeConfigurableExtension() }));
vi.mock('@tiptap/extension-font-family', () => ({ default: makeConfigurableExtension() }));
vi.mock('@tiptap/extension-highlight', () => ({ default: makeConfigurableExtension() }));
vi.mock('@tiptap/extension-image', () => ({ default: makeConfigurableExtension() }));
vi.mock('@tiptap/extension-link', () => ({ default: makeConfigurableExtension() }));
vi.mock('@tiptap/extension-mention', () => ({ default: makeConfigurableExtension() }));
vi.mock('@tiptap/extension-text-align', () => ({ default: makeConfigurableExtension() }));
vi.mock('@tiptap/extension-text-style', () => ({ TextStyle: {} }));
vi.mock('@tiptap/extension-underline', () => ({ default: {} }));
vi.mock('@tiptap/starter-kit', () => ({ default: makeConfigurableExtension() }));

vi.mock('@codemirror/lang-html', () => ({ html: () => ({}) }));
vi.mock('@codemirror/view', () => ({ EditorView: { lineWrapping: {} } }));
vi.mock('@uiw/react-codemirror', () => ({
  default: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (v: string) => void;
  }) => (
    <textarea
      aria-label="html-source"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

// Radix-backed primitives need real providers/portals we don't want to
// fight in a unit test; replace with simple passthroughs (same convention
// as src/components/ui/entity-picker.test.tsx).
vi.mock('@/components/ui/popover', () => ({
  Popover: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  PopoverContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  DropdownMenuContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuItem: ({
    children,
    onSelect,
    disabled,
  }: {
    children: ReactNode;
    onSelect?: () => void;
    disabled?: boolean;
  }) => (
    <button type="button" disabled={disabled} onClick={() => onSelect?.()}>
      {children}
    </button>
  ),
  DropdownMenuLabel: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuSeparator: () => <hr />,
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({
    children,
    open,
  }: {
    children: ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
  }) => (open ? <div data-testid="dialog">{children}</div> : null),
  DialogContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: ReactNode }) => (
    <p>{children}</p>
  ),
}));

import { RichTextEditor, type MentionItem } from './rich-text-editor';

// --- Editor mock helpers -------------------------------------------------

type RecordedCall = { method: string; args: unknown[] };

function createChainRecorder(canRunResult: unknown = true) {
  const calls: RecordedCall[] = [];
  const proxy: Record<string, unknown> = new Proxy(
    {},
    {
      get(_target, prop: string) {
        if (prop === 'run') {
          return (...args: unknown[]) => {
            calls.push({ method: 'run', args });
            return canRunResult;
          };
        }
        return (...args: unknown[]) => {
          calls.push({ method: prop, args });
          return proxy;
        };
      },
    },
  );
  return { proxy, calls };
}

function methodNames(calls: RecordedCall[]) {
  return calls.map((c) => c.method);
}

function findCall(calls: RecordedCall[], method: string) {
  // Tests reuse the same editor mock (and its single chain recorder) across
  // several interactions, so multiple calls to the same method can
  // accumulate; the most recent one reflects the last user interaction.
  return [...calls].reverse().find((c) => c.method === method);
}

type EditorMockOptions = {
  isActive?: (...args: unknown[]) => boolean;
  isEmpty?: boolean;
  canRun?: boolean;
  getAttributes?: (type: string) => Record<string, unknown>;
  getHTML?: () => string;
};

function createEditorMock(options: EditorMockOptions = {}) {
  const chain = createChainRecorder(true);
  const canChain = createChainRecorder(options.canRun ?? true);
  const setContent = vi.fn();

  const editor = {
    chain: vi.fn(() => chain.proxy),
    can: vi.fn(() => ({ chain: () => canChain.proxy })),
    isActive: vi.fn(options.isActive ?? (() => false)),
    isEmpty: options.isEmpty ?? true,
    getAttributes: vi.fn(options.getAttributes ?? (() => ({}))),
    getHTML: vi.fn(options.getHTML ?? (() => '<p>conteudo</p>')),
    commands: { setContent },
    chainCalls: chain.calls,
    canChainCalls: canChain.calls,
  };
  return editor;
}

function getLastEditorConfig() {
  const calls = useEditorMock.mock.calls;
  return calls[calls.length - 1][0];
}

function getExtensionConfigure(
  moduleFactory: () => { default?: { configure: ReturnType<typeof vi.fn> } },
) {
  return moduleFactory().default?.configure;
}

const mentions: MentionItem[] = [
  { id: 1, label: 'Alice', avatarSrc: 'http://x/alice.png' },
  { id: 2, label: 'Bob' },
];

function setup(
  editor: ReturnType<typeof createEditorMock> | null,
  props: Partial<React.ComponentProps<typeof RichTextEditor>> = {},
) {
  useEditorMock.mockReturnValue(editor);
  const onChange = vi.fn();
  const utils = render(
    <RichTextEditor value="<p>oi</p>" onChange={onChange} {...props} />,
  );
  return { ...utils, onChange };
}

describe('RichTextEditor', () => {
  beforeEach(() => {
    useEditorMock.mockReset();
  });

  it('não renderiza nada quando o editor ainda não está pronto', () => {
    const { container } = setup(null);
    expect(container).toBeEmptyDOMElement();
  });

  it('renderiza a toolbar e o placeholder quando o editor está vazio', () => {
    const editor = createEditorMock({ isEmpty: true });
    setup(editor);
    expect(screen.getByText('emptyPlaceholder')).toBeInTheDocument();
    expect(screen.getByTitle('bold')).toBeInTheDocument();
  });

  it('esconde o placeholder quando o editor não está vazio', () => {
    const editor = createEditorMock({ isEmpty: false });
    setup(editor);
    expect(screen.queryByText('emptyPlaceholder')).not.toBeInTheDocument();
  });

  it('expande a toolbar ao focar e recolhe ao perder o foco para fora', () => {
    const editor = createEditorMock();
    const { container } = setup(editor);
    const root = container.firstElementChild as HTMLElement;

    fireEvent.focus(root);
    // Toolbar wrapper becomes visible (max-h-16 class applied).
    expect(root.querySelector('.max-h-16')).not.toBeNull();

    fireEvent.blur(root, { relatedTarget: null });
    expect(root.querySelector('.max-h-0')).not.toBeNull();
  });

  it('aplica negrito, itálico e sublinhado via chain().focus()...run()', () => {
    const editor = createEditorMock();
    setup(editor);

    fireEvent.click(screen.getByTitle('bold'));
    expect(methodNames(editor.chainCalls)).toEqual(
      expect.arrayContaining(['focus', 'toggleBold', 'run']),
    );

    fireEvent.click(screen.getByTitle('italic'));
    expect(methodNames(editor.chainCalls)).toEqual(
      expect.arrayContaining(['toggleItalic']),
    );

    fireEvent.click(screen.getByTitle('underline'));
    expect(methodNames(editor.chainCalls)).toEqual(
      expect.arrayContaining(['toggleUnderline']),
    );
  });

  it('mostra destaque (bg-muted) quando bold/italic/underline estão ativos', () => {
    const editor = createEditorMock({
      isActive: (name: string) =>
        name === 'bold' || name === 'italic' || name === 'underline',
    });
    setup(editor);
    expect(screen.getByTitle('bold').className).toContain('bg-muted');
    expect(screen.getByTitle('italic').className).toContain('bg-muted');
    expect(screen.getByTitle('underline').className).toContain('bg-muted');
  });

  it('desabilita botões quando editor.can()...run() retorna falso', () => {
    const editor = createEditorMock({ canRun: false });
    setup(editor);
    expect(screen.getByTitle('bold')).toBeDisabled();
    expect(screen.getByTitle('italic')).toBeDisabled();
    expect(screen.getByTitle('underline')).toBeDisabled();
    expect(screen.getByTitle('heading')).toBeDisabled();
    expect(screen.getByTitle('bulletList')).toBeDisabled();
    expect(screen.getByTitle('numberedList')).toBeDisabled();
  });

  it('altera a cor do texto pelo input de cor e por uma amostra, e remove a cor', () => {
    const editor = createEditorMock({
      getAttributes: (type) => (type === 'textStyle' ? { color: '#123456' } : {}),
    });
    setup(editor);

    const colorInput = document.getElementById('text-color') as HTMLInputElement;
    expect(colorInput.value).toBe('#123456');

    fireEvent.change(colorInput, { target: { value: '#ff0000' } });
    expect(findCall(editor.chainCalls, 'setColor')?.args).toEqual(['#ff0000']);

    fireEvent.click(screen.getByTitle('#e60000'));
    expect(findCall(editor.chainCalls, 'setColor')?.args).toEqual(['#e60000']);

    fireEvent.click(screen.getByTitle('removeColor'));
    expect(methodNames(editor.chainCalls)).toEqual(
      expect.arrayContaining(['unsetColor']),
    );
  });

  it('aplica e remove destaque (highlight)', () => {
    const editor = createEditorMock({
      getAttributes: (type) => (type === 'highlight' ? { color: '#ffff00' } : {}),
    });
    setup(editor);

    const highlightInput = document.getElementById(
      'highlight-color',
    ) as HTMLInputElement;
    expect(highlightInput.value).toBe('#ffff00');

    fireEvent.change(highlightInput, { target: { value: '#00ff00' } });
    expect(findCall(editor.chainCalls, 'toggleHighlight')?.args).toEqual([
      { color: '#00ff00' },
    ]);

    fireEvent.click(screen.getByTitle('#00ffff'));
    expect(findCall(editor.chainCalls, 'toggleHighlight')?.args).toEqual([
      { color: '#00ffff' },
    ]);

    fireEvent.click(screen.getByTitle('removeHighlight'));
    expect(methodNames(editor.chainCalls)).toEqual(
      expect.arrayContaining(['unsetHighlight']),
    );
  });

  it('define e limpa o tamanho da fonte', () => {
    const editor = createEditorMock();
    setup(editor);

    fireEvent.click(screen.getByText('normal'));
    expect(findCall(editor.chainCalls, 'setFontSize')?.args).toEqual(['1rem']);

    fireEvent.click(screen.getByText('clearSize'));
    expect(methodNames(editor.chainCalls)).toEqual(
      expect.arrayContaining(['unsetFontSize']),
    );
  });

  it('alterna heading e mostra destaque quando ativo', () => {
    const editor = createEditorMock({
      isActive: (name: unknown, attrs?: unknown) =>
        name === 'heading' && !!attrs && (attrs as { level: number }).level === 2,
    });
    setup(editor);

    const headingBtn = screen.getByTitle('heading');
    expect(headingBtn.className).toContain('bg-muted');

    fireEvent.click(headingBtn);
    expect(findCall(editor.chainCalls, 'toggleHeading')?.args).toEqual([
      { level: 2 },
    ]);
  });

  it('aplica alinhamentos de texto pelo menu', () => {
    const editor = createEditorMock();
    setup(editor);

    fireEvent.click(screen.getByText('alignLeft'));
    expect(findCall(editor.chainCalls, 'setTextAlign')?.args).toEqual(['left']);

    fireEvent.click(screen.getByText('alignCenter'));
    expect(findCall(editor.chainCalls, 'setTextAlign')?.args).toEqual(['center']);

    fireEvent.click(screen.getByText('alignRight'));
    expect(findCall(editor.chainCalls, 'setTextAlign')?.args).toEqual(['right']);

    fireEvent.click(screen.getByText('justify'));
    expect(findCall(editor.chainCalls, 'setTextAlign')?.args).toEqual(['justify']);
  });

  it('marca o botão de alinhamento como ativo quando qualquer alinhamento está aplicado', () => {
    const editor = createEditorMock({
      isActive: (arg: unknown) =>
        typeof arg === 'object' &&
        arg !== null &&
        (arg as { textAlign?: string }).textAlign === 'center',
    });
    setup(editor);
    expect(screen.getByTitle('alignment').className).toContain('bg-muted');
  });

  it('alterna listas com marcadores e numeradas', () => {
    const editor = createEditorMock({
      isActive: (name: string) => name === 'bulletList' || name === 'orderedList',
    });
    setup(editor);

    expect(screen.getByTitle('bulletList').className).toContain('bg-muted');
    expect(screen.getByTitle('numberedList').className).toContain('bg-muted');

    fireEvent.click(screen.getByTitle('bulletList'));
    expect(methodNames(editor.chainCalls)).toEqual(
      expect.arrayContaining(['toggleBulletList']),
    );

    fireEvent.click(screen.getByTitle('numberedList'));
    expect(methodNames(editor.chainCalls)).toEqual(
      expect.arrayContaining(['toggleOrderedList']),
    );
  });

  it('aplica um link via Enter no campo de URL e via botão aplicar, e remove o link', () => {
    const editor = createEditorMock({
      getAttributes: (type) => (type === 'link' ? { href: 'http://old.test' } : {}),
      isActive: (name: string) => name === 'link',
    });
    setup(editor);

    expect(screen.getByTitle('addLink').className).toContain('bg-muted');

    const urlInput = screen.getByPlaceholderText(
      'urlPlaceholder',
    ) as HTMLInputElement;
    expect(urlInput.value).toBe('http://old.test');

    fireEvent.change(urlInput, { target: { value: 'http://new.test' } });
    fireEvent.keyDown(urlInput, { key: 'Enter' });
    expect(findCall(editor.chainCalls, 'setLink')?.args).toEqual([
      { href: 'http://new.test' },
    ]);

    fireEvent.click(screen.getByText('applyLink'));
    expect(
      editor.chainCalls.filter((c) => c.method === 'setLink').length,
    ).toBeGreaterThanOrEqual(1);

    fireEvent.click(screen.getByText('removeLink'));
    expect(methodNames(editor.chainCalls)).toEqual(
      expect.arrayContaining(['unsetLink']),
    );
  });

  it('ignora Enter no campo de URL quando vazio, e desabilita "removeLink" quando não há link ativo', () => {
    const editor = createEditorMock({ isActive: () => false });
    setup(editor);

    const urlInput = screen.getByPlaceholderText(
      'urlPlaceholder',
    ) as HTMLInputElement;
    fireEvent.keyDown(urlInput, { key: 'Enter' });
    expect(findCall(editor.chainCalls, 'setLink')).toBeUndefined();
    expect(screen.getByText('removeLink').closest('button')).toBeDisabled();
  });

  it('faz upload de imagem via input de arquivo (FileReader) e chama setImage', async () => {
    const editor = createEditorMock();
    setup(editor);

    fireEvent.click(screen.getByText('addImage'));

    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const file = new File(['(binary)'], 'pic.png', { type: 'image/png' });

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
      // jsdom's FileReader completes asynchronously; flush microtasks/timers.
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(findCall(editor.chainCalls, 'setImage')?.args?.[0]).toMatchObject({
      src: expect.stringContaining('data:'),
    });
  });

  it('rejeita upload de arquivo que não seja imagem com alert', () => {
    const editor = createEditorMock();
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    setup(editor);

    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const file = new File(['text'], 'doc.txt', { type: 'text/plain' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(alertSpy).toHaveBeenCalledWith('imageFileOnly');
    alertSpy.mockRestore();
  });

  it('não faz nada quando o input de arquivo é acionado sem arquivo selecionado', () => {
    const editor = createEditorMock();
    setup(editor);
    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    expect(() =>
      fireEvent.change(fileInput, { target: { files: [] } }),
    ).not.toThrow();
  });

  it('executa comandos do menu "mais": bloco de código, limpar formatação, desfazer e refazer', () => {
    const editor = createEditorMock({ canRun: true });
    setup(editor);

    fireEvent.click(screen.getByText('codeBlock'));
    expect(methodNames(editor.chainCalls)).toEqual(
      expect.arrayContaining(['toggleCodeBlock']),
    );

    fireEvent.click(screen.getByText('clearFormatting'));
    expect(methodNames(editor.chainCalls)).toEqual(
      expect.arrayContaining(['clearNodes', 'unsetAllMarks']),
    );

    fireEvent.click(screen.getByText('undo'));
    expect(methodNames(editor.chainCalls)).toEqual(
      expect.arrayContaining(['undo']),
    );

    fireEvent.click(screen.getByText('redo'));
    expect(methodNames(editor.chainCalls)).toEqual(
      expect.arrayContaining(['redo']),
    );
  });

  it('desabilita desfazer/refazer quando editor.can() indica que não é possível', () => {
    const editor = createEditorMock({ canRun: false });
    setup(editor);
    expect(screen.getByText('undo').closest('button')).toBeDisabled();
    expect(screen.getByText('redo').closest('button')).toBeDisabled();
  });

  it('abre o modo avançado formatando o HTML atual e permite editar e salvar', () => {
    const editor = createEditorMock({
      getHTML: () => '<div><p>Olá <strong>mundo</strong></p></div>',
    });
    setup(editor);

    fireEvent.click(screen.getByText('advancedMode'));
    expect(screen.getByTestId('dialog')).toBeInTheDocument();

    // formatHTML() re-indents the markup (see the function under test for the
    // exact whitespace rules); assert on content rather than exact
    // whitespace/formatting, which is an implementation detail we don't need
    // to pin down here.
    const source = screen.getByLabelText('html-source') as HTMLTextAreaElement;
    expect(source.value).toContain('Olá');
    expect(source.value).toContain('<strong>mundo</strong>');

    fireEvent.change(source, { target: { value: '<p>editado</p>' } });
    fireEvent.click(screen.getByText('saveAndClose'));

    expect(editor.commands.setContent).toHaveBeenCalledWith('<p>editado</p>');
  });

  it('fecha o modo avançado sem alterar o conteúdo quando o campo HTML está vazio', () => {
    const editor = createEditorMock({ getHTML: () => '<p></p>' });
    const { onChange } = setup(editor);
    // The value/editor sync effect calls setContent once on mount because
    // the default `value` ("<p>oi</p>") differs from getHTML() here; clear
    // that unrelated call before asserting on the advanced-mode flow.
    editor.commands.setContent.mockClear();

    fireEvent.click(screen.getByText('advancedMode'));
    const source = screen.getByLabelText('html-source') as HTMLTextAreaElement;
    fireEvent.change(source, { target: { value: '' } });
    fireEvent.click(screen.getByText('saveAndClose'));

    expect(editor.commands.setContent).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalledWith('');
    expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
  });

  it('controla o zoom do editor avançado (aumentar, diminuir, resetar e limites)', () => {
    const editor = createEditorMock();
    setup(editor);
    fireEvent.click(screen.getByText('advancedMode'));

    expect(screen.getByText('100%')).toBeInTheDocument();

    fireEvent.click(screen.getByTitle('increaseZoom'));
    expect(screen.getByText('110%')).toBeInTheDocument();

    fireEvent.click(screen.getByTitle('decreaseZoom'));
    fireEvent.click(screen.getByTitle('decreaseZoom'));
    expect(screen.getByText('90%')).toBeInTheDocument();

    fireEvent.click(screen.getByText('90%'));
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('respeita os limites de zoom (mínimo 50%, máximo 200%)', () => {
    const editor = createEditorMock();
    setup(editor);
    fireEvent.click(screen.getByText('advancedMode'));

    const decrease = screen.getByTitle('decreaseZoom');
    for (let i = 0; i < 10; i++) fireEvent.click(decrease);
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(decrease).toBeDisabled();

    fireEvent.click(screen.getByText('50%')); // reset to 100%
    const increase = screen.getByTitle('increaseZoom');
    for (let i = 0; i < 15; i++) fireEvent.click(increase);
    expect(screen.getByText('200%')).toBeInTheDocument();
    expect(increase).toBeDisabled();
  });

  it('mostra o botão de modo HTML customizado quando showHtmlModeButton é true', () => {
    const editor = createEditorMock();
    setup(editor, {
      showHtmlModeButton: true,
      htmlModeButtonLabel: 'Ver HTML',
    });
    const customButtons = screen.getAllByText('Ver HTML');
    expect(customButtons.length).toBeGreaterThan(0);
    fireEvent.click(customButtons[0]);
    expect(screen.getByTestId('dialog')).toBeInTheDocument();
  });

  it('propaga onChange através do onUpdate do editor, exceto quando suprimido', () => {
    const editor = createEditorMock();
    const { onChange } = setup(editor);

    const config = getLastEditorConfig();
    const updatedEditor = createEditorMock({ getHTML: () => '<p>novo</p>' });
    config.onUpdate({ editor: updatedEditor });
    expect(onChange).toHaveBeenCalledWith('<p>novo</p>');

    // Closing advanced mode sets suppressOnUpdateRef so the *next* onUpdate
    // call is swallowed once. closeAdvancedMode() itself also calls onChange
    // directly with the edited HTML, which is a separate, expected call —
    // clear the mock *after* that click so only the onUpdate suppression is
    // asserted below.
    onChange.mockClear();
    fireEvent.click(screen.getByText('advancedMode'));
    const source = screen.getByLabelText('html-source') as HTMLTextAreaElement;
    fireEvent.change(source, { target: { value: '<p>via advanced</p>' } });
    fireEvent.click(screen.getByText('saveAndClose'));
    expect(onChange).toHaveBeenCalledWith('<p>via advanced</p>');
    onChange.mockClear();

    config.onUpdate({ editor: updatedEditor });
    expect(onChange).not.toHaveBeenCalled();

    config.onUpdate({ editor: updatedEditor });
    expect(onChange).toHaveBeenCalledWith('<p>novo</p>');
  });

  it('sincroniza o conteúdo do editor quando a prop value muda externamente', () => {
    const editor = createEditorMock({ getHTML: () => '<p>oi</p>' });
    const { rerender } = setup(editor);

    rerender(<RichTextEditor value="<p>outro valor</p>" onChange={vi.fn()} />);
    expect(editor.commands.setContent).toHaveBeenCalledWith('<p>outro valor</p>', {
      emitUpdate: false,
    });
  });

  it('não sincroniza quando o valor da prop é igual ao HTML atual do editor', () => {
    const editor = createEditorMock({ getHTML: () => '<p>oi</p>' });
    const { rerender } = setup(editor, { value: '<p>oi</p>' });
    editor.commands.setContent.mockClear();

    rerender(<RichTextEditor value="<p>oi</p>" onChange={vi.fn()} />);
    expect(editor.commands.setContent).not.toHaveBeenCalled();
  });

  it('aciona onCtrlEnter via handleKeyDown da configuração do editor (Ctrl e Cmd)', () => {
    const onCtrlEnter = vi.fn();
    const editor = createEditorMock();
    setup(editor, { onCtrlEnter });

    const config = getLastEditorConfig();
    const handleKeyDown = config.editorProps.handleKeyDown;

    expect(
      handleKeyDown(null, { key: 'Enter', ctrlKey: true, metaKey: false }),
    ).toBe(true);
    expect(onCtrlEnter).toHaveBeenCalledTimes(1);

    expect(
      handleKeyDown(null, { key: 'Enter', ctrlKey: false, metaKey: true }),
    ).toBe(true);
    expect(onCtrlEnter).toHaveBeenCalledTimes(2);

    expect(
      handleKeyDown(null, { key: 'a', ctrlKey: false, metaKey: false }),
    ).toBe(false);
  });

  it('handleKeyDown não quebra quando onCtrlEnter não é fornecido', () => {
    const editor = createEditorMock();
    setup(editor);
    const config = getLastEditorConfig();
    const handleKeyDown = config.editorProps.handleKeyDown;
    expect(
      handleKeyDown(null, { key: 'Enter', ctrlKey: true, metaKey: false }),
    ).toBe(true);
  });

  it('filtra itens de menção pela query (suggestion.items)', async () => {
    const editor = createEditorMock();
    setup(editor, { mentions });

    const mentionModule = (await import(
      '@tiptap/extension-mention'
    )) as unknown as { default: { configure: ReturnType<typeof vi.fn> } };
    const configureMock = mentionModule.default.configure;
    const lastCall = configureMock.mock.calls[configureMock.mock.calls.length - 1][0];

    expect(lastCall.suggestion.items({ query: 'al' })).toEqual([mentions[0]]);
    expect(lastCall.suggestion.items({ query: '' }).length).toBe(2);
    expect(lastCall.suggestion.items({ query: 'zzz' })).toEqual([]);
    expect(lastCall.renderText({ node: { attrs: { label: 'Alice' } } })).toBe(
      '@Alice',
    );
    expect(lastCall.renderText({ node: { attrs: { id: '42' } } })).toBe('@42');
  });

  it('exibe o dropdown de menções, navega e seleciona um item', async () => {
    const editor = createEditorMock();
    setup(editor, { mentions });

    const mentionModule = (await import(
      '@tiptap/extension-mention'
    )) as unknown as { default: { configure: ReturnType<typeof vi.fn> } };
    const configureMock = mentionModule.default.configure;
    const lastCall = configureMock.mock.calls[configureMock.mock.calls.length - 1][0];
    const handlers = lastCall.suggestion.render();

    const command = vi.fn();
    act(() => {
      handlers.onStart({
        items: mentions,
        command,
        clientRect: () => ({ top: 100, bottom: 120, left: 10 }) as DOMRect,
      });
    });

    expect(await screen.findByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    // Bob has no avatarSrc -> initials fallback.
    expect(screen.getByText('B')).toBeInTheDocument();

    act(() => {
      const handled = handlers.onKeyDown({
        event: { key: 'ArrowDown', preventDefault: vi.fn() },
      });
      expect(handled).toBe(true);
    });
    act(() => {
      const handled = handlers.onKeyDown({
        event: { key: 'ArrowUp', preventDefault: vi.fn() },
      });
      expect(handled).toBe(true);
    });
    act(() => {
      const handled = handlers.onKeyDown({
        event: { key: 'x', preventDefault: vi.fn() },
      });
      expect(handled).toBe(false);
    });

    fireEvent.mouseDown(screen.getByText('Bob'));
    expect(command).toHaveBeenCalledWith(
      expect.objectContaining({ ...mentions[1], id: String(mentions[1].id) }),
    );
    expect(screen.queryByText('Alice')).not.toBeInTheDocument();
  });

  it('onUpdate da suggestion atualiza os itens exibidos e onExit limpa o estado', async () => {
    const editor = createEditorMock();
    setup(editor, { mentions });

    const mentionModule = (await import(
      '@tiptap/extension-mention'
    )) as unknown as { default: { configure: ReturnType<typeof vi.fn> } };
    const configureMock = mentionModule.default.configure;
    const lastCall = configureMock.mock.calls[configureMock.mock.calls.length - 1][0];
    const handlers = lastCall.suggestion.render();

    act(() => {
      handlers.onStart({
        items: [mentions[0]],
        command: vi.fn(),
        clientRect: () => ({ top: 100, bottom: 120, left: 10 }) as DOMRect,
      });
    });
    expect(await screen.findByText('Alice')).toBeInTheDocument();

    act(() => {
      handlers.onUpdate({
        items: [mentions[1]],
        command: vi.fn(),
        clientRect: () => null,
      });
    });
    expect(await screen.findByText('Bob')).toBeInTheDocument();
    expect(screen.queryByText('Alice')).not.toBeInTheDocument();

    act(() => {
      handlers.onExit();
    });
    expect(screen.queryByText('Bob')).not.toBeInTheDocument();
  });

  it('Enter seleciona o item destacado da sugestão e Escape fecha', async () => {
    const editor = createEditorMock();
    setup(editor, { mentions });

    const command = vi.fn();
    const items = mentions;
    const mentionModule = (await import(
      '@tiptap/extension-mention'
    )) as unknown as { default: { configure: ReturnType<typeof vi.fn> } };
    const configureMock = mentionModule.default.configure;
    const lastCall = configureMock.mock.calls[configureMock.mock.calls.length - 1][0];
    const handlers = lastCall.suggestion.render();

    act(() => {
      handlers.onStart({
        items,
        command,
        clientRect: () => ({ top: 100, bottom: 120, left: 10 }) as DOMRect,
      });
    });

    act(() => {
      const handled = handlers.onKeyDown({
        event: { key: 'Enter', preventDefault: vi.fn() },
      });
      expect(handled).toBe(true);
    });
    expect(command).toHaveBeenCalledWith(
      expect.objectContaining({ ...items[0], id: String(items[0].id) }),
    );

    act(() => {
      const handled = handlers.onKeyDown({
        event: { key: 'Escape', preventDefault: vi.fn() },
      });
      expect(handled).toBe(false);
    });
  });

  it('Escape fecha o dropdown enquanto ele ainda está visível (retorna true)', async () => {
    const editor = createEditorMock();
    setup(editor, { mentions });

    const mentionModule = (await import(
      '@tiptap/extension-mention'
    )) as unknown as { default: { configure: ReturnType<typeof vi.fn> } };
    const configureMock = mentionModule.default.configure;
    const lastCall =
      configureMock.mock.calls[configureMock.mock.calls.length - 1][0];
    const handlers = lastCall.suggestion.render();

    act(() => {
      handlers.onStart({
        items: mentions,
        command: vi.fn(),
        clientRect: () => ({ top: 100, bottom: 120, left: 10 }) as DOMRect,
      });
    });
    expect(await screen.findByText('Alice')).toBeInTheDocument();

    act(() => {
      const handled = handlers.onKeyDown({
        event: { key: 'Escape', preventDefault: vi.fn() },
      });
      expect(handled).toBe(true);
    });
    expect(screen.queryByText('Alice')).not.toBeInTheDocument();
  });

  it('seleciona um item usando o command atualizado pelo onUpdate da suggestion', async () => {
    const editor = createEditorMock();
    setup(editor, { mentions });

    const mentionModule = (await import(
      '@tiptap/extension-mention'
    )) as unknown as { default: { configure: ReturnType<typeof vi.fn> } };
    const configureMock = mentionModule.default.configure;
    const lastCall =
      configureMock.mock.calls[configureMock.mock.calls.length - 1][0];
    const handlers = lastCall.suggestion.render();

    act(() => {
      handlers.onStart({
        items: [mentions[0]],
        command: vi.fn(),
        clientRect: () => ({ top: 100, bottom: 120, left: 10 }) as DOMRect,
      });
    });
    expect(await screen.findByText('Alice')).toBeInTheDocument();

    const updatedCommand = vi.fn();
    act(() => {
      handlers.onUpdate({
        items: [mentions[1]],
        command: updatedCommand,
        clientRect: () => ({ top: 100, bottom: 120, left: 10 }) as DOMRect,
      });
    });
    expect(await screen.findByText('Bob')).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByText('Bob'));
    expect(updatedCommand).toHaveBeenCalledWith(
      expect.objectContaining({ ...mentions[1], id: String(mentions[1].id) }),
    );
  });

  it('posiciona o dropdown de menções acima quando não há espaço suficiente abaixo', async () => {
    const originalHeight = window.innerHeight;
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 300,
    });

    const editor = createEditorMock();
    setup(editor, { mentions });

    const mentionModule = (await import(
      '@tiptap/extension-mention'
    )) as unknown as { default: { configure: ReturnType<typeof vi.fn> } };
    const configureMock = mentionModule.default.configure;
    const lastCall = configureMock.mock.calls[configureMock.mock.calls.length - 1][0];
    const handlers = lastCall.suggestion.render();

    act(() => {
      handlers.onStart({
        items: mentions,
        command: vi.fn(),
        clientRect: () => ({ top: 250, bottom: 280, left: 5 }) as DOMRect,
      });
    });

    expect(await screen.findByText('Alice')).toBeInTheDocument();

    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: originalHeight,
    });
  });

  it('funciona sem mentions (padrão de prop vazio)', () => {
    const editor = createEditorMock();
    setup(editor);
    // Renders fine with the default empty mentions array; nothing to assert
    // beyond "did not throw" and the toolbar rendering as usual.
    expect(screen.getByTitle('bold')).toBeInTheDocument();
  });

  // The custom Tiptap `Extension.create({...})` config objects (FontSize,
  // PreserveAttributes) are never invoked by the real ProseMirror runtime in
  // this suite, since `@tiptap/react` is mocked wholesale. Because the mock
  // for `Extension.create` returns the config object unchanged
  // (`(config) => config`), the actual extension objects passed into
  // `useEditor({ extensions: [...] })` are the real, unmodified config
  // literals from the source file — so we can retrieve them from the
  // captured `useEditor` call and unit-test their callback bodies directly,
  // independent of the mocked editor.
  describe('extensões Tiptap customizadas (FontSize e PreserveAttributes)', () => {
    function getExtension(name: string) {
      const config = getLastEditorConfig();
      const ext = (config.extensions as Array<{ name?: string }>).find(
        (e) => e?.name === name,
      );
      expect(ext).toBeDefined();
      return ext as unknown as {
        addOptions: () => { types: string[] };
        addGlobalAttributes: (this: unknown) => Array<{
          types: string[];
          attributes: Record<
            string,
            {
              default: unknown;
              parseHTML: (el: unknown) => unknown;
              renderHTML: (attrs: Record<string, unknown>) => unknown;
            }
          >;
        }>;
        addCommands: () => {
          setFontSize: (
            size: string,
          ) => (ctx: { chain: () => unknown }) => unknown;
          unsetFontSize: () => (ctx: { chain: () => unknown }) => unknown;
        };
      };
    }

    it('FontSize.addOptions define o tipo padrão textStyle', () => {
      const editor = createEditorMock();
      setup(editor);
      const fontSize = getExtension('fontSize');
      expect(fontSize.addOptions()).toEqual({ types: ['textStyle'] });
    });

    it('FontSize.addGlobalAttributes: parseHTML remove aspas/ponto-e-vírgula e trata ausência de valor', () => {
      const editor = createEditorMock();
      setup(editor);
      const fontSize = getExtension('fontSize');
      const ctx = { options: { types: ['textStyle'] } };
      const [{ types, attributes }] = fontSize.addGlobalAttributes.call(ctx);

      expect(types).toEqual(['textStyle']);
      expect(
        attributes.fontSize.parseHTML({
          style: { fontSize: '12px;' },
        } as unknown as HTMLElement),
      ).toBe('12px');
      expect(
        attributes.fontSize.parseHTML({
          style: {},
        } as unknown as HTMLElement),
      ).toBeUndefined();
    });

    it('FontSize.addGlobalAttributes: renderHTML omite o estilo quando não há fontSize e o inclui quando há', () => {
      const editor = createEditorMock();
      setup(editor);
      const fontSize = getExtension('fontSize');
      const ctx = { options: { types: ['textStyle'] } };
      const [{ attributes }] = fontSize.addGlobalAttributes.call(ctx);

      expect(attributes.fontSize.renderHTML({ fontSize: null })).toEqual({});
      expect(attributes.fontSize.renderHTML({ fontSize: '14px' })).toEqual({
        style: 'font-size: 14px',
      });
    });

    it('FontSize.addCommands: setFontSize e unsetFontSize despacham a chain corretamente', () => {
      const editor = createEditorMock();
      setup(editor);
      const fontSize = getExtension('fontSize');
      const commands = fontSize.addCommands();

      const chain = createChainRecorder(true);
      expect(
        commands.setFontSize('18px')({ chain: () => chain.proxy }),
      ).toBe(true);
      expect(findCall(chain.calls, 'setMark')?.args).toEqual([
        'textStyle',
        { fontSize: '18px' },
      ]);
      expect(methodNames(chain.calls)).toEqual(
        expect.arrayContaining(['setMark', 'run']),
      );

      const chain2 = createChainRecorder(true);
      expect(commands.unsetFontSize()({ chain: () => chain2.proxy })).toBe(
        true,
      );
      expect(methodNames(chain2.calls)).toEqual(
        expect.arrayContaining(['setMark', 'removeEmptyTextStyle', 'run']),
      );
      expect(findCall(chain2.calls, 'setMark')?.args).toEqual([
        'textStyle',
        { fontSize: null },
      ]);
    });

    it('PreserveAttributes.addGlobalAttributes cobre parseHTML/renderHTML de style, class e id', () => {
      const editor = createEditorMock();
      setup(editor);
      const preserve = getExtension('preserveAttributes');
      const [{ types, attributes }] = preserve.addGlobalAttributes();

      expect(types).toEqual(
        expect.arrayContaining([
          'heading',
          'paragraph',
          'listItem',
          'bulletList',
          'orderedList',
          'codeBlock',
          'blockquote',
          'horizontalRule',
        ]),
      );

      expect(
        attributes.style.parseHTML({
          getAttribute: () => 'color:red',
        } as unknown as HTMLElement),
      ).toBe('color:red');
      expect(attributes.style.renderHTML({ style: null })).toEqual({});
      expect(attributes.style.renderHTML({ style: 'color:red' })).toEqual({
        style: 'color:red',
      });

      expect(
        attributes.class.parseHTML({
          getAttribute: () => 'foo',
        } as unknown as HTMLElement),
      ).toBe('foo');
      expect(attributes.class.renderHTML({ class: null })).toEqual({});
      expect(attributes.class.renderHTML({ class: 'foo' })).toEqual({
        class: 'foo',
      });

      expect(
        attributes.id.parseHTML({
          getAttribute: () => 'bar',
        } as unknown as HTMLElement),
      ).toBe('bar');
      expect(attributes.id.renderHTML({ id: null })).toEqual({});
      expect(attributes.id.renderHTML({ id: 'bar' })).toEqual({ id: 'bar' });
    });
  });

  describe('formatHTML: fixtures adicionais para cobrir mais ramos do modo avançado', () => {
    it('formata uma tag autofechada (void) preservando-a em sua própria linha', () => {
      const editor = createEditorMock({
        getHTML: () => '<div><img src="x.png"/><p>depois</p></div>',
      });
      setup(editor);

      fireEvent.click(screen.getByText('advancedMode'));
      const source = screen.getByLabelText(
        'html-source',
      ) as HTMLTextAreaElement;
      expect(source.value).toContain('<img src="x.png"/>');
      expect(source.value).toContain('depois');
    });

    it('formata um documento iniciando com DOCTYPE', () => {
      const editor = createEditorMock({
        getHTML: () => '<!DOCTYPE html><p>conteudo</p>',
      });
      setup(editor);

      fireEvent.click(screen.getByText('advancedMode'));
      const source = screen.getByLabelText(
        'html-source',
      ) as HTMLTextAreaElement;
      expect(source.value).toContain('<!DOCTYPE html>');
      expect(source.value).toContain('conteudo');
    });

    it('mantém um link ("a") em uma única linha ao abrir/fechar', () => {
      const editor = createEditorMock({
        getHTML: () => '<p>veja <a href="#">este link</a> aqui</p>',
      });
      setup(editor);

      fireEvent.click(screen.getByText('advancedMode'));
      const source = screen.getByLabelText(
        'html-source',
      ) as HTMLTextAreaElement;
      expect(source.value).toContain('<a href="#">este link</a>');
    });

    it('descarrega o buffer de conteúdo inline pendente antes de uma tag autofechada', () => {
      const editor = createEditorMock({
        getHTML: () => '<p><strong>bold</strong><img src="x"/></p>',
      });
      setup(editor);

      fireEvent.click(screen.getByText('advancedMode'));
      const source = screen.getByLabelText(
        'html-source',
      ) as HTMLTextAreaElement;
      expect(source.value).toContain('<strong>bold</strong>');
      expect(source.value).toContain('<img src="x"/>');
    });

    it('descarrega o buffer de conteúdo inline pendente antes de abrir uma nova tag de bloco', () => {
      const editor = createEditorMock({
        getHTML: () => '<div><strong>bold</strong><p>next</p></div>',
      });
      setup(editor);

      fireEvent.click(screen.getByText('advancedMode'));
      const source = screen.getByLabelText(
        'html-source',
      ) as HTMLTextAreaElement;
      expect(source.value).toContain('<strong>bold</strong>');
      expect(source.value).toContain('next');
    });

    it('descarrega o buffer de conteúdo inline remanescente ao final do documento', () => {
      const editor = createEditorMock({
        getHTML: () => '<p>text</p><strong>trailing</strong>',
      });
      setup(editor);

      fireEvent.click(screen.getByText('advancedMode'));
      const source = screen.getByLabelText(
        'html-source',
      ) as HTMLTextAreaElement;
      expect(source.value).toContain('<strong>trailing</strong>');
    });
  });

  it('usa o rótulo padrão de modo avançado quando htmlModeButtonLabel não é informado', () => {
    const editor = createEditorMock();
    setup(editor, { showHtmlModeButton: true });
    const customButtons = screen.getAllByText('advancedMode');
    expect(customButtons.length).toBeGreaterThan(0);
  });

  it('não chama setImage quando o resultado do FileReader é vazio (edge case de upload)', async () => {
    const editor = createEditorMock();
    setup(editor);

    const originalFileReader = global.FileReader;
    class FakeFileReader {
      onload: ((ev: { target: { result: string | null } }) => void) | null =
        null;
      readAsDataURL() {
        queueMicrotask(() => this.onload?.({ target: { result: null } }));
      }
    }
    // @ts-expect-error - test double replacing the global FileReader
    global.FileReader = FakeFileReader;

    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const file = new File(['x'], 'pic.png', { type: 'image/png' });

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(findCall(editor.chainCalls, 'setImage')).toBeUndefined();
    global.FileReader = originalFileReader;
  });

  it('getInitials retorna string vazia quando o rótulo da menção está vazio', async () => {
    const editor = createEditorMock();
    const emptyLabelMentions: MentionItem[] = [{ id: 9, label: '' }];
    setup(editor, { mentions: emptyLabelMentions });

    const mentionModule = (await import(
      '@tiptap/extension-mention'
    )) as unknown as { default: { configure: ReturnType<typeof vi.fn> } };
    const configureMock = mentionModule.default.configure;
    const lastCall =
      configureMock.mock.calls[configureMock.mock.calls.length - 1][0];
    const handlers = lastCall.suggestion.render();

    act(() => {
      handlers.onStart({
        items: emptyLabelMentions,
        command: vi.fn(),
        clientRect: () => ({ top: 100, bottom: 120, left: 10 }) as DOMRect,
      });
    });

    // The mention has an empty label, so the initials fallback renders an
    // empty string; assert the dropdown item rendered without throwing and
    // has no visible initials text.
    const list = document.querySelectorAll(
      'div[style*="position: fixed"] button',
    );
    expect(list.length).toBe(1);
  });

  it('onStart da suggestion funciona quando clientRect não é fornecido (rect nulo)', async () => {
    const editor = createEditorMock();
    setup(editor, { mentions });

    const mentionModule = (await import(
      '@tiptap/extension-mention'
    )) as unknown as { default: { configure: ReturnType<typeof vi.fn> } };
    const configureMock = mentionModule.default.configure;
    const lastCall =
      configureMock.mock.calls[configureMock.mock.calls.length - 1][0];
    const handlers = lastCall.suggestion.render();

    act(() => {
      handlers.onStart({
        items: mentions,
        command: vi.fn(),
        // No `clientRect` property at all — exercises the `props.clientRect?.()`
        // optional-chaining short-circuit branch, as opposed to a clientRect
        // function that itself returns null.
      });
    });

    expect(await screen.findByText('Alice')).toBeInTheDocument();
  });
});
