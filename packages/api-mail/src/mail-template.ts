const BRAND_NAME = 'HedHog';

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

export function renderMailTemplate({
  subject,
  body,
}: {
  subject?: string;
  body?: string;
}) {
  const safeSubject = escapeHtml(subject?.trim() || BRAND_NAME);
  const content = body?.trim() || '';

  if (!content) {
    return '';
  }

  if (isFullHtmlDocument(content)) {
    return content;
  }

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="color-scheme" content="light" />
    <meta name="supported-color-schemes" content="light" />
    <title>${safeSubject}</title>
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
        background:
          radial-gradient(circle at top, rgba(245, 158, 11, 0.14), transparent 32%),
          linear-gradient(180deg, #f8fafc 0%, #eef2f7 100%);
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
      .brand {
        display: inline-block;
        padding: 8px 14px;
        border-radius: 999px;
        background: #111827;
        color: #ffffff;
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
        background: linear-gradient(90deg, #f59e0b 0%, #f97316 45%, #ea580c 100%);
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
        color: #c2410c;
        font-weight: 600;
        text-decoration: none;
      }
      .content strong {
        color: #111827;
      }
      .content blockquote {
        padding: 14px 16px;
        border-left: 4px solid #f59e0b;
        border-radius: 0 14px 14px 0;
        background: #fff7ed;
        color: #7c2d12;
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
                <div class="brand">${BRAND_NAME}</div>
                <div class="subject">${safeSubject}</div>
              </td>
            </tr>
            <tr>
              <td>
                <div class="panel">
                  <div class="panel-accent"></div>
                  <div class="content">
                    ${content}
                  </div>
                </div>
              </td>
            </tr>
            <tr>
              <td class="footer">
                Esta mensagem foi enviada automaticamente pela plataforma ${BRAND_NAME}.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
