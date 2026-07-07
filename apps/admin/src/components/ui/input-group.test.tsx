import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
  InputGroupTextarea,
} from './input-group';

describe('InputGroup', () => {
  it('renderiza o container com role group e className extra', () => {
    render(
      <InputGroup className="extra-class" data-testid="group">
        <InputGroupInput placeholder="Digite algo" />
      </InputGroup>
    );

    const group = screen.getByTestId('group');
    expect(group).toHaveAttribute('role', 'group');
    expect(group).toHaveClass('extra-class');
  });

  it.each([
    'inline-start',
    'inline-end',
    'block-start',
    'block-end',
  ] as const)('InputGroupAddon aceita align=%s', (align) => {
    render(
      <InputGroup>
        <InputGroupAddon align={align} data-testid={`addon-${align}`}>
          <span>addon</span>
        </InputGroupAddon>
        <InputGroupInput placeholder="Campo" />
      </InputGroup>
    );

    const addon = screen.getByTestId(`addon-${align}`);
    expect(addon).toHaveAttribute('data-align', align);
  });

  it('usa "inline-start" como align padrão do addon', () => {
    render(
      <InputGroup>
        <InputGroupAddon data-testid="default-addon">
          <span>addon</span>
        </InputGroupAddon>
      </InputGroup>
    );

    expect(screen.getByTestId('default-addon')).toHaveAttribute(
      'data-align',
      'inline-start'
    );
  });

  it('foca o input do grupo ao clicar no addon (fora de um botão)', () => {
    render(
      <InputGroup>
        <InputGroupAddon data-testid="addon">
          <span>addon</span>
        </InputGroupAddon>
        <InputGroupInput placeholder="Campo" />
      </InputGroup>
    );

    fireEvent.click(screen.getByTestId('addon'));

    expect(screen.getByPlaceholderText('Campo')).toHaveFocus();
  });

  it('não foca o input quando o clique ocorre em um botão dentro do addon', () => {
    render(
      <InputGroup>
        <InputGroupAddon data-testid="addon">
          <button type="button">Ação</button>
        </InputGroupAddon>
        <InputGroupInput placeholder="Campo" />
      </InputGroup>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Ação' }));

    expect(screen.getByPlaceholderText('Campo')).not.toHaveFocus();
  });

  it.each(['xs', 'sm', 'icon-xs', 'icon-sm'] as const)(
    'InputGroupButton aceita size=%s',
    (size) => {
      render(<InputGroupButton size={size}>Botão</InputGroupButton>);

      const button = screen.getByRole('button', { name: 'Botão' });
      expect(button).toHaveAttribute('data-size', size);
    }
  );

  it('InputGroupButton usa defaults (type=button, variant=ghost, size=xs)', () => {
    render(<InputGroupButton>Padrão</InputGroupButton>);

    const button = screen.getByRole('button', { name: 'Padrão' });
    expect(button).toHaveAttribute('type', 'button');
    expect(button).toHaveAttribute('data-size', 'xs');
  });

  it('InputGroupButton aceita type e variant customizados', () => {
    const onClick = vi.fn();
    render(
      <InputGroupButton type="submit" variant="outline" onClick={onClick}>
        Enviar
      </InputGroupButton>
    );

    const button = screen.getByRole('button', { name: 'Enviar' });
    expect(button).toHaveAttribute('type', 'submit');

    fireEvent.click(button);
    expect(onClick).toHaveBeenCalled();
  });

  it('InputGroupText renderiza um span com className extra', () => {
    render(<InputGroupText className="text-extra">Texto</InputGroupText>);

    const el = screen.getByText('Texto');
    expect(el.tagName).toBe('SPAN');
    expect(el).toHaveClass('text-extra');
  });

  it('InputGroupInput repassa props e data-slot correto', () => {
    render(<InputGroupInput placeholder="entrada" aria-invalid="true" />);

    const input = screen.getByPlaceholderText('entrada');
    expect(input).toHaveAttribute('data-slot', 'input-group-control');
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });

  it('InputGroupTextarea repassa props e data-slot correto', () => {
    render(<InputGroupTextarea placeholder="mensagem" />);

    const textarea = screen.getByPlaceholderText('mensagem');
    expect(textarea.tagName).toBe('TEXTAREA');
    expect(textarea).toHaveAttribute('data-slot', 'input-group-control');
  });
});
