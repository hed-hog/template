import { execSync } from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

type BuildCache = Record<string, string>;
type HedHogConfig = { buildCache?: BuildCache };

const IGNORED_DIRECTORIES = ['node_modules', 'dist', 'build', '.git', '.next'];
const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.json'];

/**
 * Sleeps synchronously without burning CPU
 */
function sleepMs(ms: number): void {
  const shared = new SharedArrayBuffer(4);
  const view = new Int32Array(shared);
  Atomics.wait(view, 0, 0, ms);
}

/**
 * Reads and parses a JSON file
 */
function readJsonFile<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
}

/**
 * Returns true when a process id appears to still be running
 */
function isProcessRunning(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) {
    return false;
  }

  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Finds the workspace root by looking for pnpm-workspace.yaml
 */
function findWorkspaceRoot(): string {
  let currentDir = process.cwd();
  
  while (currentDir !== path.parse(currentDir).root) {
    if (fs.existsSync(path.join(currentDir, 'pnpm-workspace.yaml'))) {
      return currentDir;
    }
    currentDir = path.dirname(currentDir);
  }
  
  throw new Error('Workspace root not found (no pnpm-workspace.yaml)');
}

const WORKSPACE_ROOT = findWorkspaceRoot();
const CACHE_FILE_PATH = path.resolve(WORKSPACE_ROOT, 'hedhog.json');
const CACHE_LOCK_FILE_PATH = `${CACHE_FILE_PATH}.lock`;

function withCacheFileLock<T>(operation: () => T): T {
  cleanupStaleLock(CACHE_LOCK_FILE_PATH);
  const start = Date.now();
  let lockAcquired = false;

  while (!lockAcquired) {
    try {
      const fd = fs.openSync(CACHE_LOCK_FILE_PATH, 'wx');
      fs.writeFileSync(fd, String(process.pid));
      fs.closeSync(fd);
      lockAcquired = true;
    } catch {
      cleanupStaleLock(CACHE_LOCK_FILE_PATH);

      if (Date.now() - start > 30000) {
        throw new Error('Timed out waiting for build cache lock.');
      }

      sleepMs(50);
    }
  }

  try {
    return operation();
  } finally {
    try {
      if (lockAcquired && fs.existsSync(CACHE_LOCK_FILE_PATH)) {
        fs.unlinkSync(CACHE_LOCK_FILE_PATH);
      }
    } catch {
      // ignore
    }
  }
}

/**
 * Deletes the TypeScript build info file if it exists
 */
function deleteTsBuildInfo(targetDir: string): void {
  const tsBuildInfoPath = path.join(targetDir, 'tsconfig.production.tsbuildinfo');
  
  if (fs.existsSync(tsBuildInfoPath)) {
    fs.unlinkSync(tsBuildInfoPath);
    console.log(`File deleted: ${tsBuildInfoPath}`);
  }
}

/**
 * Calculates MD5 hash of all source files in a directory
 */
function calculateDirectoryHash(dirPath: string): string {
  const hash = crypto.createHash('md5');

  function processDirectory(currentPath: string): void {
    const items = fs
      .readdirSync(currentPath, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name));

    for (const item of items) {
      const fullPath = path.join(currentPath, item.name);

      if (item.isDirectory()) {
        if (!IGNORED_DIRECTORIES.includes(item.name)) {
          processDirectory(fullPath);
        }
      } else if (item.isFile()) {
        const ext = path.extname(item.name);
        if (SOURCE_EXTENSIONS.includes(ext)) {
          const content = fs.readFileSync(fullPath, 'utf-8');
          hash.update(content);
        }
      }
    }
  }

  processDirectory(dirPath);
  return hash.digest('hex');
}

/**
 * Loads the build cache from hedhog.json
 */
function loadCache(): BuildCache {
  try {
    return withCacheFileLock(() => {
      if (fs.existsSync(CACHE_FILE_PATH)) {
        const cacheData: HedHogConfig = readJsonFile<HedHogConfig>(CACHE_FILE_PATH);
        return cacheData.buildCache || {};
      }

      return {};
    });
  } catch (error) {
    console.warn('Error loading cache:', error);
    return {};
  }
}

/**
 * Saves the build cache to hedhog.json
 */
function saveCache(cache: BuildCache): void {
  try {
    withCacheFileLock(() => {
      let hedHogConfig: HedHogConfig = {};

      if (fs.existsSync(CACHE_FILE_PATH)) {
        try {
          hedHogConfig = readJsonFile<HedHogConfig>(CACHE_FILE_PATH);
        } catch {
          hedHogConfig = {};
        }
      }

      hedHogConfig = { ...hedHogConfig, buildCache: cache };
      const tempFilePath = `${CACHE_FILE_PATH}.${process.pid}.tmp`;
      fs.writeFileSync(tempFilePath, JSON.stringify(hedHogConfig, null, 2));
      fs.renameSync(tempFilePath, CACHE_FILE_PATH);
    });
  } catch (error) {
    console.error('Error saving cache:', error);
  }
}

/**
 * Resolves the package directory path (checks libraries/ then packages/)
 */
function resolvePackagePath(packageName: string): string | null {
  const libraryPath = path.resolve(WORKSPACE_ROOT, `libraries/${packageName}`);
  
  if (fs.existsSync(libraryPath)) {
    return libraryPath;
  }

  const packagePath = path.resolve(WORKSPACE_ROOT, `packages/${packageName}`);
  
  if (fs.existsSync(packagePath)) {
    return packagePath;
  }

  return null;
}

/**
 * Extracts workspace dependencies from package.json
 */
function getWorkspaceDependencies(packageJsonPath: string): string[] {
  const packageJson = readJsonFile<Record<string, Record<string, string>>>(packageJsonPath);
  const dependencyGroups = [
    packageJson.dependencies || {},
    packageJson.devDependencies || {},
    packageJson.peerDependencies || {},
    packageJson.optionalDependencies || {},
  ];

  const workspaceDeps = new Set<string>();

  for (const group of dependencyGroups) {
    for (const [depName, version] of Object.entries(group)) {
      if (version === 'workspace:*' && /^@hed-hog(-pro)?\//.test(depName)) {
        workspaceDeps.add(depName.replace(/^@hed-hog(-pro)?\//, ''));
      }
    }
  }

  return [...workspaceDeps];
}

/**
 * Checks whether package build outputs expected by package.json are available
 */
function hasBuildArtifacts(depPath: string): boolean {
  const packageJsonPath = path.join(depPath, 'package.json');

  if (!fs.existsSync(packageJsonPath)) {
    return false;
  }

  const packageJson = readJsonFile<{
    main?: string;
    types?: string;
    exports?: Record<string, unknown>;
  }>(packageJsonPath);

  const expectedFiles = [packageJson.main, packageJson.types]
    .filter((value): value is string => Boolean(value))
    .map((relativePath) => path.resolve(depPath, relativePath));

  if (expectedFiles.length > 0) {
    return expectedFiles.every((filePath) => fs.existsSync(filePath));
  }

  const distPath = path.join(depPath, 'dist');
  if (!fs.existsSync(distPath)) {
    return false;
  }

  const distFiles = fs.readdirSync(distPath);
  return distFiles.some((fileName) => fileName.endsWith('.js') || fileName.endsWith('.d.ts'));
}

/**
 * Removes stale lock files left by dead processes
 */
function cleanupStaleLock(lockFile: string): void {
  if (!fs.existsSync(lockFile)) {
    return;
  }

  try {
    const lockPid = Number(fs.readFileSync(lockFile, 'utf-8').trim());

    if (!isProcessRunning(lockPid)) {
      fs.unlinkSync(lockFile);
      console.warn(`Removed stale lock file: ${path.basename(lockFile)}`);
    }
  } catch {
    try {
      fs.unlinkSync(lockFile);
      console.warn(`Removed unreadable lock file: ${path.basename(lockFile)}`);
    } catch {
      // ignore
    }
  }
}

/**
 * Returns the path to the lock file for a given dependency
 */
function getLockFilePath(dep: string): string {
  return path.resolve(WORKSPACE_ROOT, `.build-lock-${dep}`);
}

/**
 * Waits until the lock file for a dependency is gone (up to timeoutMs)
 */
function waitForLock(dep: string, timeoutMs = 120000): void {
  const lockFile = getLockFilePath(dep);
  const start = Date.now();
  while (fs.existsSync(lockFile)) {
    if (Date.now() - start > timeoutMs) {
      console.warn(`Lock wait timeout for ${dep}, proceeding anyway.`);
      break;
    }
    sleepMs(200);
  }
}

/**
 * Builds a single dependency if its cache is invalid
 */
function buildDependency(dep: string, cache: BuildCache): boolean {
  const depPath = resolvePackagePath(dep);

  if (!depPath) {
    console.warn(`Package directory not found for dependency: ${dep}`);
    return true; // Continue with other dependencies
  }

  const depPackageJson = readJsonFile<{ scripts?: Record<string, string> }>(
    path.join(depPath, 'package.json'),
  );

  if (!depPackageJson.scripts?.build) {
    console.log(`No build script for ${dep}, skipping.`);
    return true;
  }

  const lockFile = getLockFilePath(dep);
  cleanupStaleLock(lockFile);

  // If another process is already building this dependency, wait for it
  if (fs.existsSync(lockFile)) {
    console.log(`Waiting for concurrent build of ${dep} to finish...`);
    waitForLock(dep);
    // Re-load cache after waiting; the other process likely updated it
    const freshCache = loadCache();
    const freshHash = calculateDirectoryHash(depPath);
    if (freshCache[dep] === freshHash && hasBuildArtifacts(depPath)) {
      console.log(`Valid cache for ${dep} after waiting, skipping build.`);
      cache[dep] = freshCache[dep];
      return true;
    }
  }

  const currentHash = calculateDirectoryHash(depPath);
  const cachedHash = cache[dep];

  if (cachedHash === currentHash && hasBuildArtifacts(depPath)) {
    console.log(`Valid cache for ${dep}, skipping build.`);
    return true;
  }

  if (cachedHash === currentHash) {
    console.log(`Cache hash matched for ${dep}, but build artifacts are missing. Rebuilding...`);
  }

  // Acquire lock
  let lockAcquired = false;
  try {
    const lockFd = fs.openSync(lockFile, 'wx');
    fs.writeFileSync(lockFd, String(process.pid));
    fs.closeSync(lockFd);
    lockAcquired = true;
  } catch {
    // If lock already exists, wait and retry once with fresh state
    if (fs.existsSync(lockFile)) {
      waitForLock(dep);
      const freshCache = loadCache();
      const freshHash = calculateDirectoryHash(depPath);
      if (freshCache[dep] === freshHash && hasBuildArtifacts(depPath)) {
        console.log(`Valid cache for ${dep} after lock release, skipping build.`);
        cache[dep] = freshCache[dep];
        return true;
      }
      try {
        const retryFd = fs.openSync(lockFile, 'wx');
        fs.writeFileSync(retryFd, String(process.pid));
        fs.closeSync(retryFd);
        lockAcquired = true;
      } catch {
        console.warn(`Could not acquire lock for ${dep}, continuing without lock.`);
      }
    }
  }

  try {
    // Avoid stale incremental metadata skipping emits when dist was cleaned.
    deleteTsBuildInfo(depPath);
    console.log(`Building dependency: ${dep}`);
    execSync('pnpm run build', { cwd: depPath, stdio: 'inherit' });

    cache[dep] = currentHash;
    saveCache(cache);
    return true;
  } catch (error) {
    console.error(`Error building ${dep}:`, error);
    return false;
  } finally {
    // Release lock
    try {
      if (lockAcquired && fs.existsSync(lockFile)) {
        fs.unlinkSync(lockFile);
      }
    } catch { /* ignore */ }
  }
}

/**
 * Main function to build workspace dependencies
 */
function buildWorkspaceDependencies(packageName: string): void {
  if (!packageName) {
    console.error('Please provide the package name as an argument.');
    process.exit(1);
  }

  const packageJsonPath = path.resolve(WORKSPACE_ROOT, `${packageName}/package.json`);
  const packageDir = path.dirname(packageJsonPath);

  // Clear local package incremental metadata before dependency orchestration.
  deleteTsBuildInfo(packageDir);

  if (!fs.existsSync(packageJsonPath)) {
    console.error(`package.json file not found at: ${packageJsonPath}`);
    process.exit(1);
  }

  const workspaceDeps = getWorkspaceDependencies(packageJsonPath);

  if (workspaceDeps.length === 0) {
    console.log('\x1b[33m%s\x1b[0m', 'No dependencies with version "workspace:*" found.');
    return;
  }

  const cache = loadCache();

  for (const dep of workspaceDeps) {
    const success = buildDependency(dep, cache);
    if (!success) {
      process.exit(1);
    }
  }
}

// Entry point
const [, , packageName] = process.argv;
buildWorkspaceDependencies(String(packageName));