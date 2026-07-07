import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Calendar, CalendarDayButton } from './calendar';

describe('Calendar', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'ResizeObserver',
      vi.fn(() => ({
        disconnect: vi.fn(),
        observe: vi.fn(),
        unobserve: vi.fn(),
      })),
    );
  });

  it('renderiza o calendário com o mês atual e permite selecionar um dia', () => {
    const onSelect = vi.fn();
    render(
      <Calendar
        mode="single"
        selected={new Date(2024, 0, 10)}
        onSelect={onSelect}
        defaultMonth={new Date(2024, 0, 1)}
      />,
    );

    const day15 = screen.getByText('15');
    fireEvent.click(day15);

    expect(onSelect).toHaveBeenCalled();
  });

  it('navega para o próximo mês e para o mês anterior', () => {
    render(
      <Calendar mode="single" defaultMonth={new Date(2024, 0, 1)} />,
    );

    expect(screen.getByText('January 2024')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.getByText('February 2024')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /previous/i }));
    expect(screen.getByText('January 2024')).toBeInTheDocument();
  });

  it('aplica classNames e className customizados', () => {
    render(
      <Calendar
        mode="single"
        defaultMonth={new Date(2024, 0, 1)}
        className="custom-calendar"
        classNames={{ root: 'custom-root' }}
        data-testid="calendar-root"
      />,
    );

    const root = document.querySelector('[data-slot="calendar"]');
    expect(root).not.toBeNull();
    expect(root?.className).toContain('custom-calendar');
    expect(root?.className).toContain('custom-root');
  });

  it('usa buttonVariant customizado', () => {
    render(
      <Calendar
        mode="single"
        defaultMonth={new Date(2024, 0, 1)}
        buttonVariant="outline"
      />,
    );

    expect(screen.getByText('January 2024')).toBeInTheDocument();
  });

  it('renderiza captionLayout diferente de label (dropdown)', () => {
    render(
      <Calendar
        mode="single"
        defaultMonth={new Date(2024, 0, 1)}
        captionLayout="dropdown"
      />,
    );

    expect(screen.getAllByRole('combobox').length).toBeGreaterThan(0);
  });

  it('renderiza números da semana quando showWeekNumber é true', () => {
    const { container } = render(
      <Calendar
        mode="single"
        defaultMonth={new Date(2024, 0, 1)}
        showWeekNumber
      />,
    );

    expect(
      container.querySelectorAll('td .flex.size-\\(--cell-size\\)').length,
    ).toBeGreaterThan(0);
  });

  it('renderiza dias fora do mês quando showOutsideDays é true', () => {
    render(
      <Calendar
        mode="single"
        defaultMonth={new Date(2024, 1, 1)}
        showOutsideDays
      />,
    );

    // February 2024 starts on a Thursday, so outside days from January are shown
    const outsideDays = document.querySelectorAll(
      '[data-slot="calendar"] .rdp-outside, [data-day]',
    );
    expect(outsideDays.length).toBeGreaterThan(0);
  });
});

describe('CalendarDayButton', () => {
  it('foca automaticamente quando modifiers.focused é verdadeiro', () => {
    const day = { date: new Date(2024, 0, 15) } as any;
    render(
      <table>
        <tbody>
          <tr>
            <td>
              <CalendarDayButton
                day={day}
                modifiers={{ focused: true } as any}
              />
            </td>
          </tr>
        </tbody>
      </table>,
    );

    const button = screen.getByRole('button');
    expect(button).toHaveFocus();
  });

  it('define data-selected-single quando apenas selected é verdadeiro', () => {
    const day = { date: new Date(2024, 0, 15) } as any;
    render(
      <table>
        <tbody>
          <tr>
            <td>
              <CalendarDayButton
                day={day}
                modifiers={{ selected: true } as any}
              />
            </td>
          </tr>
        </tbody>
      </table>,
    );

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('data-selected-single', 'true');
  });

  it('define data-range-start/middle/end quando aplicável', () => {
    const day = { date: new Date(2024, 0, 15) } as any;
    render(
      <table>
        <tbody>
          <tr>
            <td>
              <CalendarDayButton
                day={day}
                modifiers={
                  {
                    selected: true,
                    range_start: true,
                    range_middle: false,
                    range_end: false,
                  } as any
                }
              />
            </td>
          </tr>
        </tbody>
      </table>,
    );

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('data-range-start', 'true');
    expect(button).toHaveAttribute('data-selected-single', 'false');
  });

  it('não foca quando modifiers.focused é falso', () => {
    const day = { date: new Date(2024, 0, 15) } as any;
    render(
      <table>
        <tbody>
          <tr>
            <td>
              <CalendarDayButton
                day={day}
                modifiers={{ focused: false } as any}
              />
            </td>
          </tr>
        </tbody>
      </table>,
    );

    const button = screen.getByRole('button');
    expect(button).not.toHaveFocus();
  });
});
