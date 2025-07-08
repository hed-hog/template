import * as fs from 'fs';
import * as path from 'path';

// Caminhos dos arquivos
const envPath = path.resolve(__dirname, '../apps/api/.env');
const schemaPath = path.resolve(__dirname, '../apps/api/prisma/schema.prisma');

console.log({
    envPath,
    schemaPath
})

// Lê o arquivo .env e verifica o provider
function getDatabaseProvider(envFile: string): 'postgresql' | 'mysql' | null {
    if (!fs.existsSync(envFile)) return null;
    const envContent = fs.readFileSync(envFile, 'utf-8');
    const match = envContent.match(/^DATABASE_URL\s*=\s*["']?(.*)["']?/m);
    if (!match) return null;
    const url = match[1];
    if (!url) return null;
    if (url.startsWith('postgres://') || url.startsWith('postgresql://')) return 'postgresql';
    if (url.startsWith('mysql://')) return 'mysql';
    return null;
}

const provider = getDatabaseProvider(envPath);

if (!provider) {
    console.error('Não foi possível determinar o provider do banco de dados a partir do .env.');
    process.exit(1);
}

const schemaContent = `generator client {
    provider = "prisma-client-js"
}

datasource db {
    provider = "${provider}"
    url      = env("DATABASE_URL")
}
`;

fs.writeFileSync(schemaPath, schemaContent, 'utf-8');
console.log(`Arquivo schema.prisma redefinido com provider: ${provider}`);