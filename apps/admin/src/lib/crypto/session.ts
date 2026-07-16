/**
 * Estado criptográfico da sessão — SOMENTE em memória (variáveis de módulo). É
 * perdido no reload da página (aceitável e desejado): nada de senha/chave em
 * localStorage. A "lembrar dispositivo" opcional usa WebAuthn PRF (ver webauthn-prf).
 */

let unlockedPrivateKey: CryptoKey | null = null;
const vaultKeyCache = new Map<number, CryptoKey>();

export function setPrivateKey(key: CryptoKey): void {
  unlockedPrivateKey = key;
}

export function getPrivateKey(): CryptoKey | null {
  return unlockedPrivateKey;
}

export function isUnlocked(): boolean {
  return unlockedPrivateKey !== null;
}

/** Zera todo o material sensível da sessão (logout / lock). */
export function lockSession(): void {
  unlockedPrivateKey = null;
  vaultKeyCache.clear();
}

export function cacheVaultKey(vaultId: number, key: CryptoKey): void {
  vaultKeyCache.set(vaultId, key);
}

export function getCachedVaultKey(vaultId: number): CryptoKey | null {
  return vaultKeyCache.get(vaultId) ?? null;
}
