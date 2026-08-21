import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Sheet's open/close visibility and the resizable width machinery aren't the
// concern of this component's tests — mirror the same targeted mock the repo
// already uses for EntityPicker (see entity-picker.test.tsx) so we avoid
// needing an AppProvider (for usePersistedSheetWidth's useApp()) and
// window.matchMedia (for useIsMobile), while still exercising the sheet's
// actual open/close state machine driven by TagSelectorSheet itself.
vi.mock('@/components/ui/sheet', () => ({
  Sheet: ({ children, open }: { children: ReactNode; open?: boolean }) =>
    open ? <div data-testid="sheet">{children}</div> : null,
  SheetDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  SheetHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SheetFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));

vi.mock('@/components/ui/resizable-sheet-content', () => ({
  ResizableSheetContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
}));

import { TooltipProvider } from '@/components/ui/tooltip';
import { TagSelectorSheet } from './tag-selector-sheet';

// The "add tag" button and each selected-tag remove button are wrapped in a
// <Tooltip>, which requires a <TooltipProvider> ancestor.
function renderSheet(ui: ReactElement) {
  return render(<TooltipProvider>{ui}</TooltipProvider>);
}

type TagOption = {
  id: string;
  name: string;
  color?: string;
  usageCount?: number;
};

const labels = {
  addTag: 'Adicionar tag',
  sheetTitle: 'Selecionar tags',
  sheetDescription: 'Escolha as tags para este item',
  createLabel: 'Nome da tag',
  createPlaceholder: 'Ex: urgente',
  createAction: 'Criar tag',
  popularTitle: 'Tags populares',
  selectedTitle: 'Tags selecionadas',
  noTags: 'Nenhuma tag disponível',
  cancel: 'Cancelar',
  apply: 'Aplicar',
  removeTagAria: (tagName: string) => `Remover ${tagName}`,
};

const baseTags: TagOption[] = [
  { id: '1', name: 'Urgente', usageCount: 5, color: '#ff0000' },
  { id: '2', name: 'Bug', usageCount: 3 },
  { id: '3', name: 'Feature' },
];

function openSheet() {
  fireEvent.click(screen.getByRole('button', { name: labels.addTag }));
}

describe('TagSelectorSheet', () => {
  beforeEach(() => {
    Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('abre a sheet ao clicar no botão de adicionar tag', () => {
    renderSheet(
      <TagSelectorSheet
        selectedTagIds={[]}
        tags={baseTags}
        labels={labels}
        onChange={vi.fn()}
      />,
    );

    expect(screen.queryByTestId('sheet')).not.toBeInTheDocument();

    openSheet();

    expect(screen.getByTestId('sheet')).toBeInTheDocument();
    expect(screen.getByText(labels.sheetTitle)).toBeInTheDocument();
    expect(screen.getByText(labels.sheetDescription)).toBeInTheDocument();
  });

  it('mostra o estado vazio quando não há tags selecionadas', () => {
    renderSheet(
      <TagSelectorSheet
        selectedTagIds={[]}
        tags={baseTags}
        labels={labels}
        emptyText="Sem tags"
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByText('Sem tags')).toBeInTheDocument();
  });

  it('mostra o estado vazio de tags populares quando não há tags disponíveis', () => {
    renderSheet(
      <TagSelectorSheet
        selectedTagIds={[]}
        tags={[]}
        labels={labels}
        onChange={vi.fn()}
      />,
    );

    openSheet();

    expect(screen.getByText(labels.noTags)).toBeInTheDocument();
  });

  it('alterna uma tag popular na seleção rascunho sem chamar onChange', () => {
    const onChange = vi.fn();
    renderSheet(
      <TagSelectorSheet
        selectedTagIds={[]}
        tags={baseTags}
        labels={labels}
        onChange={onChange}
      />,
    );

    openSheet();

    const popularSection = screen.getByText(labels.popularTitle).parentElement!;
    const popularBugButton = within(popularSection).getByText('Bug').closest('button')!;
    fireEvent.click(popularBugButton);

    const selectedSection = screen.getByText(labels.selectedTitle).parentElement!;
    expect(within(selectedSection).getByText('Bug')).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();

    // toggling it off again removes it from the draft list
    fireEvent.click(popularBugButton);
    expect(within(selectedSection).queryByText('Bug')).not.toBeInTheDocument();
  });

  it('aplica a seleção rascunho: chama onChange com os ids e fecha a sheet', async () => {
    const onChange = vi.fn().mockResolvedValue(undefined);
    renderSheet(
      <TagSelectorSheet
        selectedTagIds={[]}
        tags={baseTags}
        labels={labels}
        onChange={onChange}
      />,
    );

    openSheet();
    fireEvent.click(screen.getByText('Bug').closest('button')!);
    fireEvent.click(screen.getByRole('button', { name: labels.apply }));

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(['2']);
    });
    await waitFor(() => {
      expect(screen.queryByTestId('sheet')).not.toBeInTheDocument();
    });
  });

  it('remove uma tag já selecionada chamando onChange imediatamente (sem precisar de Aplicar)', async () => {
    const onChange = vi.fn().mockResolvedValue(undefined);
    renderSheet(
      <TagSelectorSheet
        selectedTagIds={['1', '2']}
        tags={baseTags}
        labels={labels}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Remover Urgente' }));

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(['2']);
    });
    // Sheet was never opened for this interaction.
    expect(screen.queryByTestId('sheet')).not.toBeInTheDocument();
  });

  it('não chama onChange ao tentar remover quando disabled', () => {
    const onChange = vi.fn();
    renderSheet(
      <TagSelectorSheet
        selectedTagIds={['1']}
        tags={baseTags}
        labels={labels}
        onChange={onChange}
        disabled
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Remover Urgente' }));

    expect(onChange).not.toHaveBeenCalled();
  });

  it('não chama onChange ao aplicar quando disabled muda para true enquanto a sheet está aberta', () => {
    // O botão "Aplicar" só reflete `isSaving` no seu próprio `disabled`, então uma
    // mudança de prop `disabled` para true enquanto a sheet já está aberta não
    // desabilita o botão — mas handleApply ainda deve respeitar a guarda
    // `disabled || isSaving` e não chamar onChange.
    const onChange = vi.fn();
    const { rerender } = renderSheet(
      <TagSelectorSheet
        selectedTagIds={[]}
        tags={baseTags}
        labels={labels}
        onChange={onChange}
      />,
    );

    openSheet();

    rerender(
      <TooltipProvider>
        <TagSelectorSheet
          selectedTagIds={[]}
          tags={baseTags}
          labels={labels}
          onChange={onChange}
          disabled
        />
      </TooltipProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: labels.apply }));

    expect(onChange).not.toHaveBeenCalled();
  });

  it('mostra o spinner de carregamento no botão enquanto onCreateTag está pendente', async () => {
    let resolveCreate!: (tag: TagOption) => void;
    const onCreateTag = vi.fn(
      () =>
        new Promise<TagOption>((resolve) => {
          resolveCreate = resolve;
        }),
    );

    const { container } = renderSheet(
      <TagSelectorSheet
        selectedTagIds={[]}
        tags={baseTags}
        labels={labels}
        onChange={vi.fn()}
        onCreateTag={onCreateTag}
      />,
    );

    openSheet();

    fireEvent.change(screen.getByPlaceholderText(labels.createPlaceholder), {
      target: { value: 'Pendente' },
    });
    fireEvent.click(screen.getByRole('button', { name: labels.createAction }));

    // While the create request is in flight, the submit button swaps its
    // Plus icon for the animated Loader2 spinner.
    await waitFor(() => {
      expect(container.querySelector('.animate-spin')).toBeTruthy();
    });

    resolveCreate({ id: '9', name: 'Pendente' });

    await waitFor(() => {
      expect(container.querySelector('.animate-spin')).not.toBeInTheDocument();
    });
  });

  it('cria uma nova tag pelo formulário embutido e a adiciona às listas de populares e selecionadas', async () => {
    const onChange = vi.fn();
    const onCreateTag = vi.fn().mockResolvedValue({ id: '4', name: 'Nova Tag' });

    renderSheet(
      <TagSelectorSheet
        selectedTagIds={[]}
        tags={baseTags}
        labels={labels}
        onChange={onChange}
        onCreateTag={onCreateTag}
      />,
    );

    openSheet();

    fireEvent.change(screen.getByPlaceholderText(labels.createPlaceholder), {
      target: { value: 'Nova Tag' },
    });
    fireEvent.click(screen.getByRole('button', { name: labels.createAction }));

    await waitFor(() => {
      expect(onCreateTag).toHaveBeenCalledWith('Nova Tag');
    });

    const popularSection = screen.getByText(labels.popularTitle).parentElement!;
    await waitFor(() => {
      expect(within(popularSection).getByText('Nova Tag')).toBeInTheDocument();
    });

    const selectedSection = screen.getByText(labels.selectedTitle).parentElement!;
    expect(within(selectedSection).getByText('Nova Tag')).toBeInTheDocument();
  });

  it('não chama onCreateTag quando a prop não é fornecida (submissão é um no-op)', async () => {
    renderSheet(
      <TagSelectorSheet
        selectedTagIds={[]}
        tags={baseTags}
        labels={labels}
        onChange={vi.fn()}
      />,
    );

    openSheet();

    fireEvent.change(screen.getByPlaceholderText(labels.createPlaceholder), {
      target: { value: 'Qualquer' },
    });
    fireEvent.click(screen.getByRole('button', { name: labels.createAction }));

    // Nothing should be added to the popular list, and no crash should occur.
    await waitFor(() => {
      expect(screen.queryByText('Qualquer')).not.toBeInTheDocument();
    });
  });

  it('ignora o retorno quando onCreateTag resolve para null (tag não é adicionada)', async () => {
    const onCreateTag = vi.fn().mockResolvedValue(null);
    renderSheet(
      <TagSelectorSheet
        selectedTagIds={[]}
        tags={baseTags}
        labels={labels}
        onChange={vi.fn()}
        onCreateTag={onCreateTag}
      />,
    );

    openSheet();

    fireEvent.change(screen.getByPlaceholderText(labels.createPlaceholder), {
      target: { value: 'Descartada' },
    });
    fireEvent.click(screen.getByRole('button', { name: labels.createAction }));

    await waitFor(() => {
      expect(onCreateTag).toHaveBeenCalledWith('Descartada');
    });
    expect(screen.queryByText('Descartada')).not.toBeInTheDocument();
  });

  it('não duplica uma tag criada nem seu id de rascunho quando o id já existe', async () => {
    const onCreateTag = vi.fn().mockResolvedValue({ id: '2', name: 'Bug' });
    renderSheet(
      <TagSelectorSheet
        selectedTagIds={[]}
        tags={baseTags}
        labels={labels}
        onChange={vi.fn()}
        onCreateTag={onCreateTag}
      />,
    );

    openSheet();

    // First creation adds "Bug" (id "2", already in `tags`) to the draft.
    fireEvent.change(screen.getByPlaceholderText(labels.createPlaceholder), {
      target: { value: 'Bug' },
    });
    fireEvent.click(screen.getByRole('button', { name: labels.createAction }));
    await waitFor(() => expect(onCreateTag).toHaveBeenCalledTimes(1));

    const popularSection = screen.getByText(labels.popularTitle).parentElement!;
    await waitFor(() => {
      expect(within(popularSection).getAllByText('Bug')).toHaveLength(1);
    });

    // Second creation resolves to the very same tag id — both the
    // createdTags de-dupe branch and the draftTagIds de-dupe branch run.
    fireEvent.change(screen.getByPlaceholderText(labels.createPlaceholder), {
      target: { value: 'Bug' },
    });
    fireEvent.click(screen.getByRole('button', { name: labels.createAction }));
    await waitFor(() => expect(onCreateTag).toHaveBeenCalledTimes(2));

    expect(within(popularSection).getAllByText('Bug')).toHaveLength(1);
  });

  it('ignora ids selecionados que não correspondem a nenhuma tag conhecida', () => {
    renderSheet(
      <TagSelectorSheet
        selectedTagIds={['unknown-id']}
        tags={baseTags}
        labels={labels}
        emptyText="Sem tags"
        onChange={vi.fn()}
      />,
    );

    // The unknown id is filtered out of the visible selected-tags row, so the
    // empty-state text is shown instead of a Badge for it.
    expect(screen.getByText('Sem tags')).toBeInTheDocument();
  });

  it('mostra o estado vazio da lista de rascunho dentro da sheet quando nada está selecionado', () => {
    renderSheet(
      <TagSelectorSheet
        selectedTagIds={[]}
        tags={baseTags}
        labels={labels}
        emptyText="Sem tags"
        onChange={vi.fn()}
      />,
    );

    openSheet();

    const selectedSection = screen.getByText(labels.selectedTitle).parentElement!;
    expect(within(selectedSection).getByText('Sem tags')).toBeInTheDocument();
  });

  it('respeita popularLimit ao truncar a lista de tags populares', () => {
    const manyTags: TagOption[] = Array.from({ length: 5 }, (_, i) => ({
      id: String(i + 1),
      name: `Tag ${i + 1}`,
    }));

    renderSheet(
      <TagSelectorSheet
        selectedTagIds={[]}
        tags={manyTags}
        labels={labels}
        onChange={vi.fn()}
        popularLimit={2}
      />,
    );

    openSheet();

    const popularSection = screen.getByText(labels.popularTitle).parentElement!;
    expect(within(popularSection).getByText('Tag 1')).toBeInTheDocument();
    expect(within(popularSection).getByText('Tag 2')).toBeInTheDocument();
    expect(within(popularSection).queryByText('Tag 3')).not.toBeInTheDocument();
  });

  it('ordena tags populares por nome quando nenhuma delas tem usageCount', () => {
    const tagsNoUsage: TagOption[] = [
      { id: '1', name: 'Zebra' },
      { id: '2', name: 'Abacaxi' },
    ];

    renderSheet(
      <TagSelectorSheet
        selectedTagIds={[]}
        tags={tagsNoUsage}
        labels={labels}
        onChange={vi.fn()}
      />,
    );

    openSheet();

    const popularSection = screen.getByText(labels.popularTitle).parentElement!;
    const buttons = within(popularSection).getAllByRole('button');
    expect(buttons[0]).toHaveTextContent('Abacaxi');
    expect(buttons[1]).toHaveTextContent('Zebra');
  });
});
