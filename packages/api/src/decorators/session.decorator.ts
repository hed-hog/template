import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';

export const Session = createParamDecorator(
  (_, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();

    if (!request.auth) {
      throw new UnauthorizedException(`User is not authenticated`);
    }

    return request.auth.sessionId;
  },
);
