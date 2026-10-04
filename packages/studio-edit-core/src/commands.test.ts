import { describe, expect, it } from 'vitest';

import { applyCommand, commandsConflict, type Decision, replay } from './commands';
import { createDocument, EditRuleError, segmentsOfTake } from './document';
import { buildMontage, montageToTake, previewProposal, takeToMontage } from './montage';
import { ticksFromMs } from './time';

const s = (seconds: number) => ticksFromMs(seconds * 1000);

function baseDocument() {
  return createDocument(
    [
      { takeId: 1, start: 0, end: s(60) },
      { takeId: 2, start: 0, end: s(30) },
    ],
    [1],
  );
}

function decide(decisions: Decision[], command: Decision['command']): Decision {
  const decision = { decisionId: `d${decisions.length + 1}`, command };
  decisions.push(decision);
  return decision;
}

describe('documento inicial', () => {
  it('não inclui takes por padrão e mantém tudo', () => {
    const doc = baseDocument();
    expect(doc.takes.map((take) => take.included)).toEqual([true, false]);
    expect(segmentsOfTake(doc, 1)).toHaveLength(1);
    expect(segmentsOfTake(doc, 1)[0]).toMatchObject({ state: 'keep', origin: 'default' });
  });
});

describe('comandos', () => {
  it('corta um trecho partindo o segmento e restaura voltando ao estado inteiro', () => {
    const decisions: Decision[] = [];
    let doc = baseDocument();
    doc = applyCommand(doc, decide(decisions, { type: 'setCut', takeId: 1, start: s(10), end: s(20), state: 'remove' }));
    expect(segmentsOfTake(doc, 1).map((segment) => segment.state)).toEqual(['keep', 'remove', 'keep']);

    doc = applyCommand(doc, decide(decisions, { type: 'setCut', takeId: 1, start: s(10), end: s(20), state: 'keep' }));
    expect(segmentsOfTake(doc, 1).map((segment) => segment.state)).toEqual(['keep', 'keep', 'keep']);
    expect(segmentsOfTake(doc, 1).reduce((total, segment) => total + segment.end - segment.start, 0)).toBe(s(60));
  });

  it('recusa remover trecho protegido, a menos que a pessoa force', () => {
    const decisions: Decision[] = [];
    let doc = applyCommand(
      baseDocument(),
      decide(decisions, { type: 'protectRange', takeId: 1, start: s(5), end: s(15), protected: true }),
    );
    expect(() =>
      applyCommand(doc, decide(decisions, { type: 'setCut', takeId: 1, start: s(10), end: s(20), state: 'remove' })),
    ).toThrow(EditRuleError);
    expect(() =>
      applyCommand(
        doc,
        decide(decisions, {
          type: 'approveSuggestion',
          suggestionId: 9,
          takeId: 1,
          start: s(10),
          end: s(12),
          state: 'remove',
          modified: false,
        }),
      ),
    ).toThrow(/protected/);

    doc = applyCommand(
      doc,
      decide(decisions, { type: 'setCut', takeId: 1, start: s(10), end: s(20), state: 'remove', overrideProtection: true }),
    );
    expect(segmentsOfTake(doc, 1).some((segment) => segment.state === 'remove')).toBe(true);
  });

  it('não revisa duas vezes a mesma sugestão', () => {
    const decisions: Decision[] = [];
    const doc = applyCommand(baseDocument(), decide(decisions, { type: 'rejectSuggestion', suggestionId: 3 }));
    expect(doc.reviews).toEqual([{ suggestionId: 3, status: 'rejected', modified: false, decisionId: 'd1' }]);
    expect(() =>
      applyCommand(
        doc,
        decide(decisions, {
          type: 'approveSuggestion',
          suggestionId: 3,
          takeId: 1,
          start: s(1),
          end: s(2),
          state: 'remove',
          modified: false,
        }),
      ),
    ).toThrow(/already reviewed/);
  });
});

describe('replay e desfazer', () => {
  it('o histórico reconstrói exatamente o documento aplicado passo a passo', () => {
    const decisions: Decision[] = [];
    let doc = baseDocument();
    const steps: Decision['command'][] = [
      { type: 'setTakeInclusion', takeId: 2, included: true },
      { type: 'setCut', takeId: 1, start: s(3), end: s(7), state: 'remove' },
      { type: 'approveSuggestion', suggestionId: 1, takeId: 1, start: s(40), end: s(45), state: 'remove', modified: false },
      { type: 'addMarker', markerId: 'm1', takeId: 2, at: s(4), kind: 'note', text: 'trocar slide' },
      { type: 'setCut', takeId: 2, start: s(0), end: s(2), state: 'remove' },
    ];
    for (const command of steps) doc = applyCommand(doc, decide(decisions, command));
    expect(replay(baseDocument(), decisions).document).toEqual(doc);
  });

  it('desfazer devolve o estado anterior mesmo com decisões depois, e refazer volta', () => {
    const decisions: Decision[] = [];
    let doc = baseDocument();
    const cut = decide(decisions, { type: 'setCut', takeId: 1, start: s(10), end: s(20), state: 'remove' });
    doc = applyCommand(doc, cut);
    doc = applyCommand(doc, decide(decisions, { type: 'setCut', takeId: 1, start: s(40), end: s(50), state: 'remove' }));

    const undo = decide(decisions, { type: 'undo', decisionId: cut.decisionId });
    const afterUndo = replay(baseDocument(), decisions).document;
    expect(segmentsOfTake(afterUndo, 1).filter((segment) => segment.state === 'remove')).toHaveLength(1);
    expect(segmentsOfTake(afterUndo, 1).find((segment) => segment.state === 'remove')?.start).toBe(s(40));

    decide(decisions, { type: 'undo', decisionId: undo.decisionId });
    const afterRedo = replay(baseDocument(), decisions).document;
    expect(segmentsOfTake(afterRedo, 1).filter((segment) => segment.state === 'remove')).toHaveLength(2);
  });

  it('desfazer uma aprovação libera a sugestão para nova revisão', () => {
    const decisions: Decision[] = [];
    const approve = decide(decisions, {
      type: 'approveSuggestion',
      suggestionId: 5,
      takeId: 1,
      start: s(1),
      end: s(4),
      state: 'remove',
      modified: false,
    });
    decide(decisions, { type: 'undo', decisionId: approve.decisionId });
    const { document } = replay(baseDocument(), decisions);
    expect(document.reviews).toEqual([]);
    expect(segmentsOfTake(document, 1)).toHaveLength(1);
  });
});

describe('montagem', () => {
  it('pula os trechos removidos e sabe de onde veio cada instante', () => {
    const decisions: Decision[] = [];
    let doc = baseDocument();
    doc = applyCommand(doc, decide(decisions, { type: 'setTakeInclusion', takeId: 2, included: true }));
    doc = applyCommand(doc, decide(decisions, { type: 'setCut', takeId: 1, start: s(10), end: s(20), state: 'remove' }));

    const montage = buildMontage(doc);
    expect(montage.duration).toBe(s(80));
    expect(montage.clips.map((clip) => [clip.takeId, clip.montageStart])).toEqual([
      [1, 0],
      [1, s(10)],
      [2, s(50)],
    ]);
    expect(takeToMontage(montage, 1, s(15))).toBeNull();
    expect(takeToMontage(montage, 1, s(25))).toBe(s(15));
    expect(montageToTake(montage, s(55))).toMatchObject({ takeId: 2, takeTicks: s(5) });
  });

  it('a prévia da proposta aplica pendentes sem mudar o aprovado e acusa o que bateu em proteção', () => {
    const decisions: Decision[] = [];
    const doc = applyCommand(
      baseDocument(),
      decide(decisions, { type: 'protectRange', takeId: 1, start: s(30), end: s(35), protected: true }),
    );
    const preview = previewProposal(doc, [
      { id: 1, takeId: 1, start: s(5), end: s(8), state: 'remove', status: 'pending' },
      { id: 2, takeId: 1, start: s(31), end: s(33), state: 'remove', status: 'pending' },
      { id: 3, takeId: 1, start: s(50), end: s(52), state: 'remove', status: 'rejected' },
    ]);
    expect(buildMontage(preview.document).duration).toBe(s(57));
    expect(preview.blocked).toEqual([{ suggestionId: 2, code: 'protected_range' }]);
    expect(buildMontage(doc).duration).toBe(s(60));
  });
});

describe('conflitos concorrentes', () => {
  it('só conflita quando toca o mesmo trecho, sugestão ou marcador', () => {
    const cutA = { type: 'setCut', takeId: 1, start: s(10), end: s(20), state: 'remove' } as const;
    expect(commandsConflict(cutA, { ...cutA, start: s(15), end: s(25) })).toBe(true);
    expect(commandsConflict(cutA, { ...cutA, start: s(20), end: s(25) })).toBe(false);
    expect(commandsConflict(cutA, { ...cutA, takeId: 2 })).toBe(false);
    expect(commandsConflict({ type: 'rejectSuggestion', suggestionId: 4 }, { type: 'rejectSuggestion', suggestionId: 4 })).toBe(true);
  });
});
