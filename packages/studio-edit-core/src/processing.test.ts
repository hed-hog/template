import { describe, expect, it } from 'vitest';
import { summarizeProcessing } from './processing';

describe('summarizeProcessing', () => {
  it('fica ocioso sem etapa pedida', () => {
    expect(summarizeProcessing([{ step: 'proxy', status: 'missing' }], true)).toEqual({
      state: 'idle',
      step: null,
      done: 0,
      total: 0,
    });
  });

  it('nomeia a etapa que roda, mesmo com outra falha', () => {
    const summary = summarizeProcessing(
      [
        { step: 'probe', status: 'ready' },
        { step: 'hash', status: 'failed' },
        { step: 'proxy', status: 'running' },
      ],
      true,
    );
    expect(summary).toEqual({ state: 'running', step: 'proxy', done: 1, total: 3 });
  });

  it('diz que a máquina está ligando só quando é certo que não há quem processe o proxy', () => {
    const items = [
      { step: 'probe' as const, status: 'ready' as const },
      { step: 'proxy' as const, status: 'pending' as const },
    ];
    expect(summarizeProcessing(items, false).state).toBe('starting');
    expect(summarizeProcessing(items, true).state).toBe('queued');
    expect(summarizeProcessing(items, null).state).toBe('queued');
  });

  it('pega a primeira etapa da fila pela ordem da preparação', () => {
    const summary = summarizeProcessing(
      [
        { step: 'analysis', status: 'pending' },
        { step: 'hash', status: 'pending' },
      ],
      true,
    );
    expect(summary.step).toBe('hash');
  });

  it('falha quando nada mais anda e algo falhou; pronto quando tudo está pronto', () => {
    expect(summarizeProcessing([{ step: 'proxy', status: 'failed' }, { step: 'probe', status: 'ready' }], true).state).toBe(
      'failed',
    );
    expect(summarizeProcessing([{ step: 'proxy', status: 'ready' }], true).state).toBe('ready');
  });
});
