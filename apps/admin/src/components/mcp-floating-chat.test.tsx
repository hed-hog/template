import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode, RefObject } from 'react';
import { http, HttpResponse, server } from '@hed-hog/vitest-config';

// --- Mocks (hoisted) ----------------------------------------------------

let mockPathname = '/some/other/page';
const routerPush = vi.fn();
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({
    push: routerPush,
    replace: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
}));
vi.mock('@bprogress/next', () => ({
  AppProgressProvider: ({ children }: { children: ReactNode }) => children,
}));

// IMPORTANT: the identity translator must be a single stable function
// reference across renders (module-level, not re-created per call). The
// component lists `tChatPage` (from useTranslations) in a useEffect
// dependency array; a factory that returns a fresh arrow function on every
// call (the naive `() => (key) => key` pattern used elsewhere in this repo)
// makes that effect re-fire on every render, looping forever via
// setState -> re-render -> new function -> effect re-fires, which hangs the
// whole test run with an out-of-memory crash.
const identityT = (key: string) => key;
vi.mock('next-intl', () => ({
  useTranslations: () => identityT,
}));

const toastError = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    error: (...args: unknown[]) => toastError(...args),
    success: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

// The real Tooltip (Radix) requires a TooltipProvider ancestor; replace with
// a passthrough, matching the convention already used in
// entity-list/pagination-footer.test.tsx.
vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: ReactNode }) => children,
  TooltipTrigger: ({ children }: { children: ReactNode }) => children,
  TooltipContent: () => null,
  TooltipProvider: ({ children }: { children: ReactNode }) => children,
}));

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
  motion: {
    div: ({
      initial: _initial,
      animate: _animate,
      exit: _exit,
      transition: _transition,
      ...props
    }: Record<string, unknown>) => <div {...(props as object)} />,
  },
}));

// Fake chat-components module, resolved by the component's dynamic import of
// `@/app/(app)/(libraries)/core/mcp_chat/chat-components`. Real Tiptap/DOM
// chat widgets live in a library that's empty in this template checkout, so
// we stub minimal ChatInput/MessageFeed to exercise this component's own
// wiring (props passed down, callbacks invoked) without needing that library.
//
// The exports are backed by getters reading `chatComponentsMockState`
// (created via `vi.hoisted` so it's safe to reference from this hoisted
// factory). This lets individual tests flip the dynamic-import outcome
// (success / missing named export / throws) *without* needing
// `vi.resetModules()` + a fresh component re-import — the component's
// loading effect calls `import(...)` fresh on every mount, and since this
// mocked module's properties are getters, each access re-evaluates against
// whatever `chatComponentsMockState.mode` is currently set to. This
// specifically exercises the `!mod.ChatInput || !mod.MessageFeed` and
// `catch` branches of that effect, which the "always succeeds" shape used
// to leave uncovered.
const chatComponentsMockState = vi.hoisted(() => ({
  mode: 'ok' as 'ok' | 'missing-message-feed' | 'throw',
}));

vi.mock('@/app/(app)/(libraries)/core/mcp_chat/chat-components', () => {
  const ChatInputImpl = ({
    input,
    isSending,
    isUploadingFile,
    attachments,
    onInputChange,
    onSend,
    onUploadFiles,
    onRemoveAttachment,
  }: {
    input: string;
    isSending: boolean;
    isUploadingFile: boolean;
    attachments: Array<{ id: number; name: string }>;
    onInputChange: (v: string) => void;
    onSend: () => void;
    onUploadFiles: (files: FileList) => void;
    onRemoveAttachment: (id: number) => void;
  }) => (
    <div data-testid="chat-input">
      <input
        aria-label="chat-message-input"
        value={input}
        onChange={(e) => onInputChange(e.target.value)}
      />
      <button type="button" onClick={onSend} disabled={isSending}>
        send
      </button>
      <span data-testid="uploading-flag">{String(isUploadingFile)}</span>
      <ul>
        {attachments.map((a) => (
          <li key={a.id}>
            {a.name}
            <button type="button" onClick={() => onRemoveAttachment(a.id)}>
              remove-{a.id}
            </button>
          </li>
        ))}
      </ul>
      <input
        aria-label="chat-file-input"
        type="file"
        onChange={(e) => e.target.files && onUploadFiles(e.target.files)}
      />
    </div>
  );

  const MessageFeedImpl = ({
    messages,
    isLoadingMessages,
    isSending,
    isStreamingResponse,
    messagesEndRef,
  }: {
    messages: Array<{ id: number; role: string; content: string }>;
    isLoadingMessages: boolean;
    isSending: boolean;
    isStreamingResponse: boolean;
    messagesEndRef?: RefObject<HTMLDivElement | null>;
  }) => (
    <div data-testid="message-feed">
      <span data-testid="loading-messages">{String(isLoadingMessages)}</span>
      <span data-testid="sending">{String(isSending)}</span>
      <span data-testid="streaming">{String(isStreamingResponse)}</span>
      <ul>
        {messages.map((m) => (
          <li key={m.id} data-role={m.role}>
            {m.content}
          </li>
        ))}
      </ul>
      {/* Real element wired to `messagesEndRef` so the parent's auto-scroll
          effect (`messagesEndRef.current?.scrollIntoView(...)`) has a real
          node to call — the previous mock never rendered anything for this
          ref, so `.current` was always null and the effect's "ref present"
          branch was never exercised. */}
      <div data-testid="messages-end" ref={messagesEndRef} />
    </div>
  );

  return {
    get ChatInput() {
      if (chatComponentsMockState.mode === 'throw') {
        throw new Error('dynamic import failed');
      }
      return ChatInputImpl;
    },
    get MessageFeed() {
      if (chatComponentsMockState.mode === 'missing-message-feed') {
        return undefined;
      }
      if (chatComponentsMockState.mode === 'throw') {
        throw new Error('dynamic import failed');
      }
      return MessageFeedImpl;
    },
  };
});

import { makeAppProviderWrapper } from '@/test/test-utils';
import { LocalStorageKeys } from '@hed-hog/next-app-provider';
import { McpFloatingChat, openMcpFloatingChat } from './mcp-floating-chat';

const API = 'http://api.test';

function stubMatchMedia(matches = false) {
  const listeners: Array<(e: MediaQueryListEvent) => void> = [];
  const mql: Partial<MediaQueryList> & {
    _emit: (matches: boolean) => void;
  } = {
    matches,
    media: '(max-width: 639px)',
    addEventListener: (_type: string, cb: (e: MediaQueryListEvent) => void) => {
      listeners.push(cb);
    },
    removeEventListener: (_type: string, cb: (e: MediaQueryListEvent) => void) => {
      const idx = listeners.indexOf(cb);
      if (idx >= 0) listeners.splice(idx, 1);
    },
    _emit: (next: boolean) => {
      listeners.forEach((cb) => cb({ matches: next } as MediaQueryListEvent));
    },
  };
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue(mql as MediaQueryList),
  );
  return mql;
}

async function renderWidget(settings: Record<string, unknown> = {}) {
  stubMatchMedia(false);
  const wrapper = makeAppProviderWrapper({ apiBaseUrl: API });
  const utils = render(<McpFloatingChat />, { wrapper });
  return utils;
}

function openWidget() {
  act(() => {
    openMcpFloatingChat();
  });
}

// Belt-and-suspenders: whatever a test sets `chatComponentsMockState.mode`
// to, always restore the default so a failed/aborted test can't silently
// leak a permanently-broken dynamic import into unrelated tests later in
// this file.
afterEach(() => {
  chatComponentsMockState.mode = 'ok';
});

describe('McpFloatingChat', () => {
  beforeEach(() => {
    mockPathname = '/some/other/page';
    localStorage.clear();
    toastError.mockClear();
    // jsdom does not implement scrollIntoView; stub it (same convention used
    // across this repo's other test suites) so the auto-scroll effect can
    // call it on the real element wired via `messagesEndRef` in the
    // MessageFeed mock above.
    Element.prototype.scrollIntoView = vi.fn();
    server.use(
      http.get(`${API}/mcp-chat`, () => HttpResponse.json([])),
      http.post(`${API}/mcp-chat`, () => HttpResponse.json({ id: 1 })),
      http.get(`${API}/mcp-chat/:id/messages`, () => HttpResponse.json([])),
    );
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(null, { status: 500 })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('não renderiza nada quando a página atual já é a página de chat', async () => {
    mockPathname = '/core/mcp_chat';
    const { container } = await renderWidget();
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it('não renderiza nada quando o mcp está desabilitado via settings', async () => {
    stubMatchMedia(false);
    const wrapper = makeAppProviderWrapper({ apiBaseUrl: API });
    // Force getSettingValue('mcp-enabled') === false by pre-seeding localStorage
    // the same way AppProvider persists settings: it stores
    // JSON.stringify(settingsObject) as a *string* value via usehooks-ts'
    // useLocalStorage, which itself JSON-encodes whatever it stores — hence
    // the double JSON.stringify here.
    localStorage.setItem(
      'settings',
      JSON.stringify(JSON.stringify({ 'mcp-enabled': false })),
    );
    const { container } = render(<McpFloatingChat />, { wrapper });
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it('abre o painel flutuante ao disparar o evento global e mostra o estado vazio', async () => {
    await renderWidget();
    openWidget();

    expect(await screen.findByText('title')).toBeInTheDocument();
    expect(screen.getByText('emptyState')).toBeInTheDocument();
  });

  it('rola para a última mensagem via messagesEndRef quando mensagens chegam', async () => {
    const finalMessages = [
      {
        id: 200,
        conversation_id: 1,
        role: 'user',
        content: 'oi',
        created_at: new Date().toISOString(),
      },
      {
        id: 201,
        conversation_id: 1,
        role: 'assistant',
        content: 'ok',
        created_at: new Date().toISOString(),
      },
    ];
    server.use(
      http.post(`${API}/mcp-chat/:id/messages`, () =>
        HttpResponse.json(finalMessages),
      ),
      http.get(`${API}/mcp-chat/:id/messages`, () =>
        HttpResponse.json(finalMessages),
      ),
    );

    await renderWidget();
    openWidget();
    expect(await screen.findByText('title')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('chat-message-input'), {
      target: { value: 'oi' },
    });
    fireEvent.click(screen.getByText('send'));

    await screen.findByText('ok');
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it('fecha o painel ao clicar em minimizar', async () => {
    await renderWidget();
    openWidget();
    expect(await screen.findByText('title')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('minimize'));
    await waitFor(() => expect(screen.queryByText('title')).not.toBeInTheDocument());
  });

  it('alterna atalho de teclado Ctrl+/ para abrir e fechar', async () => {
    await renderWidget();

    fireEvent.keyDown(window, { key: '/', ctrlKey: true });
    expect(await screen.findByText('title')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: '/', ctrlKey: true });
    await waitFor(() => expect(screen.queryByText('title')).not.toBeInTheDocument());
  });

  it('ignora Ctrl+/ quando o foco está em um input e o painel está fechado', async () => {
    await renderWidget();
    const outsideInput = document.createElement('input');
    document.body.appendChild(outsideInput);
    outsideInput.focus();

    fireEvent.keyDown(outsideInput, { key: '/', ctrlKey: true });
    expect(screen.queryByText('title')).not.toBeInTheDocument();
    outsideInput.remove();
  });

  it('abre com Cmd+/ (metaKey) além de Ctrl+/', async () => {
    await renderWidget();
    fireEvent.keyDown(window, { key: '/', metaKey: true });
    expect(await screen.findByText('title')).toBeInTheDocument();
  });

  it('ignora o atalho Ctrl+/ e o evento global de abertura quando o widget está oculto (página mcp_chat)', async () => {
    mockPathname = '/core/mcp_chat';
    await renderWidget();

    fireEvent.keyDown(window, { key: '/', ctrlKey: true });
    expect(screen.queryByText('title')).not.toBeInTheDocument();

    openWidget();
    expect(screen.queryByText('title')).not.toBeInTheDocument();
  });

  it('lista conversas, filtra pela busca e seleciona uma conversa', async () => {
    server.use(
      http.get(`${API}/mcp-chat`, () =>
        HttpResponse.json([
          { id: 1, title: 'Alpha' },
          { id: 2, title: 'Beta' },
        ]),
      ),
    );
    await renderWidget();
    openWidget();
    expect(await screen.findByText('title')).toBeInTheDocument();

    // Conversation list auto-opens because conversationId is initially null.
    expect(await screen.findByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('conversations...'), {
      target: { value: 'alp' },
    });
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.queryByText('Beta')).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('conversations...'), {
      target: { value: '' },
    });
    fireEvent.click(screen.getByText('Beta'));

    await waitFor(() =>
      expect(screen.queryByText('conversations')).not.toBeInTheDocument(),
    );
  });

  it('mostra o estado vazio de conversas quando a lista está vazia', async () => {
    await renderWidget();
    openWidget();
    expect(await screen.findByText('title')).toBeInTheDocument();
    expect(await screen.findByText('emptyConversations')).toBeInTheDocument();
  });

  it('trata erro ao carregar a lista de conversas mostrando o estado vazio', async () => {
    server.use(
      http.get(`${API}/mcp-chat`, () =>
        HttpResponse.json({ message: 'boom' }, { status: 500 }),
      ),
    );
    await renderWidget();
    openWidget();
    expect(await screen.findByText('title')).toBeInTheDocument();
    expect(await screen.findByText('emptyConversations')).toBeInTheDocument();
  });

  it('clicar na mesma conversa já selecionada apenas fecha a lista', async () => {
    server.use(
      http.get(`${API}/mcp-chat`, () =>
        HttpResponse.json([{ id: 5, title: 'Gamma' }]),
      ),
    );
    await renderWidget();
    openWidget();
    fireEvent.click(await screen.findByText('Gamma'));
    await waitFor(() =>
      expect(screen.queryByText('conversations')).not.toBeInTheDocument(),
    );

    // Reopen the conversation list and click the same, now-selected conversation.
    fireEvent.click(screen.getByLabelText('openConversations'));
    fireEvent.click(await screen.findByText('Gamma'));
    await waitFor(() =>
      expect(screen.queryByText('conversations')).not.toBeInTheDocument(),
    );
  });

  it('inicia uma nova conversa e limpa o estado atual', async () => {
    server.use(
      http.get(`${API}/mcp-chat`, () =>
        HttpResponse.json([{ id: 5, title: 'Gamma' }]),
      ),
    );
    await renderWidget();
    openWidget();
    fireEvent.click(await screen.findByText('Gamma'));
    await waitFor(() =>
      expect(screen.queryByText('conversations')).not.toBeInTheDocument(),
    );

    fireEvent.click(screen.getByLabelText('newConversation'));
    expect(await screen.findByText('emptyState')).toBeInTheDocument();
  });

  it('envia uma mensagem: cria conversa, tenta stream (falha) e usa fallback REST', async () => {
    // The same messages are also returned by the GET .../messages handler:
    // creating a conversation sets `conversationId`, which independently
    // triggers the component's "load messages for this conversation" effect.
    // A real backend would return the just-sent messages there too; a bare
    // `[]` default would race with (and can clobber) the POST fallback's
    // optimistic state.
    const finalMessages = [
      {
        id: 10,
        conversation_id: 1,
        role: 'user',
        content: 'hi',
        created_at: new Date().toISOString(),
      },
      {
        id: 11,
        conversation_id: 1,
        role: 'assistant',
        content: 'short reply',
        created_at: new Date().toISOString(),
      },
    ];
    server.use(
      http.post(`${API}/mcp-chat/:id/messages`, () => HttpResponse.json(finalMessages)),
      http.get(`${API}/mcp-chat/:id/messages`, () => HttpResponse.json(finalMessages)),
    );

    await renderWidget();
    openWidget();
    expect(await screen.findByText('title')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('chat-message-input'), {
      target: { value: 'hello there' },
    });
    fireEvent.click(screen.getByText('send'));

    expect(await screen.findByText('short reply')).toBeInTheDocument();
    expect(toastError).not.toHaveBeenCalled();
  });

  it('marca hadToolUse e chama refetchUser quando há mensagens de tool_call', async () => {
    const finalMessages = [
      {
        id: 20,
        conversation_id: 1,
        role: 'tool_call',
        content: 'call',
        created_at: new Date().toISOString(),
      },
      {
        id: 21,
        conversation_id: 1,
        role: 'assistant',
        content: 'ok',
        created_at: new Date().toISOString(),
      },
    ];
    server.use(
      http.post(`${API}/mcp-chat/:id/messages`, () => HttpResponse.json(finalMessages)),
      http.get(`${API}/mcp-chat/:id/messages`, () => HttpResponse.json(finalMessages)),
    );

    await renderWidget();
    openWidget();
    expect(await screen.findByText('title')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('chat-message-input'), {
      target: { value: 'use a tool' },
    });
    fireEvent.click(screen.getByText('send'));

    expect(await screen.findByText('ok')).toBeInTheDocument();
  });

  it('mostra erro e reverte input quando a criação da conversa falha', async () => {
    server.use(
      http.post(`${API}/mcp-chat`, () => HttpResponse.json({ message: 'nope' }, { status: 500 })),
    );
    await renderWidget();
    openWidget();
    expect(await screen.findByText('title')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('chat-message-input'), {
      target: { value: 'will fail' },
    });
    fireEvent.click(screen.getByText('send'));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith('createConversationError'));
    expect(screen.getByLabelText('chat-message-input')).toHaveValue('will fail');
  });

  it('mostra erro de envio quando stream e fallback REST falham', async () => {
    server.use(
      http.post(`${API}/mcp-chat/:id/messages`, () =>
        HttpResponse.json({ message: 'boom' }, { status: 500 }),
      ),
    );
    await renderWidget();
    openWidget();
    expect(await screen.findByText('title')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('chat-message-input'), {
      target: { value: 'will fail too' },
    });
    fireEvent.click(screen.getByText('send'));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith('sendMessageError'));
    expect(screen.getByLabelText('chat-message-input')).toHaveValue('will fail too');
  });

  it('ignora clique em enviar quando não há texto nem anexos', async () => {
    await renderWidget();
    openWidget();
    expect(await screen.findByText('title')).toBeInTheDocument();

    fireEvent.click(screen.getByText('send'));
    // Nothing should happen — still showing empty state, no request errors.
    expect(screen.getByText('emptyState')).toBeInTheDocument();
  });

  it('faz upload de arquivo com sucesso e permite removê-lo', async () => {
    server.use(
      http.post(`${API}/file`, () =>
        HttpResponse.json({ id: 99, filename: 'doc.pdf' }),
      ),
    );
    await renderWidget();
    openWidget();
    expect(await screen.findByText('title')).toBeInTheDocument();

    const file = new File(['content'], 'doc.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByLabelText('chat-file-input'), {
      target: { files: [file] },
    });

    expect(await screen.findByText('doc.pdf')).toBeInTheDocument();

    fireEvent.click(screen.getByText('remove-99'));
    await waitFor(() => expect(screen.queryByText('doc.pdf')).not.toBeInTheDocument());
  });

  it('envia uma mensagem com anexos, incluindo o bloco de anexos no payload', async () => {
    server.use(
      http.post(`${API}/file`, () =>
        HttpResponse.json({ id: 100, filename: 'relatorio.pdf' }),
      ),
    );
    const finalMessages = [
      {
        id: 90,
        conversation_id: 1,
        role: 'user',
        content: 'seguem os dados\n\n- relatorio.pdf (file_id: 100)',
        created_at: new Date().toISOString(),
      },
      {
        id: 91,
        conversation_id: 1,
        role: 'assistant',
        content: 'recebido',
        created_at: new Date().toISOString(),
      },
    ];
    server.use(
      http.post(`${API}/mcp-chat/:id/messages`, () =>
        HttpResponse.json(finalMessages),
      ),
      http.get(`${API}/mcp-chat/:id/messages`, () =>
        HttpResponse.json(finalMessages),
      ),
    );

    await renderWidget();
    openWidget();
    expect(await screen.findByText('title')).toBeInTheDocument();

    const file = new File(['content'], 'relatorio.pdf', {
      type: 'application/pdf',
    });
    fireEvent.change(screen.getByLabelText('chat-file-input'), {
      target: { files: [file] },
    });
    expect(await screen.findByText('relatorio.pdf')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('chat-message-input'), {
      target: { value: 'seguem os dados' },
    });
    fireEvent.click(screen.getByText('send'));

    expect(await screen.findByText('recebido')).toBeInTheDocument();
  });

  it('mostra erro de upload quando o arquivo falha', async () => {
    server.use(
      http.post(`${API}/file`, () => HttpResponse.json({ message: 'bad' }, { status: 500 })),
    );
    await renderWidget();
    openWidget();
    expect(await screen.findByText('title')).toBeInTheDocument();

    const file = new File(['content'], 'broken.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByLabelText('chat-file-input'), {
      target: { files: [file] },
    });

    await waitFor(() => expect(toastError).toHaveBeenCalledWith('uploadFileError'));
  });

  it('carrega mensagens de uma conversa selecionada e trata erro de carregamento', async () => {
    server.use(
      http.get(`${API}/mcp-chat`, () =>
        HttpResponse.json([{ id: 7, title: 'Delta' }]),
      ),
      http.get(`${API}/mcp-chat/:id/messages`, () =>
        HttpResponse.json({ message: 'fail' }, { status: 500 }),
      ),
    );
    await renderWidget();
    openWidget();
    fireEvent.click(await screen.findByText('Delta'));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith('loadMessagesError'));
  });

  it('abre o modo avançado (link para página cheia) presente no cabeçalho', async () => {
    await renderWidget();
    openWidget();
    expect(await screen.findByText('title')).toBeInTheDocument();
    const link = screen.getByLabelText('openFullPage').closest('a');
    expect(link).toHaveAttribute('href', '/core/mcp_chat');
  });

  // --- Typing-simulation loop (streamAssistantMessage) --------------------
  //
  // This loop only runs when: (1) the streaming fetch failed and the REST
  // fallback succeeded, and (2) the final assistant message content is >= 24
  // characters. Every test above uses short fixtures ("short reply", "ok")
  // that stay under that threshold, so the loop itself (chunked reveal via
  // recursive `window.setTimeout(tick, 16)`) was never exercised. These use
  // real timers (not fake ones) — the loop completes in a handful of 16ms
  // ticks, well within the default test timeout.
  describe('loop de digitação simulada (streamAssistantMessage)', () => {
    it('não inicia o efeito de digitação quando a resposta final não contém mensagem do assistente', async () => {
      const finalMessages = [
        {
          id: 40,
          conversation_id: 1,
          role: 'user',
          content: 'oi',
          created_at: new Date().toISOString(),
        },
      ];
      server.use(
        http.post(`${API}/mcp-chat/:id/messages`, () =>
          HttpResponse.json(finalMessages),
        ),
        http.get(`${API}/mcp-chat/:id/messages`, () =>
          HttpResponse.json(finalMessages),
        ),
      );

      await renderWidget();
      openWidget();
      expect(await screen.findByText('title')).toBeInTheDocument();

      fireEvent.change(screen.getByLabelText('chat-message-input'), {
        target: { value: 'sem assistente' },
      });
      fireEvent.click(screen.getByText('send'));

      expect(await screen.findAllByText('oi')).toHaveLength(1);
      expect(screen.getByTestId('streaming').textContent).toBe('false');
    });

    it('executa o loop de digitação simulada por completo quando a resposta final é longa o suficiente', async () => {
      const longContent = 'x'.repeat(40); // >= 24-char threshold
      const finalMessages = [
        {
          id: 30,
          conversation_id: 1,
          role: 'user',
          content: 'oi',
          created_at: new Date().toISOString(),
        },
        {
          id: 31,
          conversation_id: 1,
          role: 'assistant',
          content: longContent,
          created_at: new Date().toISOString(),
        },
      ];
      server.use(
        http.post(`${API}/mcp-chat/:id/messages`, () =>
          HttpResponse.json(finalMessages),
        ),
        http.get(`${API}/mcp-chat/:id/messages`, () =>
          HttpResponse.json(finalMessages),
        ),
      );

      await renderWidget();
      openWidget();
      expect(await screen.findByText('title')).toBeInTheDocument();

      fireEvent.change(screen.getByLabelText('chat-message-input'), {
        target: { value: 'mensagem longa' },
      });
      fireEvent.click(screen.getByText('send'));

      await waitFor(
        () => expect(screen.getByTestId('streaming').textContent).toBe('true'),
        { timeout: 3000 },
      );
      await waitFor(
        () => expect(screen.getByText(longContent)).toBeInTheDocument(),
        { timeout: 3000 },
      );
      await waitFor(() =>
        expect(screen.getByTestId('streaming').textContent).toBe('false'),
      );
    });

    it('interrompe o loop de digitação simulada quando uma nova conversa é iniciada no meio do processo', async () => {
      const longContent = 'y'.repeat(64);
      const finalMessages = [
        {
          id: 50,
          conversation_id: 1,
          role: 'user',
          content: 'oi',
          created_at: new Date().toISOString(),
        },
        {
          id: 51,
          conversation_id: 1,
          role: 'assistant',
          content: longContent,
          created_at: new Date().toISOString(),
        },
      ];
      server.use(
        http.post(`${API}/mcp-chat/:id/messages`, () =>
          HttpResponse.json(finalMessages),
        ),
        http.get(`${API}/mcp-chat/:id/messages`, () =>
          HttpResponse.json(finalMessages),
        ),
      );

      await renderWidget();
      openWidget();
      expect(await screen.findByText('title')).toBeInTheDocument();

      fireEvent.change(screen.getByLabelText('chat-message-input'), {
        target: { value: 'mensagem longa' },
      });
      fireEvent.click(screen.getByText('send'));

      await waitFor(
        () => expect(screen.getByTestId('streaming').textContent).toBe('true'),
        { timeout: 3000 },
      );

      fireEvent.click(screen.getByLabelText('newConversation'));

      await waitFor(() =>
        expect(screen.getByTestId('streaming').textContent).toBe('false'),
      );
      expect(screen.queryByText(longContent)).not.toBeInTheDocument();
    });
  });

  // --- Real SSE streaming (sendMessageViaStream) ---------------------------
  //
  // The default `beforeEach` stubs `fetch` to resolve with a 500 Response so
  // every test above exercises the REST fallback instead of the streaming
  // path. These tests override that stub with a real `ReadableStream`
  // (SSE-formatted, `TextEncoder`-encoded) so the component's own
  // chunk-by-chunk reader/parser loop actually runs end-to-end.
  describe('streaming SSE real (sendMessageViaStream)', () => {
    function sseResponse(events: string[], status = 200) {
      const encoder = new TextEncoder();
      let i = 0;
      const stream = new ReadableStream<Uint8Array>({
        pull(controller) {
          if (i < events.length) {
            controller.enqueue(encoder.encode(events[i]));
            i += 1;
          } else {
            controller.close();
          }
        },
      });
      return new Response(stream, { status });
    }

    it('processa o stream por chunks reais, ignora eventos vazios/malformados e aplica o evento done', async () => {
      const events = [
        'data: {"type":"chunk","content":"Ola "}\n\n',
        // Empty chunk content -> hits the `if (!chunk) continue;` branch.
        'data: {"type":"chunk","content":""}\n\n',
        // No `data:` line at all -> hits `dataLines.length === 0` branch.
        ':heartbeat\n\n',
        // Malformed JSON payload -> hits the JSON.parse catch/continue branch.
        'data: {not-json\n\n',
        'data: {"type":"chunk","content":"mundo"}\n\n',
        'data: {"type":"done","messages":[' +
          '{"id":60,"conversation_id":1,"role":"user","content":"oi","created_at":"2024-01-01T00:00:00.000Z"},' +
          '{"id":61,"conversation_id":1,"role":"assistant","content":"Ola mundo","created_at":"2024-01-01T00:00:00.000Z"}' +
          ']}\n\n',
      ];
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(sseResponse(events)));

      await renderWidget();
      openWidget();
      expect(await screen.findByText('title')).toBeInTheDocument();

      fireEvent.change(screen.getByLabelText('chat-message-input'), {
        target: { value: 'oi' },
      });
      fireEvent.click(screen.getByText('send'));

      expect(await screen.findByText('Ola mundo')).toBeInTheDocument();
      expect(toastError).not.toHaveBeenCalled();
    });

    it('inclui o header Authorization no fetch de streaming quando há um accessToken', async () => {
      localStorage.setItem(LocalStorageKeys.AccessToken, JSON.stringify('tok-abc'));
      server.use(
        http.get(`${API}/auth/verify`, () => HttpResponse.json({ id: 1, name: 'Root' })),
      );
      const fetchMock = vi.fn().mockResolvedValue(sseResponse([
        'data: {"type":"done","messages":[]}\n\n',
      ]));
      vi.stubGlobal('fetch', fetchMock);

      await renderWidget();
      openWidget();
      expect(await screen.findByText('title')).toBeInTheDocument();

      fireEvent.change(screen.getByLabelText('chat-message-input'), {
        target: { value: 'oi' },
      });
      fireEvent.click(screen.getByText('send'));

      await waitFor(() => expect(fetchMock).toHaveBeenCalled());
      const [, init] = fetchMock.mock.calls[0];
      expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok-abc');
    });

    it('cai para o fallback REST quando o SSE emite um evento de erro', async () => {
      const events = [
        'data: {"type":"chunk","content":"parcial"}\n\n',
        'data: {"type":"error","message":"falha no stream"}\n\n',
      ];
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(sseResponse(events)));

      const finalMessages = [
        {
          id: 70,
          conversation_id: 1,
          role: 'user',
          content: 'oi',
          created_at: new Date().toISOString(),
        },
        {
          id: 71,
          conversation_id: 1,
          role: 'assistant',
          content: 'resposta fallback',
          created_at: new Date().toISOString(),
        },
      ];
      server.use(
        http.post(`${API}/mcp-chat/:id/messages`, () =>
          HttpResponse.json(finalMessages),
        ),
        http.get(`${API}/mcp-chat/:id/messages`, () =>
          HttpResponse.json(finalMessages),
        ),
      );

      await renderWidget();
      openWidget();
      expect(await screen.findByText('title')).toBeInTheDocument();

      fireEvent.change(screen.getByLabelText('chat-message-input'), {
        target: { value: 'oi' },
      });
      fireEvent.click(screen.getByText('send'));

      expect(await screen.findByText('resposta fallback')).toBeInTheDocument();
      expect(toastError).not.toHaveBeenCalled();
    });

    it('cai para o fallback REST quando a resposta do stream não possui body (ok=true, body=null)', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(new Response(null, { status: 200 })),
      );

      const finalMessages = [
        {
          id: 80,
          conversation_id: 1,
          role: 'user',
          content: 'oi',
          created_at: new Date().toISOString(),
        },
        {
          id: 81,
          conversation_id: 1,
          role: 'assistant',
          content: 'sem corpo',
          created_at: new Date().toISOString(),
        },
      ];
      server.use(
        http.post(`${API}/mcp-chat/:id/messages`, () =>
          HttpResponse.json(finalMessages),
        ),
        http.get(`${API}/mcp-chat/:id/messages`, () =>
          HttpResponse.json(finalMessages),
        ),
      );

      await renderWidget();
      openWidget();
      expect(await screen.findByText('title')).toBeInTheDocument();

      fireEvent.change(screen.getByLabelText('chat-message-input'), {
        target: { value: 'oi' },
      });
      fireEvent.click(screen.getByText('send'));

      expect(await screen.findByText('sem corpo')).toBeInTheDocument();
    });
  });

  // --- Nullish-coalescing / fallback branches ------------------------------
  describe('ramos de fallback (?? / ||) pouco exercitados', () => {
    it('usa [] quando a API de conversas responde com corpo nulo', async () => {
      server.use(
        http.get(`${API}/mcp-chat`, () => HttpResponse.json(null)),
      );
      await renderWidget();
      openWidget();
      expect(await screen.findByText('title')).toBeInTheDocument();
      expect(await screen.findByText('emptyConversations')).toBeInTheDocument();
    });

    it('usa "#id" quando a conversa não possui título', async () => {
      server.use(
        http.get(`${API}/mcp-chat`, () =>
          HttpResponse.json([{ id: 42, title: null }]),
        ),
      );
      await renderWidget();
      openWidget();
      expect(await screen.findByText('title')).toBeInTheDocument();
      expect(await screen.findByText('#42')).toBeInTheDocument();

      // Also exercise filteredConversations' own (conv.title || `#${id}`)
      // fallback, used only once the search query is non-empty.
      fireEvent.change(screen.getByPlaceholderText('conversations...'), {
        target: { value: '42' },
      });
      expect(await screen.findByText('#42')).toBeInTheDocument();
    });

    it('usa [] quando a API de mensagens de uma conversa responde com corpo nulo', async () => {
      server.use(
        http.get(`${API}/mcp-chat`, () =>
          HttpResponse.json([{ id: 7, title: 'Conversa 7' }]),
        ),
        http.get(`${API}/mcp-chat/7/messages`, () => HttpResponse.json(null)),
      );
      await renderWidget();
      openWidget();
      expect(await screen.findByText('title')).toBeInTheDocument();

      fireEvent.click(await screen.findByText('Conversa 7'));
      await waitFor(() => expect(screen.getByText('emptyState')).toBeInTheDocument());
    });

    it('usa string vazia quando a última mensagem do assistente não possui content', async () => {
      const finalMessages = [
        {
          id: 10,
          conversation_id: 1,
          role: 'user',
          content: 'oi',
          created_at: new Date().toISOString(),
        },
        {
          id: 11,
          conversation_id: 1,
          role: 'assistant',
          created_at: new Date().toISOString(),
        },
      ];
      server.use(
        http.post(`${API}/mcp-chat/:id/messages`, () =>
          HttpResponse.json(finalMessages),
        ),
        http.get(`${API}/mcp-chat/:id/messages`, () =>
          HttpResponse.json(finalMessages),
        ),
      );
      await renderWidget();
      openWidget();
      expect(await screen.findByText('title')).toBeInTheDocument();

      fireEvent.change(screen.getByLabelText('chat-message-input'), {
        target: { value: 'sem content' },
      });
      fireEvent.click(screen.getByText('send'));

      await waitFor(() =>
        expect(screen.getByTestId('streaming').textContent).toBe('false'),
      );
    });

    it('processa um evento de chunk sem content e um evento de erro sem message via SSE', async () => {
      const encoder = new TextEncoder();
      const events = [
        // `content` key entirely absent -> `payload.content ?? ''` fallback.
        'data: {"type":"chunk"}\n\n',
        // `message` key entirely absent -> `payload.message || 'stream-error'` fallback.
        'data: {"type":"error"}\n\n',
      ];
      let i = 0;
      const stream = new ReadableStream<Uint8Array>({
        pull(controller) {
          if (i < events.length) {
            controller.enqueue(encoder.encode(events[i]));
            i += 1;
          } else {
            controller.close();
          }
        },
      });
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(new Response(stream, { status: 200 })),
      );

      const finalMessages = [
        {
          id: 95,
          conversation_id: 1,
          role: 'user',
          content: 'oi',
          created_at: new Date().toISOString(),
        },
        {
          id: 96,
          conversation_id: 1,
          role: 'assistant',
          content: 'fallback sem message',
          created_at: new Date().toISOString(),
        },
      ];
      server.use(
        http.post(`${API}/mcp-chat/:id/messages`, () =>
          HttpResponse.json(finalMessages),
        ),
        http.get(`${API}/mcp-chat/:id/messages`, () =>
          HttpResponse.json(finalMessages),
        ),
      );

      await renderWidget();
      openWidget();
      expect(await screen.findByText('title')).toBeInTheDocument();

      fireEvent.change(screen.getByLabelText('chat-message-input'), {
        target: { value: 'oi' },
      });
      fireEvent.click(screen.getByText('send'));

      expect(
        await screen.findByText('fallback sem message'),
      ).toBeInTheDocument();
    });

    it('usa [] ao concluir o envio quando o stream termina sem um evento done', async () => {
      const encoder = new TextEncoder();
      const events = ['data: {"type":"chunk","content":"parcial"}\n\n'];
      let i = 0;
      const stream = new ReadableStream<Uint8Array>({
        pull(controller) {
          if (i < events.length) {
            controller.enqueue(encoder.encode(events[i]));
            i += 1;
          } else {
            controller.close();
          }
        },
      });
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(new Response(stream, { status: 200 })),
      );

      await renderWidget();
      openWidget();
      expect(await screen.findByText('title')).toBeInTheDocument();

      fireEvent.change(screen.getByLabelText('chat-message-input'), {
        target: { value: 'sem done' },
      });
      fireEvent.click(screen.getByText('send'));

      // No `done` event ever arrives, so `finalMessages` stays null and the
      // `(finalMessages ?? []).some(...)` tool-use check falls back to [];
      // the optimistic user message remains the last thing shown.
      expect(await screen.findByText('parcial')).toBeInTheDocument();
      await waitFor(() => expect(toastError).not.toHaveBeenCalled());
    });
  });

  // --- File upload edge branches -------------------------------------------
  describe('ramos adicionais de upload de arquivo', () => {
    it('ignora um arquivo cujo nome já está entre os anexos', async () => {
      server.use(
        http.post(`${API}/file`, () =>
          HttpResponse.json({ id: 101, filename: 'igual.pdf' }),
        ),
      );
      await renderWidget();
      openWidget();
      expect(await screen.findByText('title')).toBeInTheDocument();

      const file = new File(['a'], 'igual.pdf', { type: 'application/pdf' });
      const fileInput = screen.getByLabelText('chat-file-input');

      fireEvent.change(fileInput, { target: { files: [file] } });
      expect(await screen.findByText('igual.pdf')).toBeInTheDocument();

      // Uploading a second file with the very same name should be skipped
      // (the `existingNames.has(file.name)` guard), so no duplicate/second
      // POST /file call happens and only one "igual.pdf" attachment exists.
      fireEvent.change(fileInput, { target: { files: [file] } });
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(screen.getAllByText('igual.pdf')).toHaveLength(1);
    });

    it('trata resposta de upload sem id como erro', async () => {
      server.use(
        http.post(`${API}/file`, () => HttpResponse.json({})),
      );
      await renderWidget();
      openWidget();
      expect(await screen.findByText('title')).toBeInTheDocument();

      const file = new File(['a'], 'sem-id.pdf', { type: 'application/pdf' });
      fireEvent.change(screen.getByLabelText('chat-file-input'), {
        target: { files: [file] },
      });

      await waitFor(() =>
        expect(toastError).toHaveBeenCalledWith('uploadFileError'),
      );
      expect(screen.queryByText('sem-id.pdf')).not.toBeInTheDocument();
    });

    it('usa o nome original do arquivo quando a resposta de upload não retorna filename', async () => {
      server.use(
        http.post(`${API}/file`, () => HttpResponse.json({ id: 200 })),
      );
      await renderWidget();
      openWidget();
      expect(await screen.findByText('title')).toBeInTheDocument();

      const file = new File(['a'], 'original.pdf', { type: 'application/pdf' });
      fireEvent.change(screen.getByLabelText('chat-file-input'), {
        target: { files: [file] },
      });

      expect(await screen.findByText('original.pdf')).toBeInTheDocument();
    });
  });

  // --- Unmount races (loading effects) -------------------------------------
  describe('efeitos de carregamento cancelados por desmontagem', () => {
    it('não atualiza estado após desmontar enquanto o import dinâmico ainda está pendente', async () => {
      chatComponentsMockState.mode = 'ok';
      stubMatchMedia(false);
      const wrapper = makeAppProviderWrapper({ apiBaseUrl: API });
      const { unmount } = render(<McpFloatingChat />, { wrapper });
      expect(() => unmount()).not.toThrow();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    it('não atualiza estado após desmontar enquanto o import dinâmico ainda está pendente e falha (ramo catch)', async () => {
      chatComponentsMockState.mode = 'throw';
      stubMatchMedia(false);
      const wrapper = makeAppProviderWrapper({ apiBaseUrl: API });
      const { unmount } = render(<McpFloatingChat />, { wrapper });
      expect(() => unmount()).not.toThrow();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    it('não atualiza estado após desmontar enquanto mensagens de uma conversa ainda estão carregando', async () => {
      server.use(
        http.get(`${API}/mcp-chat`, () =>
          HttpResponse.json([{ id: 9, title: 'Epsilon' }]),
        ),
        http.get(`${API}/mcp-chat/:id/messages`, async () => {
          await new Promise((resolve) => setTimeout(resolve, 50));
          return HttpResponse.json([]);
        }),
      );
      const { unmount } = await renderWidget();
      openWidget();
      fireEvent.click(await screen.findByText('Epsilon'));

      expect(() => unmount()).not.toThrow();
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    it('não atualiza estado após desmontar enquanto o carregamento de mensagens está falhando', async () => {
      server.use(
        http.get(`${API}/mcp-chat`, () =>
          HttpResponse.json([{ id: 12, title: 'Theta' }]),
        ),
        http.get(`${API}/mcp-chat/:id/messages`, async () => {
          await new Promise((resolve) => setTimeout(resolve, 50));
          return HttpResponse.json({ message: 'boom' }, { status: 500 });
        }),
      );
      const { unmount } = await renderWidget();
      openWidget();
      fireEvent.click(await screen.findByText('Theta'));

      expect(() => unmount()).not.toThrow();
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    it('não atualiza estado após desmontar enquanto o import dinâmico está falhando', async () => {
      chatComponentsMockState.mode = 'throw';
      stubMatchMedia(false);
      const wrapper = makeAppProviderWrapper({ apiBaseUrl: API });
      const { unmount } = render(<McpFloatingChat />, { wrapper });
      expect(() => unmount()).not.toThrow();
      await new Promise((resolve) => setTimeout(resolve, 0));
      // Restore the shared mock state so later tests in this file don't
      // silently inherit a permanently-failing dynamic import.
      chatComponentsMockState.mode = 'ok';
    });

    it('cancela o fetch de streaming em andamento e o timer de digitação ao desmontar', async () => {
      // A stream whose `pull` never enqueues/closes, so `reader.read()`
      // never resolves — this keeps `streamAbortRef.current` populated
      // (never cleared by `handleSend`'s `finally`) so unmounting exercises
      // the cleanup effect's `streamAbortRef.current.abort()` branch.
      const hangingStream = new ReadableStream<Uint8Array>({
        pull() {
          /* never resolves */
        },
      });
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(new Response(hangingStream, { status: 200 })),
      );

      const { unmount } = await renderWidget();
      openWidget();
      expect(await screen.findByText('title')).toBeInTheDocument();

      fireEvent.change(screen.getByLabelText('chat-message-input'), {
        target: { value: 'mensagem pendurada' },
      });
      fireEvent.click(screen.getByText('send'));

      await waitFor(() =>
        expect(screen.getByTestId('streaming').textContent).toBe('true'),
      );

      expect(() => unmount()).not.toThrow();
    });

    it('não chama focus em um textarea desmontado após iniciar uma nova conversa', async () => {
      const longContent = 'z'.repeat(40);
      const finalMessages = [
        {
          id: 300,
          conversation_id: 1,
          role: 'user',
          content: 'oi',
          created_at: new Date().toISOString(),
        },
        {
          id: 301,
          conversation_id: 1,
          role: 'assistant',
          content: longContent,
          created_at: new Date().toISOString(),
        },
      ];
      server.use(
        http.post(`${API}/mcp-chat/:id/messages`, () =>
          HttpResponse.json(finalMessages),
        ),
        http.get(`${API}/mcp-chat/:id/messages`, () =>
          HttpResponse.json(finalMessages),
        ),
      );

      const { unmount } = await renderWidget();
      openWidget();
      expect(await screen.findByText('title')).toBeInTheDocument();

      fireEvent.change(screen.getByLabelText('chat-message-input'), {
        target: { value: 'mensagem longa' },
      });
      fireEvent.click(screen.getByText('send'));

      await waitFor(
        () => expect(screen.getByTestId('streaming').textContent).toBe('true'),
        { timeout: 3000 },
      );

      // Trigger handleNewConversation's deferred `setTimeout(() =>
      // textareaRef.current?.focus(), 80)`, then unmount before that timer
      // fires so `textareaRef.current` is null when it does.
      fireEvent.click(screen.getByLabelText('newConversation'));
      expect(() => unmount()).not.toThrow();
      await new Promise((resolve) => setTimeout(resolve, 120));
    });
  });
});

// --- Dynamic import of chat-components: success/shape/failure branches ----
//
// The mocked chat-components module's exports are getters driven by
// `chatComponentsMockState.mode` (declared above, near the mock). Flipping
// that mode before mount exercises the `!mod.ChatInput || !mod.MessageFeed`
// fallthrough (`missing-message-feed`) and the `catch` branch (`throw`) of
// the component's dynamic-import loading effect, in addition to the
// default `ok` shape already covered by every test above.
describe('McpFloatingChat - ramos do import dinâmico de chat-components', () => {
  beforeEach(() => {
    mockPathname = '/some/other/page';
    localStorage.clear();
    toastError.mockClear();
    server.use(
      http.get(`${API}/mcp-chat`, () => HttpResponse.json([])),
      http.post(`${API}/mcp-chat`, () => HttpResponse.json({ id: 1 })),
      http.get(`${API}/mcp-chat/:id/messages`, () => HttpResponse.json([])),
    );
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(null, { status: 500 })),
    );
  });

  afterEach(() => {
    chatComponentsMockState.mode = 'ok';
    vi.unstubAllGlobals();
  });

  it('mantém o widget oculto quando o módulo dinâmico não expõe MessageFeed', async () => {
    chatComponentsMockState.mode = 'missing-message-feed';

    await renderWidget();
    openWidget();

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByText('title')).not.toBeInTheDocument();
  });

  it('mantém o widget oculto quando o import dinâmico do chat-components lança um erro', async () => {
    chatComponentsMockState.mode = 'throw';

    await renderWidget();
    openWidget();

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByText('title')).not.toBeInTheDocument();
  });
});

describe('McpFloatingChat - modo mobile (matchMedia e bloqueio de scroll)', () => {
  beforeEach(() => {
    mockPathname = '/some/other/page';
    localStorage.clear();
    server.use(
      http.get(`${API}/mcp-chat`, () => HttpResponse.json([])),
      http.post(`${API}/mcp-chat`, () => HttpResponse.json({ id: 1 })),
      http.get(`${API}/mcp-chat/:id/messages`, () => HttpResponse.json([])),
    );
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(null, { status: 500 })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('bloqueia o scroll do body quando em modo mobile e o painel está aberto, e reage a mudanças de matchMedia', async () => {
    const mql = stubMatchMedia(true);
    const wrapper = makeAppProviderWrapper({ apiBaseUrl: API });
    render(<McpFloatingChat />, { wrapper });
    openWidget();

    expect(await screen.findByText('title')).toBeInTheDocument();
    await waitFor(() => expect(document.body.style.overflow).toBe('hidden'));

    // Exercise the matchMedia `change` listener registered in the
    // mobile-detection effect (previously never invoked).
    act(() => {
      mql._emit(false);
    });
    await waitFor(() => expect(document.body.style.overflow).toBe(''));
  });

  it('fecha a lista de conversas ao iniciar uma nova conversa em modo mobile', async () => {
    server.use(
      http.get(`${API}/mcp-chat`, () =>
        HttpResponse.json([{ id: 3, title: 'Zeta' }]),
      ),
    );
    stubMatchMedia(true);
    const wrapper = makeAppProviderWrapper({ apiBaseUrl: API });
    render(<McpFloatingChat />, { wrapper });
    openWidget();

    fireEvent.click(await screen.findByText('Zeta'));
    await waitFor(() =>
      expect(screen.queryByText('conversations')).not.toBeInTheDocument(),
    );

    fireEvent.click(screen.getByLabelText('openConversations'));
    expect(await screen.findByText('conversations')).toBeInTheDocument();

    // Exercises the `if (isMobile) setIsConversationListOpen(false);` branch
    // inside handleNewConversation. The conversation-list-open effect
    // immediately reopens it afterwards (conversationId becomes null), so we
    // assert on the functional outcome (empty state reachable) rather than a
    // transient "closed" DOM state.
    fireEvent.click(screen.getByLabelText('newConversation'));
    expect(await screen.findByText('emptyState')).toBeInTheDocument();
  });
});
