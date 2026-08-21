import {
  BrandAssetBases,
  isPublicAssetUrl,
  resolveBrandAssetUrl,
} from './brand-asset';

export const DEFAULT_BRAND_NAME = 'HedHog';

/** Fallback quando a setting `theme-primary-light` nao pode ser lida. */
export const DEFAULT_PRIMARY_COLOR = '#111827';
/** Fallback quando a setting `theme-primary-foreground-light` nao pode ser lida. */
export const DEFAULT_PRIMARY_FOREGROUND = '#ffffff';

/**
 * Resolve uma URL potencialmente relativa (ex.: `/logo.svg`, como salvo pela
 * setting `image-url`) para uma URL absoluta.
 *
 * Alias de {@link resolveBrandAssetUrl}, mantido porque o pacote e publicado no
 * npm e a assinatura antiga recebia a base da API como string.
 */
export function resolveMailAssetUrl(
  url: string,
  bases: BrandAssetBases | string,
): string {
  return resolveBrandAssetUrl(url, bases);
}

/**
 * Layout base aplicado a todo e-mail transacional.
 *
 * `wrapper` e o documento HTML completo (estrutura + CSS) e por isso NAO e
 * traduzivel. `header` e `footer` sao fragmentos por idioma.
 *
 * Tokens reconhecidos:
 *  - `{{{content}}}`         corpo do template ja interpolado (wrapper)
 *  - `{{{header}}}`          fragmento de cabecalho (wrapper)
 *  - `{{{footer}}}`          fragmento de rodape (wrapper)
 *  - `{{subject}}`           assunto, com escape de HTML
 *  - `{{brandName}}`         setting `system-name`, com escape de HTML
 *  - `{{{brandMark}}}`       logo (setting `image-url`) ou selo de texto com o brandName, ja como HTML
 *  - `{{primaryColor}}`      setting `theme-primary-light`
 *  - `{{primaryForeground}}` setting `theme-primary-foreground-light`
 *  - `{{year}}`              ano corrente
 *  - `{{lang}}`              codigo do locale
 */
export type MailLayout = {
  wrapper?: string | null;
  header?: string | null;
  footer?: string | null;
};

export type RenderMailTemplateInput = {
  subject?: string;
  body?: string;
  /** Ausente ou null => DEFAULT_MAIL_LAYOUT. */
  layout?: MailLayout | null;
  brandName?: string;
  lang?: string;
  /** URL absoluta do logo (setting `image-url`). Ausente => selo de texto com o brandName. */
  logoUrl?: string;
  /** Cor de marca (setting `theme-primary-light`). Ausente => DEFAULT_PRIMARY_COLOR. */
  primaryColor?: string;
  /** Contraste sobre a cor de marca (setting `theme-primary-foreground-light`). Ausente => DEFAULT_PRIMARY_FOREGROUND. */
  primaryForeground?: string;
};

/** Selo do cabecalho: logo quando configurado, senao um badge de texto com o brandName. */
function buildBrandMark(input: {
  logoUrl?: string;
  brandName: string;
  primaryColor: string;
  primaryForeground: string;
}): string {
  const logoUrl = input.logoUrl?.trim();

  // Sem URL publica o <img> chega quebrado e o destinatario ve so o alt. O selo
  // de texto usa a cor da marca e sempre renderiza. Ver isPublicAssetUrl.
  if (logoUrl && isPublicAssetUrl(logoUrl)) {
    return `<img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(input.brandName)}" height="32" style="height:32px;max-height:32px;width:auto;display:block;border:0;outline:none;" />`;
  }

  return `<div class="brand" style="background:${escapeHtml(input.primaryColor)};color:${escapeHtml(input.primaryForeground)};">${escapeHtml(input.brandName)}</div>`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isFullHtmlDocument(value: string) {
  return /<!doctype\s+html|<html[\s>]/i.test(value);
}

/**
 * Substituicao literal de token.
 *
 * Usa split/join de proposito: `String.replace(string, string)` troca apenas a
 * primeira ocorrencia E interpreta `$&`, `` $` ``, `$'` e `$1` no texto de
 * substituicao. Header, footer e content sao HTML arbitrario do usuario e podem
 * conter esses padroes (um preco "$1,00", por exemplo), o que corromperia a
 * saida silenciosamente.
 */
function substitute(source: string, token: string, value: string): string {
  if (!source.includes(token)) {
    return source;
  }
  return source.split(token).join(value);
}

/** Aceita tanto `{{{token}}}` quanto `{{token}}`. */
function substituteToken(source: string, name: string, value: string): string {
  return substitute(substitute(source, `{{{${name}}}}`, value), `{{${name}}}`, value);
}

function applyScalars(
  source: string,
  scalars: Record<string, string>,
): string {
  return Object.entries(scalars).reduce(
    (acc, [name, value]) => substituteToken(acc, name, value),
    source,
  );
}

export const DEFAULT_MAIL_LAYOUT: MailLayout = {
  wrapper: `<!DOCTYPE html>
<html lang="{{lang}}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="color-scheme" content="light" />
    <meta name="supported-color-schemes" content="light" />
    <title>{{subject}}</title>
    <style>
      body {
        margin: 0;
        padding: 0;
        background: #eef2f7;
        color: #1f2937;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      }
      table {
        border-collapse: collapse;
      }
      .page {
        width: 100%;
        background: linear-gradient(180deg, #f8fafc 0%, #eef2f7 100%);
        padding: 32px 16px;
      }
      .shell {
        width: 100%;
        max-width: 640px;
        margin: 0 auto;
      }
      .hero {
        padding: 0 0 18px;
      }
      .brand-mark {
        margin: 0 0 16px;
      }
      .brand-mark img {
        display: block;
        height: 32px;
        max-height: 32px;
        width: auto;
      }
      .brand {
        display: inline-block;
        padding: 8px 14px;
        border-radius: 999px;
        background: {{primaryColor}};
        color: {{primaryForeground}};
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .subject {
        margin: 18px 0 0;
        font-size: 28px;
        line-height: 1.2;
        font-weight: 800;
        color: #0f172a;
      }
      .panel {
        background: #ffffff;
        border: 1px solid rgba(148, 163, 184, 0.22);
        border-radius: 24px;
        overflow: hidden;
        box-shadow: 0 24px 60px rgba(15, 23, 42, 0.08);
      }
      .panel-accent {
        height: 6px;
        background: {{primaryColor}};
      }
      .content {
        padding: 36px 34px 28px;
        font-size: 16px;
        line-height: 1.7;
        color: #334155;
      }
      .content h1,
      .content h2,
      .content h3 {
        margin: 0 0 16px;
        line-height: 1.25;
        color: #0f172a;
      }
      .content h1 { font-size: 28px; }
      .content h2 { font-size: 22px; }
      .content h3 { font-size: 18px; }
      .content p,
      .content ul,
      .content ol,
      .content blockquote {
        margin: 0 0 16px;
      }
      .content ul,
      .content ol {
        padding-left: 22px;
      }
      .content li + li {
        margin-top: 8px;
      }
      .content a {
        color: {{primaryColor}};
        font-weight: 600;
        text-decoration: none;
      }
      .content strong {
        color: #111827;
      }
      .content blockquote {
        padding: 14px 16px;
        border-left: 4px solid {{primaryColor}};
        border-radius: 0 14px 14px 0;
        background: #f8fafc;
        color: #334155;
      }
      .content hr {
        margin: 24px 0;
        border: 0;
        border-top: 1px solid #e2e8f0;
      }
      .content img {
        max-width: 100%;
        border-radius: 16px;
      }
      .footer {
        padding: 18px 12px 0;
        font-size: 12px;
        line-height: 1.6;
        text-align: center;
        color: #64748b;
      }
      @media only screen and (max-width: 640px) {
        .page {
          padding: 20px 12px;
        }
        .subject {
          font-size: 24px;
        }
        .content {
          padding: 26px 20px 22px;
          font-size: 15px;
        }
      }
    </style>
  </head>
  <body>
    <table role="presentation" width="100%" class="page">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" class="shell">
            <tr>
              <td class="hero">
                {{{header}}}
              </td>
            </tr>
            <tr>
              <td>
                <div class="panel">
                  <div class="panel-accent" style="background:{{primaryColor}};"></div>
                  <div class="content">
                    {{{content}}}
                  </div>
                </div>
              </td>
            </tr>
            <tr>
              <td class="footer">
                {{{footer}}}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`,
  header: `<div class="brand-mark">{{{brandMark}}}</div>
<div class="subject">{{subject}}</div>`,
  footer: `Esta mensagem foi enviada automaticamente pela plataforma {{brandName}}.`,
};

export function renderMailTemplate(input: RenderMailTemplateInput): string {
  const { subject, body, layout, brandName, lang, logoUrl, primaryColor, primaryForeground } = input;

  const content = body?.trim() || '';

  if (!content) {
    return '';
  }

  // Corpo que ja e um documento completo passa direto: envolve-lo produziria
  // HTML aninhado invalido. Vale para campanhas e HTML importado de fora.
  if (isFullHtmlDocument(content)) {
    return content;
  }

  const resolvedBrand = brandName?.trim() || DEFAULT_BRAND_NAME;
  const resolvedPrimaryColor = primaryColor?.trim() || DEFAULT_PRIMARY_COLOR;
  const resolvedPrimaryForeground = primaryForeground?.trim() || DEFAULT_PRIMARY_FOREGROUND;

  // Layout ausente => padrao embutido por inteiro. Layout presente => usado como
  // veio: um header vazio salvo pelo admin e uma escolha valida, nao um buraco a
  // preencher com o padrao.
  const resolved = layout ?? DEFAULT_MAIL_LAYOUT;
  const wrapper = resolved.wrapper || '';

  // Sem wrapper nao ha o que envolver.
  if (!wrapper.trim()) {
    return content;
  }

  const scalars: Record<string, string> = {
    subject: escapeHtml(subject?.trim() || resolvedBrand),
    brandName: escapeHtml(resolvedBrand),
    brandMark: buildBrandMark({
      logoUrl,
      brandName: resolvedBrand,
      primaryColor: resolvedPrimaryColor,
      primaryForeground: resolvedPrimaryForeground,
    }),
    primaryColor: escapeHtml(resolvedPrimaryColor),
    primaryForeground: escapeHtml(resolvedPrimaryForeground),
    year: String(new Date().getFullYear()),
    lang: lang?.trim() || 'en',
  };

  // A ordem abaixo importa. Escalares primeiro, em cada fragmento isoladamente,
  // depois header/footer no wrapper e o conteudo POR ULTIMO: assim o corpo (que
  // ja passou pelo Handlebars e e texto do usuario) nunca e reexaminado em busca
  // de tokens.
  const header = applyScalars(resolved.header || '', scalars);
  const footer = applyScalars(resolved.footer || '', scalars);

  let html = applyScalars(wrapper, scalars);
  html = substituteToken(html, 'header', header);
  html = substituteToken(html, 'footer', footer);
  html = substituteToken(html, 'content', content);

  return html;
}
