import { describe, expect, it } from '@jest/globals';
import { MailService } from './mail.service';

const htmlToPlainText = (html: string): string =>
  (MailService as any).htmlToPlainText(html);

const extractProviderMessageId = (result: any): string | null =>
  (MailService as any).extractProviderMessageId(result);

const splitAddresses = (value?: any): string[] =>
  (MailService as any).splitAddresses(value);

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

describe('MailService.splitAddresses', () => {
  // O split(';') cru deixava passar o espaco e o SES respondia
  // "InvalidParameterValue: Local address contains control or whitespace".
  it('apara o espaco que sobra depois do ponto-e-virgula', () => {
    expect(splitAddresses('a@x.com; b@x.com')).toEqual(['a@x.com', 'b@x.com']);
    expect(splitAddresses(' a@x.com ')).toEqual(['a@x.com']);
  });

  it('separa por virgula tambem, como as pessoas costumam digitar', () => {
    expect(splitAddresses('a@x.com,b@x.com')).toEqual(['a@x.com', 'b@x.com']);
    expect(splitAddresses('a@x.com, b@x.com; c@x.com')).toEqual([
      'a@x.com',
      'b@x.com',
      'c@x.com',
    ]);
  });

  it('descarta pedacos vazios', () => {
    expect(splitAddresses('a@x.com;')).toEqual(['a@x.com']);
    expect(splitAddresses(';;')).toEqual([]);
    expect(splitAddresses('')).toEqual([]);
    expect(splitAddresses(undefined)).toEqual([]);
    expect(splitAddresses(null)).toEqual([]);
  });

  it('preserva caixa e nome de exibicao, e nao quebra nome com virgula', () => {
    expect(splitAddresses('Nome <A@X.com>')).toEqual(['Nome <A@X.com>']);
    expect(splitAddresses('"Hcode, Ltda" <a@x.com>')).toEqual([
      '"Hcode, Ltda" <a@x.com>',
    ]);
  });

  it('aceita array e remove repetidos ignorando a caixa', () => {
    expect(splitAddresses(['a@x.com', ' A@X.com ', 'b@x.com'])).toEqual([
      'a@x.com',
      'b@x.com',
    ]);
  });
});

describe('MailService.buildMimeMessage', () => {
  const base = {
    from: 'Hub <no-reply@x.com>',
    to: 'aluno@x.com',
    replyTo: 'suporte@x.com',
    subject: 'Sua aula começa em breve',
    body: '<p>Olá</p>',
  };

  it('leva os cabecalhos extras, o Reply-To e a parte texto', async () => {
    const raw = (
      await MailService.buildMimeMessage({
        ...base,
        headers: {
          'List-Unsubscribe': '<https://api.x.com/mail/unsubscribe/abc>',
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      })
    ).toString();

    expect(raw).toContain('List-Unsubscribe: <https://api.x.com/mail/unsubscribe/abc>');
    expect(raw).toContain('List-Unsubscribe-Post: List-Unsubscribe=One-Click');
    expect(raw).toContain('Reply-To: suporte@x.com');
    expect(raw).toContain('multipart/alternative');
    expect(raw).toContain('text/plain');
  });

  it('anexa o arquivo com o content-type informado', async () => {
    const raw = (
      await MailService.buildMimeMessage({
        ...base,
        attachments: [
          {
            filename: 'aula.ics',
            content: Buffer.from('BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n'),
            contentType: 'text/calendar; charset=utf-8; method=PUBLISH',
          },
        ],
      })
    ).toString();

    expect(raw).toContain('multipart/mixed');
    expect(raw).toContain('filename=aula.ics');
    expect(raw).toContain('text/calendar');
  });

  it('so mantem o Bcc no cabecalho quando pedido', async () => {
    const mail = { ...base, bcc: 'oculto@x.com' };

    expect((await MailService.buildMimeMessage(mail)).toString()).not.toContain('oculto@x.com');
    expect(
      (await MailService.buildMimeMessage(mail, { keepBcc: true })).toString(),
    ).toContain('Bcc: oculto@x.com');
  });
});

const formatSesSource = (email: string, name?: string): string =>
  (MailService as any).formatSesSource(email, name);

describe('MailService.formatSesSource', () => {
  it('sem nome, devolve o endereço cru', () => {
    expect(formatSesSource('contato@exemplo.com.br')).toBe('contato@exemplo.com.br');
    expect(formatSesSource('contato@exemplo.com.br', '  ')).toBe('contato@exemplo.com.br');
  });

  it('nome ASCII simples vai sem aspas', () => {
    expect(formatSesSource('contato@exemplo.com.br', 'Compara Hardware')).toBe(
      'Compara Hardware <contato@exemplo.com.br>',
    );
  });

  // O SES recusa caractere fora do ASCII no Source: o nome com acento tem de
  // ir como encoded-word.
  it('nome com acento vai em MIME encoded-word', () => {
    const out = formatSesSource('contato@exemplo.com.br', 'João');
    expect(out).toBe(`=?UTF-8?B?${Buffer.from('João', 'utf8').toString('base64')}?= <contato@exemplo.com.br>`);
  });

  it('nome com vírgula vai entre aspas', () => {
    expect(formatSesSource('a@b.com', 'Hcode, Cursos')).toBe('"Hcode, Cursos" <a@b.com>');
  });

  it('endereço que já tem nome não é embrulhado de novo', () => {
    expect(formatSesSource('Fulano <a@b.com>', 'Outro')).toBe('Fulano <a@b.com>');
  });
});

describe('MailService.send com configuração por envio', () => {
  const globalConfig = {
    type: 'SES',
    region: 'us-east-1',
    accessKeyId: 'A',
    secretAccessKey: 'A',
    from: 'global@hcode.com.br',
  } as any;
  const profileConfig = {
    type: 'SES',
    region: 'us-east-1',
    accessKeyId: 'B',
    secretAccessKey: 'B',
    from: 'contato@comparahardware.com.br',
    fromName: 'Compara Hardware',
  } as any;

  function makeService() {
    const service = new MailService(globalConfig, {} as any, null as any, {} as any);
    const calls: any[] = [];
    (service as any).sendWithSES = async (mail: any, config: any) => {
      calls.push(config);
      // devolve o controle ao event loop, como o SES de verdade
      await new Promise((resolve) => setTimeout(resolve, 5));
      return { result: { MessageId: config.from }, mail };
    };
    return { service, calls };
  }

  const mail = { to: 'x@y.com', subject: 's', body: '<p>b</p>', skipLayout: true, layout: 'x' } as any;

  it('usa a configuração passada e não troca a global', async () => {
    const { service, calls } = makeService();
    await service.send(mail, profileConfig);
    expect(calls[0]).toBe(profileConfig);
    expect((service as any).mailConfig).toBe(globalConfig);
  });

  it('envios simultâneos de perfis diferentes não se misturam', async () => {
    const { service, calls } = makeService();
    const [a, b] = await Promise.all([service.send(mail), service.send(mail, profileConfig)]);
    expect((a as any).result.MessageId).toBe('global@hcode.com.br');
    expect((b as any).result.MessageId).toBe('contato@comparahardware.com.br');
    expect(calls).toEqual(expect.arrayContaining([globalConfig, profileConfig]));
  });
});
