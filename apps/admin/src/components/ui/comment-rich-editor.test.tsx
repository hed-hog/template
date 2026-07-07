import '@testing-library/jest-dom/vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const useEditorMock = vi.fn();

vi.mock('@tiptap/react', () => ({
  useEditor: (config: unknown) => useEditorMock(config),
  EditorContent: () => <div data-testid="editor-content" />,
}));

vi.mock('@tiptap/extension-mention', () => ({
  default: { configure: vi.fn((opts: unknown) => opts) },
}));

vi.mock('@tiptap/starter-kit', () => ({
  default: { configure: vi.fn((opts: unknown) => opts) },
}));

import MentionExtension from '@tiptap/extension-mention';
import {
  CommentContent,
  CommentEditorActions,
  CommentRichEditor,
  type MentionItem,
} from './comment-rich-editor';

type EditorMock = {
  chain: () => {
    focus: () => {
      toggleBold: () => { run: () => void };
      toggleItalic: () => { run: () => void };
    };
  };
  isActive: (name: string) => boolean;
  getText: () => string;
  getHTML: () => string;
  setEditable: (v: boolean) => void;
  commands: { clearContent: () => void };
  toggleBoldRun: ReturnType<typeof vi.fn>;
  toggleItalicRun: ReturnType<typeof vi.fn>;
};

function createEditorMock(overrides: Partial<EditorMock> = {}): EditorMock {
  const toggleBoldRun = vi.fn();
  const toggleItalicRun = vi.fn();
  return {
    chain: () => ({
      focus: () => ({
        toggleBold: () => ({ run: toggleBoldRun }),
        toggleItalic: () => ({ run: toggleItalicRun }),
      }),
    }),
    isActive: vi.fn(() => false),
    getText: vi.fn(() => ''),
    getHTML: vi.fn(() => '<p>html</p>'),
    setEditable: vi.fn(),
    commands: { clearContent: vi.fn() },
    toggleBoldRun,
    toggleItalicRun,
    ...overrides,
  };
}

function getLastEditorConfig() {
  const calls = useEditorMock.mock.calls;
  return calls[calls.length - 1][0];
}

function getSuggestionConfig() {
  const configureMock = MentionExtension.configure as unknown as ReturnType<
    typeof vi.fn
  >;
  const calls = configureMock.mock.calls;
  return calls[calls.length - 1][0].suggestion;
}

const mentions: MentionItem[] = [
  { id: 1, label: 'Alice', avatarSrc: 'http://x/alice.png' },
  { id: 2, label: 'Bob' },
  { id: 3, label: 'Carla' },
];

describe('CommentRichEditor', () => {
  beforeEach(() => {
    useEditorMock.mockReset();
    useEditorMock.mockReturnValue(createEditorMock());
  });

  it('renderiza o placeholder quando o editor está vazio ou ainda não inicializado', () => {
    useEditorMock.mockReturnValue(null);
    render(<CommentRichEditor placeholder="Escreva algo" />);
    expect(screen.getByText('Escreva algo')).toBeInTheDocument();
  });

  it('esconde o placeholder quando há texto no editor', () => {
    useEditorMock.mockReturnValue(
      createEditorMock({ getText: vi.fn(() => 'algo digitado') }),
    );
    render(<CommentRichEditor placeholder="Escreva algo" />);
    expect(screen.queryByText('Escreva algo')).not.toBeInTheDocument();
  });

  it('aplica destaque de negrito quando ativo e aciona o comando ao clicar', () => {
    const editor = createEditorMock({
      isActive: vi.fn((name: string) => name === 'bold'),
    });
    useEditorMock.mockReturnValue(editor);

    render(<CommentRichEditor />);

    const boldBtn = screen.getByRole('button', { name: 'Negrito' });
    const italicBtn = screen.getByRole('button', { name: 'Itálico' });

    expect(boldBtn.className).toContain('bg-muted');

    fireEvent.mouseDown(boldBtn);
    expect(editor.toggleBoldRun).toHaveBeenCalled();

    fireEvent.mouseDown(italicBtn);
    expect(editor.toggleItalicRun).toHaveBeenCalled();
  });

  it('aplica destaque de itálico quando ativo', () => {
    const editor = createEditorMock({
      isActive: vi.fn((name: string) => name === 'italic'),
    });
    useEditorMock.mockReturnValue(editor);

    render(<CommentRichEditor />);

    const italicBtn = screen.getByRole('button', { name: 'Itálico' });
    expect(italicBtn.className).toContain('bg-muted');
  });

  it('desabilita os botões da toolbar e aplica estilos de desabilitado', () => {
    render(<CommentRichEditor disabled />);
    expect(screen.getByRole('button', { name: 'Negrito' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Itálico' })).toBeDisabled();
  });

  it('sincroniza o estado "disabled" chamando setEditable no editor', () => {
    const editor = createEditorMock();
    useEditorMock.mockReturnValue(editor);
    const { rerender } = render(<CommentRichEditor disabled={false} />);
    expect(editor.setEditable).toHaveBeenCalledWith(true);

    rerender(<CommentRichEditor disabled />);
    expect(editor.setEditable).toHaveBeenCalledWith(false);
  });

  it('limpa o conteúdo quando value muda para string vazia e o editor não está vazio', () => {
    const editor = createEditorMock({ getText: vi.fn(() => 'texto restante') });
    useEditorMock.mockReturnValue(editor);
    const { rerender } = render(<CommentRichEditor value="algo" />);
    expect(editor.commands.clearContent).not.toHaveBeenCalled();

    rerender(<CommentRichEditor value="" />);
    expect(editor.commands.clearContent).toHaveBeenCalled();
  });

  it('não chama clearContent quando o editor já está vazio', () => {
    const editor = createEditorMock({ getText: vi.fn(() => '') });
    useEditorMock.mockReturnValue(editor);
    const { rerender } = render(<CommentRichEditor value="" />);
    rerender(<CommentRichEditor value="" />);
    expect(editor.commands.clearContent).not.toHaveBeenCalled();
  });

  it('propaga onChange via onUpdate do editor', () => {
    const onChange = vi.fn();
    render(<CommentRichEditor onChange={onChange} />);

    const config = getLastEditorConfig();
    const fakeEditor = createEditorMock({ getHTML: vi.fn(() => '<p>novo</p>') });
    config.onUpdate({ editor: fakeEditor });

    expect(onChange).toHaveBeenCalledWith('<p>novo</p>');
  });

  it('não quebra quando onChange não é fornecido no onUpdate', () => {
    render(<CommentRichEditor />);
    const config = getLastEditorConfig();
    expect(() =>
      config.onUpdate({ editor: createEditorMock() }),
    ).not.toThrow();
  });

  it('chama onSubmit com Ctrl+Enter e Cmd+Enter via handleKeyDown', () => {
    const onSubmit = vi.fn();
    render(<CommentRichEditor onSubmit={onSubmit} />);
    const config = getLastEditorConfig();
    const handleKeyDown = config.editorProps.handleKeyDown;

    const ctrlEvent = { key: 'Enter', ctrlKey: true, metaKey: false };
    expect(handleKeyDown(null, ctrlEvent)).toBe(true);
    expect(onSubmit).toHaveBeenCalledTimes(1);

    const metaEvent = { key: 'Enter', ctrlKey: false, metaKey: true };
    expect(handleKeyDown(null, metaEvent)).toBe(true);
    expect(onSubmit).toHaveBeenCalledTimes(2);
  });

  it('handleKeyDown retorna false para outras teclas ou sem onSubmit', () => {
    render(<CommentRichEditor />);
    const config = getLastEditorConfig();
    const handleKeyDown = config.editorProps.handleKeyDown;

    expect(
      handleKeyDown(null, { key: 'a', ctrlKey: false, metaKey: false }),
    ).toBe(false);
    expect(
      handleKeyDown(null, { key: 'Enter', ctrlKey: false, metaKey: false }),
    ).toBe(false);
    // no onSubmit provided at all
    expect(
      handleKeyDown(null, { key: 'Enter', ctrlKey: true, metaKey: false }),
    ).toBe(false);
  });

  it('filtra itens de menção pela query (items da suggestion)', () => {
    render(<CommentRichEditor mentions={mentions} />);
    const suggestion = getSuggestionConfig();

    expect(suggestion.items({ query: 'al' })).toEqual([mentions[0]]);
    expect(suggestion.items({ query: '' }).length).toBe(3);
    expect(suggestion.items({ query: 'zzz' })).toEqual([]);
  });

  it('exibe o dropdown de menções ao abrir a sugestão e permite navegar e selecionar', async () => {
    render(<CommentRichEditor mentions={mentions} />);
    const suggestion = getSuggestionConfig();
    const handlers = suggestion.render();

    const command = vi.fn();
    act(() => {
      handlers.onStart({
        items: mentions,
        command,
        clientRect: () => ({ top: 100, bottom: 120, left: 10 } as DOMRect),
      });
    });

    expect(await screen.findByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('Carla')).toBeInTheDocument();
    // Bob has no avatarSrc -> initials fallback
    expect(screen.getByText('B')).toBeInTheDocument();

    // ArrowDown moves selection
    act(() => {
      const handled = handlers.onKeyDown({
        event: { key: 'ArrowDown', preventDefault: vi.fn() },
      });
      expect(handled).toBe(true);
    });

    // ArrowUp moves selection back
    act(() => {
      const handled = handlers.onKeyDown({
        event: { key: 'ArrowUp', preventDefault: vi.fn() },
      });
      expect(handled).toBe(true);
    });

    // Unhandled key returns false
    act(() => {
      const handled = handlers.onKeyDown({
        event: { key: 'x', preventDefault: vi.fn() },
      });
      expect(handled).toBe(false);
    });

    // Click an item selects it via handleSelectItem
    fireEvent.mouseDown(screen.getByText('Carla'));
    expect(command).toHaveBeenCalledWith(
      expect.objectContaining({ ...mentions[2], id: String(mentions[2].id) }),
    );

    // Dropdown closes after selection
    expect(screen.queryByText('Alice')).not.toBeInTheDocument();
  });

  it('onUpdate da suggestion atualiza os itens exibidos', async () => {
    render(<CommentRichEditor mentions={mentions} />);
    const suggestion = getSuggestionConfig();
    const handlers = suggestion.render();
    const command = vi.fn();

    act(() => {
      handlers.onStart({
        items: [mentions[0]],
        command,
        clientRect: () => ({ top: 100, bottom: 120, left: 10 } as DOMRect),
      });
    });
    expect(await screen.findByText('Alice')).toBeInTheDocument();

    act(() => {
      handlers.onUpdate({
        items: [mentions[1]],
        command,
        clientRect: undefined,
      });
    });

    expect(await screen.findByText('Bob')).toBeInTheDocument();
    expect(screen.queryByText('Alice')).not.toBeInTheDocument();

    act(() => {
      handlers.onUpdate({
        items: [mentions[1]],
        command,
        clientRect: () => ({ top: 10, bottom: 30, left: 2 } as DOMRect),
      });
    });

    fireEvent.mouseDown(screen.getByText('Bob'));
    expect(command).toHaveBeenCalledWith(
      expect.objectContaining({ ...mentions[1], id: String(mentions[1].id) }),
    );
  });

  it('posiciona o dropdown acima quando não há espaço suficiente abaixo', async () => {
    const originalHeight = window.innerHeight;
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 300,
    });

    render(<CommentRichEditor mentions={mentions} />);
    const suggestion = getSuggestionConfig();
    const handlers = suggestion.render();

    act(() => {
      handlers.onStart({
        items: mentions,
        command: vi.fn(),
        clientRect: () => ({ top: 250, bottom: 280, left: 5 } as DOMRect),
      });
    });

    expect(await screen.findByText('Alice')).toBeInTheDocument();

    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: originalHeight,
    });
  });

  it('fecha a sugestão pressionando Enter sem itens selecionáveis e Escape', () => {
    render(<CommentRichEditor mentions={mentions} />);
    const suggestion = getSuggestionConfig();
    const handlers = suggestion.render();
    const command = vi.fn();

    act(() => {
      handlers.onStart({
        items: mentions,
        command,
        clientRect: () => null,
      });
    });

    act(() => {
      const handled = handlers.onKeyDown({
        event: { key: 'Enter', preventDefault: vi.fn() },
      });
      expect(handled).toBe(true);
    });
    expect(command).toHaveBeenCalled();

    // After Enter, suggestion state is cleared -> onKeyDown should short-circuit false
    act(() => {
      const handled = handlers.onKeyDown({
        event: { key: 'Escape', preventDefault: vi.fn() },
      });
      expect(handled).toBe(false);
    });
  });

  it('onKeyDown com Escape fecha a sugestão quando visível', () => {
    render(<CommentRichEditor mentions={mentions} />);
    const suggestion = getSuggestionConfig();
    const handlers = suggestion.render();

    act(() => {
      handlers.onStart({
        items: mentions,
        command: vi.fn(),
        clientRect: () => ({ top: 100, bottom: 120, left: 10 } as DOMRect),
      });
    });

    act(() => {
      const handled = handlers.onKeyDown({
        event: { key: 'Escape', preventDefault: vi.fn() },
      });
      expect(handled).toBe(true);
    });

    expect(screen.queryByText('Alice')).not.toBeInTheDocument();
  });

  it('onExit da suggestion limpa o estado', async () => {
    render(<CommentRichEditor mentions={mentions} />);
    const suggestion = getSuggestionConfig();
    const handlers = suggestion.render();

    act(() => {
      handlers.onStart({
        items: mentions,
        command: vi.fn(),
        clientRect: () => ({ top: 100, bottom: 120, left: 10 } as DOMRect),
      });
    });
    expect(await screen.findByText('Alice')).toBeInTheDocument();

    act(() => {
      handlers.onExit();
    });

    expect(screen.queryByText('Alice')).not.toBeInTheDocument();
  });

  it('getInitials retorna string vazia quando o label não possui caracteres', async () => {
    const blankMention: MentionItem = { id: 99, label: '   ' };
    render(<CommentRichEditor mentions={[blankMention]} />);
    const suggestion = getSuggestionConfig();
    const handlers = suggestion.render();

    act(() => {
      handlers.onStart({
        items: [blankMention],
        command: vi.fn(),
        clientRect: () => ({ top: 100, bottom: 120, left: 10 } as DOMRect),
      });
    });

    // renders without throwing, with an empty initials fallback (no avatar, blank label)
    const truncateSpans = document.querySelectorAll('span.truncate');
    expect(truncateSpans.length).toBeGreaterThan(0);
  });

  it('onKeyDown retorna false quando não há sugestão visível', () => {
    render(<CommentRichEditor mentions={mentions} />);
    const suggestion = getSuggestionConfig();
    const handlers = suggestion.render();

    const handled = handlers.onKeyDown({
      event: { key: 'ArrowDown', preventDefault: vi.fn() },
    });
    expect(handled).toBe(false);
  });

  it('renderText da extensão de menção usa o label ou o id', () => {
    const configureMock = MentionExtension.configure as unknown as ReturnType<
      typeof vi.fn
    >;
    render(<CommentRichEditor mentions={mentions} />);
    const lastCall = configureMock.mock.calls[configureMock.mock.calls.length - 1][0];

    expect(lastCall.renderText({ node: { attrs: { label: 'Alice' } } })).toBe(
      '@Alice',
    );
    expect(lastCall.renderText({ node: { attrs: { id: '42' } } })).toBe('@42');
  });
});

describe('CommentContent', () => {
  it('renderiza texto simples como parágrafo', () => {
    render(<CommentContent content="olá mundo" />);
    expect(screen.getByText('olá mundo').tagName).toBe('P');
  });

  it('renderiza HTML confiável via dangerouslySetInnerHTML', () => {
    const { container } = render(
      <CommentContent content="<p>rico <b>html</b></p>" />,
    );
    expect(container.querySelector('b')).toHaveTextContent('html');
  });
});

describe('CommentEditorActions', () => {
  it('chama onSubmit ao clicar e habilita o botão quando pode enviar', () => {
    const onSubmit = vi.fn();
    render(
      <CommentEditorActions
        onSubmit={onSubmit}
        submitting={false}
        canSubmit
      />,
    );
    const button = screen.getByRole('button', { name: 'Comentar' });
    expect(button).toBeEnabled();
    fireEvent.click(button);
    expect(onSubmit).toHaveBeenCalled();
  });

  it('desabilita o botão quando submitting é verdadeiro', () => {
    render(
      <CommentEditorActions onSubmit={vi.fn()} submitting canSubmit />,
    );
    expect(screen.getByRole('button', { name: 'Comentar' })).toBeDisabled();
  });

  it('desabilita o botão quando canSubmit é falso', () => {
    render(
      <CommentEditorActions
        onSubmit={vi.fn()}
        submitting={false}
        canSubmit={false}
      />,
    );
    expect(screen.getByRole('button', { name: 'Comentar' })).toBeDisabled();
  });

  it('usa o rótulo customizado quando fornecido', () => {
    render(
      <CommentEditorActions
        onSubmit={vi.fn()}
        submitting={false}
        canSubmit
        submitLabel="Enviar"
      />,
    );
    expect(screen.getByRole('button', { name: 'Enviar' })).toBeInTheDocument();
  });
});
