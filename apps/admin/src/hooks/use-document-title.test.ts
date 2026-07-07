import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

// useDocumentTitle usa getSettingValue('system-name') do provider.
const { appState } = vi.hoisted(() => ({
  appState: { systemName: 'MyApp' as string | null },
}));
vi.mock('@hed-hog/next-app-provider', () => ({
  useApp: () => ({ getSettingValue: () => appState.systemName }),
}));

import { useDocumentTitle } from './use-document-title';

describe('useDocumentTitle', () => {
  beforeEach(() => {
    appState.systemName = 'MyApp';
    document.title = 'inicial';
  });

  it('define o título como "<entidade> | <systemName>"', () => {
    renderHook(() => useDocumentTitle('Contatos'));
    expect(document.title).toBe('Contatos | MyApp');
  });

  it('no unmount restaura o título para o systemName', () => {
    const { unmount } = renderHook(() => useDocumentTitle('Contatos'));
    unmount();
    expect(document.title).toBe('MyApp');
  });

  it('usa "HedHog Admin" quando o system-name não está definido', () => {
    appState.systemName = null;
    renderHook(() => useDocumentTitle('Pedidos'));
    expect(document.title).toBe('Pedidos | HedHog Admin');
  });

  it('entityName vazio não altera o título', () => {
    renderHook(() => useDocumentTitle(undefined));
    expect(document.title).toBe('inicial');
  });
});
