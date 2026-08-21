import { SetMetadata } from '@nestjs/common';

export const LOG_OPERATION_METADATA = 'log_operation';

export function LogOperation(module: string) {
  return SetMetadata(LOG_OPERATION_METADATA, { module });
}
