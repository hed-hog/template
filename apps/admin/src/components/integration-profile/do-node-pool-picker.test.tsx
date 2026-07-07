import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { http, HttpResponse, server } from '@hed-hog/vitest-config';

// Hoisted mocks required by AppProvider (see src/test/app-provider.integration.test.tsx).
const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
}));
vi.mock('@bprogress/next', () => ({
  AppProgressProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  }),
}));

import { toast } from 'sonner';
import { makeAppProviderWrapper } from '@/test/test-utils';
import { DoNodePoolPicker } from './do-node-pool-picker';

const API = 'http://api.test';

// Radix Select relies on DOM APIs jsdom doesn't implement (see src/components/ui/select.test.tsx).
beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
  vi.clearAllMocks();
});

function setup(
  props: Partial<React.ComponentProps<typeof DoNodePoolPicker>> = {},
) {
  const onChange = vi.fn();
  const utils = render(
    <DoNodePoolPicker
      apiToken="tok-123"
      clusterId="cluster-1"
      value=""
      onChange={onChange}
      {...props}
    />,
    { wrapper: makeAppProviderWrapper({ apiBaseUrl: API }) },
  );
  return { onChange, ...utils };
}

function openSelect() {
  const trigger = screen.getByLabelText(/fieldVideoNodePool/, { exact: false });
  fireEvent.pointerDown(trigger);
  fireEvent.click(trigger);
}

describe('DoNodePoolPicker', () => {
  it('desabilita o botão de carregar e mostra a dica quando não há credenciais nem profileId', () => {
    setup({ apiToken: '', clusterId: '', value: '' });
    expect(screen.getByRole('button', { name: 'nodePoolLoad' })).toBeDisabled();
    expect(screen.getByText('nodePoolNeedCreds')).toBeInTheDocument();
  });

  it('habilita o botão quando há token e clusterId, sem mostrar a dica', () => {
    setup({ apiToken: 'tok', clusterId: 'cluster-1' });
    expect(screen.getByRole('button', { name: 'nodePoolLoad' })).toBeEnabled();
    expect(screen.queryByText('nodePoolNeedCreds')).not.toBeInTheDocument();
  });

  it('habilita o botão quando há profileId mesmo sem token/clusterId', () => {
    setup({ apiToken: '', clusterId: '', profileId: 42 });
    expect(screen.getByRole('button', { name: 'nodePoolLoad' })).toBeEnabled();
    expect(screen.queryByText('nodePoolNeedCreds')).not.toBeInTheDocument();
  });

  it('ignora o token quando ele está mascarado (SECRET_MASK)', () => {
    setup({ apiToken: '********', clusterId: '', value: '' });
    // effectiveToken becomes '', so without clusterId/profileId, canLoad is false.
    expect(screen.getByRole('button', { name: 'nodePoolLoad' })).toBeDisabled();
    expect(screen.getByText('nodePoolNeedCreds')).toBeInTheDocument();
  });

  it('carrega os pools ao clicar em Load e popula o select', async () => {
    let receivedBody: any = null;
    server.use(
      http.post(`${API}/queue/scaling/node-pools`, async ({ request }) => {
        receivedBody = await request.json();
        return HttpResponse.json([
          { id: 'p1', name: 'pool-1', size: 's-2vcpu-2gb', count: 2, nodeCount: 3 },
          { id: 'p2', name: 'pool-2', size: '', count: 0, nodeCount: 0 },
        ]);
      }),
    );

    setup({ apiToken: 'tok-abc', clusterId: 'cluster-9', profileId: 7 });

    const loadButton = screen.getByRole('button', { name: 'nodePoolLoad' });
    fireEvent.click(loadButton);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'nodePoolLoad' })).toBeInTheDocument(),
    );

    expect(receivedBody).toEqual({
      profileId: 7,
      api_token: 'tok-abc',
      cluster_id: 'cluster-9',
    });

    openSelect();
    const listbox = await screen.findByRole('listbox');
    expect(within(listbox).getByText(/pool-1.*s-2vcpu-2gb.*3/)).toBeInTheDocument();
    expect(within(listbox).getByText('pool-2')).toBeInTheDocument();
  });

  it('mostra o estado de carregando enquanto a requisição está em andamento', async () => {
    let resolveRequest: (() => void) | null = null;
    server.use(
      http.post(`${API}/queue/scaling/node-pools`, async () => {
        await new Promise<void>((resolve) => {
          resolveRequest = resolve;
        });
        return HttpResponse.json([]);
      }),
    );

    setup({ apiToken: 'tok', clusterId: 'cl' });
    fireEvent.click(screen.getByRole('button', { name: 'nodePoolLoad' }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'nodePoolLoading' })).toBeDisabled(),
    );
    await waitFor(() => expect(resolveRequest).not.toBeNull());

    resolveRequest?.();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'nodePoolLoad' })).toBeInTheDocument(),
    );
  });

  it('mostra aviso (toast.warning) quando a lista retornada está vazia', async () => {
    server.use(
      http.post(`${API}/queue/scaling/node-pools`, () => HttpResponse.json([])),
    );

    setup({ apiToken: 'tok', clusterId: 'cl' });
    fireEvent.click(screen.getByRole('button', { name: 'nodePoolLoad' }));

    await waitFor(() => expect(toast.warning).toHaveBeenCalledWith('nodePoolNoneFound'));
  });

  it('mostra erro (toast.error) quando a requisição falha', async () => {
    server.use(
      http.post(`${API}/queue/scaling/node-pools`, () =>
        HttpResponse.json({ message: 'boom' }, { status: 500 }),
      ),
    );

    setup({ apiToken: 'tok', clusterId: 'cl' });
    fireEvent.click(screen.getByRole('button', { name: 'nodePoolLoad' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('nodePoolLoadError'));
  });

  it('não duplica o valor atual quando ele já está entre os pools carregados', async () => {
    server.use(
      http.post(`${API}/queue/scaling/node-pools`, () =>
        HttpResponse.json([
          { id: 'p1', name: 'pool-1', size: '', count: 0, nodeCount: 0 },
        ]),
      ),
    );

    setup({ apiToken: 'tok', clusterId: 'cl', value: 'pool-1' });
    fireEvent.click(screen.getByRole('button', { name: 'nodePoolLoad' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'nodePoolLoad' })).toBeInTheDocument(),
    );

    openSelect();
    const listbox = await screen.findByRole('listbox');
    expect(within(listbox).getAllByText('pool-1')).toHaveLength(1);
  });

  it('adiciona uma opção sintética quando o valor atual não está entre os pools', async () => {
    setup({ apiToken: '', clusterId: '', profileId: 1, value: 'orphan-pool' });

    openSelect();
    const listbox = await screen.findByRole('listbox');
    expect(within(listbox).getByText('orphan-pool')).toBeInTheDocument();
  });

  it('usa apenas profileId no payload quando não há token nem clusterId', async () => {
    let receivedBody: any = null;
    server.use(
      http.post(`${API}/queue/scaling/node-pools`, async ({ request }) => {
        receivedBody = await request.json();
        return HttpResponse.json([]);
      }),
    );

    setup({ apiToken: '', clusterId: '', profileId: 5 });
    fireEvent.click(screen.getByRole('button', { name: 'nodePoolLoad' }));

    await waitFor(() => expect(receivedBody).toEqual({ profileId: 5 }));
  });

  it('trata uma resposta que não é array como lista vazia', async () => {
    server.use(
      http.post(`${API}/queue/scaling/node-pools`, () =>
        HttpResponse.json({ notAnArray: true } as unknown as never),
      ),
    );

    setup({ apiToken: 'tok', clusterId: 'cl' });
    fireEvent.click(screen.getByRole('button', { name: 'nodePoolLoad' }));

    await waitFor(() => expect(toast.warning).toHaveBeenCalledWith('nodePoolNoneFound'));
  });

  it('chama onChange com o nome selecionado', async () => {
    server.use(
      http.post(`${API}/queue/scaling/node-pools`, () =>
        HttpResponse.json([
          { id: 'p1', name: 'pool-1', size: 's-1vcpu', count: 1, nodeCount: 0 },
        ]),
      ),
    );

    const { onChange } = setup({ apiToken: 'tok', clusterId: 'cl' });
    fireEvent.click(screen.getByRole('button', { name: 'nodePoolLoad' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'nodePoolLoad' })).toBeInTheDocument(),
    );

    openSelect();
    const listbox = await screen.findByRole('listbox');
    const option = within(listbox).getByText(/pool-1/);
    fireEvent.pointerUp(option);
    fireEvent.click(option);

    expect(onChange).toHaveBeenCalledWith('pool-1');
  });
});
