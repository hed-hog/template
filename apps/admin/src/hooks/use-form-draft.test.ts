import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// useFormDraft depends on useApp() for accessToken/user (draft scope).
const { appState } = vi.hoisted(() => ({
  appState: {
    accessToken: 'tok' as string | undefined,
    user: { id: 7 } as { id: number } | null,
  },
}));
vi.mock('@hed-hog/next-app-provider', () => ({ useApp: () => appState }));

import {
  useFormDraft,
  getFormDraftOwnerKey,
  isFormDraftStorageKey,
} from './use-form-draft';

describe('useFormDraft', () => {
  beforeEach(() => {
    localStorage.clear();
    appState.accessToken = 'tok';
    appState.user = { id: 7 };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('getFormDraftOwnerKey escopa por usuário / anônimo', () => {
    expect(getFormDraftOwnerKey(undefined, undefined)).toBe('anonymous');
    expect(getFormDraftOwnerKey('tok', 7)).toBe('user:7');
    // token present but user not yet loaded → owner undefined (does not save)
    expect(getFormDraftOwnerKey('tok', null)).toBeNull();
  });

  it('salva rascunho com o dono correto e recupera via loadDraft', () => {
    const { result } = renderHook(() =>
      useFormDraft({ storageKey: 'x-draft', value: { a: 1 }, hasData: true }),
    );

    act(() => result.current.saveDraft({ a: 1 }));

    const raw = JSON.parse(localStorage.getItem('x-draft')!);
    expect(raw.ownerKey).toBe('user:7');
    expect(raw.payload).toEqual({ a: 1 });
    expect(result.current.hasDraft).toBe(true);
    expect(result.current.loadDraft()?.payload).toEqual({ a: 1 });
  });

  it('clearDraft remove o rascunho', () => {
    const { result } = renderHook(() =>
      useFormDraft({ storageKey: 'y-draft', value: { a: 1 }, hasData: true }),
    );

    act(() => result.current.saveDraft({ a: 1 }));
    expect(localStorage.getItem('y-draft')).not.toBeNull();

    act(() => result.current.clearDraft());
    expect(localStorage.getItem('y-draft')).toBeNull();
    expect(result.current.hasDraft).toBe(false);
  });

  it('descarta rascunho expirado pelo TTL', () => {
    localStorage.setItem(
      'z-draft',
      JSON.stringify({
        payload: { a: 1 },
        savedAt: new Date(Date.now() - 10_000).toISOString(),
        version: 1,
        ownerKey: 'user:7',
      }),
    );

    const { result } = renderHook(() =>
      useFormDraft({ storageKey: 'z-draft', value: { a: 1 }, hasData: true, ttlMs: 1000 }),
    );

    expect(result.current.loadDraft()).toBeNull();
    expect(localStorage.getItem('z-draft')).toBeNull();
  });

  it('descarta rascunho pertencente a outro usuário', () => {
    localStorage.setItem(
      'w-draft',
      JSON.stringify({
        payload: { a: 1 },
        savedAt: new Date().toISOString(),
        version: 1,
        ownerKey: 'user:999',
      }),
    );

    const { result } = renderHook(() =>
      useFormDraft({ storageKey: 'w-draft', value: { a: 1 }, hasData: true }),
    );

    expect(result.current.loadDraft()).toBeNull();
    expect(localStorage.getItem('w-draft')).toBeNull();
  });

  it('auto-salva após o debounce', () => {
    vi.useFakeTimers();
    renderHook(() =>
      useFormDraft({ storageKey: 'd-draft', value: { a: 2 }, hasData: true, debounceMs: 500 }),
    );

    expect(localStorage.getItem('d-draft')).toBeNull();
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(JSON.parse(localStorage.getItem('d-draft')!).payload).toEqual({ a: 2 });
  });

  it('isFormDraftStorageKey identifica chaves de rascunho', () => {
    expect(isFormDraftStorageKey('entity-123-draft')).toBe(true);
    expect(isFormDraftStorageKey('entity-123')).toBe(false);
  });

  it('loadDraft trata valor armazenado que não é um objeto como inválido', () => {
    localStorage.setItem('num-draft', JSON.stringify(123));

    const { result } = renderHook(() =>
      useFormDraft({ storageKey: 'num-draft', value: { a: 1 }, hasData: true }),
    );

    expect(result.current.loadDraft()).toBeNull();
    expect(localStorage.getItem('num-draft')).toBeNull();
  });

  it('loadDraft trata JSON inválido no localStorage', () => {
    localStorage.setItem('bad-json-draft', '{not valid json');

    const { result } = renderHook(() =>
      useFormDraft({ storageKey: 'bad-json-draft', value: { a: 1 }, hasData: true }),
    );

    expect(result.current.loadDraft()).toBeNull();
    expect(localStorage.getItem('bad-json-draft')).toBeNull();
  });

  it('loadDraft aceita valor legado sem wrapper de payload para usuário anônimo', () => {
    appState.accessToken = undefined;
    appState.user = null;
    localStorage.setItem('legacy-anon-draft', JSON.stringify({ a: 9 }));

    const { result } = renderHook(() =>
      useFormDraft({ storageKey: 'legacy-anon-draft', value: { a: 9 }, hasData: true }),
    );

    const draft = result.current.loadDraft();
    expect(draft?.payload).toEqual({ a: 9 });
    expect(result.current.hasDraft).toBe(true);
  });

  it('normaliza savedAt, version e ownerKey ausentes/inválidos aplicando os defaults', () => {
    appState.accessToken = undefined;
    appState.user = null;
    localStorage.setItem(
      'partial-draft',
      JSON.stringify({ payload: { a: 5 }, ownerKey: 42 }),
    );

    const { result } = renderHook(() =>
      useFormDraft({
        storageKey: 'partial-draft',
        value: { a: 5 },
        hasData: true,
        version: 3,
      }),
    );

    const draft = result.current.loadDraft();
    expect(draft?.payload).toEqual({ a: 5 });
    expect(draft?.version).toBe(3);
    expect(typeof draft?.savedAt).toBe('string');
  });

  it('normaliza ownerKey nulo explícito no rascunho armazenado', () => {
    appState.accessToken = undefined;
    appState.user = null;
    localStorage.setItem(
      'ownerkey-null-draft',
      JSON.stringify({ payload: { a: 1 }, ownerKey: null }),
    );

    const { result } = renderHook(() =>
      useFormDraft({ storageKey: 'ownerkey-null-draft', value: { a: 1 }, hasData: true }),
    );

    expect(result.current.loadDraft()?.payload).toEqual({ a: 1 });
  });

  it('saveDraft não faz nada quando enabled=false', () => {
    const { result } = renderHook(() =>
      useFormDraft({
        storageKey: 'disabled-draft',
        value: { a: 1 },
        hasData: true,
        enabled: false,
      }),
    );

    act(() => result.current.saveDraft({ a: 1 }));
    expect(localStorage.getItem('disabled-draft')).toBeNull();
  });

  it('não carrega nem salva quando o owner ainda não está pronto (usuário carregando)', () => {
    appState.user = null;

    const { result } = renderHook(() =>
      useFormDraft({ storageKey: 'notready-draft', value: { a: 1 }, hasData: true }),
    );

    expect(result.current.loadDraft()).toBeNull();
    act(() => result.current.saveDraft({ a: 1 }));
    expect(localStorage.getItem('notready-draft')).toBeNull();
  });

  it('saveDraft limpa o rascunho quando hasData é false', () => {
    localStorage.setItem(
      'nodata-draft',
      JSON.stringify({
        payload: { a: 1 },
        savedAt: new Date().toISOString(),
        version: 1,
        ownerKey: 'user:7',
      }),
    );

    const { result } = renderHook(() =>
      useFormDraft({ storageKey: 'nodata-draft', value: { a: 1 }, hasData: false }),
    );

    act(() => result.current.saveDraft({ a: 1 }));
    expect(localStorage.getItem('nodata-draft')).toBeNull();
  });

  it('saveDraft ignora falha ao persistir no localStorage', () => {
    const { result } = renderHook(() =>
      useFormDraft({ storageKey: 'throw-draft', value: { a: 1 }, hasData: true }),
    );

    const setItemSpy = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('quota exceeded');
      });

    expect(() => act(() => result.current.saveDraft({ a: 1 }))).not.toThrow();
    setItemSpy.mockRestore();
  });

  it('não agenda auto-save quando enabled é false', () => {
    vi.useFakeTimers();
    renderHook(() =>
      useFormDraft({
        storageKey: 'noauto-draft',
        value: { a: 1 },
        hasData: true,
        enabled: false,
        debounceMs: 100,
      }),
    );

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(localStorage.getItem('noauto-draft')).toBeNull();
  });

  it('clearDraft ignora falha ao remover do localStorage', () => {
    const { result } = renderHook(() =>
      useFormDraft({ storageKey: 'clear-throw-draft', value: { a: 1 }, hasData: true }),
    );

    act(() => result.current.saveDraft({ a: 1 }));

    const removeItemSpy = vi
      .spyOn(Storage.prototype, 'removeItem')
      .mockImplementation(() => {
        throw new Error('fail');
      });

    expect(() => act(() => result.current.clearDraft())).not.toThrow();
    removeItemSpy.mockRestore();
  });

  it('descarta rascunho de outro usuário quando o owner atual é anônimo', () => {
    appState.accessToken = undefined;
    appState.user = null;
    localStorage.setItem(
      'anon-mismatch-draft',
      JSON.stringify({
        payload: { a: 1 },
        savedAt: new Date().toISOString(),
        version: 1,
        ownerKey: 'user:999',
      }),
    );

    const { result } = renderHook(() =>
      useFormDraft({ storageKey: 'anon-mismatch-draft', value: { a: 1 }, hasData: true }),
    );

    expect(result.current.loadDraft()).toBeNull();
    expect(localStorage.getItem('anon-mismatch-draft')).toBeNull();
  });

  it('saveDraft sem argumento usa o valor atual via ref', () => {
    const { result } = renderHook(() =>
      useFormDraft({ storageKey: 'ref-draft', value: { a: 42 }, hasData: true }),
    );

    act(() => result.current.saveDraft());
    expect(JSON.parse(localStorage.getItem('ref-draft')!).payload).toEqual({ a: 42 });
  });

  it('trata user undefined (ainda carregando) distinto de user null', () => {
    appState.user = undefined as unknown as { id: number } | null;

    const { result } = renderHook(() =>
      useFormDraft({ storageKey: 'user-undefined-draft', value: { a: 1 }, hasData: true }),
    );

    act(() => result.current.saveDraft({ a: 1 }));
    expect(localStorage.getItem('user-undefined-draft')).toBeNull();
  });
});
