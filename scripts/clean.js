const fs = require('fs');
const path = require('path');

const rootDir = process.cwd();
const appsDir = path.join(rootDir, 'apps');
const packagesDir = path.join(rootDir, 'packages');

function removeIfExists(targetPath) {
  if (!fs.existsSync(targetPath)) return;
  const stat = fs.statSync(targetPath);
  fs.rmSync(targetPath, { recursive: stat.isDirectory(), force: true });
}

function resetInDir(dir) {
  [
    'node_modules',
    'pnpm-lock.yaml',
    'package-lock.json',
    'dist',
    '.turbo',
  ].forEach((file) => removeIfExists(path.join(dir, file)));
  console.log(`Reset: ${dir}`);
  removeGeneratedFromSrc(path.join(dir, 'src'));
}

function resetInSubDirs(parentDir) {
  if (!fs.existsSync(parentDir)) return;
  fs.readdirSync(parentDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .forEach((entry) => resetInDir(path.join(parentDir, entry.name)));
}

function removeTsBuildInfoFiles(dir) {
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      removeTsBuildInfoFiles(fullPath);
    } else if (entry.name === 'tsconfig.tsbuildinfo') {
      removeIfExists(fullPath);
      console.log(`Removed: ${fullPath}`);
    }
  });
}

// NOVA FUNÇÃO: Remove arquivos .js, .d.ts, .d.ts.map da pasta src
function removeGeneratedFromSrc(srcDir) {
  if (!fs.existsSync(srcDir)) return;
  fs.readdirSync(srcDir, { withFileTypes: true }).forEach((entry) => {
    const fullPath = path.join(srcDir, entry.name);
    if (entry.isDirectory()) {
      // Recursively search in subdirectories
      removeGeneratedFromSrc(fullPath);
    }
    if (
      entry.isFile() &&
      (entry.name.endsWith('.js') ||
        entry.name.endsWith('.d.ts') ||
        entry.name.endsWith('.d.ts.map') ||
        entry.name.endsWith('.js.map'))
    ) {
      removeIfExists(fullPath);
      console.log(`Removed generated: ${fullPath}`);
    }
  });
}

// Reset root
resetInDir(rootDir);

// Remove tsconfig.tsbuildinfo from all apps and packages
[appsDir, packagesDir].forEach(removeTsBuildInfoFiles);

// Reset each app and package (e também limpa src)
[appsDir, packagesDir].forEach(resetInSubDirs);

console.log('==========================');
console.log('\x1b[32m%s\x1b[0m', 'Press any key to finish...');
process.stdin.setRawMode(true);
process.stdin.resume();
process.stdin.on('data', () => {
  console.clear();
  process.exit(0);
});
