'use client';

import { useApp } from '@hed-hog/next-app-provider';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getFormDraftOwnerKey } from './use-form-draft';

export type ColumnPreferences = {
  order: string[];
  hidden: string[];
};

type StoredColumnPreferences = ColumnPreferences & {
  ownerKey?: string | null;
  version: number;
};

type UseColumnPreferencesOptions = {
  storageKey: string;
  columnIds: string[];
  /** Colunas que nunca podem ser ocultadas (ex: coluna de ações). */
  requiredIds?: string[];
  /**
   * Colunas que nascem ocultas. Valem para quem não tem preferência salva e
   * também para quem tem, enquanto a coluna não estiver na ordem salva — é o
   * caso da coluna que acabou de ser criada. Depois que a preferência é gravada
   * com ela, a escolha do usuário é a que vale.
   */
  defaultHiddenIds?: string[];
  version?: number;
};

function isClient() {
  return typeof window !== 'undefined';
}

function sanitizeOrder(order: unknown, columnIds: string[]): string[] {
  const known = Array.isArray(order)
    ? order.filter(
        (id): id is string => typeof id === 'string' && columnIds.includes(id)
      )
    : [];
  const missing = columnIds.filter((id) => !known.includes(id));
  return [...known, ...missing];
}

function resolveHidden(
  stored: { order: unknown; hidden: unknown } | null,
  columnIds: string[],
  requiredIds: string[],
  defaultHiddenIds: string[]
): string[] {
  const hidden = sanitizeHidden(stored?.hidden, columnIds, requiredIds);
  const storedOrder: unknown[] = Array.isArray(stored?.order)
    ? stored.order
    : [];
  const unseenDefaults = defaultHiddenIds.filter(
    (id) =>
      columnIds.includes(id) &&
      !requiredIds.includes(id) &&
      !storedOrder.includes(id) &&
      !hidden.includes(id)
  );
  return [...hidden, ...unseenDefaults];
}

function sanitizeHidden(
  hidden: unknown,
  columnIds: string[],
  requiredIds: string[]
): string[] {
  if (!Array.isArray(hidden)) return [];
  return hidden.filter(
    (id): id is string =>
      typeof id === 'string' &&
      columnIds.includes(id) &&
      !requiredIds.includes(id)
  );
}

/**
 * Ordem e visibilidade de colunas persistidas no localStorage, por usuário.
 *
 * Espelha o padrão do `useFormDraft`: mesma chave de dono (`getFormDraftOwnerKey`)
 * para não vazar preferência entre contas num navegador compartilhado, e leitura/
 * escrita sempre protegidas por try/catch.
 */
export function useColumnPreferences({
  storageKey,
  columnIds,
  requiredIds = [],
  defaultHiddenIds = [],
  version = 1,
}: UseColumnPreferencesOptions) {
  const { accessToken, user } = useApp();
  const ownerKey = useMemo(
    () =>
      getFormDraftOwnerKey(
        accessToken,
        user?.id ?? (user === null ? null : undefined)
      ),
    [accessToken, user]
  );

  const columnIdsKey = columnIds.join('\0');
  const requiredIdsKey = requiredIds.join('\0');
  const defaultHiddenIdsKey = defaultHiddenIds.join('\0');

  const readStored = useCallback((): StoredColumnPreferences | null => {
    if (!isClient()) return null;

    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return null;

      const parsed = JSON.parse(raw) as Partial<StoredColumnPreferences>;

      if (
        ownerKey !== null &&
        parsed.ownerKey &&
        parsed.ownerKey !== ownerKey
      ) {
        return null;
      }

      return {
        order: Array.isArray(parsed.order) ? parsed.order : [],
        hidden: Array.isArray(parsed.hidden) ? parsed.hidden : [],
        ownerKey: parsed.ownerKey ?? null,
        version: typeof parsed.version === 'number' ? parsed.version : version,
      };
    } catch {
      return null;
    }
  }, [ownerKey, storageKey, version]);

  const [prefs, setPrefs] = useState<ColumnPreferences>(() => {
    const stored = readStored();
    return {
      order: sanitizeOrder(stored?.order, columnIds),
      hidden: resolveHidden(stored, columnIds, requiredIds, defaultHiddenIds),
    };
  });

  // Recarrega quando o conjunto de colunas, a chave de armazenamento ou o dono
  // das preferências muda (ex.: colunas dependentes de feature flag, troca de
  // usuário logado, ou uma tela que serve várias entidades e muda de chave sem
  // desmontar — sem `storageKey` aqui, ela seguiria com a preferência da
  // entidade anterior e ainda a gravaria por cima da nova).
  useEffect(() => {
    const stored = readStored();
    setPrefs({
      order: sanitizeOrder(stored?.order, columnIds),
      hidden: resolveHidden(stored, columnIds, requiredIds, defaultHiddenIds),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columnIdsKey, requiredIdsKey, defaultHiddenIdsKey, ownerKey, storageKey]);

  useEffect(() => {
    if (!isClient()) return;

    try {
      const payload: StoredColumnPreferences = {
        ...prefs,
        ownerKey,
        version,
      };
      window.localStorage.setItem(storageKey, JSON.stringify(payload));
    } catch {
      // Ignore storage write failures.
    }
  }, [prefs, ownerKey, storageKey, version]);

  const setOrder = useCallback(
    (nextOrder: string[]) => {
      setPrefs((prev) => ({
        ...prev,
        order: sanitizeOrder(nextOrder, columnIds),
      }));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [columnIdsKey]
  );

  const toggleColumn = useCallback(
    (id: string, visible: boolean) => {
      if (requiredIds.includes(id)) return;

      setPrefs((prev) => ({
        ...prev,
        hidden: visible
          ? prev.hidden.filter((hiddenId) => hiddenId !== id)
          : prev.hidden.includes(id)
            ? prev.hidden
            : [...prev.hidden, id],
      }));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [requiredIdsKey]
  );

  const setHidden = useCallback(
    (nextHidden: string[]) => {
      setPrefs((prev) => ({
        ...prev,
        hidden: sanitizeHidden(nextHidden, columnIds, requiredIds),
      }));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [columnIdsKey, requiredIdsKey]
  );

  const reset = useCallback(() => {
    setPrefs({
      order: [...columnIds],
      hidden: resolveHidden(null, columnIds, requiredIds, defaultHiddenIds),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columnIdsKey, requiredIdsKey, defaultHiddenIdsKey]);

  const visibility = useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const id of columnIds) {
      map[id] = !prefs.hidden.includes(id);
    }
    return map;
  }, [columnIds, prefs.hidden]);

  return {
    order: prefs.order,
    hidden: prefs.hidden,
    visibility,
    setOrder,
    toggleColumn,
    setHidden,
    reset,
  };
}
