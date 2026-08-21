/**
 * Taxonomia de erro de rede, fora do componente de propósito.
 *
 * Isto não é estado de UI: é a resposta para "a requisição chegou a conversar
 * com o servidor?". Duas decisões diferentes dependem dela — o texto do toast
 * que o próprio provider mostra, e a política de relatório de erro do app
 * hospedeiro (o `apps/class` decide, a partir daqui, o que vai ou não para o
 * Sentry). Enquanto vivia como closure dentro do `AppProvider` só a primeira
 * conseguia usá-la, e o monorepo acumulou cinco cópias divergentes da mesma
 * regra.
 *
 * Funções puras, sem React, para poderem ser testadas direto.
 */

/**
 * Extrai a mensagem legível de um erro do axios, tolerando os três formatos que
 * o backend usa em `message`: string, lista (validação do class-validator) e
 * objeto de campos.
 */
export const getRawErrorMessage = (error: any) => {
  const raw = error?.response?.data?.message ?? error?.message;
  if (typeof raw === 'string') return raw;
  if (Array.isArray(raw)) return raw.join(' ');
  if (raw && typeof raw === 'object') return Object.values(raw).flat().join(' ');
  return '';
};

/**
 * Falha de transporte: a requisição não completou o ciclo com o servidor.
 *
 * `ERR_NETWORK` é o portão real para tudo que passa pelo interceptor do axios —
 * é o código que o axios atribui quando o `onerror` do XHR dispara (conexão
 * caiu, aba fechando, DNS/TLS/CORS quebrado). O regex cobre o caso do `fetch`
 * cru, que não passa pelo interceptor e só tem a mensagem: repare que ele
 * **não** casa `'Network Error'` (com espaço) de propósito — essa frase vem do
 * axios e já está coberta pelo código.
 *
 * Cancelamento (`ERR_CANCELED` / `CanceledError` / `AbortError`) não entra:
 * é a própria tela abortando a requisição, não uma falha. O interceptor já o
 * filtra antes de chegar aqui.
 *
 * Cuidado no uso: `getRawErrorMessage` lê o corpo da resposta, então um 502 com
 * corpo "Connection refused" casa o regex. Quem precisa de certeza de que o
 * servidor não respondeu deve somar `error.response == null`.
 */
export const isNetworkError = (error: any) => {
  if (error?.code === 'ERR_NETWORK') return true;
  const raw = getRawErrorMessage(error);
  return /failed to fetch|networkerror|load failed|fetch failed|connection refused/i.test(
    raw
  );
};

/** Mensagem única para falha de transporte — o aluno não precisa do código. */
export const NETWORK_ERROR_MESSAGE =
  'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.';
