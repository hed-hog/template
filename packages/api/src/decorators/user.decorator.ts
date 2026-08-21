import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';

export const User = createParamDecorator(
  (field: string | null = null, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();

    if (!request.auth) {
      throw new UnauthorizedException(`User is not authenticated`);
    }

    request.auth.user = {
      id: request.auth.sub
    }

    return field ? request.auth.user[field] : request.auth.user;
  },
);
