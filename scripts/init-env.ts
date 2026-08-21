import { randomBytes } from 'crypto';
import { promises as fs } from 'fs';
import * as path from 'path';

function generateSecret(): string {
  return randomBytes(32).toString('base64');
}

/**
 * Replaces `KEY="generate"` / `KEY=generate` with a fresh random value.
 *
 * Secrets are generated per checkout rather than shipped in .env.example:
 * a real value committed there would hand every user of this template the
 * same encryption key, JWT secret and password pepper.
 */
function materializeSecrets(contents: string): string {
  return contents.replace(
    /^([A-Z0-9_]+)=(["']?)generate\2\s*$/gm,
    (_match, key: string, quote: string) =>
      `${key}=${quote}${generateSecret()}${quote}`
  );
}

async function copyEnvExampleToEnv(appsDir: string) {
  try {
    const apps = await fs.readdir(appsDir, { withFileTypes: true });
    for (const app of apps) {
      if (app.isDirectory()) {
        const appPath = path.join(appsDir, app.name);
        const envExamplePath = path.join(appPath, '.env.example');
        const envPath = path.join(appPath, '.env');
        try {
          await fs.access(envExamplePath);
          // Only create if .env does not exist
          try {
            await fs.access(envPath);
            console.log(`.env already exists in ${appPath}, skipping.`);
          } catch {
            const example = await fs.readFile(envExamplePath, 'utf8');
            await fs.writeFile(envPath, materializeSecrets(example), 'utf8');
            console.log(`Created .env in ${appPath}`);
          }
        } catch {
          // .env.example does not exist, skip
        }
      }
    }
  } catch (err) {
    console.error('Error initializing .env files:', err);
  }
}

// Use process.cwd() que funciona em ambos CommonJS e ESM
const appsDir = path.resolve(process.cwd(), 'apps');

copyEnvExampleToEnv(appsDir);
