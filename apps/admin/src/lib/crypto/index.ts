// A cripto do cofre vive em @hed-hog/vault-crypto (WebCrypto puro, sem React),
// compartilhada com a extensão de navegador. `session` fica aqui porque é estado
// mutável de módulo, específico do runtime do admin.
export * from '@hed-hog/vault-crypto';
export * from './session';
