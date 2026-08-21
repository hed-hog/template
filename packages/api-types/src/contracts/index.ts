/**
 * Contratos de request/response compartilhados entre backend e frontend.
 *
 * Diferente dos demais arquivos deste pacote (tipos com formato de linha de
 * tabela, gerados por introspecção do banco), este submódulo é escrito à mão e
 * descreve os CONTRATOS DE API (envelopes de resposta e formato de erro) usando
 * zod, servindo como fonte única de verdade para os testes de contrato dos dois
 * lados. Reexportado pela entrada principal: `import { paginationEnvelope } from '@hed-hog/api-types'`.
 */
export * from './pagination';
export * from './error';
export * from './crypto';
