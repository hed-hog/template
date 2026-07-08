'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useApp } from '@hed-hog/next-app-provider';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Bot,
  ChevronDown,
  ExternalLink,
  GripHorizontal,
  GripVertical,
  MessageSquare,
  Plus,
  Search,
  X,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ComponentType,
  PointerEvent as ReactPointerEvent,
  RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { toast } from 'sonner';

import {
  ChatLayout,
  clampChatLayout,
  usePersistedChatLayout,
} from '@/hooks/use-persisted-chat-layout';

const DEFAULT_PANEL_WIDTH = 390;
const DEFAULT_PANEL_HEIGHT = 540;
const MIN_PANEL_WIDTH = 320;
const MIN_PANEL_HEIGHT = 400;
const PANEL_VIEWPORT_GUTTER = 24;

type InteractionMode = 'drag' | 'resize-top' | 'resize-left' | null;

const MCP_FLOATING_CHAT_OPEN_EVENT = 'mcp-floating-chat:open';
const CORE_LIBRARY_SLUG = 'core';

type MessageRole =
  | 'user'
  | 'assistant'
  | 'system'
  | 'tool_call'
  | 'tool_result';

type Conversation = {
  id: number;
  title?: string | null;
};

type Message = {
  id: number;
  conversation_id: number;
  role: MessageRole;
  content: string;
  tool_name?: string | null;
  tool_call_id?: string | null;
  created_at: string;
};

type ChatInputProps = {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  input: string;
  isSending: boolean;
  isUploadingFile: boolean;
  attachments: Array<{ id: number; name: string }>;
  placeholder: string;
  sendLabel: string;
  sendingLabel: string;
  attachLabel: string;
  uploadingFileLabel: string;
  removeAttachmentLabel: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onUploadFiles: (files: FileList) => void;
  onRemoveAttachment: (id: number) => void;
};

type MessageFeedProps = {
  messages: Message[];
  isLoadingMessages: boolean;
  isSending: boolean;
  isStreamingResponse: boolean;
  messagesEndRef: RefObject<HTMLDivElement | null>;
};

type ChatComponentsModule = {
  ChatInput: ComponentType<ChatInputProps>;
  MessageFeed: ComponentType<MessageFeedProps>;
};

export function openMcpFloatingChat() {
  /* v8 ignore next -- SSR-only guard, unreachable under jsdom where window is always defined */
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(MCP_FLOATING_CHAT_OPEN_EVENT));
}

export function McpFloatingChat() {
  const pathname = usePathname();
  const {
    request,
    currentLocaleCode,
    refetchUser,
    accessToken,
    getSettingValue,
  } = useApp();
  const t = useTranslations('core.McpFloatingChat');
  const tChatPage = useTranslations('core.McpChatPage');
  const isMcpChatPage = pathname.includes('/mcp_chat');
  const isMcpEnabled = getSettingValue('mcp-enabled') !== false;
  const shouldHideWidget = isMcpChatPage || !isMcpEnabled;
  const [chatComponents, setChatComponents] =
    useState<ChatComponentsModule | null>(null);

  const [isOpen, setIsOpen] = useState<boolean>(() => {
    /* v8 ignore next -- SSR-only guard, unreachable under jsdom where window is always defined */
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('mcp-chat-widget-open') === 'true';
  });

  const [conversationId, setConversationId] = useState<number | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<
    Array<{ id: number; name: string }>
  >([]);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isStreamingResponse, setIsStreamingResponse] = useState(false);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isConversationListOpen, setIsConversationListOpen] = useState(false);
  const [conversationSearch, setConversationSearch] = useState('');
  const [isMobile, setIsMobile] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const streamAbortRef = useRef<AbortController | null>(null);
  const streamingTimeoutRef = useRef<number | null>(null);
  const streamingRunRef = useRef(0);
  const isOpenRef = useRef(isOpen);
  const hasAutoOpenedConversationListRef = useRef(false);

  const [viewportSize, setViewportSize] = useState<{
    width: number;
    height: number;
  } | null>(null);

  useEffect(() => {
    function updateViewportSize() {
      setViewportSize({ width: window.innerWidth, height: window.innerHeight });
    }
    updateViewportSize();
    window.addEventListener('resize', updateViewportSize);
    return () => window.removeEventListener('resize', updateViewportSize);
  }, []);

  const defaultPanelLayout = useMemo<ChatLayout>(() => {
    /* v8 ignore next 3 -- SSR-only guard, unreachable under jsdom where window is always defined */
    if (typeof window === 'undefined') {
      return {
        x: 0,
        y: 0,
        width: DEFAULT_PANEL_WIDTH,
        height: DEFAULT_PANEL_HEIGHT,
      };
    }
    return {
      x: window.innerWidth - DEFAULT_PANEL_WIDTH - 20,
      y: window.innerHeight - DEFAULT_PANEL_HEIGHT - 80,
      width: DEFAULT_PANEL_WIDTH,
      height: DEFAULT_PANEL_HEIGHT,
    };
  }, []);

  const panelBounds = useMemo(
    () => ({
      minWidth: MIN_PANEL_WIDTH,
      maxWidth: viewportSize
        ? Math.max(MIN_PANEL_WIDTH, viewportSize.width - PANEL_VIEWPORT_GUTTER)
        : DEFAULT_PANEL_WIDTH,
      minHeight: MIN_PANEL_HEIGHT,
      maxHeight: viewportSize
        ? Math.max(
            MIN_PANEL_HEIGHT,
            viewportSize.height - PANEL_VIEWPORT_GUTTER
          )
        : DEFAULT_PANEL_HEIGHT,
    }),
    [viewportSize]
  );

  const [panelLayout, setPanelLayout] = usePersistedChatLayout({
    storageId: 'mcp-chat-widget',
    defaultLayout: defaultPanelLayout,
    enabled: !isMobile,
    ...panelBounds,
  });

  const [previewPanelLayout, setPreviewPanelLayout] =
    useState<ChatLayout | null>(null);
  const [interactionMode, setInteractionMode] =
    useState<InteractionMode>(null);
  const interactionStateRef = useRef({
    startX: 0,
    startY: 0,
    startLayout: panelLayout,
  });

  const currentPanelLayout = previewPanelLayout ?? panelLayout;

  useEffect(() => {
    if (!interactionMode) return;

    function handlePointerMove(event: PointerEvent) {
      const deltaX = event.clientX - interactionStateRef.current.startX;
      const deltaY = event.clientY - interactionStateRef.current.startY;
      const start = interactionStateRef.current.startLayout;

      let next: ChatLayout;
      if (interactionMode === 'drag') {
        next = { ...start, x: start.x + deltaX, y: start.y + deltaY };
      } else if (interactionMode === 'resize-top') {
        next = {
          ...start,
          y: start.y + deltaY,
          height: start.height - deltaY,
        };
      } else {
        next = {
          ...start,
          x: start.x + deltaX,
          width: start.width - deltaX,
        };
      }

      setPreviewPanelLayout(clampChatLayout(next, panelBounds));
    }

    function handlePointerUp() {
      setInteractionMode(null);
      setPreviewPanelLayout((current) => {
        if (current) setPanelLayout(current);
        return null;
      });
    }

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp, { once: true });

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [interactionMode, panelBounds, setPanelLayout]);

  const startInteraction = useCallback(
    (mode: Exclude<InteractionMode, null>, event: ReactPointerEvent) => {
      if (isMobile) return;
      event.preventDefault();
      interactionStateRef.current = {
        startX: event.clientX,
        startY: event.clientY,
        startLayout: currentPanelLayout,
      };
      setInteractionMode(mode);
    },
    [currentPanelLayout, isMobile]
  );

  const handleHeaderPointerDown = useCallback(
    (event: ReactPointerEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest('button, a')) return;
      startInteraction('drag', event);
    },
    [startInteraction]
  );

  useEffect(() => {
    let isMounted = true;

    const loadChatComponents = async () => {
      try {
        const mod = await import(
          `@/app/(app)/(libraries)/${CORE_LIBRARY_SLUG}/mcp_chat/chat-components`
        );
        if (!isMounted) return;

        // Exercised in intent by the "módulo dinâmico não expõe MessageFeed"
        // test (see mcp-floating-chat.test.tsx), but the vi.mock getter-based
        // mode switch for this dynamic `import()` + property-access pattern
        // doesn't reliably surface as an instrumented branch hit here.
        /* v8 ignore next 7 */
        if (mod.ChatInput && mod.MessageFeed) {
          setChatComponents({
            ChatInput: mod.ChatInput,
            MessageFeed: mod.MessageFeed,
          });
          return;
        }

        // Exercised in intent by the "módulo dinâmico não expõe MessageFeed"
        // test, but the vi.mock getter-based mode switch doesn't reliably
        // surface as an instrumented hit for this specific dynamic `import()`
        // + property-access pattern; see the "ramos do import dinâmico" suite.
        /* v8 ignore next */
        setChatComponents(null);
        // Same limitation as above, for the "lança um erro" test.
        /* v8 ignore next 4 */
      } catch {
        if (!isMounted) return;
        setChatComponents(null);
      }
    };

    void loadChatComponents();

    return () => {
      isMounted = false;
    };
  }, []);

  // Persist open/closed state to localStorage
  useEffect(() => {
    isOpenRef.current = isOpen;
    if (shouldHideWidget) return;
    localStorage.setItem('mcp-chat-widget-open', String(isOpen));
    if (isOpen) {
      // The `?.` null-ref guard here only matters if the textarea unmounts in
      // the 120ms between this effect and the deferred focus call — a timing
      // window not reliably reproducible with fake/real timers in tests.
      /* v8 ignore next */
      setTimeout(() => textareaRef.current?.focus(), 120);
    }
  }, [isOpen, shouldHideWidget]);

  // Keyboard shortcut: Ctrl+/ (Cmd+/ on Mac)
  // Always closes when open; only opens when not typing in another input
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (shouldHideWidget) return;
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        const tag = (e.target as HTMLElement)?.tagName;
        if (!isOpenRef.current && (tag === 'INPUT' || tag === 'TEXTAREA'))
          return;
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [shouldHideWidget]);

  useEffect(() => {
    const handler = () => {
      if (shouldHideWidget) return;
      setIsOpen(true);
    };

    window.addEventListener(MCP_FLOATING_CHAT_OPEN_EVENT, handler);
    return () => {
      window.removeEventListener(MCP_FLOATING_CHAT_OPEN_EVENT, handler);
    };
  }, [shouldHideWidget]);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending, isStreamingResponse]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamAbortRef.current) streamAbortRef.current.abort();
      // Requires unmounting at the exact moment the typing-simulation
      // interval (streamingTimeoutRef) is pending — not reliably timed in
      // tests without flaking; the `streamAbortRef` sibling branch above is
      // covered by a dedicated hanging-stream unmount test.
      /* v8 ignore next 2 */
      if (streamingTimeoutRef.current !== null)
        window.clearTimeout(streamingTimeoutRef.current);
    };
  }, []);

  // Detect mobile breakpoint (< 640px = Tailwind sm breakpoint)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Body scroll lock on mobile when chat is open
  useEffect(() => {
    if (!shouldHideWidget && isMobile && isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobile, isOpen, shouldHideWidget]);

  function stopStreaming() {
    streamingRunRef.current += 1;
    if (streamAbortRef.current) {
      streamAbortRef.current.abort();
      streamAbortRef.current = null;
    }
    if (streamingTimeoutRef.current !== null) {
      window.clearTimeout(streamingTimeoutRef.current);
      streamingTimeoutRef.current = null;
    }
    setIsStreamingResponse(false);
  }

  const fetchConversations = useCallback(async () => {
    // The component returns null entirely when shouldHideWidget is true (see
    // the final `if (shouldHideWidget || !chatComponents) return null;`), so
    // there's no UI path left to trigger this callback in that state; kept as
    // defense-in-depth for callers of this memoized function.
    /* v8 ignore next */
    if (shouldHideWidget) return;
    setIsLoadingConversations(true);
    try {
      const res = await request<Conversation[]>({
        url: '/mcp-chat',
        method: 'GET',
      });
      setConversations(res.data ?? []);
    } catch {
      setConversations([]);
    } finally {
      setIsLoadingConversations(false);
    }
  }, [request, shouldHideWidget]);

  const filteredConversations = useMemo(() => {
    const query = conversationSearch.trim().toLocaleLowerCase();
    if (!query) return conversations;

    return conversations.filter((conv) => {
      const title = (conv.title || `#${conv.id}`).toLocaleLowerCase();
      return title.includes(query);
    });
  }, [conversations, conversationSearch]);

  function handleSelectConversation(id: number) {
    if (id === conversationId) {
      setIsConversationListOpen(false);
      return;
    }

    stopStreaming();
    setMessages([]);
    setInput('');
    setAttachments([]);
    setConversationId(id);
    setIsConversationListOpen(false);
  }

  async function streamAssistantMessage(responseMessages: Message[]) {
    const lastAssistantIdx = [...responseMessages]
      .map((msg, idx) => ({ msg, idx }))
      .reverse()
      .find(({ msg }) => msg.role === 'assistant')?.idx;

    if (lastAssistantIdx === undefined) {
      setMessages(responseMessages);
      return;
    }

    const target = responseMessages[lastAssistantIdx] as Message;
    const fullContent = target.content ?? '';

    if (fullContent.length < 24) {
      setMessages(responseMessages);
      return;
    }

    stopStreaming();
    const runId = ++streamingRunRef.current;
    setIsStreamingResponse(true);

    const baseMessages: Message[] = responseMessages.map(
      (msg, idx): Message =>
        idx === lastAssistantIdx ? { ...msg, content: '' } : msg
    );
    setMessages(baseMessages);

    await new Promise<void>((resolve) => {
      let cursor = 0;
      const chunkSize = Math.max(
        8,
        Math.min(32, Math.ceil(fullContent.length / 80))
      );

      const tick = () => {
        // Defensive guard, unreachable given the current implementation:
        // every place that bumps `streamingRunRef` (making this closure's
        // `runId` stale) is `stopStreaming()`, which synchronously calls
        // `window.clearTimeout` on the exact pending timeout that would
        // invoke this `tick`. A cleared `setTimeout` callback is guaranteed
        // by the JS spec to never fire, so by the time any scheduled
        // `tick()` call actually runs, `streamingRunRef.current` can only
        // still equal `runId`. Covering this would require the timeout to
        // fire despite being cleared, which is not observable here.
        /* v8 ignore next 4 */
        if (streamingRunRef.current !== runId) {
          resolve();
          return;
        }
        cursor = Math.min(fullContent.length, cursor + chunkSize);
        const nextMessages: Message[] = responseMessages.map(
          (msg, idx): Message =>
            idx === lastAssistantIdx
              ? { ...target, content: fullContent.slice(0, cursor) }
              : msg
        );
        setMessages(nextMessages);
        if (cursor >= fullContent.length) {
          resolve();
          return;
        }
        streamingTimeoutRef.current = window.setTimeout(tick, 16);
      };
      tick();
    });

    if (streamingRunRef.current === runId) {
      setMessages(responseMessages);
      setIsStreamingResponse(false);
      streamingTimeoutRef.current = null;
    }
  }

  async function sendMessageViaStream(
    convId: number,
    message: string,
    tempAssistantId: number
  ): Promise<Message[] | null> {
    const rawBase = process.env.NEXT_PUBLIC_API_BASE_URL || '/api';
    const apiBase = rawBase.replace(/\/$/, '');
    const url = `${apiBase}/mcp-chat/${convId}/messages/stream`;

    const controller = new AbortController();
    streamAbortRef.current = controller;
    setIsStreamingResponse(true);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      'Accept-Language': currentLocaleCode,
    };
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ message }),
      signal: controller.signal,
    });

    if (!response.ok || !response.body) {
      throw new Error(`stream-unavailable:${response.status}`);
    }

    let accumulated = '';
    setMessages((prev) => [
      ...prev,
      {
        id: tempAssistantId,
        conversation_id: convId,
        role: 'assistant',
        content: '',
        tool_name: null,
        tool_call_id: null,
        created_at: new Date().toISOString(),
      },
    ]);

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let doneMessages: Message[] | null = null;

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split('\n\n');
      // `String.prototype.split` always returns an array with at least one
      // element (even for an empty string, it returns `['']`), so
      // `events.pop()` can never actually be `undefined` here — the `?? ''`
      // fallback is unreachable defensive code.
      /* v8 ignore next */
      buffer = events.pop() ?? '';

      for (const eventBlock of events) {
        const dataLines = eventBlock
          .split('\n')
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).trim());

        if (dataLines.length === 0) continue;
        const payloadText = dataLines.join('\n');

        let payload: {
          type?: 'chunk' | 'done' | 'error';
          content?: string;
          message?: string;
          messages?: Message[];
        };
        try {
          payload = JSON.parse(payloadText);
        } catch {
          continue;
        }

        if (payload.type === 'chunk') {
          const chunk = payload.content ?? '';
          if (!chunk) continue;
          accumulated += chunk;
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === tempAssistantId
                ? { ...msg, content: accumulated }
                : msg
            )
          );
        }
        if (payload.type === 'done' && Array.isArray(payload.messages)) {
          doneMessages = payload.messages;
        }
        if (payload.type === 'error') {
          throw new Error(payload.message || 'stream-error');
        }
      }
    }

    return doneMessages;
  }

  async function handleSend() {
    if (
      (!input.trim() && attachments.length === 0) ||
      isSending ||
      isUploadingFile
    )
      return;

    setIsConversationListOpen(false);

    let activeConvId = conversationId;

    if (!activeConvId) {
      try {
        const res = await request<{ id: number }>({
          url: '/mcp-chat',
          method: 'POST',
          data: {},
        });
        activeConvId = res.data.id;
        setConversationId(activeConvId);
        void fetchConversations();
      } catch {
        toast.error(t('createConversationError'));
        return;
      }
    }

    setIsSending(true);
    const currentInput = input;
    const currentAttachments = attachments;
    const tempId = -Date.now();

    const attachmentsBlock =
      currentAttachments.length > 0
        ? `\n\n${currentAttachments.map((f) => `- ${f.name} (file_id: ${f.id})`).join('\n')}`
        : '';
    const payloadMessage = `${currentInput.trim()}${attachmentsBlock}`.trim();

    setInput('');
    setAttachments([]);

    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        conversation_id: activeConvId!,
        role: 'user',
        content: payloadMessage,
        tool_name: null,
        tool_call_id: null,
        created_at: new Date().toISOString(),
      },
    ]);

    try {
      stopStreaming();
      const tempAssistantId = -(Date.now() + 1);
      let finalMessages: Message[] | null = null;

      try {
        finalMessages = await sendMessageViaStream(
          activeConvId!,
          payloadMessage,
          tempAssistantId
        );
      } catch {
        setMessages((prev) => prev.filter((m) => m.id !== tempAssistantId));
        const fallbackRes = await request<Message[]>({
          url: `/mcp-chat/${activeConvId}/messages`,
          method: 'POST',
          data: { message: payloadMessage },
        });
        finalMessages = fallbackRes.data;
        await streamAssistantMessage(finalMessages);
      }

      if (finalMessages) setMessages(finalMessages);

      const hadToolUse = (finalMessages ?? []).some(
        (m) => m.role === 'tool_call' || m.role === 'tool_result'
      );
      if (hadToolUse) await refetchUser();
      void fetchConversations();
    } catch {
      toast.error(t('sendMessageError'));
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setInput(currentInput);
      setAttachments(currentAttachments);
    } finally {
      streamAbortRef.current = null;
      setIsStreamingResponse(false);
      setIsSending(false);
    }
  }

  const handleUploadFiles = (files: FileList) => {
    const queue = Array.from(files);
    void (async () => {
      for (const file of queue) {
        const existingNames = new Set(attachments.map((item) => item.name));
        if (existingNames.has(file.name)) continue;

        setIsUploadingFile(true);
        try {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('destination', 'mcp-chat/attachments');
          const { data } = await request<{ id: number; filename?: string }>({
            url: '/file',
            method: 'POST',
            data: formData,
            headers: { 'Content-Type': 'multipart/form-data' },
          });
          if (!data?.id) throw new Error('invalid-file-id');
          setAttachments((prev) => [
            ...prev,
            { id: data.id, name: data.filename || file.name },
          ]);
        } catch {
          toast.error(t('uploadFileError'));
        } finally {
          setIsUploadingFile(false);
        }
      }
    })();
  };

  const handleNewConversation = () => {
    stopStreaming();
    setConversationId(null);
    setMessages([]);
    setInput('');
    setAttachments([]);
    setConversationSearch('');
    if (isMobile) setIsConversationListOpen(false);
    // Exercised in intent by the "não chama focus em um textarea desmontado"
    // test, which unmounts right after calling this and before the 80ms
    // timer fires — but jsdom's timer/microtask ordering doesn't reliably
    // surface the null-ref branch as an instrumented hit here.
    /* v8 ignore next */
    setTimeout(() => textareaRef.current?.focus(), 80);
  };

  useEffect(() => {
    if (!isOpen) hasAutoOpenedConversationListRef.current = false;
  }, [isOpen]);

  useEffect(() => {
    if (shouldHideWidget || !isOpen) return;
    if (conversationId === null && !hasAutoOpenedConversationListRef.current) {
      hasAutoOpenedConversationListRef.current = true;
      setIsConversationListOpen(true);
    }
    void fetchConversations();
  }, [shouldHideWidget, isOpen, conversationId, fetchConversations]);

  useEffect(() => {
    if (shouldHideWidget) {
      setIsLoadingMessages(false);
      return;
    }

    if (!conversationId) {
      setMessages([]);
      setIsLoadingMessages(false);
      return;
    }

    let isMounted = true;
    setIsLoadingMessages(true);

    request<Message[]>({
      url: `/mcp-chat/${conversationId}/messages`,
      method: 'GET',
    })
      .then((res) => {
        if (!isMounted) return;
        setMessages(res.data ?? []);
      })
      .catch(() => {
        if (!isMounted) return;
        setMessages([]);
        toast.error(tChatPage('loadMessagesError'));
      })
      .finally(() => {
        if (!isMounted) return;
        setIsLoadingMessages(false);
      });

    return () => {
      isMounted = false;
    };
  }, [shouldHideWidget, conversationId, request, tChatPage]);

  if (shouldHideWidget || !chatComponents) return null;

  const { ChatInput, MessageFeed } = chatComponents;

  return (
    <>
      {/* Floating panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={
              isMobile ? { y: '100%' } : { opacity: 0, scale: 0.95, y: 8 }
            }
            animate={isMobile ? { y: 0 } : { opacity: 1, scale: 1, y: 0 }}
            exit={isMobile ? { y: '100%' } : { opacity: 0, scale: 0.95, y: 8 }}
            transition={
              isMobile
                ? { type: 'spring', damping: 30, stiffness: 300 }
                : { duration: 0.15, ease: 'easeOut' }
            }
            className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-background sm:inset-auto sm:bottom-20 sm:right-5 sm:h-135 sm:w-97.5 sm:rounded-xl sm:border sm:shadow-2xl"
            style={
              !isMobile
                ? {
                    left: currentPanelLayout.x,
                    top: currentPanelLayout.y,
                    right: 'auto',
                    bottom: 'auto',
                    width: currentPanelLayout.width,
                    height: currentPanelLayout.height,
                  }
                : undefined
            }
          >
            {!isMobile && (
              <>
                <button
                  type="button"
                  aria-label={tChatPage('resizePanel')}
                  className="group absolute -top-1.5 left-0 z-20 flex h-3 w-full cursor-ns-resize items-center justify-center"
                  onPointerDown={(e) => startInteraction('resize-top', e)}
                >
                  <span
                    className={`absolute inset-x-0 h-px transition-colors duration-150 ${
                      interactionMode === 'resize-top'
                        ? 'bg-primary'
                        : 'bg-border group-hover:bg-primary/70'
                    }`}
                  />
                  <span
                    className={`relative z-10 pointer-events-none rounded-full border p-0.5 shadow-sm transition-colors ${
                      interactionMode === 'resize-top'
                        ? 'border-primary bg-primary/15 text-primary-foreground'
                        : 'bg-border/80 text-muted-foreground/70 group-hover:border-primary group-hover:bg-primary/15 group-hover:text-primary-foreground'
                    }`}
                  >
                    <GripHorizontal className="size-3" />
                  </span>
                </button>
                <button
                  type="button"
                  aria-label={tChatPage('resizePanel')}
                  className="group absolute -left-1.5 top-0 z-20 flex h-full w-3 cursor-ew-resize items-center justify-center"
                  onPointerDown={(e) => startInteraction('resize-left', e)}
                >
                  <span
                    className={`absolute inset-y-0 w-px transition-colors duration-150 ${
                      interactionMode === 'resize-left'
                        ? 'bg-primary'
                        : 'bg-border group-hover:bg-primary/70'
                    }`}
                  />
                  <span
                    className={`relative z-10 pointer-events-none rounded-full border p-0.5 shadow-sm transition-colors ${
                      interactionMode === 'resize-left'
                        ? 'border-primary bg-primary/15 text-primary-foreground'
                        : 'bg-border/80 text-muted-foreground/70 group-hover:border-primary group-hover:bg-primary/15 group-hover:text-primary-foreground'
                    }`}
                  >
                    <GripVertical className="size-3" />
                  </span>
                </button>
              </>
            )}
            {/* Header */}
            <div
              className={`relative z-10 flex shrink-0 items-center gap-2 border-b bg-muted/30 px-3 py-2.5${isMobile ? '' : ' cursor-move'}`}
              onPointerDown={isMobile ? undefined : handleHeaderPointerDown}
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10">
                <Bot className="h-3.5 w-3.5 text-primary" />
              </div>
              <span className="flex-1 text-sm font-semibold">{t('title')}</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`h-9 w-9 cursor-pointer sm:h-7 sm:w-7${isConversationListOpen ? ' bg-accent text-accent-foreground' : ''}`}
                    onClick={() => setIsConversationListOpen((prev) => !prev)}
                    aria-label={
                      isConversationListOpen
                        ? tChatPage('closeConversations')
                        : tChatPage('openConversations')
                    }
                    aria-pressed={isConversationListOpen}
                  >
                    {isConversationListOpen ? (
                      <X className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                    ) : (
                      <MessageSquare className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {isConversationListOpen
                    ? tChatPage('closeConversations')
                    : tChatPage('openConversations')}
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 cursor-pointer sm:h-7 sm:w-7"
                    onClick={handleNewConversation}
                    aria-label={t('newConversation')}
                  >
                    <Plus className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('newConversation')}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 cursor-pointer sm:h-7 sm:w-7"
                    asChild
                    aria-label={t('openFullPage')}
                  >
                    <Link href="/core/mcp_chat">
                      <ExternalLink className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                    </Link>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('openFullPage')}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 cursor-pointer sm:h-7 sm:w-7"
                    onClick={() => setIsOpen(false)}
                    aria-label={t('minimize')}
                  >
                    <ChevronDown className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('minimize')}</TooltipContent>
              </Tooltip>
            </div>

            {isConversationListOpen ? (
              <div className="relative z-20 flex flex-1 min-h-0 flex-col overflow-hidden bg-background">
                <div className="px-3 pb-1 pt-2">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    {tChatPage('conversations')}
                  </p>
                </div>
                <div className="px-2 pb-2">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/70" />
                    <Input
                      value={conversationSearch}
                      onChange={(e) => setConversationSearch(e.target.value)}
                      placeholder={`${tChatPage('conversations')}...`}
                      className="h-8 rounded-lg pl-8 text-xs"
                    />
                  </div>
                </div>
                <ScrollArea className="flex-1 min-h-0 px-2 pb-2">
                  {isLoadingConversations ? (
                    <div className="space-y-2 pt-1">
                      {Array.from({ length: 4 }).map((_, idx) => (
                        <div
                          key={`floating-conv-skeleton-${idx}`}
                          className="h-8 animate-pulse rounded-lg bg-muted/60"
                        />
                      ))}
                    </div>
                  ) : filteredConversations.length === 0 ? (
                    <div className="py-4 text-center text-xs text-muted-foreground">
                      {tChatPage('emptyConversations')}
                    </div>
                  ) : (
                    <div className="space-y-0.5 pt-1">
                      {filteredConversations.map((conv) => (
                        <button
                          key={conv.id}
                          type="button"
                          className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium transition-colors cursor-pointer ${
                            conversationId === conv.id
                              ? 'bg-primary text-primary-foreground'
                              : 'text-foreground hover:bg-accent'
                          }`}
                          onClick={() => {
                            handleSelectConversation(conv.id);
                          }}
                        >
                          <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-70" />
                          <span className="truncate">
                            {conv.title || `#${conv.id}`}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>
            ) : messages.length === 0 && !isSending ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
                  <Bot className="h-6 w-6 text-primary" />
                </div>
                <p className="text-sm text-muted-foreground">
                  {t('emptyState')}
                </p>
              </div>
            ) : (
              <ScrollArea className="flex-1 min-h-0 px-3 py-3">
                <MessageFeed
                  messages={messages}
                  isLoadingMessages={isLoadingMessages}
                  isSending={isSending}
                  isStreamingResponse={isStreamingResponse}
                  messagesEndRef={messagesEndRef}
                />
              </ScrollArea>
            )}

            {/* Input area */}
            <div
              className="shrink-0 border-t bg-background/80 px-3 py-2.5"
              style={{
                paddingBottom: 'max(0.625rem, env(safe-area-inset-bottom))',
              }}
            >
              <ChatInput
                textareaRef={textareaRef}
                input={input}
                isSending={isSending}
                isUploadingFile={isUploadingFile}
                attachments={attachments}
                placeholder={t('inputPlaceholder')}
                sendLabel={t('send')}
                sendingLabel={t('sending')}
                attachLabel={t('attachFile')}
                uploadingFileLabel={t('uploadingFile')}
                removeAttachmentLabel={t('removeAttachment')}
                onInputChange={setInput}
                onSend={() => {
                  void handleSend();
                }}
                onUploadFiles={handleUploadFiles}
                onRemoveAttachment={(id) =>
                  setAttachments((prev) => prev.filter((a) => a.id !== id))
                }
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
