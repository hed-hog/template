import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

// installation-provider uses useFormDraft, which calls useApp(). Mocking
// @hed-hog/next-app-provider directly (as src/hooks/use-form-draft.test.ts does)
// avoids having to stand up the full AppProvider tree / next navigation mocks.
const { appState } = vi.hoisted(() => ({
  appState: {
    accessToken: undefined as string | undefined,
    user: null as { id: number } | null,
  },
}));
vi.mock('@hed-hog/next-app-provider', () => ({ useApp: () => appState }));

const { axiosMock } = vi.hoisted(() => {
  const fn = vi.fn() as unknown as ReturnType<typeof vi.fn> & {
    get: ReturnType<typeof vi.fn>;
  };
  fn.get = vi.fn();
  return { axiosMock: fn };
});
vi.mock('axios', () => ({ default: axiosMock }));

import {
  InstallationProvider,
  useInstallation,
} from './installation-provider';

const DRAFT_KEY = 'core-installation-form-draft';

function setLocationOrigin(origin: string) {
  Object.defineProperty(window, 'location', {
    value: { ...window.location, origin, reload: vi.fn() },
    writable: true,
    configurable: true,
  });
}

function setNavigatorLanguage(language: string) {
  Object.defineProperty(navigator, 'language', {
    value: language,
    configurable: true,
  });
}

describe('InstallationProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    appState.accessToken = undefined;
    appState.user = null;
    setLocationOrigin('http://localhost:3000');
    setNavigatorLanguage('en-US');
    axiosMock.mockReset();
    axiosMock.get = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('quando installed=true, renderiza apenas os children, sem formulário', () => {
    render(
      <InstallationProvider installed apiBaseUrl="http://api.test">
        <span>app instalado</span>
      </InstallationProvider>
    );
    expect(screen.getByText('app instalado')).toBeInTheDocument();
    expect(screen.queryByText('HedHog')).not.toBeInTheDocument();
  });

  it('quando installed=false, renderiza o formulário com adminUrl/apiUrl preenchidos automaticamente', async () => {
    render(
      <InstallationProvider installed={false} apiBaseUrl="http://api.test">
        <span>nunca aparece</span>
      </InstallationProvider>
    );

    expect(screen.getByText('HedHog')).toBeInTheDocument();
    expect(screen.queryByText('nunca aparece')).not.toBeInTheDocument();

    const adminUrlInput = screen.getByPlaceholderText(
      'http://localhost:3200'
    ) as HTMLInputElement;
    const apiUrlInput = screen.getByPlaceholderText(
      'http://localhost:3100'
    ) as HTMLInputElement;

    await waitFor(() => expect(adminUrlInput.value).toBe('http://localhost:3000'));
    expect(apiUrlInput.value).toBe('http://api.test');
  });

  it('remove barra final do apiBaseUrl ao preencher apiUrl', async () => {
    render(
      <InstallationProvider installed={false} apiBaseUrl="http://api.test/">
        <span />
      </InstallationProvider>
    );
    const apiUrlInput = screen.getByPlaceholderText(
      'http://localhost:3100'
    ) as HTMLInputElement;
    await waitFor(() => expect(apiUrlInput.value).toBe('http://api.test'));
  });

  it('preenche apiUrl quando o valor inicial normalizado é vazio (apiBaseUrl "/")', async () => {
    // '/'.replace(/\/$/, '') === '' — so normalizedApiBaseUrl (and thus the
    // apiUrl default value) is falsy, exercising the "fill apiUrl" branch of
    // the mount effect (the same branch that fills adminUrl when it's unset).
    render(
      <InstallationProvider installed={false} apiBaseUrl="/">
        <span />
      </InstallationProvider>
    );
    const apiUrlInput = screen.getByPlaceholderText(
      'http://localhost:3100'
    ) as HTMLInputElement;
    await waitFor(() => expect(apiUrlInput.value).toBe(''));
  });

  it('usa http://localhost:3100 como apiBaseUrl padrão quando não informado', async () => {
    render(
      <InstallationProvider installed={false}>
        <span />
      </InstallationProvider>
    );
    const apiUrlInput = screen.getByPlaceholderText(
      'http://localhost:3100'
    ) as HTMLInputElement;
    await waitFor(() =>
      expect(apiUrlInput.value).toBe('http://localhost:3100')
    );
  });

  it('carrega rascunho salvo do localStorage e reseta o formulário (senha sempre em branco)', async () => {
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        payload: {
          values: {
            appName: 'Minha App',
            slogan: 'Meu Slogan',
            userName: 'Fulano',
            email: 'fulano@test.com',
            adminUrl: 'http://admin.test',
            apiUrl: 'http://api.test',
          },
        },
        savedAt: new Date().toISOString(),
        version: 1,
        ownerKey: 'anonymous',
      })
    );

    render(
      <InstallationProvider installed={false} apiBaseUrl="http://api.test">
        <span />
      </InstallationProvider>
    );

    const appNameInput = screen.getByPlaceholderText(
      'HedHog'
    ) as HTMLInputElement;
    const emailInput = screen.getByPlaceholderText(
      'root@hedhog.com'
    ) as HTMLInputElement;
    const passwordInput = screen.getByPlaceholderText(
      'changeme'
    ) as HTMLInputElement;

    await waitFor(() => expect(appNameInput.value).toBe('Minha App'));
    expect(emailInput.value).toBe('fulano@test.com');
    expect(passwordInput.value).toBe('');
  });

  it('usa adminUrl/apiUrl atuais quando o rascunho não os possui', async () => {
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        payload: {
          values: {
            appName: 'Minha App',
            slogan: '',
            userName: '',
            email: '',
            adminUrl: '',
            apiUrl: '',
          },
        },
        savedAt: new Date().toISOString(),
        version: 1,
        ownerKey: 'anonymous',
      })
    );

    render(
      <InstallationProvider installed={false} apiBaseUrl="http://api.test">
        <span />
      </InstallationProvider>
    );

    const adminUrlInput = screen.getByPlaceholderText(
      'http://localhost:3200'
    ) as HTMLInputElement;
    const apiUrlInput = screen.getByPlaceholderText(
      'http://localhost:3100'
    ) as HTMLInputElement;

    await waitFor(() =>
      expect(adminUrlInput.value).toBe('http://localhost:3000')
    );
    expect(apiUrlInput.value).toBe('http://api.test');
  });

  it('mostra o status do rascunho em inglês quando o idioma do navegador não é pt', async () => {
    setNavigatorLanguage('en-US');
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        payload: {
          values: {
            appName: 'X',
            slogan: '',
            userName: '',
            email: '',
            adminUrl: '',
            apiUrl: '',
          },
        },
        savedAt: new Date().toISOString(),
        version: 1,
        ownerKey: 'anonymous',
      })
    );

    render(
      <InstallationProvider installed={false} apiBaseUrl="http://api.test">
        <span />
      </InstallationProvider>
    );

    await waitFor(() =>
      expect(screen.getByText(/Draft saved/)).toBeInTheDocument()
    );
  });

  it('mostra o status do rascunho em português quando o idioma do navegador é pt', async () => {
    setNavigatorLanguage('pt-BR');
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        payload: {
          values: {
            appName: 'X',
            slogan: '',
            userName: '',
            email: '',
            adminUrl: '',
            apiUrl: '',
          },
        },
        savedAt: new Date().toISOString(),
        version: 1,
        ownerKey: 'anonymous',
      })
    );

    render(
      <InstallationProvider installed={false} apiBaseUrl="http://api.test">
        <span />
      </InstallationProvider>
    );

    await waitFor(() =>
      expect(screen.getByText(/Rascunho salvo/)).toBeInTheDocument()
    );
  });

  it('não mostra status de rascunho quando não há rascunho salvo', () => {
    render(
      <InstallationProvider installed={false} apiBaseUrl="http://api.test">
        <span />
      </InstallationProvider>
    );
    expect(screen.queryByText(/Draft saved/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Rascunho salvo/)).not.toBeInTheDocument();
  });

  it('preenche todos os campos e alimenta o hasData/rascunho com valores reais (não vazios)', async () => {
    vi.useFakeTimers();
    render(
      <InstallationProvider installed={false} apiBaseUrl="http://api.test">
        <span />
      </InstallationProvider>
    );

    fireEvent.change(screen.getByPlaceholderText('HedHog'), {
      target: { value: 'App Real' },
    });
    fireEvent.change(screen.getByPlaceholderText('Administration Panel'), {
      target: { value: 'Slogan Real' },
    });
    fireEvent.change(screen.getByPlaceholderText('Root User'), {
      target: { value: 'Usuario Real' },
    });
    fireEvent.change(screen.getByPlaceholderText('root@hedhog.com'), {
      target: { value: 'real@test.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('http://localhost:3200'), {
      target: { value: 'http://custom-admin.test' },
    });
    fireEvent.change(screen.getByPlaceholderText('http://localhost:3100'), {
      target: { value: 'http://custom-api.test' },
    });

    // Let the debounced draft-save effect run so hasData/watchedValues settle
    // with real (non-nullish) values instead of the initial empty defaults.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(
      JSON.parse(localStorage.getItem(DRAFT_KEY) ?? '{}').payload.values
    ).toEqual({
      appName: 'App Real',
      slogan: 'Slogan Real',
      userName: 'Usuario Real',
      email: 'real@test.com',
      adminUrl: 'http://custom-admin.test',
      apiUrl: 'http://custom-api.test',
    });
  });

  it('reseta o formulário quando o rascunho não possui appName/slogan/userName/email (undefined)', async () => {
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        payload: {
          values: {
            adminUrl: 'http://from-draft-admin.test',
            apiUrl: 'http://from-draft-api.test',
          },
        },
        savedAt: new Date().toISOString(),
        version: 1,
        ownerKey: 'anonymous',
      })
    );

    render(
      <InstallationProvider installed={false} apiBaseUrl="http://api.test">
        <span />
      </InstallationProvider>
    );

    const appNameInput = screen.getByPlaceholderText(
      'HedHog'
    ) as HTMLInputElement;
    const adminUrlInput = screen.getByPlaceholderText(
      'http://localhost:3200'
    ) as HTMLInputElement;

    await waitFor(() =>
      expect(adminUrlInput.value).toBe('http://from-draft-admin.test')
    );
    expect(appNameInput.value).toBe('');
  });

  it('não mostra status de rascunho quando savedAt é inválido', async () => {
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        payload: {
          values: {
            appName: 'X',
            slogan: '',
            userName: '',
            email: '',
            adminUrl: '',
            apiUrl: '',
          },
        },
        savedAt: 'not-a-valid-date',
        version: 1,
        ownerKey: 'anonymous',
      })
    );

    render(
      <InstallationProvider installed={false} apiBaseUrl="http://api.test">
        <span />
      </InstallationProvider>
    );

    const appNameInput = screen.getByPlaceholderText(
      'HedHog'
    ) as HTMLInputElement;
    await waitFor(() => expect(appNameInput.value).toBe('X'));
    expect(screen.queryByText(/Draft saved/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Rascunho salvo/)).not.toBeInTheDocument();
  });

  it('useInstallation lança erro quando usado fora do InstallationProvider', () => {
    function Consumer() {
      useInstallation();
      return null;
    }
    // Suppress the expected React error boundary console noise.
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Consumer />)).toThrow(
      'useInstallation must be used within an InstallationProvider'
    );
    consoleSpy.mockRestore();
  });

  it('useInstallation retorna o contexto quando usado dentro do InstallationProvider', () => {
    function Consumer() {
      const ctx = useInstallation();
      return <span>ctx:{JSON.stringify(ctx)}</span>;
    }
    render(
      <InstallationProvider installed apiBaseUrl="http://api.test">
        <Consumer />
      </InstallationProvider>
    );
    expect(screen.getByText('ctx:{}')).toBeInTheDocument();
  });

  describe('submissão do formulário', () => {
    async function renderAndWaitValid() {
      render(
        <InstallationProvider installed={false} apiBaseUrl="http://api.test">
          <span />
        </InstallationProvider>
      );
      const button = screen.getByRole('button', { name: 'Instalar' });
      await waitFor(() => expect(button).not.toBeDisabled());
      return button;
    }

    it('submete com sucesso, mostra loading e recarrega ao confirmar instalação', async () => {
      vi.useFakeTimers();
      axiosMock.mockResolvedValue({ data: {} });
      axiosMock.get = vi.fn().mockResolvedValue({ data: { installed: true } });

      render(
        <InstallationProvider installed={false} apiBaseUrl="http://api.test">
          <span />
        </InstallationProvider>
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      const button = screen.getByRole('button', { name: 'Instalar' });
      expect(button).not.toBeDisabled();

      fireEvent.click(button);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(screen.getByText('Iniciando instalação... 🦔')).toBeInTheDocument();
      expect(axiosMock).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          url: 'http://api.test/install',
        })
      );

      // checkInstall waits 5s before the first poll.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });

      expect(axiosMock.get).toHaveBeenCalledWith('http://api.test/install');
      expect(window.location.reload).toHaveBeenCalled();
      expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
    });

    it('ignora erro de verificação (catch) e tenta novamente até suceder', async () => {
      vi.useFakeTimers();
      axiosMock.mockResolvedValue({ data: {} });
      axiosMock.get = vi
        .fn()
        .mockRejectedValueOnce(new Error('network down'))
        .mockResolvedValue({ data: { installed: true } });

      render(
        <InstallationProvider installed={false} apiBaseUrl="http://api.test">
          <span />
        </InstallationProvider>
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      const button = screen.getByRole('button', { name: 'Instalar' });
      expect(button).not.toBeDisabled();
      fireEvent.click(button);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });
      // first poll rejects
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
      // second poll resolves installed: true

      expect(axiosMock.get).toHaveBeenCalledTimes(2);
      expect(window.location.reload).toHaveBeenCalled();
    });

    it('expira o polling após timeout e mostra mensagem de erro', async () => {
      vi.useFakeTimers();
      axiosMock.mockResolvedValue({ data: {} });
      axiosMock.get = vi.fn().mockResolvedValue({ data: { installed: false } });

      render(
        <InstallationProvider installed={false} apiBaseUrl="http://api.test">
          <span />
        </InstallationProvider>
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      const button = screen.getByRole('button', { name: 'Instalar' });
      expect(button).not.toBeDisabled();
      fireEvent.click(button);

      // 5s initial wait + enough 1s polls to exceed the 300s timeout budget.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(310_000);
      });

      expect(
        screen.getByText('Timeout ao verificar instalação. Tente novamente.')
      ).toBeInTheDocument();
      expect(window.location.reload).not.toHaveBeenCalled();
    }, 15000);

    it('recarrega a página quando a API responde que já está instalado', async () => {
      axiosMock.mockRejectedValue({
        response: { data: { message: 'Application is already installed.' } },
      });

      const button = await renderAndWaitValid();
      fireEvent.click(button);

      await waitFor(() => expect(window.location.reload).toHaveBeenCalled());
    });

    it('exibe a mensagem de erro específica retornada pela API', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      axiosMock.mockRejectedValue({
        response: { data: { message: 'Credenciais inválidas.' } },
      });

      const button = await renderAndWaitValid();
      fireEvent.click(button);

      await waitFor(() =>
        expect(screen.getByText('Credenciais inválidas.')).toBeInTheDocument()
      );
      consoleSpy.mockRestore();
    });

    it('exibe mensagem de erro genérica quando a API não retorna "message"', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      axiosMock.mockRejectedValue(new Error('boom'));

      const button = await renderAndWaitValid();
      fireEvent.click(button);

      await waitFor(() =>
        expect(
          screen.getByText(
            'Erro ao instalar a aplicação. Verifique os dados e tente novamente.'
          )
        ).toBeInTheDocument()
      );
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});
