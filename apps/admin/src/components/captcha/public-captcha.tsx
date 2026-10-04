'use client';

import Script from 'next/script';
import * as React from 'react';

/**
 * Widget de CAPTCHA para as paginas publicas do admin.
 *
 * A site key vem SEMPRE do endpoint de configuracao da propria pagina, nunca de
 * uma env: chave em build-arg congela no bundle, e trocar o perfil de integracao
 * no admin passaria a exigir rebuild.
 *
 * O provider tambem vem do servidor (`provider_slug` do perfil), porque quem
 * confere o token e quem dita com o que ele foi gerado.
 *
 * ALTCHA fica de fora de proposito: ele e proof-of-work com HMAC emitido pelo
 * servidor, e o backend nao expoe endpoint de desafio. Renderizar um widget que
 * nunca produziria token valido seria pior do que dizer que nao da.
 */

type TurnstileApi = {
  render: (
    container: string | HTMLElement,
    options: {
      sitekey: string;
      action?: string;
      theme?: 'light' | 'dark' | 'auto';
      size?: 'normal' | 'compact' | 'flexible';
      callback?: (token: string) => void;
      'error-callback'?: () => void;
      'expired-callback'?: () => void;
    },
  ) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId?: string) => void;
};

type RecaptchaApi = {
  render: (
    container: string | HTMLElement,
    options: {
      sitekey: string;
      theme?: 'light' | 'dark';
      callback?: (token: string) => void;
      'expired-callback'?: () => void;
      'error-callback'?: () => void;
    },
  ) => number;
  reset: (widgetId?: number) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
    grecaptcha?: RecaptchaApi & { ready?: (cb: () => void) => void };
  }
}

export type PublicCaptchaConfig = {
  enabled: boolean;
  provider_slug: string | null;
  site_key: string | null;
  action?: string | null;
};

export type PublicCaptchaHandle = { reset: () => void };

/** Providers que esta pagina sabe desenhar. */
export const SUPPORTED_CAPTCHA_PROVIDERS = ['cloudflare-turnstile', 'recaptcha'];

/**
 * `true` quando o captcha esta ligado e da para montar o widget.
 *
 * Ligado sem site key (perfil apagado) ou com provider que nao sabemos desenhar
 * conta como impedimento, nao como "desligado": o envio seria recusado no
 * servidor de qualquer forma, e a pagina precisa dizer isso antes.
 */
export function captchaIsUsable(config: PublicCaptchaConfig | null): boolean {
  return Boolean(
    config?.enabled &&
      config.site_key &&
      config.provider_slug &&
      SUPPORTED_CAPTCHA_PROVIDERS.includes(config.provider_slug),
  );
}

type Props = {
  config: PublicCaptchaConfig;
  onToken: (token: string) => void;
};

export const PublicCaptcha = React.forwardRef<PublicCaptchaHandle, Props>(
  function PublicCaptcha({ config, onToken }, ref) {
    const containerRef = React.useRef<HTMLDivElement>(null);
    const turnstileIdRef = React.useRef<string | null>(null);
    const recaptchaIdRef = React.useRef<number | null>(null);
    const onTokenRef = React.useRef(onToken);

    // O callback vive numa ref para o widget nao remontar a cada setState do
    // pai — mas a atribuicao fica num efeito, e nao no corpo do componente, que
    // pode ser descartado antes de virar tela.
    React.useEffect(() => {
      onTokenRef.current = onToken;
    }, [onToken]);

    const siteKey = config.site_key ?? '';
    const provider = config.provider_slug ?? '';
    const action = config.action ?? undefined;

    const reset = React.useCallback(() => {
      if (turnstileIdRef.current && window.turnstile) {
        window.turnstile.reset(turnstileIdRef.current);
      }
      if (recaptchaIdRef.current !== null && window.grecaptcha) {
        window.grecaptcha.reset(recaptchaIdRef.current);
      }
    }, []);

    React.useImperativeHandle(ref, () => ({ reset }), [reset]);

    const render = React.useCallback(() => {
      if (!siteKey || !containerRef.current) return;

      if (provider === 'cloudflare-turnstile' && window.turnstile) {
        if (turnstileIdRef.current) {
          window.turnstile.remove(turnstileIdRef.current);
          turnstileIdRef.current = null;
        }
        turnstileIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          action,
          theme: 'auto',
          size: 'flexible',
          callback: (token) => onTokenRef.current(token),
          'error-callback': () => onTokenRef.current(''),
          'expired-callback': () => onTokenRef.current(''),
        });
        return;
      }

      if (provider === 'recaptcha' && window.grecaptcha?.render) {
        // Remontar o mesmo container quebra o grecaptcha, que nao tem `remove`:
        // renderizar uma vez so e resetar depois e o caminho suportado.
        if (recaptchaIdRef.current !== null) return;
        recaptchaIdRef.current = window.grecaptcha.render(containerRef.current, {
          sitekey: siteKey,
          callback: (token) => onTokenRef.current(token),
          'expired-callback': () => onTokenRef.current(''),
          'error-callback': () => onTokenRef.current(''),
        });
      }
    }, [siteKey, provider, action]);

    // A chave chega de um fetch, entao o primeiro render acontece sem ela.
    React.useEffect(() => {
      render();
    }, [render]);

    React.useEffect(() => {
      return () => {
        if (turnstileIdRef.current && window.turnstile) {
          window.turnstile.remove(turnstileIdRef.current);
          turnstileIdRef.current = null;
        }
      };
    }, []);

    if (!captchaIsUsable(config)) return null;

    return (
      <>
        {provider === 'cloudflare-turnstile' && (
          <Script
            src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
            strategy="afterInteractive"
            onLoad={render}
          />
        )}
        {provider === 'recaptcha' && (
          <Script
            src="https://www.google.com/recaptcha/api.js?render=explicit"
            strategy="afterInteractive"
            onLoad={() =>
              window.grecaptcha?.ready
                ? window.grecaptcha.ready(render)
                : render()
            }
          />
        )}
        <div ref={containerRef} className="min-h-[70px] w-full" />
      </>
    );
  },
);
