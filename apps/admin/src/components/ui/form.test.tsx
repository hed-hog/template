import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useForm } from 'react-hook-form';

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from './form';
import { Input } from './input';

type Values = { name: string };

function Harness({
  onSubmit,
  defaultValues = { name: '' },
}: {
  onSubmit: (values: Values) => void;
  defaultValues?: Values;
}) {
  const form = useForm<Values>({ defaultValues });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <FormField
          control={form.control}
          name="name"
          rules={{ required: 'Nome é obrigatório' }}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nome</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormDescription>Informe seu nome completo</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <button type="submit">Enviar</button>
      </form>
    </Form>
  );
}

describe('Form (react-hook-form wrapper)', () => {
  it('renderiza label, descrição e controle sem mensagem de erro inicialmente', () => {
    render(<Harness onSubmit={() => {}} />);

    const label = screen.getByText('Nome');
    expect(label).toHaveAttribute('data-error', 'false');
    expect(screen.getByText('Informe seu nome completo')).toBeInTheDocument();

    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('aria-invalid', 'false');
    // No error yet, so aria-describedby only references the description id.
    expect(input.getAttribute('aria-describedby')).not.toMatch(/-message/);
  });

  it('exibe a mensagem de erro de validação e marca data-error/aria-invalid após submit inválido', async () => {
    render(<Harness onSubmit={() => {}} />);

    const submitButton = screen.getByRole('button', { name: 'Enviar' });
    submitButton.click();

    await waitFor(() => {
      expect(screen.getByText('Nome é obrigatório')).toBeInTheDocument();
    });

    const label = screen.getByText('Nome');
    expect(label).toHaveAttribute('data-error', 'true');

    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input.getAttribute('aria-describedby')).toMatch(/-message$/);
  });

  it('FormMessage renderiza children quando não há erro', () => {
    function ChildrenHarness() {
      const form = useForm<Values>({ defaultValues: { name: '' } });
      return (
        <Form {...form}>
          <FormField
            control={form.control}
            name="name"
            render={() => (
              <FormItem>
                <FormMessage>Texto informativo</FormMessage>
              </FormItem>
            )}
          />
        </Form>
      );
    }

    render(<ChildrenHarness />);
    expect(screen.getByText('Texto informativo')).toBeInTheDocument();
  });

  it('FormMessage não renderiza nada quando não há erro nem children', () => {
    function EmptyHarness() {
      const form = useForm<Values>({ defaultValues: { name: '' } });
      return (
        <Form {...form}>
          <FormField
            control={form.control}
            name="name"
            render={() => (
              <FormItem>
                <FormMessage data-testid="empty-message" />
              </FormItem>
            )}
          />
        </Form>
      );
    }

    render(<EmptyHarness />);
    expect(screen.queryByTestId('empty-message')).not.toBeInTheDocument();
  });
});
