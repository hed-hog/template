import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  FieldTitle,
} from './field';

describe('Field primitives — estrutura', () => {
  it('renderiza FieldSet, FieldLegend (variant padrão legend), FieldGroup, FieldContent e FieldTitle', () => {
    render(
      <FieldSet>
        <FieldLegend>Legenda</FieldLegend>
        <FieldGroup>
          <FieldContent>
            <FieldTitle>Título</FieldTitle>
          </FieldContent>
        </FieldGroup>
      </FieldSet>
    );

    const legend = screen.getByText('Legenda');
    expect(legend).toHaveAttribute('data-variant', 'legend');
    expect(screen.getByText('Título')).toBeInTheDocument();
  });

  it('renderiza FieldLegend com variant "label"', () => {
    render(<FieldLegend variant="label">Rótulo</FieldLegend>);
    expect(screen.getByText('Rótulo')).toHaveAttribute('data-variant', 'label');
  });

  it('renderiza Field com orientation padrão (vertical)', () => {
    render(<Field data-testid="field-vertical">conteúdo</Field>);
    expect(screen.getByTestId('field-vertical')).toHaveAttribute(
      'data-orientation',
      'vertical'
    );
  });

  it('renderiza Field com orientation "horizontal"', () => {
    render(
      <Field orientation="horizontal" data-testid="field-horizontal">
        conteúdo
      </Field>
    );
    expect(screen.getByTestId('field-horizontal')).toHaveAttribute(
      'data-orientation',
      'horizontal'
    );
  });

  it('renderiza Field com orientation "responsive"', () => {
    render(
      <Field orientation="responsive" data-testid="field-responsive">
        conteúdo
      </Field>
    );
    expect(screen.getByTestId('field-responsive')).toHaveAttribute(
      'data-orientation',
      'responsive'
    );
  });

  it('renderiza FieldLabel (envolve Label) e FieldDescription', () => {
    render(
      <>
        <FieldLabel htmlFor="input-1">Rótulo do campo</FieldLabel>
        <FieldDescription>Descrição do campo</FieldDescription>
      </>
    );

    expect(screen.getByText('Rótulo do campo')).toBeInTheDocument();
    expect(screen.getByText('Descrição do campo')).toBeInTheDocument();
  });

  it('renderiza FieldSeparator sem conteúdo', () => {
    const { container } = render(<FieldSeparator data-testid="separator" />);
    const separator = screen.getByTestId('separator');
    expect(separator).toHaveAttribute('data-content', 'false');
    expect(container.querySelector('[data-slot="field-separator-content"]')).not.toBeInTheDocument();
  });

  it('renderiza FieldSeparator com conteúdo (children)', () => {
    render(<FieldSeparator data-testid="separator-with-content">ou</FieldSeparator>);
    const separator = screen.getByTestId('separator-with-content');
    expect(separator).toHaveAttribute('data-content', 'true');
    expect(screen.getByText('ou')).toBeInTheDocument();
  });
});

describe('FieldError', () => {
  it('não renderiza nada quando não há children nem errors', () => {
    const { container } = render(<FieldError />);
    expect(container).toBeEmptyDOMElement();
  });

  it('não renderiza nada quando errors é um array vazio', () => {
    const { container } = render(<FieldError errors={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renderiza children diretamente quando informado, ignorando errors', () => {
    render(
      <FieldError errors={[{ message: 'Ignorado' }]}>
        Mensagem customizada
      </FieldError>
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Mensagem customizada');
    expect(screen.queryByText('Ignorado')).not.toBeInTheDocument();
  });

  it('renderiza a mensagem única quando há apenas um erro (após deduplicar)', () => {
    render(<FieldError errors={[{ message: 'Campo obrigatório' }]} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Campo obrigatório');
  });

  it('renderiza lista de mensagens únicas quando há múltiplos erros, ignorando entradas sem message', () => {
    render(
      <FieldError
        errors={[
          { message: 'Erro A' },
          { message: undefined },
          { message: 'Erro A' },
          { message: 'Erro B' },
        ]}
      />
    );

    const alert = screen.getByRole('alert');
    const items = alert.querySelectorAll('li');
    // Deduplicated by message: 'Erro A', undefined, 'Erro B' => 3 unique entries,
    // but the undefined-message entry renders no <li> (falsy && short-circuit).
    expect(items).toHaveLength(2);
    expect(screen.getByText('Erro A')).toBeInTheDocument();
    expect(screen.getByText('Erro B')).toBeInTheDocument();
  });
});
