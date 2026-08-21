import { z } from 'zod';

/**
 * Validação de ambiente no BOOT. Falha explicitamente (impede o app de subir) se
 * segredos obrigatórios faltarem — em especial JWT_SECRET, que NUNCA deve ter
 * fallback. Mantém as demais variáveis intactas (não faz strip do process.env).
 */
const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL é obrigatória.'),
  JWT_SECRET: z.string().min(1, 'JWT_SECRET é obrigatória (sem fallback).'),
  // Observabilidade nunca pode ser motivo de fail-fast no boot — todos
  // opcionais, só para pegar valor mal-formado (DSN inválido, sample rate
  // fora de [0,1]) sem bloquear a subida da API.
  SENTRY_ENABLED: z.enum(['true', 'false']).optional(),
  SENTRY_DSN: z.string().url().optional().or(z.literal('')),
  SENTRY_ENVIRONMENT: z.string().optional(),
  SENTRY_RELEASE: z.string().optional(),
  SENTRY_SERVER_NAME: z.string().optional(),
  SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).optional(),
  SENTRY_TRACES_SAMPLE_RATE_QUEUE: z.coerce.number().min(0).max(1).optional(),
  SENTRY_PROFILE_SESSION_SAMPLE_RATE: z.coerce.number().min(0).max(1).optional(),
  SENTRY_ENABLE_LOGS: z.enum(['true', 'false']).optional(),
});

export function validateEnv(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    const errors = result.error.flatten().fieldErrors;
    throw new Error(
      `Configuração de ambiente inválida: ${JSON.stringify(errors)}`,
    );
  }
  // Retorna o config original: valida o obrigatório sem descartar as demais envs.
  return config;
}
