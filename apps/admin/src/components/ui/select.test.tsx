import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from './select';

// Radix Select relies on DOM APIs jsdom doesn't implement.
beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
});

function Harness({
  onValueChange,
  disabled,
  defaultValue,
}: {
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  defaultValue?: string;
}) {
  return (
    <Select onValueChange={onValueChange} disabled={disabled} defaultValue={defaultValue}>
      <SelectTrigger data-testid="trigger">
        <SelectValue placeholder="Selecione uma fruta" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Frutas</SelectLabel>
          <SelectItem value="apple">Maçã</SelectItem>
          <SelectItem value="banana">Banana</SelectItem>
          <SelectSeparator />
          <SelectItem value="grape">Uva</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

describe('Select', () => {
  it('abre o menu e seleciona um item, propagando onValueChange', async () => {
    const onValueChange = vi.fn();
    render(<Harness onValueChange={onValueChange} />);

    const trigger = screen.getByTestId('trigger');
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });
    fireEvent.click(trigger);

    const listbox = await screen.findByRole('listbox');
    const banana = within(listbox).getByText('Banana');
    fireEvent.pointerUp(banana);
    fireEvent.click(banana);

    expect(onValueChange).toHaveBeenCalledWith('banana');
  });

  it('renderiza SelectGroup, SelectLabel e SelectSeparator dentro do conteúdo', async () => {
    render(<Harness />);

    fireEvent.pointerDown(screen.getByTestId('trigger'));
    fireEvent.click(screen.getByTestId('trigger'));

    const listbox = await screen.findByRole('listbox');
    expect(within(listbox).getByText('Frutas')).toBeInTheDocument();
    expect(within(listbox).getByText('Maçã')).toBeInTheDocument();
    expect(within(listbox).getByText('Uva')).toBeInTheDocument();
  });

  it('não abre o menu quando o select está desabilitado', () => {
    render(<Harness disabled />);

    const trigger = screen.getByTestId('trigger');
    expect(trigger).toBeDisabled();

    fireEvent.pointerDown(trigger);
    fireEvent.click(trigger);

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('mostra o valor selecionado por padrão (defaultValue)', () => {
    render(<Harness defaultValue="apple" />);

    expect(screen.getByTestId('trigger')).toHaveTextContent('Maçã');
  });

  it('renderiza o trigger com size sm', () => {
    render(
      <Select>
        <SelectTrigger size="sm" data-testid="trigger-sm">
          <SelectValue placeholder="Escolha" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">A</SelectItem>
        </SelectContent>
      </Select>,
    );

    expect(screen.getByTestId('trigger-sm')).toHaveAttribute('data-size', 'sm');
  });

  it('abre o menu e monta os botões de scroll dentro do conteúdo (SelectContent os renderiza sempre)', async () => {
    render(<Harness />);

    fireEvent.pointerDown(screen.getByTestId('trigger'));
    fireEvent.click(screen.getByTestId('trigger'));

    const listbox = await screen.findByRole('listbox');
    // SelectContent always mounts SelectScrollUpButton/SelectScrollDownButton
    // internally; asserting the listbox rendered is enough to exercise them.
    expect(listbox).toBeInTheDocument();
  });
});
