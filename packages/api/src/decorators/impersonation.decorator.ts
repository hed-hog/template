import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Contexto de simulacao de acesso do request atual.
 *
 * Numa sessao simulada, `@User()` devolve o ALVO (o JWT tem `sub` = alvo) — e e
 * isso que se quer: o RoleGuard resolve os papeis do alvo e todo servico a
 * jusante enxerga o alvo. Quem precisa saber que ha um operador por tras usa
 * este decorator.
 *
 * A claim `act` segue o claim "actor" da RFC 8693.
 */
export type ImpersonationContext = {
  active: boolean;
  operatorUserId: number | null;
  sessionId: number | null;
};

export const Impersonation = createParamDecorator(
  (_, ctx: ExecutionContext): ImpersonationContext => {
    const request = ctx.switchToHttp().getRequest();
    const auth = request?.auth;

    return {
      active: auth?.imp === true,
      operatorUserId: typeof auth?.act === 'number' ? auth.act : null,
      sessionId: typeof auth?.sessionId === 'number' ? auth.sessionId : null,
    };
  },
);
