import { AsyncLocalStorage } from 'async_hooks';

export interface LocaleContext {
  locale: string;
  /**
   * `true` quando o idioma veio do `Accept-Language` do cliente, `false`
   * quando e apenas o default do middleware. So o primeiro pode virar
   * preferencia gravada do usuario.
   */
  detected?: boolean;
}

/**
 * Mora aqui, e nao em `libraries/core`, porque quem popula o contexto e o
 * `LocaleMiddleware` deste pacote. Com o storage do lado do middleware, ha um
 * unico ponto de escrita e a ordem de registro entre modulos deixa de importar.
 * `@hed-hog/core` reexporta para os consumidores antigos.
 */
export const localeStorage = new AsyncLocalStorage<LocaleContext>();

export function getLocaleFromContext(): string {
  const context = localeStorage.getStore();
  return context?.locale || 'en';
}

export function isLocaleDetectedFromContext(): boolean {
  const context = localeStorage.getStore();
  return Boolean(context?.detected && context?.locale);
}
