import { toPascalCase, toTitleCase } from '../naming';
import type { ScaffoldPlan } from '../types';

export type MessagesLocale = 'en' | 'pt';

export function pageNamespace(plan: ScaffoldPlan): string {
  return `${toPascalCase(plan.entity)}Page`;
}

function columnLabelKey(columnName: string): string {
  return `column${toPascalCase(columnName)}`;
}

function fieldLabelKey(columnName: string): string {
  return `field${toPascalCase(columnName)}`;
}

/** Chaves consumidas pelos templates de página. */
export function buildPageMessages(
  plan: ScaffoldPlan,
  locale: MessagesLocale
): Record<string, string> {
  const isEn = locale === 'en';
  const label = isEn ? plan.labelEn : plan.labelPt;
  const description = isEn ? plan.descriptionEn : plan.descriptionPt;

  const messages: Record<string, string> = {
    title: label,
    description,
    breadcrumbHome: isEn ? 'Home' : 'Início',
    newItem: isEn ? `New ${label}` : `Novo ${label}`,
    searchPlaceholder: isEn ? 'Search...' : 'Buscar...',
    viewMode: isEn ? 'View' : 'Visualização',
    viewModeTable: isEn ? 'Table' : 'Tabela',
    viewModeCards: isEn ? 'Cards' : 'Cards',
    emptyStateTitle: isEn ? 'Nothing here yet' : 'Nada por aqui ainda',
    emptyStateDescription: isEn
      ? 'Create the first record to get started.'
      : 'Crie o primeiro registro para começar.',
    edit: isEn ? 'Edit' : 'Editar',
    delete: isEn ? 'Delete' : 'Excluir',
    deleting: isEn ? 'Deleting...' : 'Excluindo...',
    cancel: isEn ? 'Cancel' : 'Cancelar',
    save: isEn ? 'Save' : 'Salvar',
    saving: isEn ? 'Saving...' : 'Salvando...',
    createTitle: isEn ? `New ${label}` : `Novo ${label}`,
    editTitle: isEn ? `Edit ${label}` : `Editar ${label}`,
    createSuccess: isEn ? 'Record created.' : 'Registro criado.',
    editSuccess: isEn ? 'Record updated.' : 'Registro atualizado.',
    deleteSuccess: isEn ? 'Record deleted.' : 'Registro excluído.',
    saveError: isEn ? 'Could not save the record.' : 'Não foi possível salvar o registro.',
    deleteError: isEn
      ? 'Could not delete the record.'
      : 'Não foi possível excluir o registro.',
    deleteTitle: isEn ? 'Delete record' : 'Excluir registro',
    deleteDescription: isEn
      ? 'This action cannot be undone.'
      : 'Esta ação não pode ser desfeita.',
    columnActions: isEn ? 'Actions' : 'Ações',
    allOption: isEn ? 'All' : 'Todos',
  };

  if (plan.template === 'list-kpi' || plan.template === 'dashboard') {
    messages.statsTotal = isEn ? 'Total' : 'Total';
  }

  plan.columns.forEach((column) => {
    const columnLabel = isEn ? column.labelEn : column.labelPt;
    const fallback = toTitleCase(column.name);
    const value = columnLabel?.trim() || fallback;

    messages[columnLabelKey(column.name)] = value;
    messages[fieldLabelKey(column.name)] = value;

    if (column.type === 'enum') {
      (column.enumValues ?? []).forEach((enumValue) => {
        messages[`${column.name}_${enumValue}`] = toTitleCase(enumValue);
      });

      if (plan.template === 'list-kpi') {
        (column.enumValues ?? []).forEach((enumValue) => {
          messages[`stats${toPascalCase(enumValue)}`] = toTitleCase(enumValue);
        });
      }
    }
  });

  return messages;
}

export type MessagesMergeResult = {
  contents: string;
  addedKeys: string[];
};

/**
 * Insere o namespace da página no arquivo de mensagens sem tocar no que já
 * existe: chaves presentes são mantidas, apenas as ausentes são acrescentadas.
 */
export function mergeMessages(
  currentContents: string | null,
  namespace: string,
  messages: Record<string, string>
): MessagesMergeResult {
  let parsed: Record<string, unknown> = {};

  if (currentContents?.trim()) {
    parsed = JSON.parse(currentContents) as Record<string, unknown>;
  }

  const existing =
    typeof parsed[namespace] === 'object' && parsed[namespace] !== null
      ? (parsed[namespace] as Record<string, unknown>)
      : {};

  const addedKeys: string[] = [];
  const merged: Record<string, unknown> = { ...existing };

  Object.entries(messages).forEach(([key, value]) => {
    if (!(key in merged)) {
      merged[key] = value;
      addedKeys.push(key);
    }
  });

  parsed[namespace] = merged;

  return {
    contents: `${JSON.stringify(parsed, null, 2)}\n`,
    addedKeys,
  };
}

export type MessagesRemovalResult = {
  contents: string;
  removed: boolean;
};

/**
 * Remove um namespace inteiro do arquivo de mensagens, preservando os demais.
 * `removed` é falso quando o namespace não existia — nada é reescrito à toa.
 */
export function removeNamespace(
  currentContents: string | null,
  namespace: string
): MessagesRemovalResult {
  if (!currentContents?.trim()) {
    return { contents: currentContents ?? '', removed: false };
  }

  const parsed = JSON.parse(currentContents) as Record<string, unknown>;

  if (!(namespace in parsed)) {
    return { contents: currentContents, removed: false };
  }

  delete parsed[namespace];

  return {
    contents: `${JSON.stringify(parsed, null, 2)}\n`,
    removed: true,
  };
}
