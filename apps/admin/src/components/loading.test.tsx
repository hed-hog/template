import '@testing-library/jest-dom/vitest';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';

import { Loading } from './loading';

describe('Loading', () => {
  it('renderiza o spinner de carregamento', () => {
    const { container } = render(<Loading />);
    expect(container.querySelector('.loader')).toBeInTheDocument();
    expect(container.querySelector('style')).toBeInTheDocument();
  });
});
