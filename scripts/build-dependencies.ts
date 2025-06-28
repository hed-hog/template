import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// Extrai o argumento recebido (nome do pacote)
const [,, packageName] = process.argv;

if (!packageName) {
    console.error('Por favor, forneça o nome do pacote como argumento.');
    process.exit(1);
}

// Caminho para o package.json do pacote informado
const packageJsonPath = path.resolve(__dirname, `../packages/${packageName}/package.json`);

if (!fs.existsSync(packageJsonPath)) {
    console.error(`Arquivo package.json não encontrado em: ${packageJsonPath}`);
    process.exit(1);
}

// Lê e faz o parse do package.json
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

// Filtra as dependências com versão "workspace:*"
const dependencies = packageJson.dependencies || {};
const workspaceDeps = Object.entries(dependencies)
    .filter(([_, version]) => version === 'workspace:*')
    .map(([depName]) => depName.replaceAll('@hed-hog/', ''));

if (workspaceDeps.length === 0) {
    console.log('Nenhuma dependência com versão "workspace:*" encontrada.');
    process.exit(0);
}

// Executa o script "pnpm run build" para cada dependência encontrada
for (const dep of workspaceDeps) {
    const depPath = path.resolve(__dirname, `../packages/${dep}`);
    if (!fs.existsSync(depPath)) {
        console.warn(`Diretório do pacote não encontrado: ${depPath}`);
        continue;
    }
    try {
        console.log(`Executando build para dependência: ${dep}`);
        execSync('pnpm run build', { cwd: depPath, stdio: 'inherit' });
    } catch (error) {
        console.error(`Erro ao executar build para ${dep}:`, error);
        process.exit(1);
    }
}