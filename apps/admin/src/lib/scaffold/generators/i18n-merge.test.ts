import { describe, expect, it } from 'vitest';
import { createTestPlan } from '../scaffold-fixtures';
import {
  buildPageMessages,
  mergeMessages,
  pageNamespace,
  removeNamespace,
} from './i18n-merge';

describe('pageNamespace', () => {
  it('deriva o namespace da entidade', () => {
    expect(pageNamespace(createTestPlan())).toBe('ServiceOrderPage');
  });
});

describe('buildPageMessages', () => {
  it('usa o rótulo do idioma pedido', () => {
    const pt = buildPageMessages(createTestPlan(), 'pt');
    const en = buildPageMessages(createTestPlan(), 'en');

    expect(pt.title).toBe('Ordens de serviço');
    expect(en.title).toBe('Service Orders');
  });

  it('cria chaves de coluna, campo e enum', () => {
    const messages = buildPageMessages(createTestPlan(), 'pt');

    expect(messages.columnTitle).toBe('Título');
    expect(messages.fieldTitle).toBe('Título');
    expect(messages.status_open).toBe('Open');
    expect(messages.statsOpen).toBe('Open');
  });

  it('cai para o nome da coluna quando não há rótulo', () => {
    const plan = createTestPlan({
      columns: [
        {
          name: 'due_date',
          type: 'date',
          nullable: false,
          labelEn: '',
          labelPt: '',
          inList: true,
          inFilters: false,
        },
      ],
    });

    expect(buildPageMessages(plan, 'pt').columnDueDate).toBe('Due Date');
  });
});

describe('mergeMessages', () => {
  it('cria o namespace quando o arquivo não existe', () => {
    const result = mergeMessages(null, 'ServiceOrderPage', { title: 'OS' });

    expect(JSON.parse(result.contents)).toEqual({
      ServiceOrderPage: { title: 'OS' },
    });
    expect(result.addedKeys).toEqual(['title']);
  });

  it('preserva outros namespaces e chaves já traduzidas', () => {
    const current = JSON.stringify({
      OtherPage: { title: 'Outro' },
      ServiceOrderPage: { title: 'Traduzido à mão' },
    });

    const result = mergeMessages(current, 'ServiceOrderPage', {
      title: 'Novo',
      description: 'Descrição',
    });

    const parsed = JSON.parse(result.contents);

    expect(parsed.OtherPage).toEqual({ title: 'Outro' });
    expect(parsed.ServiceOrderPage.title).toBe('Traduzido à mão');
    expect(parsed.ServiceOrderPage.description).toBe('Descrição');
    expect(result.addedKeys).toEqual(['description']);
  });

  it('é idempotente', () => {
    const first = mergeMessages(null, 'Page', { a: '1' });
    const second = mergeMessages(first.contents, 'Page', { a: '1' });

    expect(second.contents).toBe(first.contents);
    expect(second.addedKeys).toEqual([]);
  });
});

describe('removeNamespace', () => {
  it('remove o namespace preservando os demais', () => {
    const current = JSON.stringify({
      OtherPage: { title: 'Outro' },
      ServiceOrderPage: { title: 'OS' },
    });

    const result = removeNamespace(current, 'ServiceOrderPage');
    const parsed = JSON.parse(result.contents);

    expect(result.removed).toBe(true);
    expect(parsed.ServiceOrderPage).toBeUndefined();
    expect(parsed.OtherPage).toEqual({ title: 'Outro' });
  });

  it('não reescreve quando o namespace não existe', () => {
    const current = JSON.stringify({ OtherPage: { title: 'Outro' } });
    const result = removeNamespace(current, 'ServiceOrderPage');

    expect(result.removed).toBe(false);
    expect(result.contents).toBe(current);
  });

  it('lida com arquivo vazio ou nulo', () => {
    expect(removeNamespace(null, 'X')).toEqual({ contents: '', removed: false });
    expect(removeNamespace('  ', 'X')).toEqual({ contents: '  ', removed: false });
  });
});
