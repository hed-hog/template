import { describe, expect, it } from '@jest/globals';
import { MailService } from './mail.service';

const htmlToPlainText = (html: string): string =>
  (MailService as any).htmlToPlainText(html);

const extractProviderMessageId = (result: any): string | null =>
  (MailService as any).extractProviderMessageId(result);

describe('MailService.htmlToPlainText', () => {
  it('converte <br> e fechamento de bloco em quebra de linha', () => {
    expect(htmlToPlainText('<p>Olá</p><p>Tudo bem?</p>')).toBe('Olá\nTudo bem?');
    expect(htmlToPlainText('A<br>B<br />C')).toBe('A\nB\nC');
  });

  it('remove style e script inteiros, nao so as tags', () => {
    expect(
      htmlToPlainText('<style>.a{color:red}</style><p>Corpo</p>'),
    ).toBe('Corpo');
    expect(htmlToPlainText('<script>alert(1)</script>Corpo')).toBe('Corpo');
  });

  it('prefixa itens de lista', () => {
    expect(htmlToPlainText('<ul><li>Um</li><li>Dois</li></ul>')).toBe(
      '- Um\n- Dois',
    );
  });

  it('decodifica as entidades mais comuns', () => {
    expect(htmlToPlainText('Caf&eacute; &amp; ch&aacute;')).toBe(
      'Caf&eacute; & ch&aacute;',
    );
    expect(htmlToPlainText('a&nbsp;b &lt;tag&gt; &quot;x&quot; &#39;y&#39;')).toBe(
      'a b <tag> "x" \'y\'',
    );
  });

  it('colapsa linhas em branco excedentes e apara as bordas', () => {
    expect(htmlToPlainText('<p></p><p>A</p><p></p><p></p><p>B</p><p></p>')).toBe(
      'A\n\nB',
    );
  });

  it('nao devolve HTML cru - era isso que pesava no score de spam', () => {
    const out = htmlToPlainText(
      '<table><tr><td><a href="https://x">Clique</a></td></tr></table>',
    );
    expect(out).not.toContain('<');
    expect(out).toContain('Clique');
  });

  it('separa as celulas de um cartao rotulo/valor', () => {
    // Sem a regra de </td> isto saia "NavegadorChrome 151", que e como o
    // alerta de dispositivo novo chegava na alternativa text/plain.
    const out = htmlToPlainText(
      '<table><tr><td>Navegador</td><td>Chrome 151</td></tr>' +
        '<tr><td>Sistema</td><td>Windows 10</td></tr></table>',
    );
    expect(out).toBe('Navegador\tChrome 151\nSistema\tWindows 10');
  });

  it('preserva o emoji da bandeira, que e a unica forma que renderiza em e-mail', () => {
    expect(htmlToPlainText('<p>\u{1F1E7}\u{1F1F7} Sao Paulo, Brasil</p>')).toBe(
      '\u{1F1E7}\u{1F1F7} Sao Paulo, Brasil',
    );
  });
});

describe('MailService.extractProviderMessageId', () => {
  it('le o MessageId do SES', () => {
    expect(extractProviderMessageId({ result: { MessageId: 'ses-1' } })).toBe(
      'ses-1',
    );
  });

  it('le o messageId do nodemailer', () => {
    expect(extractProviderMessageId({ result: { messageId: '<smtp-1>' } })).toBe(
      '<smtp-1>',
    );
  });

  it('le o id da resposta HTTP do Gmail', () => {
    expect(
      extractProviderMessageId({ result: { data: { id: 'gmail-1' } } }),
    ).toBe('gmail-1');
  });

  it('devolve null quando o provedor nao informa id', () => {
    expect(extractProviderMessageId({ result: {} })).toBeNull();
    expect(extractProviderMessageId(undefined)).toBeNull();
    expect(extractProviderMessageId(null)).toBeNull();
  });
});
