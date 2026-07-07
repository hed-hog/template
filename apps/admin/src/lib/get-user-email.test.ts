import { describe, it, expect } from 'vitest';
import type { User } from '@hed-hog/api-types';

import { getUserEmail } from './get-user-email';

function asUser(partial: unknown): User {
  return partial as User;
}

describe('getUserEmail', () => {
  it('retorna o value do identificador do tipo email', () => {
    const user = asUser({
      user_identifier: [
        { type: 'phone', value: '+55 11 99999-9999' },
        { type: 'email', value: 'joao@example.com' },
      ],
    });
    expect(getUserEmail(user)).toBe('joao@example.com');
  });

  it('sem identificador de email retorna string vazia', () => {
    const user = asUser({
      user_identifier: [{ type: 'phone', value: '123' }],
    });
    expect(getUserEmail(user)).toBe('');
  });

  it('sem user_identifier retorna string vazia', () => {
    expect(getUserEmail(asUser({}))).toBe('');
  });
});
