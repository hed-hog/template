import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const Locale = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request['locale'];
  },
);

/**
 * `true` quando o `Accept-Language` da requisicao trouxe um idioma suportado.
 * Distingue a escolha do cliente do default do middleware - so o primeiro pode
 * virar preferencia gravada do usuario.
 */
export const LocaleDetected = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return Boolean(request['localeDetected']);
  },
);
