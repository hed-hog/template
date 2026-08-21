import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { StatusBadge } from './status-badge';

describe('StatusBadge', () => {
  it('renderiza status de título com label e classe extra', () => {
    render(<StatusBadge status="aberto" className="custom-class" />);

    const badge = screen.getByText('Aberto');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('bg-yellow-100', 'text-yellow-700', 'custom-class');
  });

  it('renderiza status de conciliação', () => {
    render(<StatusBadge status="conciliado" type="conciliacao" />);

    expect(screen.getByText('Conciliado')).toHaveClass(
      'bg-green-100',
      'text-green-700',
    );
  });

  it('retorna null para status incompatível com o tipo', () => {
    const { container } = render(
      <StatusBadge status={'nao_existe' as never} type="titulo" />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
