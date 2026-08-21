/**
 * Idempotent backfill: encrypts at rest the secrets that already exist in Integration
 * Profiles which are still stored in plain text (legacy, pre-encryption).
 *
 * Must run AFTER the code deploy (with the decryption middleware active). Uses a raw
 * PrismaClient (without the middleware) to read/write the actual value. Idempotent:
 * skips values that are already encrypted (enc.v1. prefix) and empty values — safe to
 * rerun with no effect.
 *
 * Usage:
 *   pnpm exec ts-node scripts/encrypt-integration-secrets.ts            # applies
 *   pnpm exec ts-node scripts/encrypt-integration-secrets.ts --dry-run  # report only
 *
 * Requires DATABASE_URL and ENCRYPTION_SECRET in the environment (loads apps/api/.env).
 */
import { PrismaClient } from '@prisma/client';
import { createCipheriv, randomBytes, scryptSync } from 'crypto';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { getSensitiveConfigKeys } from '../libraries/core/src/integration-profile/integration-profile.secrets';

/** Loads apps/api/.env into process.env (without depending on dotenv), without overwriting what already exists. */
function loadEnvFile(path: string) {
  if (!existsSync(path)) return;
  for (const rawLine of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile(resolve(__dirname, '../apps/api/.env'));

const ENC_ENVELOPE_PREFIX = 'enc.v1.';

/** Exactly mirrors SecurityService.encrypt (aes-256-gcm, scrypt, salt:iv:tag:ct). */
function encryptValue(value: string, secret: string): string {
  const salt = randomBytes(16);
  const key = scryptSync(secret, salt, 32);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return (
    ENC_ENVELOPE_PREFIX +
    [
      salt.toString('hex'),
      iv.toString('hex'),
      authTag.toString('hex'),
      encrypted.toString('hex'),
    ].join(':')
  );
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const secret = process.env.ENCRYPTION_SECRET;
  if (!secret || !secret.trim()) {
    throw new Error('ENCRYPTION_SECRET is not configured.');
  }

  const prisma = new PrismaClient();
  let profilesUpdated = 0;
  let secretsEncrypted = 0;
  let secretsSkipped = 0;

  try {
    const profiles = await prisma.integration_profile.findMany({
      select: {
        id: true,
        slug: true,
        config: true,
        integration_provider: { select: { slug: true } },
      },
    });

    for (const profile of profiles) {
      const providerSlug = profile.integration_provider?.slug ?? '';
      const keys = getSensitiveConfigKeys(providerSlug);
      if (keys.length === 0) continue;

      const cfg = (profile.config as Record<string, unknown> | null) ?? null;
      if (!cfg) continue;

      const next = { ...cfg };
      let changed = false;

      for (const k of keys) {
        const v = next[k];
        if (typeof v !== 'string' || v.length === 0) continue;
        if (v.startsWith(ENC_ENVELOPE_PREFIX)) {
          secretsSkipped += 1;
          continue;
        }
        next[k] = encryptValue(v, secret);
        secretsEncrypted += 1;
        changed = true;
      }

      if (changed) {
        profilesUpdated += 1;
        console.log(
          `${dryRun ? '[dry-run] ' : ''}profile #${profile.id} (${profile.slug}) [${providerSlug}]: ` +
            `cifrando ${keys.filter((k) => typeof cfg[k] === 'string' && (cfg[k] as string).length > 0 && !(cfg[k] as string).startsWith(ENC_ENVELOPE_PREFIX)).join(', ')}`,
        );
        if (!dryRun) {
          await prisma.integration_profile.update({
            where: { id: profile.id },
            data: { config: next as object },
          });
        }
      }
    }

    console.log(
      `\n${dryRun ? '[dry-run] ' : ''}Concluído: ${profilesUpdated} perfil(is) atualizado(s), ` +
        `${secretsEncrypted} segredo(s) cifrado(s), ${secretsSkipped} já cifrado(s)/pulado(s).`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
