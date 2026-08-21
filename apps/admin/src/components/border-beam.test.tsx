import '@testing-library/jest-dom/vitest';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';

import { BorderBeam } from './border-beam';

describe('BorderBeam', () => {
  it('renderiza com os valores padrão', () => {
    const { container } = render(<BorderBeam />);
    const divs = container.querySelectorAll('div[aria-hidden]');
    expect(divs).toHaveLength(2);
  });

  it('renderiza com props customizadas', () => {
    const { container } = render(
      <BorderBeam duration={5} rx={20} color="red" />,
    );
    const divs = container.querySelectorAll('div[aria-hidden]');
    expect(divs).toHaveLength(2);
    expect(divs[0]?.getAttribute('style')).toContain('red');
  });
});
