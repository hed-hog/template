import '@testing-library/jest-dom/vitest';
import * as React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { NameInput } from './name-input';

describe('NameInput', () => {
  it('formata no blur (modo não controlado)', () => {
    render(<NameInput />);
    const input = screen.getByRole('textbox') as HTMLInputElement;

    fireEvent.change(input, { target: { value: 'APARECIDA DA SILVA' } });
    fireEvent.blur(input);

    expect(input.value).toBe('Aparecida da Silva');
  });

  it('não formata durante a digitação, só no blur', () => {
    render(<NameInput />);
    const input = screen.getByRole('textbox') as HTMLInputElement;

    fireEvent.change(input, { target: { value: 'MARIA JOSE' } });
    expect(input.value).toBe('MARIA JOSE');
  });

  it('não formata quando isCompany é true', () => {
    render(<NameInput isCompany />);
    const input = screen.getByRole('textbox') as HTMLInputElement;

    fireEvent.change(input, { target: { value: 'HCODE TECNOLOGIA LTDA' } });
    fireEvent.blur(input);

    expect(input.value).toBe('HCODE TECNOLOGIA LTDA');
  });

  it('não muda o valor quando já está formatado', () => {
    render(<NameInput defaultValue="João da Silva" />);
    const input = screen.getByRole('textbox') as HTMLInputElement;

    fireEvent.blur(input);

    expect(input.value).toBe('João da Silva');
  });

  it('encadeia o onChange do chamador com o valor formatado (equivalente a field.onChange do RHF)', () => {
    const onChange = vi.fn();
    render(<NameInput onChange={onChange} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;

    fireEvent.change(input, { target: { value: 'maria jose' } });
    onChange.mockClear();

    fireEvent.blur(input);

    expect(onChange).toHaveBeenCalledTimes(1);
    const event = onChange.mock.calls[0]?.[0] as React.ChangeEvent<HTMLInputElement>;
    expect(event.target.value).toBe('Maria Jose');
  });

  it('sempre chama o onBlur do chamador, mesmo quando formata (equivalente a field.onBlur do RHF)', () => {
    const onBlur = vi.fn();
    render(<NameInput onBlur={onBlur} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;

    fireEvent.change(input, { target: { value: 'MARIA JOSE' } });
    fireEvent.blur(input);

    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  it('chama o onBlur do chamador quando não há nada a formatar', () => {
    const onBlur = vi.fn();
    render(<NameInput onBlur={onBlur} defaultValue="João da Silva" />);
    const input = screen.getByRole('textbox') as HTMLInputElement;

    fireEvent.blur(input);

    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  it('modo controlado: o valor formatado sobrevive ao re-render quando o onChange atualiza o state (como o field do RHF faz)', () => {
    function Controlled() {
      const [value, setValue] = React.useState('');
      return (
        <NameInput
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      );
    }

    render(<Controlled />);
    const input = screen.getByRole('textbox') as HTMLInputElement;

    fireEvent.change(input, { target: { value: 'MARIA JOSE' } });
    fireEvent.blur(input);

    expect(input.value).toBe('Maria Jose');
  });

  it('repassa demais props para o Input subjacente', () => {
    render(<NameInput placeholder="Nome completo" disabled />);
    const input = screen.getByRole('textbox') as HTMLInputElement;

    expect(input).toHaveAttribute('placeholder', 'Nome completo');
    expect(input).toBeDisabled();
  });

  it('encaminha o ref para o elemento input', () => {
    const ref = React.createRef<HTMLInputElement>();
    render(<NameInput ref={ref} />);

    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });
});
