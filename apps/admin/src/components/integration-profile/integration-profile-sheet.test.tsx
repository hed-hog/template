import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  within,
  waitFor,
  act,
} from '@testing-library/react';
import { http, HttpResponse, server } from '@hed-hog/vitest-config';

// Hoisted mocks required by AppProvider (see src/test/app-provider.integration.test.tsx).
const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
}));
vi.mock('@bprogress/next', () => ({
  AppProgressProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Stable identity function: some effects in the component depend on `t` in
// their dependency array, so a fresh arrow function per render (as a naive
// mock would return) would re-trigger them on every render.
const identityT = (key: string) => key;
vi.mock('next-intl', () => ({
  useTranslations: () => identityT,
}));

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  }),
}));

// ResizableSheetContent's own resize/mobile machinery isn't what this file exercises;
// stub it the same way src/components/ui/resizable-sheet-content.test.tsx does, to avoid
// depending on matchMedia/ResizeObserver internals unrelated to the sheet's form logic.
vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => false,
}));
vi.mock('@/hooks/use-persisted-sheet-width', () => ({
  usePersistedSheetWidth: () => [640, vi.fn()],
}));

import { toast } from 'sonner';
import { makeAppProviderWrapper } from '@/test/test-utils';
import {
  IntegrationProfileSheet,
  type IntegrationProfileSheetSavedProfile,
} from './integration-profile-sheet';

const API = 'http://api.test';

const TYPES = [
  {
    id: 1,
    slug: 'email',
    icon: null,
    integration_type_locale: [
      { name: 'Email', locale: { code: 'en' } },
      { name: 'E-mail', locale: { code: 'pt' } },
    ],
  },
  {
    id: 2,
    slug: 'storage',
    icon: null,
    integration_type_locale: [{ name: 'Storage', locale: { code: 'fr' } }],
  },
  {
    id: 3,
    slug: 'video',
    icon: null,
    integration_type_locale: [{ name: 'Video', locale: { code: 'en' } }],
  },
  {
    id: 4,
    slug: 'payment',
    icon: null,
    integration_type_locale: [{ name: 'Payment', locale: { code: 'en' } }],
  },
  {
    id: 5,
    slug: 'auth',
    icon: null,
    integration_type_locale: [{ name: 'Auth', locale: { code: 'en' } }],
  },
];

const PROVIDERS = [
  {
    id: 10,
    slug: 'smtp',
    type_id: 1,
    integration_provider_locale: [{ name: 'SMTP', locale: { code: 'en' } }],
  },
  {
    id: 11,
    slug: 'digitalocean',
    type_id: 3,
    integration_provider_locale: [{ name: 'DigitalOcean', locale: { code: 'en' } }],
  },
  {
    id: 12,
    slug: 'stripe',
    type_id: 4,
    integration_provider_locale: [{ name: 'Stripe', locale: { code: 'en' } }],
  },
  {
    id: 13,
    slug: 'google-oauth',
    type_id: 5,
    integration_provider_locale: [{ name: 'Google', locale: { code: 'en' } }],
  },
  {
    id: 14,
    slug: 'github-oauth',
    type_id: 5,
    integration_provider_locale: [{ name: 'GitHub', locale: { code: 'en' } }],
  },
  {
    id: 15,
    slug: 'local',
    type_id: 2,
    integration_provider_locale: [{ name: 'Local', locale: { code: 'en' } }],
  },
  {
    // A second provider under the same type_id as smtp (1), used to exercise
    // the lock-sync effect's "previous.provider_id truthy and different"
    // branch by locking to a sibling provider after a profile with a
    // different provider under that same type has already loaded.
    id: 16,
    slug: 'gmail',
    type_id: 1,
    integration_provider_locale: [{ name: 'Gmail', locale: { code: 'en' } }],
  },
];

function mockCatalog(
  { typesBody, providersBody }: { typesBody?: unknown; providersBody?: unknown } = {},
) {
  server.use(
    http.get(`${API}/integration-profile/types`, () =>
      HttpResponse.json(typesBody ?? TYPES),
    ),
    http.get(`${API}/integration-profile/providers`, () =>
      HttpResponse.json(providersBody ?? PROVIDERS),
    ),
  );
}

function renderSheet(
  props: Partial<React.ComponentProps<typeof IntegrationProfileSheet>> = {},
) {
  const onOpenChange = vi.fn();
  const onSaved = vi.fn();
  const utils = render(
    <IntegrationProfileSheet
      open
      onOpenChange={onOpenChange}
      onSaved={onSaved}
      {...props}
    />,
    { wrapper: makeAppProviderWrapper({ apiBaseUrl: API }) },
  );
  return { onOpenChange, onSaved, ...utils };
}

async function waitForTypesLoaded() {
  await waitFor(() => {
    expect(screen.getByLabelText(/typeLabel/)).not.toBeDisabled();
  });
}

function openSelectByLabel(label: RegExp) {
  const trigger = screen.getByLabelText(label);
  fireEvent.pointerDown(trigger);
  fireEvent.click(trigger);
  return trigger;
}

async function chooseType(name: string) {
  openSelectByLabel(/typeLabel/);
  const listbox = await screen.findByRole('listbox');
  const option = within(listbox).getByText(name);
  fireEvent.pointerUp(option);
  fireEvent.click(option);
}

async function chooseProvider(name: string) {
  openSelectByLabel(/providerLabel/);
  const listbox = await screen.findByRole('listbox');
  const option = within(listbox).getByText(name);
  fireEvent.pointerUp(option);
  fireEvent.click(option);
}

/**
 * Edit mode sets `type_id` and `provider_id` together in one state update, the
 * very first time the provider Select's item list becomes non-empty for that
 * type. Radix Select's hidden native `<select>` mirror (used for native form
 * participation) can't yet accept a value for an `<option>` that is being
 * inserted in that same commit, so the browser clamps it back to `''` and
 * Radix's own change listener on that hidden select echoes the clamped value
 * back through `onValueChange('')` — silently clearing `provider_id`/`config`
 * right after they were set (see also handleProviderChange in the component).
 * This resync fires a native `change` event on that hidden select with the
 * real value, exactly like Radix's own bubbling mechanism does once the
 * option is actually present, to work around the timing gap in tests.
 */
function resyncEditModeProviderSelection(providerId: number) {
  const providerNativeSelect = document.querySelectorAll('form select')[1] as
    | HTMLSelectElement
    | undefined;
  if (providerNativeSelect) {
    fireEvent.change(providerNativeSelect, {
      target: { value: String(providerId) },
    });
  }
}

beforeEach(() => {
  // Radix Select/Dialog rely on DOM APIs jsdom doesn't implement.
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
  window.HTMLElement.prototype.scrollIntoView = vi.fn();

  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );

  Object.assign(navigator, { clipboard: { writeText: vi.fn() } });

  if (typeof (globalThis as any).ResizeObserver === 'undefined') {
    (globalThis as any).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }

  vi.clearAllMocks();
});

afterEach(() => {
  // Safety net: if a test using fake timers throws before its own cleanup, later
  // tests would hang forever (RTL's waitFor polling relies on real timers).
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('IntegrationProfileSheet — carregamento do catálogo', () => {
  it('não busca tipos/providers quando o sheet está fechado', () => {
    renderSheet({ open: false });
    // No handler registered for /integration-profile/*; if a fetch happened,
    // MSW's onUnhandledRequest: 'error' setting would fail the test.
    expect(screen.queryByLabelText(/typeLabel/)).not.toBeInTheDocument();
  });

  it('carrega tipos e providers com sucesso (arrays diretos)', async () => {
    mockCatalog();
    renderSheet();
    await waitForTypesLoaded();
    expect(screen.getByLabelText(/typeLabel/)).toBeInTheDocument();
  });

  it('usa o fallback {data: [...]}  quando a resposta não é um array puro', async () => {
    mockCatalog({
      typesBody: { data: TYPES },
      providersBody: { data: PROVIDERS },
    });
    renderSheet();
    await waitForTypesLoaded();

    await chooseType('Email');
    openSelectByLabel(/providerLabel/);
    const listbox = await screen.findByRole('listbox');
    expect(within(listbox).getByText('SMTP')).toBeInTheDocument();
  });

  it('mostra erro quando o carregamento do catálogo falha', async () => {
    server.use(
      http.get(`${API}/integration-profile/types`, () =>
        HttpResponse.json({ message: 'boom' }, { status: 500 }),
      ),
      http.get(`${API}/integration-profile/providers`, () => HttpResponse.json(PROVIDERS)),
    );
    renderSheet();

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('loadError'));
  });
});

describe('IntegrationProfileSheet — seleção de tipo/provider e slug', () => {
  beforeEach(() => mockCatalog());

  it('gera o slug automaticamente a partir do nome e o para quando o slug é editado manualmente', async () => {
    renderSheet();
    await waitForTypesLoaded();

    const nameInput = screen.getByLabelText(/nameLabel/) as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: 'Café Ação!!' } });

    const slugInput = screen.getByLabelText(/slugLabel/) as HTMLInputElement;
    expect(slugInput.value).toBe('cafe-acao');

    fireEvent.change(slugInput, { target: { value: 'meu-slug-manual' } });
    expect(slugInput.value).toBe('meu-slug-manual');

    fireEvent.change(nameInput, { target: { value: 'Outro Nome' } });
    expect(slugInput.value).toBe('meu-slug-manual');
  });

  it('toSlug trata bordas: espaços/símbolos nas pontas e caracteres não alfanuméricos', async () => {
    renderSheet();
    await waitForTypesLoaded();

    const nameInput = screen.getByLabelText(/nameLabel/) as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: '  --Multi   Word!!--  ' } });

    const slugInput = screen.getByLabelText(/slugLabel/) as HTMLInputElement;
    expect(slugInput.value).toBe('multi-word');
  });

  it('ao trocar o tipo, reseta provider_id e config; provider fica desabilitado sem tipo selecionado', async () => {
    renderSheet();
    await waitForTypesLoaded();

    const providerTrigger = screen.getByLabelText(/providerLabel/);
    expect(providerTrigger).toBeDisabled();

    await chooseType('Email');
    expect(providerTrigger).not.toBeDisabled();

    await chooseProvider('SMTP');
    expect(screen.getByText('configSectionTitle')).toBeInTheDocument();

    await chooseType('Payment');
    expect(screen.queryByText('configSectionTitle')).not.toBeInTheDocument();
  });

  it('usa o fallback do locale (locales[0].name) quando o código atual não é encontrado', async () => {
    renderSheet();
    await waitForTypesLoaded();
    // "storage" only has a 'fr' locale entry; currentLocaleCode defaults to 'en'.
    openSelectByLabel(/typeLabel/);
    const listbox = await screen.findByRole('listbox');
    expect(within(listbox).getByText('Storage')).toBeInTheDocument();
  });
});

describe('IntegrationProfileSheet — campos de configuração (smtp)', () => {
  beforeEach(() => mockCatalog());

  it('renderiza e edita os campos text/number/password/email/boolean, alterna visibilidade da senha e envia o formulário (criação)', async () => {
    let receivedBody: any = null;
    server.use(
      http.post(`${API}/integration-profile`, async ({ request }) => {
        receivedBody = await request.json();
        return HttpResponse.json({
          id: 99,
          slug: receivedBody.slug,
          name: receivedBody.name,
          type_id: receivedBody.type_id,
          provider_id: receivedBody.provider_id,
          config: receivedBody.config,
          is_active: receivedBody.is_active,
        });
      }),
    );

    const { onOpenChange, onSaved } = renderSheet();
    await waitForTypesLoaded();
    await chooseType('Email');
    await chooseProvider('SMTP');

    fireEvent.change(screen.getByLabelText(/nameLabel/), {
      target: { value: 'Meu SMTP' },
    });
    fireEvent.change(screen.getByLabelText(/fieldHost/), {
      target: { value: 'smtp.example.com' },
    });
    fireEvent.change(screen.getByLabelText(/fieldPort/), {
      target: { value: '587' },
    });
    fireEvent.change(screen.getByLabelText(/fieldUsername/), {
      target: { value: 'user' },
    });

    const passwordInput = screen.getByLabelText(/fieldPassword/) as HTMLInputElement;
    expect(passwordInput).toHaveAttribute('type', 'password');
    fireEvent.change(passwordInput, { target: { value: 'secret' } });

    const showPasswordButton = screen.getByRole('button', { name: 'showPassword' });
    fireEvent.click(showPasswordButton);
    expect(passwordInput).toHaveAttribute('type', 'text');
    const hideButton = screen.getByRole('button', { name: 'hidePassword' });
    fireEvent.click(hideButton);
    expect(passwordInput).toHaveAttribute('type', 'password');

    fireEvent.change(screen.getByLabelText(/fieldFromEmail/), {
      target: { value: 'noreply@example.com' },
    });

    // There are two switches on this form (config "secure" + "is_active"); the
    // "secure" one renders first since it's part of the smtp config field list.
    const switches = screen.getAllByRole('switch');
    fireEvent.click(switches[0]);

    fireEvent.click(screen.getByRole('button', { name: 'createProfile' }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('createSuccess'));
    expect(receivedBody).toMatchObject({
      name: 'Meu SMTP',
      type_id: 1,
      provider_id: 10,
      config: expect.objectContaining({
        host: 'smtp.example.com',
        port: '587',
        username: 'user',
        password: 'secret',
        from_email: 'noreply@example.com',
        secure: true,
      }),
    });
    expect(onSaved).toHaveBeenCalledWith(
      expect.objectContaining({ id: 99, provider_id: 10, type_id: 1 } satisfies Partial<IntegrationProfileSheetSavedProfile>),
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('mostra erro (toast.error) quando a criação falha', async () => {
    server.use(
      http.post(`${API}/integration-profile`, () =>
        HttpResponse.json({ message: 'boom' }, { status: 500 }),
      ),
    );

    renderSheet();
    await waitForTypesLoaded();
    await chooseType('Email');
    await chooseProvider('SMTP');

    fireEvent.change(screen.getByLabelText(/nameLabel/), { target: { value: 'X' } });
    fireEvent.change(screen.getByLabelText(/fieldHost/), { target: { value: 'h' } });
    fireEvent.change(screen.getByLabelText(/fieldPort/), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText(/fieldUsername/), { target: { value: 'u' } });
    fireEvent.change(screen.getByLabelText(/fieldPassword/), { target: { value: 'p' } });
    fireEvent.change(screen.getByLabelText(/fieldFromEmail/), {
      target: { value: 'a@b.com' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'createProfile' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('createError'));
  });

  it('não envia quando type_id/provider_id não estão definidos (submit direto no form)', async () => {
    renderSheet();
    await waitForTypesLoaded();

    const form = document.querySelector('form') as HTMLFormElement;
    fireEvent.submit(form);

    // Neither success nor error toast should fire — handleSubmit returns early.
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('alterna o switch isActiveLabel', async () => {
    renderSheet();
    await waitForTypesLoaded();
    await chooseType('Email');
    await chooseProvider('SMTP');

    const switches = screen.getAllByRole('switch');
    const isActiveSwitch = switches[switches.length - 1];
    expect(isActiveSwitch).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(isActiveSwitch);
    expect(isActiveSwitch).toHaveAttribute('aria-checked', 'false');
  });

  it('envia callback_urls dentro do config ao criar um perfil oauth', async () => {
    let receivedBody: any = null;
    server.use(
      http.post(`${API}/integration-profile`, async ({ request }) => {
        receivedBody = await request.json();
        return HttpResponse.json({
          id: 55,
          slug: receivedBody.slug,
          name: receivedBody.name,
          type_id: receivedBody.type_id,
          provider_id: receivedBody.provider_id,
          config: receivedBody.config,
          is_active: receivedBody.is_active,
        });
      }),
    );

    renderSheet();
    await waitForTypesLoaded();
    await chooseType('Auth');
    await chooseProvider('Google');

    fireEvent.change(screen.getByLabelText(/nameLabel/), {
      target: { value: 'Meu Google OAuth' },
    });
    fireEvent.change(screen.getByLabelText(/fieldClientId/), {
      target: { value: 'client-123' },
    });
    fireEvent.change(screen.getByLabelText(/fieldClientSecret/), {
      target: { value: 'secret-456' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'createProfile' }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('createSuccess'));
    expect(receivedBody.config.callback_urls).toEqual([
      `${window.location.origin}/callback/google`,
    ]);
  });
});

describe('IntegrationProfileSheet — campo select (stripe)', () => {
  beforeEach(() => mockCatalog());

  it('renderiza o campo tipo select com opções traduzidas', async () => {
    renderSheet();
    await waitForTypesLoaded();
    await chooseType('Payment');
    await chooseProvider('Stripe');

    openSelectByLabel(/fieldMode/);
    const listbox = await screen.findByRole('listbox');
    const sandboxOption = within(listbox).getByText('fieldModeSandbox');
    fireEvent.pointerUp(sandboxOption);
    fireEvent.click(sandboxOption);

    expect(screen.getByLabelText(/fieldMode/)).toHaveTextContent('fieldModeSandbox');
  });
});

describe('IntegrationProfileSheet — DigitalOcean (node pool picker)', () => {
  beforeEach(() => mockCatalog());

  it('renderiza a seção do seletor de node pool quando o provider é digitalocean', async () => {
    renderSheet();
    await waitForTypesLoaded();
    await chooseType('Video');
    await chooseProvider('DigitalOcean');

    expect(screen.getByText('nodePoolSectionTitle')).toBeInTheDocument();
  });

  it('carrega e seleciona um node pool em modo edição, propagando o valor via onChange/updateConfig', async () => {
    mockCatalog();
    server.use(
      http.get(`${API}/integration-profile/55`, () =>
        HttpResponse.json({
          id: 55,
          slug: 'meu-do',
          name: 'Meu DigitalOcean',
          type_id: 3,
          provider_id: 11,
          config: {},
          is_active: true,
        }),
      ),
      http.post(`${API}/queue/scaling/node-pools`, () =>
        HttpResponse.json([{ id: 'pool-1', name: 'pool-1', size: 's-1vcpu', count: 1, nodeCount: 3 }]),
      ),
    );

    renderSheet({ profileId: 55 });

    await waitFor(() => {
      expect((screen.getByLabelText(/nameLabel/) as HTMLInputElement).value).toBe(
        'Meu DigitalOcean',
      );
    });
    resyncEditModeProviderSelection(11);

    await waitFor(() => {
      expect(screen.getByText('nodePoolSectionTitle')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'nodePoolLoad' }));
      await Promise.resolve();
      await Promise.resolve();
    });

    const trigger = openSelectByLabel(/fieldVideoNodePool/);
    const listbox = await screen.findByRole('listbox');
    const option = within(listbox).getByText(/pool-1/);
    fireEvent.pointerUp(option);
    fireEvent.click(option);

    await waitFor(() => expect(trigger).toHaveTextContent('pool-1'));
  });
});

describe('IntegrationProfileSheet — OAuth (google-oauth)', () => {
  beforeEach(() => mockCatalog());

  it('preenche a callback url padrão via window.location.origin, permite remover (mostrando o estado vazio) e adicionar novamente', async () => {
    renderSheet();
    await waitForTypesLoaded();
    await chooseType('Auth');
    await chooseProvider('Google');

    expect(screen.getByText('callbackUrlsSectionTitle')).toBeInTheDocument();
    const urlInput = screen.getByPlaceholderText('callbackUrlPlaceholder') as HTMLInputElement;
    expect(urlInput.value).toBe(`${window.location.origin}/callback/google`);

    const removeButtons = screen.getAllByRole('button').filter((btn) =>
      btn.querySelector('svg.lucide-x'),
    );
    fireEvent.click(removeButtons[0]);

    expect(screen.getByText('noCallbackUrls')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /addCallbackUrl/ }));
    expect(screen.queryByText('noCallbackUrls')).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('callbackUrlPlaceholder')).toBeInTheDocument();
  });

  it('copia a url para a área de transferência e restaura o ícone após o timeout', async () => {
    renderSheet();
    await waitForTypesLoaded();
    await chooseType('Auth');
    await chooseProvider('Google');

    // Fake timers only around the click + setTimeout under test: the async setup
    // above relies on real microtasks/MSW polling that fake timers would stall.
    vi.useFakeTimers();
    try {
      const copyButtons = screen.getAllByRole('button').filter((btn) =>
        btn.querySelector('svg.lucide-copy'),
      );
      fireEvent.click(copyButtons[0]);

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        `${window.location.origin}/callback/google`,
      );
      expect(document.querySelector('svg.lucide-check')).toBeTruthy();

      act(() => {
        vi.advanceTimersByTime(1500);
      });

      expect(document.querySelector('svg.lucide-check')).toBeFalsy();
    } finally {
      vi.useRealTimers();
    }
  });

  it('atualiza o valor de uma callback url existente', async () => {
    renderSheet();
    await waitForTypesLoaded();
    await chooseType('Auth');
    await chooseProvider('Google');

    const urlInput = screen.getByPlaceholderText('callbackUrlPlaceholder') as HTMLInputElement;
    fireEvent.change(urlInput, { target: { value: 'https://custom.example.com/cb' } });
    expect(urlInput.value).toBe('https://custom.example.com/cb');
  });
});

describe('IntegrationProfileSheet — OAuth especial (github-oauth)', () => {
  beforeEach(() => mockCatalog());

  it('sem NEXT_PUBLIC_API_BASE_URL definido, não gera nenhuma callback url (estado vazio)', async () => {
    renderSheet();
    await waitForTypesLoaded();
    await chooseType('Auth');
    await chooseProvider('GitHub');

    expect(screen.getByText('callbackUrlsSectionTitle')).toBeInTheDocument();
    expect(screen.getByText('noCallbackUrls')).toBeInTheDocument();
  });

  it('com NEXT_PUBLIC_API_BASE_URL definido, gera a callback url única do backend', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'https://api.example.com/');

    renderSheet();
    await waitForTypesLoaded();
    await chooseType('Auth');
    await chooseProvider('GitHub');

    const urlInput = screen.getByPlaceholderText('callbackUrlPlaceholder') as HTMLInputElement;
    expect(urlInput.value).toBe('https://api.example.com/oauth/github/callback');
  });
});

describe('IntegrationProfileSheet — tipo/provider travados e initialTypeSlug', () => {
  beforeEach(() => mockCatalog());

  it('com lockedTypeSlug + lockedProviderSlug, pré-seleciona e desabilita ambos os selects', async () => {
    renderSheet({ lockedTypeSlug: 'payment', lockedProviderSlug: 'stripe' });

    await waitFor(() => {
      expect(screen.getByLabelText(/typeLabel/)).toHaveTextContent('Payment');
    });
    expect(screen.getByLabelText(/typeLabel/)).toBeDisabled();

    await waitFor(() => {
      expect(screen.getByLabelText(/providerLabel/)).toHaveTextContent('Stripe');
    });
    expect(screen.getByLabelText(/providerLabel/)).toBeDisabled();
  });

  it('com initialTypeSlug (sem lock), pré-seleciona o tipo mas mantém os selects habilitados', async () => {
    renderSheet({ initialTypeSlug: 'video' });

    await waitFor(() => {
      expect(screen.getByLabelText(/typeLabel/)).toHaveTextContent('Video');
    });
    expect(screen.getByLabelText(/typeLabel/)).not.toBeDisabled();
    expect(screen.getByLabelText(/providerLabel/)).not.toBeDisabled();
  });

  it('com lockedProviderSlug apontando para um provider oauth, pré-popula callback_urls a partir do provider travado', async () => {
    renderSheet({ initialTypeSlug: 'auth', lockedProviderSlug: 'google-oauth' });

    await waitFor(() => {
      expect(screen.getByLabelText(/providerLabel/)).toHaveTextContent('Google');
    });

    const urlInput = await screen.findByPlaceholderText('callbackUrlPlaceholder');
    expect((urlInput as HTMLInputElement).value).toBe(
      `${window.location.origin}/callback/google`,
    );
  });

  it('com lockedProviderSlug que não corresponde a nenhum provider do tipo atual, não trava nem pré-seleciona nada', async () => {
    renderSheet({ initialTypeSlug: 'auth', lockedProviderSlug: 'provider-inexistente' });

    await waitFor(() => {
      expect(screen.getByLabelText(/typeLabel/)).toHaveTextContent('Auth');
    });
    // isProviderLocked reflects the raw prop (disables the select regardless
    // of a match), but resolvedLockedProvider stays null since no provider
    // matches — so nothing gets pre-selected, unlike the matching-slug case.
    expect(screen.getByLabelText(/providerLabel/)).toBeDisabled();
    expect(screen.getByLabelText(/providerLabel/)).toHaveTextContent('providerPlaceholder');
  });

  it('aceita types/providers envolvidos em { data: [...] } (não apenas arrays puros)', async () => {
    mockCatalog({
      typesBody: { data: TYPES },
      providersBody: { data: PROVIDERS },
    });

    renderSheet();
    await waitForTypesLoaded();
    await chooseType('Video');
    await chooseProvider('DigitalOcean');

    expect(screen.getByLabelText(/providerLabel/)).toHaveTextContent('DigitalOcean');
  });
});

describe('IntegrationProfileSheet — modo edição', () => {
  it('carrega o perfil existente e popula o formulário, incluindo o segredo mascarado', async () => {
    mockCatalog();
    server.use(
      http.get(`${API}/integration-profile/42`, () =>
        HttpResponse.json({
          id: 42,
          slug: 'meu-smtp',
          name: 'Meu SMTP',
          type_id: 1,
          provider_id: 10,
          config: {
            host: 'smtp.old.com',
            port: 25,
            username: 'olduser',
            password: '********',
            from_email: 'old@example.com',
            secure: true,
          },
          is_active: true,
        }),
      ),
    );

    renderSheet({ profileId: 42 });

    await waitFor(() => {
      expect((screen.getByLabelText(/nameLabel/) as HTMLInputElement).value).toBe(
        'Meu SMTP',
      );
    });
    expect((screen.getByLabelText(/slugLabel/) as HTMLInputElement).value).toBe(
      'meu-smtp',
    );
    expect(screen.getByLabelText(/typeLabel/)).toBeDisabled();
    expect(screen.getByLabelText(/providerLabel/)).toBeDisabled();

    // See resyncEditModeProviderSelection: provider_id gets clobbered back to ''
    // in the same commit it's populated, so the config fields never appear
    // without this resync. The resync goes through the same onValueChange the
    // component uses for a user picking a provider, which also resets `config`
    // to {} (by design, for the "user changes provider" flow) — so we
    // reconstruct the masked-secret scenario by typing the mask back in,
    // exercising the same isLockedSecret/isEditing branch either way.
    resyncEditModeProviderSelection(10);

    await waitFor(() => {
      expect(screen.getByLabelText(/fieldPassword/)).toBeInTheDocument();
    });
    const passwordInput = screen.getByLabelText(/fieldPassword/) as HTMLInputElement;
    fireEvent.change(passwordInput, { target: { value: '********' } });
    expect(passwordInput.value).toBe('********');
    expect(passwordInput).toBeDisabled();
    expect(passwordInput).not.toBeRequired();

    const changeButton = screen.getByRole('button', { name: 'changeSecret' });
    fireEvent.click(changeButton);

    expect(passwordInput.value).toBe('');
    expect(passwordInput).not.toBeDisabled();
    expect(passwordInput).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'hidePassword' })).toBeInTheDocument();
  });

  it('mostra erro e fecha o sheet quando o carregamento do perfil falha', async () => {
    mockCatalog();
    server.use(
      http.get(`${API}/integration-profile/42`, () =>
        HttpResponse.json({ message: 'boom' }, { status: 500 }),
      ),
    );

    const { onOpenChange } = renderSheet({ profileId: 42 });

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('loadError'));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it('atualiza um perfil existente via PATCH e chama onSaved/onOpenChange', async () => {
    mockCatalog();
    server.use(
      http.get(`${API}/integration-profile/42`, () =>
        HttpResponse.json({
          id: 42,
          slug: 'meu-smtp',
          name: 'Meu SMTP',
          type_id: 1,
          provider_id: 10,
          config: {
            host: 'smtp.old.com',
            port: 25,
            username: 'olduser',
            password: '********',
            from_email: 'old@example.com',
          },
          is_active: true,
        }),
      ),
    );
    let receivedMethod = '';
    server.use(
      http.patch(`${API}/integration-profile/42`, async ({ request }) => {
        receivedMethod = request.method;
        const body = (await request.json()) as any;
        return HttpResponse.json({
          id: 42,
          slug: body.slug,
          name: body.name,
          type_id: body.type_id,
          provider_id: body.provider_id,
          config: body.config,
          is_active: body.is_active,
        });
      }),
    );

    const { onOpenChange, onSaved } = renderSheet({ profileId: 42 });

    await waitFor(() => {
      expect((screen.getByLabelText(/nameLabel/) as HTMLInputElement).value).toBe(
        'Meu SMTP',
      );
    });
    resyncEditModeProviderSelection(10);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'saveChanges' })).toBeEnabled();
    });

    // Submitting via a direct click on the submit button is flaky here: the
    // resync's native `change` event on the hidden select leaves an in-flight
    // render that can make jsdom see the button as transiently disabled at
    // the exact moment of the click. Submitting the form directly sidesteps
    // that ordering issue while still exercising the same onSubmit handler.
    fireEvent.submit(document.querySelector('form')!);

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('updateSuccess'));
    expect(receivedMethod).toBe('PATCH');
    expect(onSaved).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('mostra erro (toast.error updateError) quando a atualização falha', async () => {
    mockCatalog();
    server.use(
      http.get(`${API}/integration-profile/42`, () =>
        HttpResponse.json({
          id: 42,
          slug: 'meu-smtp',
          name: 'Meu SMTP',
          type_id: 1,
          provider_id: 10,
          config: { host: 'h', port: 1, username: 'u', password: '********', from_email: 'a@b.com' },
          is_active: true,
        }),
      ),
      http.patch(`${API}/integration-profile/42`, () =>
        HttpResponse.json({ message: 'boom' }, { status: 500 }),
      ),
    );

    renderSheet({ profileId: 42 });

    await waitFor(() => {
      expect((screen.getByLabelText(/nameLabel/) as HTMLInputElement).value).toBe(
        'Meu SMTP',
      );
    });
    resyncEditModeProviderSelection(10);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'saveChanges' })).toBeEnabled();
    });

    fireEvent.submit(document.querySelector('form')!);

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('updateError'));
  });

  it('modo edição com provider oauth sem callback_urls salvos gera o default a partir do provider', async () => {
    mockCatalog();
    server.use(
      http.get(`${API}/integration-profile/77`, () =>
        HttpResponse.json({
          id: 77,
          slug: 'meu-google',
          name: 'Meu Google',
          type_id: 5,
          provider_id: 13,
          config: { client_id: 'cid', client_secret: '********' },
          is_active: true,
        }),
      ),
    );

    renderSheet({ profileId: 77 });

    await waitFor(() => {
      expect((screen.getByLabelText(/nameLabel/) as HTMLInputElement).value).toBe(
        'Meu Google',
      );
    });
    resyncEditModeProviderSelection(13);

    const urlInput = (await screen.findByPlaceholderText(
      'callbackUrlPlaceholder',
    )) as HTMLInputElement;
    expect(urlInput.value).toBe(`${window.location.origin}/callback/google`);
  });

  it('provider_id do perfil carregado não corresponde a nenhum provider conhecido: não trava, não pré-popula callback_urls', async () => {
    mockCatalog();
    server.use(
      http.get(`${API}/integration-profile/93`, () =>
        HttpResponse.json({
          id: 93,
          slug: 'provider-desconhecido',
          name: 'Provider Desconhecido',
          type_id: 1,
          provider_id: 9999,
          config: {},
          is_active: true,
        }),
      ),
    );

    renderSheet({ profileId: 93 });

    await waitFor(() => {
      expect((screen.getByLabelText(/nameLabel/) as HTMLInputElement).value).toBe(
        'Provider Desconhecido',
      );
    });
    expect(screen.queryByPlaceholderText('callbackUrlPlaceholder')).not.toBeInTheDocument();
  });

  it('config: null no perfil carregado cai no fallback {} e não quebra o formulário', async () => {
    mockCatalog();
    server.use(
      http.get(`${API}/integration-profile/91`, () =>
        HttpResponse.json({
          id: 91,
          slug: 'sem-config',
          name: 'Sem Config',
          type_id: 1,
          provider_id: 10,
          config: null,
          is_active: true,
        }),
      ),
    );

    renderSheet({ profileId: 91 });

    await waitFor(() => {
      expect((screen.getByLabelText(/nameLabel/) as HTMLInputElement).value).toBe(
        'Sem Config',
      );
    });
    resyncEditModeProviderSelection(10);

    await waitFor(() => {
      expect(screen.getByLabelText(/fieldHost/)).toBeInTheDocument();
    });
    expect((screen.getByLabelText(/fieldHost/) as HTMLInputElement).value).toBe('');
  });

  it('modo edição com lockedProviderSlug: quando o provider travado bate com o tipo do perfil carregado, força o provider_id para o travado mesmo com provider_id salvo diferente', async () => {
    mockCatalog();
    server.use(
      http.get(`${API}/integration-profile/88`, () =>
        HttpResponse.json({
          id: 88,
          slug: 'x',
          name: 'X',
          type_id: 5,
          // Saved provider is github-oauth (14), but google-oauth (13) is locked
          // and shares the same type_id (5) — the ternary should force provider_id
          // to the locked provider's id instead of the loaded data.provider_id.
          provider_id: 14,
          config: { access_token: 'whatever' },
          is_active: true,
        }),
      ),
    );

    renderSheet({ profileId: 88, lockedProviderSlug: 'google-oauth' });

    await waitFor(() => {
      expect((screen.getByLabelText(/nameLabel/) as HTMLInputElement).value).toBe('X');
    });
    resyncEditModeProviderSelection(13);

    await waitFor(() => {
      expect(screen.getByLabelText(/providerLabel/)).toHaveTextContent('Google');
    });
  });
});

describe('IntegrationProfileSheet — corridas de desmontagem (guarda active)', () => {
  it('desmontar antes da resposta do catálogo resolver não causa erro (guarda active no efeito de catálogo)', async () => {
    let resolveTypes: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      resolveTypes = resolve;
    });
    server.use(
      http.get(`${API}/integration-profile/types`, async () => {
        await gate;
        return HttpResponse.json(TYPES);
      }),
      http.get(`${API}/integration-profile/providers`, () => HttpResponse.json(PROVIDERS)),
    );

    const { unmount } = renderSheet();
    unmount();
    resolveTypes();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(toast.error).not.toHaveBeenCalled();
  });

  it('desmontar antes da resposta do perfil (modo edição) resolver não causa erro (guarda active no efeito de carregamento)', async () => {
    mockCatalog();
    let resolveProfile: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      resolveProfile = resolve;
    });
    server.use(
      http.get(`${API}/integration-profile/42`, async () => {
        await gate;
        return HttpResponse.json({
          id: 42,
          slug: 'meu-smtp',
          name: 'Meu SMTP',
          type_id: 1,
          provider_id: 10,
          config: {},
          is_active: true,
        });
      }),
    );

    const { unmount } = renderSheet({ profileId: 42 });
    // In edit mode the type/provider selects are always disabled (isEditing),
    // so waitForTypesLoaded's "not disabled" check never resolves here. Wait
    // instead for isLoadingProfile to flip true (nameLabel becomes disabled),
    // which only happens once the catalog has loaded and the profile fetch
    // has actually started — the moment we want to unmount at.
    await waitFor(() => {
      expect(screen.getByLabelText(/nameLabel/)).toBeDisabled();
    });
    unmount();
    resolveProfile();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(toast.error).not.toHaveBeenCalled();
  });
});

describe('IntegrationProfileSheet — appUrl indisponível (window.location.origin vazio)', () => {
  beforeEach(() => mockCatalog());

  const originalLocation = window.location;

  function stubEmptyOrigin() {
    // jsdom's window.location.origin is a non-configurable accessor on the
    // Location prototype, so it can't be shadowed in place with
    // Object.defineProperty(window.location, 'origin', ...). Replacing the
    // whole `window.location` property (which IS configurable) with a plain
    // object that mimics the bits the component reads works instead.
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, origin: '' },
      configurable: true,
      writable: true,
    });
  }

  function restoreLocation() {
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      configurable: true,
      writable: true,
    });
  }

  it('com window.location.origin vazio, callback_urls fica vazio (buildOAuthCallbackUrls / defaults / handleProviderChange)', async () => {
    stubEmptyOrigin();

    try {
      renderSheet();
      await waitForTypesLoaded();
      await chooseType('Auth');
      await chooseProvider('Google');

      expect(screen.getByText('callbackUrlsSectionTitle')).toBeInTheDocument();
      expect(screen.getByText('noCallbackUrls')).toBeInTheDocument();
      expect(screen.queryByPlaceholderText('callbackUrlPlaceholder')).not.toBeInTheDocument();
    } finally {
      restoreLocation();
    }
  });

  it('com window.location.origin vazio, provider travado oauth não gera callback_urls padrão', async () => {
    stubEmptyOrigin();

    try {
      renderSheet({ initialTypeSlug: 'auth', lockedProviderSlug: 'google-oauth' });

      await waitFor(() => {
        expect(screen.getByLabelText(/providerLabel/)).toHaveTextContent('Google');
      });

      expect(screen.getByText('noCallbackUrls')).toBeInTheDocument();
    } finally {
      restoreLocation();
    }
  });
});

describe('IntegrationProfileSheet — provider travado trocado manualmente (ternário previous.provider_id)', () => {
  it('travar o provider após um perfil de outro provider do mesmo tipo já ter carregado força a correção e reseta o config (previous.provider_id truthy e diferente)', async () => {
    mockCatalog();
    server.use(
      http.get(`${API}/integration-profile/42`, () =>
        HttpResponse.json({
          id: 42,
          slug: 'meu-smtp',
          name: 'Meu SMTP',
          type_id: 1,
          provider_id: 10,
          config: {
            host: 'smtp.old.com',
            port: 25,
            username: 'olduser',
            password: '********',
            from_email: 'old@example.com',
          },
          is_active: true,
        }),
      ),
    );

    const onOpenChange = vi.fn();
    const onSaved = vi.fn();
    const { rerender } = render(
      <IntegrationProfileSheet
        open
        onOpenChange={onOpenChange}
        onSaved={onSaved}
        profileId={42}
      />,
      { wrapper: makeAppProviderWrapper({ apiBaseUrl: API }) },
    );

    await waitFor(() => {
      expect((screen.getByLabelText(/nameLabel/) as HTMLInputElement).value).toBe(
        'Meu SMTP',
      );
    });
    resyncEditModeProviderSelection(10);
    await waitFor(() => {
      expect(screen.getByLabelText(/fieldHost/)).toBeInTheDocument();
    });

    // Rerender adding lockedProviderSlug='gmail': gmail (16) is a *different*
    // provider under the same type_id (1) as the already-loaded smtp (10).
    // The lock-sync effect (which only depends on formData.type_id/provider_id,
    // not on the profile refetch) runs synchronously on this same commit and
    // sees a formData.provider_id ('10') that is truthy and different from
    // the newly-locked provider's id ('16') — exactly the branch under test.
    rerender(
      <IntegrationProfileSheet
        open
        onOpenChange={onOpenChange}
        onSaved={onSaved}
        profileId={42}
        lockedProviderSlug="gmail"
      />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText(/providerLabel/)).toHaveTextContent('Gmail');
    });
    // config was reset (to the gmail lock's initialConfig), so the smtp-only
    // "host" field must be gone and gmail's own fields must show up empty.
    expect(screen.queryByLabelText(/fieldHost/)).not.toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByLabelText(/fieldClientId/)).toBeInTheDocument();
    });
    expect((screen.getByLabelText(/fieldClientId/) as HTMLInputElement).value).toBe('');
  });
});

describe('IntegrationProfileSheet — handleTypeChange com tipo travado (guarda isTypeLocked)', () => {
  beforeEach(() => mockCatalog());

  it('disparar um change no select nativo de tipo travado não altera type_id/provider_id/config (guarda isTypeLocked)', async () => {
    renderSheet({ lockedTypeSlug: 'payment', lockedProviderSlug: 'stripe' });

    await waitFor(() => {
      expect(screen.getByLabelText(/typeLabel/)).toHaveTextContent('Payment');
    });
    await waitFor(() => {
      expect(screen.getByLabelText(/providerLabel/)).toHaveTextContent('Stripe');
    });

    const typeNativeSelect = document.querySelectorAll('form select')[0] as
      | HTMLSelectElement
      | undefined;
    // Even bypassing the disabled Radix trigger via a direct native `change`
    // event, handleTypeChange's `if (isTypeLocked) return;` guard must prevent
    // any state update: type/provider stay exactly as locked.
    fireEvent.change(typeNativeSelect!, { target: { value: '4' } });

    expect(screen.getByLabelText(/typeLabel/)).toHaveTextContent('Payment');
    expect(screen.getByLabelText(/providerLabel/)).toHaveTextContent('Stripe');
  });
});
