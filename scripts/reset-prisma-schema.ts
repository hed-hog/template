import * as fs from 'fs';
import * as path from 'path';

type DatabaseProvider = 'postgresql' | 'mysql';

const PROJECT_ROOT = path.resolve(__dirname, '..');
const ENV_PATH = path.resolve(PROJECT_ROOT, 'apps/api/.env');
const SCHEMA_PATH = path.resolve(PROJECT_ROOT, 'apps/api/prisma/schema.prisma');
const DATABASE_URL_REGEX = /^DATABASE_URL\s*=\s*["']?(.*)["']?/m;

/**
 * Extracts the database URL from .env file content
 */
function extractDatabaseUrl(envContent: string): string | null {
  const match = envContent.match(DATABASE_URL_REGEX);
  return match?.[1] || null;
}

/**
 * Determines the database provider from a connection URL
 */
function getProviderFromUrl(url: string): DatabaseProvider | null {
  if (url.startsWith('postgres://') || url.startsWith('postgresql://')) {
    return 'postgresql';
  }
  if (url.startsWith('mysql://')) {
    return 'mysql';
  }
  return null;
}

/**
 * Reads the .env file and determines the database provider
 */
function getDatabaseProvider(envFile: string): DatabaseProvider | null {
  if (!fs.existsSync(envFile)) {
    return null;
  }

  const envContent = fs.readFileSync(envFile, 'utf-8');
  const url = extractDatabaseUrl(envContent);

  if (!url) {
    return null;
  }

  return getProviderFromUrl(url);
}

/**
 * Generates the Prisma schema content with the specified provider
 */
function generateSchemaContent(provider: DatabaseProvider): string {
  return `generator client {
    provider = "prisma-client-js"
    output   = "../../../node_modules/.prisma/client"
}

datasource db {
    provider = "${provider}"
    url      = env("DATABASE_URL")
}
`;
}

/**
 * Writes the Prisma schema file with the detected provider
 */
function writePrismaSchema(schemaPath: string, provider: DatabaseProvider): void {
  const schemaContent = generateSchemaContent(provider);
  fs.writeFileSync(schemaPath, schemaContent, 'utf-8');
}

/**
 * Resets the Prisma schema with the database provider from .env
 */
function resetPrismaSchema(): void {
  const provider = getDatabaseProvider(ENV_PATH);

  if (!provider) {
    console.error('Unable to determine the database provider from .env file.');
    process.exit(1);
  }

  writePrismaSchema(SCHEMA_PATH, provider);
  console.log(`schema.prisma reset with provider: ${provider}`);
}

// Entry point
resetPrismaSchema();