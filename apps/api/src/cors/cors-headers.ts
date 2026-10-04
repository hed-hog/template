/**
 * Cabeçalhos de requisição aceitos no preflight CORS.
 *
 * Fica fora do `main.ts` pelo mesmo motivo do `cors-origin.ts`: sem import do
 * NestJS nem efeito colateral, a lista pode ser conferida em teste sem subir a
 * aplicação — e é justamente ela que já quebrou o front duas vezes.
 *
 * Um cabeçalho que falta aqui não é ignorado: o navegador reprova o preflight e
 * barra a **requisição inteira**, não só o cabeçalho. O sintoma chega ao usuário
 * como falha de rede ("Não foi possível conectar ao servidor"), apontando para o
 * lado errado do problema — foi assim com os `X-App-*` e depois com o
 * `X-Cms-Site`, que deixou as telas do CMS vazias em produção.
 *
 * Por isso a regra: **todo cabeçalho customizado que qualquer front-end envia
 * precisa estar nesta lista**. Ao acrescentar um cabeçalho no cliente, acrescente
 * aqui na mesma mudança.
 */
export const CORS_ALLOWED_HEADERS = [
  'Content-Type',
  'Authorization',
  'Accept-Language',
  'X-Requested-With',
  // Identificação do dispositivo e do cliente (site x aplicativo, e de qual
  // portal), injetados pelo `AppProvider` de `@hed-hog/next-app-provider`.
  'X-Browser-ID',
  'X-App-Name',
  'X-App-Platform',
  'X-App-Version',
  // Escopo de site do admin do CMS (`CMS_SITE_HEADER` em
  // `libraries/cms/src/site/cms-site-scope.interceptor.ts`). Vale para o módulo
  // inteiro, então viaja em toda chamada do CMS — inclusive nas de outras
  // bibliotecas feitas de dentro dele, como `/core/locales`.
  'X-Cms-Site',
  // Cabecalhos do transporte Streamable HTTP do MCP. O conector remoto do Claude
  // e um cliente de navegador como qualquer outro: sem estes tres no preflight, a
  // conexao falha antes do primeiro JSON-RPC.
  'MCP-Protocol-Version',
  'Mcp-Session-Id',
  'Last-Event-ID',
];
