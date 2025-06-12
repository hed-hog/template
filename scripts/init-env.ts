import { promises as fs } from 'fs';
import * as path from 'path';

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
          // Only copy if .env does not exist
          try {
            await fs.access(envPath);
            console.log(`.env already exists in ${appPath}, skipping.`);
          } catch {
            await fs.copyFile(envExamplePath, envPath);
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

// Ajuste o caminho conforme sua estrutura de monorepo
const appsDir = path.resolve(__dirname, '../apps');

copyEnvExampleToEnv(appsDir);
