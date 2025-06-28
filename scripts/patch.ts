import * as fs from 'fs';
import * as path from 'path';

// Recebe o nome do diretório do pacote como argumento
const [, , packageDirName] = process.argv;

    console.log({packageDirName})

if (!packageDirName) {
    console.error('Por favor, forneça o nome do diretório do pacote como argumento.');
    process.exit(1);
}

// Caminho base dos pacotes
const packagesBaseDir = path.resolve(__dirname, '../packages');
const targetDir = path.join(packagesBaseDir, packageDirName);
const packageJsonPath = path.join(targetDir, 'package.json');

// Verifica se o package.json existe
if (!fs.existsSync(packageJsonPath)) {
    console.error(`package.json não encontrado em: ${packageJsonPath}`);
    process.exit(1);
}

// Lê o package.json
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

// Faz o patch na versão
if (!packageJson.version) {
    console.error('Campo "version" não encontrado no package.json.');
    process.exit(1);
}

const versionParts = packageJson.version.split('.').map(Number);
if (versionParts.length !== 3 || versionParts.some(isNaN)) {
    console.error('Formato de versão inválido no package.json.');
    process.exit(1);
}

versionParts[2] += 1; // Incrementa o patch
packageJson.version = versionParts.join('.');

// Escreve de volta no package.json
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n', 'utf-8');
console.log(`Versão atualizada para ${packageJson.version} em ${packageJsonPath}`);