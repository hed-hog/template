import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// The storage key is scoped by the owner (getFormDraftOwnerKey), which comes from
// useApp(). We mock the provider to control accessToken/user.
const { appState } = vi.hoisted(() => ({
  appState: {
    accessToken: 'tok' as string | undefined,
    user: { id: 7 } as { id: number } | null,
  },
}));
vi.mock('@hed-hog/next-app-provider', () => ({
  useApp: () => appState,
}));

import { usePersistedSheetWidth } from './use-persisted-sheet-width';

const KEY_USER = 'sheet-width:mysheet:user:7';

function setup(overrides: Partial<Parameters<typeof usePersistedSheetWidth>[0]> = {}) {
  return renderHook(() =>
    usePersistedSheetWidth({
      sheetId: 'mysheet',
      defaultWidth: 500,
      minWidth: 300,
      maxWidth: 800,
      ...overrides,
    })
  );
}

describe('usePersistedSheetWidth', () => {
  beforeEach(() => {
    localStorage.clear();
    appState.accessToken = 'tok';
    appState.user = { id: 7 };
  });

  it('lê a largura armazenada quando dentro dos limites', () => {
    localStorage.setItem(KEY_USER, '650');
    const { result } = setup();
    expect(result.current[0]).toBe(650);
  });

  it('faz clamp da largura armazenada acima do máximo', () => {
    localStorage.setItem(KEY_USER, '9999');
    const { result } = setup();
    expect(result.current[0]).toBe(800);
  });

  it('setWidth faz clamp acima do máximo e persiste', () => {
    const { result } = setup();
    act(() => result.current[1](1000));
    expect(result.current[0]).toBe(800);
    expect(localStorage.getItem(KEY_USER)).toBe('800');
  });

  it('setWidth faz clamp abaixo do mínimo', () => {
    const { result } = setup();
    act(() => result.current[1](100));
    expect(result.current[0]).toBe(300);
    expect(localStorage.getItem(KEY_USER)).toBe('300');
  });

  it('escopa a chave como "anonymous" sem accessToken', () => {
    appState.accessToken = undefined;
    const { result } = setup();
    act(() => result.current[1](450));
    expect(localStorage.getItem('sheet-width:mysheet:anonymous')).toBe('450');
    expect(localStorage.getItem(KEY_USER)).toBeNull();
  });

  it('com enabled=false não persiste no localStorage', () => {
    const { result } = setup({ enabled: false });
    act(() => result.current[1](450));
    expect(result.current[0]).toBe(450);
    expect(localStorage.getItem(KEY_USER)).toBeNull();
  });

  it('usa a chave "anonymous" quando o owner é null (usuário ainda carregando)', () => {
    appState.user = null;
    const { result } = setup();
    act(() => result.current[1](600));
    expect(localStorage.getItem('sheet-width:mysheet:anonymous')).toBe('600');
  });

  it('trata user undefined (ainda carregando) distinto de user null', () => {
    appState.user = undefined as unknown as { id: number } | null;
    const { result } = setup();
    act(() => result.current[1](600));
    expect(localStorage.getItem('sheet-width:mysheet:anonymous')).toBe('600');
  });

  it('cai no default quando o valor armazenado não é um número válido', () => {
    localStorage.setItem(KEY_USER, 'not-a-number');
    const { result } = setup();
    expect(result.current[0]).toBe(500);
  });

  describe('falhas de acesso ao localStorage', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('effect ignora falha do localStorage.getItem e cai no default', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('boom');
      });

      const { result } = setup();
      expect(result.current[0]).toBe(500);
    });

    it('setWidth ignora falha do localStorage.setItem', () => {
      const { result } = setup();
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('quota exceeded');
      });

      expect(() => act(() => result.current[1](600))).not.toThrow();
      expect(result.current[0]).toBe(600);
    });
  });
});
