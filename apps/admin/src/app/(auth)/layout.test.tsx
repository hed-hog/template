import '@testing-library/jest-dom/vitest';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import Layout from './layout';

describe('(auth) Layout', () => {
  it('renderiza os children passados', () => {
    render(
      <Layout>
        <div>Conteúdo filho</div>
      </Layout>,
    );
    expect(screen.getByText('Conteúdo filho')).toBeInTheDocument();
  });
});
