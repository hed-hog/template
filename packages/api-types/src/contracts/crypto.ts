import { z } from 'zod';

/**
 * Contratos de criptografia zero-knowledge do módulo Vaults, compartilhados entre
 * backend (validação/persistência dos blobs) e frontend (WebCrypto). Nenhum destes
 * tipos contém segredo em claro: o servidor só vê ciphertext + metadados.
 *
 * Escrito à mão (zod), como os demais contracts. Reexportado por `@hed-hog/api-types`.
 */

/** Papéis de um membro dentro de um cofre (hierarquia OWNER > ADMIN > EDITOR > READER). */
export const vaultRoleSchema = z.enum(['OWNER', 'ADMIN', 'EDITOR', 'READER']);
export type VaultRole = z.infer<typeof vaultRoleSchema>;

/** Ações registradas no audit log (vault_activity.action). */
export const vaultActionSchema = z.enum([
  'CREATE_VAULT',
  'UPDATE_VAULT',
  'DELETE_VAULT',
  'SHARE_VAULT',
  'UNSHARE_VAULT',
  // Saída por reset do keystore: diferente de UNSHARE_VAULT, ninguém revogou o
  // acesso e a vault key NÃO foi rotacionada.
  'LEAVE_VAULT',
  'CHANGE_ROLE',
  'CREATE_SECRET',
  // Uma linha por LOTE importado, não por segredo: importar centenas de itens
  // com CREATE_SECRET tornaria o histórico do cofre ilegível justamente no dia
  // em que ele mais precisa ser auditável.
  'IMPORT_SECRETS',
  'UPDATE_SECRET',
  'DELETE_SECRET',
  'MOVE_SECRET',
  'SHARE_SECRET',
  'UNSHARE_SECRET',
  'VIEW_SHARED_SECRET',
  'ACCESS_VAULT',
  'VIEW_SECRET',
  'REVEAL_SECRET',
  'ADD_ATTACHMENT',
  'REMOVE_ATTACHMENT',
  'DOWNLOAD_ATTACHMENT',
]);
export type VaultAction = z.infer<typeof vaultActionSchema>;

/**
 * Ações de leitura (quem abriu o quê). São de alto volume e visíveis apenas para
 * ADMIN/OWNER do cofre; o restante do audit log é visível a qualquer membro.
 */
export const VAULT_ACCESS_ACTIONS = [
  'ACCESS_VAULT',
  'VIEW_SECRET',
  'REVEAL_SECRET',
  'DOWNLOAD_ATTACHMENT',
] as const satisfies readonly VaultAction[];

/** Ações de mutação (o que mudou). Complemento de `VAULT_ACCESS_ACTIONS`. */
export const VAULT_CHANGE_ACTIONS = vaultActionSchema.options.filter(
  (action) => !(VAULT_ACCESS_ACTIONS as readonly string[]).includes(action),
);

/**
 * Janelas de deduplicação das ações de leitura: dentro delas, repetir a mesma ação
 * não gera uma nova linha. O frontend espelha estes valores para não fazer requisição
 * que o servidor vai descartar.
 */
export const ACCESS_VAULT_WINDOW_MINUTES = 30;
export const SECRET_ACCESS_WINDOW_MINUTES = 5;

/**
 * Teto do anexo, medido no arquivo ORIGINAL (o envelope acrescenta 29 bytes: versão,
 * IV e tag GCM). Independente do setting `storage-max-size`, que é editável na UI e
 * vale para o produto inteiro — o limite do cofre não pode depender de um checkbox.
 */
export const VAULT_ATTACHMENT_MAX_BYTES = 25 * 1024 * 1024;

/**
 * Teto de anexos por segredo. Cada anexo carrega ~250 bytes de referência (chave,
 * nome, mimetype) dentro do blob do segredo, e esse blob é decifrado inteiro a cada
 * carregamento da lista.
 */
export const VAULT_ATTACHMENT_MAX_PER_SECRET = 20;

const vaultChangeSchema = z.object({
  from: z.union([z.string(), z.number(), z.null()]),
  to: z.union([z.string(), z.number(), z.null()]),
});

/** Ícone (arquivo), ícone (slug lucide) e cor viajam juntos: o preview precisa dos três. */
const vaultAppearanceSchema = z.object({
  icon: z.number().nullable(),
  icon_slug: z.string().nullable(),
  color: z.string().nullable(),
});

/**
 * Origem e destino de um MOVE_SECRET. Os NOMES vão desnormalizados de propósito:
 * `vault_activity.vault_id` é CASCADE, então apagar o cofre de origem leva a linha
 * de lá junto — e a linha que sobra, no destino, precisa continuar dizendo de onde
 * o segredo veio.
 */
const vaultMoveSchema = z.object({
  from_vault_id: z.number().int(),
  from_vault_name: z.string().nullable(),
  to_vault_id: z.number().int(),
  to_vault_name: z.string().nullable(),
  /** Compartilhamentos ativos revogados pelo movimento. */
  revoked_shares: z.number().int().nonnegative(),
});

/** Gerenciadores de senha aceitos como origem de uma importação em massa. */
export const vaultImportSourceSchema = z.enum([
  'chrome',
  'onepassword',
  'keepass',
  'bitwarden',
  'lastpass',
  'csv',
]);
export type VaultImportSource = z.infer<typeof vaultImportSourceSchema>;

/**
 * Resumo de um lote de IMPORT_SECRETS. `source` é apenas o rótulo declarado pelo
 * cliente para o texto do histórico — o servidor não tem como verificá-lo (os
 * blobs são opacos) e nada depende dele além da tradução da linha.
 */
const vaultImportSchema = z.object({
  count: z.number().int().nonnegative(),
  source: vaultImportSourceSchema.nullable().optional(),
});
export type VaultImport = z.infer<typeof vaultImportSchema>;

/** Teto de segredos por chamada de POST /secrets/bulk. O cliente fatia por este número. */
export const VAULT_IMPORT_BATCH_MAX_ITEMS = 100;

/**
 * Teto de destinatários por chamada de POST /vaults/:id/share/bulk.
 *
 * Cada entrada carrega uma vault key embrulhada e vira um INSERT dentro da MESMA
 * transação: o limite existe para o corpo da requisição e a duração da transação
 * não dependerem só do limite de body do servidor. O cliente fatia por este número.
 */
export const VAULT_BULK_SHARE_MAX_MEMBERS = 100;

/**
 * Teto do ciphertext de um segredo importado, em caracteres Base64 (~150 KB de
 * plaintext). Não existe no POST unitário: aqui ele importa porque um lote
 * multiplica o pior caso por `VAULT_IMPORT_BATCH_MAX_ITEMS`.
 */
export const VAULT_IMPORT_MAX_CIPHERTEXT_CHARS = 200_000;

/**
 * Detalhe opcional de uma linha do audit log (coluna `vault_activity.metadata`).
 * Só metadados que o servidor já vê em claro — nunca conteúdo de segredo.
 */
export const vaultActivityMetadataSchema = z.object({
  v: z.literal(1),
  /** Nome do segredo no momento da ação; sobrevive ao DELETE (a FK vira NULL). */
  secret_name: z.string().optional(),
  /** Preenchido só em MOVE_SECRET. */
  move: vaultMoveSchema.optional(),
  /** Preenchido só em IMPORT_SECRETS. */
  import: vaultImportSchema.optional(),
  changes: z
    .object({
      name: vaultChangeSchema.optional(),
      appearance: z
        .object({
          fields: z.array(z.enum(['icon', 'icon_slug', 'color'])),
          from: vaultAppearanceSchema,
          to: vaultAppearanceSchema,
        })
        .optional(),
    })
    .optional(),
});
export type VaultActivityMetadata = z.infer<typeof vaultActivityMetadataSchema>;
export type VaultAppearance = z.infer<typeof vaultAppearanceSchema>;
export type VaultMove = z.infer<typeof vaultMoveSchema>;

/**
 * Modo de um compartilhamento individual de segredo (tabela secret_share):
 *  USER — share key embrulhada (ECIES) para a chave pública de um usuário do sistema;
 *  LINK — share key derivada do fragmento da URL, que nunca chega ao servidor.
 */
export const secretShareModeSchema = z.enum(['USER', 'LINK']);
export type SecretShareMode = z.infer<typeof secretShareModeSchema>;

/**
 * Envelope único de dados cifrados usado em todo o sistema. Todos os campos em
 * Base64. `salt` é opcional (presente quando o blob deriva chave por KDF, ausente
 * quando é apenas AES-GCM com chave já disponível).
 */
export const encryptedDataSchema = z.object({
  ciphertext: z.string(),
  iv: z.string(),
  salt: z.string().optional(),
});
export type EncryptedData = z.infer<typeof encryptedDataSchema>;

/** Parâmetros do KDF (Argon2id) persistidos junto ao bundle para reproduzir a derivação. */
export const kdfParamsSchema = z.object({
  memory: z.number().int().positive(),
  iterations: z.number().int().positive(),
  parallelism: z.number().int().positive(),
  hashLength: z.number().int().positive(),
});
export type KdfParams = z.infer<typeof kdfParamsSchema>;

/**
 * Bundle criptográfico do usuário (tabela user_crypto), em camelCase, como servido
 * por GET /crypto/me e enviado por POST /crypto/setup. A private key trafega SEMPRE
 * cifrada; a senha e a master key NUNCA chegam ao servidor.
 */
export const cryptoBundleSchema = z.object({
  publicKey: z.string(),
  encryptedPrivateKey: z.string(),
  privateKeyIv: z.string(),
  privateKeySalt: z.string(),
  kdfAlgorithm: z.string().default('argon2id'),
  kdfParams: kdfParamsSchema,
});
export type CryptoBundle = z.infer<typeof cryptoBundleSchema>;
