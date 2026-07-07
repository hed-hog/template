import { User } from '@hed-hog/api-types';

export function getUserEmail(user: User): string {
  return (
    user.user_identifier?.find((identifier) => identifier.type === 'email')
      ?.value || ''
  );
}
