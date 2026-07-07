import {
  createParamDecorator,
  ExecutionContext
} from '@nestjs/common';

export const UserOptional = createParamDecorator(
  (field: string | null = null, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();

    if (!request.auth) {
      return null;
    }

    request.auth.user = {
      id: request.auth.sub
    }

    return field ? request.auth.user[field] : request.auth.user;
  },
);
