import { SetMetadata } from '@nestjs/common';

export const WITH_NO_ROLE = 'withNoRole';

export function NoRole() {
  return SetMetadata(WITH_NO_ROLE, true);
}
