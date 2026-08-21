import * as fs from 'fs';
import * as path from 'path';

type PackageJson = {
  version?: string;
  [key: string]: any;
};

type VersionParts = [number, number, number];

const SCRIPT_DIR = path.dirname(__filename);
const PACKAGES_BASE_DIR = path.resolve(SCRIPT_DIR, '..');
const SEMVER_PARTS_COUNT = 3;
const PATCH_INDEX = 2;

/**
 * Validates if a version string follows semantic versioning (x.y.z)
 */
function isValidSemanticVersion(version: string): version is string {
  const parts = version.split('.').map(Number);
  return parts.length === SEMVER_PARTS_COUNT && parts.every((part) => !isNaN(part));
}

/**
 * Increments the patch version (x.y.z -> x.y.z+1)
 */
function incrementPatchVersion(version: string): string {
  const versionParts = version.split('.').map(Number) as VersionParts;
  versionParts[PATCH_INDEX] += 1;
  return versionParts.join('.');
}

/**
 * Reads and parses package.json from the given path
 */
function readPackageJson(packageJsonPath: string): PackageJson {
  if (!fs.existsSync(packageJsonPath)) {
    console.error(`package.json not found at: ${packageJsonPath}`);
    process.exit(1);
  }

  return JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
}

/**
 * Validates that package.json has a valid version field
 */
function validatePackageVersion(packageJson: PackageJson): void {
  if (!packageJson.version) {
    console.error('"version" field not found in package.json.');
    process.exit(1);
  }

  if (!isValidSemanticVersion(packageJson.version)) {
    console.error('Invalid version format in package.json.');
    process.exit(1);
  }
}

/**
 * Writes the updated package.json back to disk
 */
function writePackageJson(packageJsonPath: string, packageJson: PackageJson): void {
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n', 'utf-8');
}

/**
 * Patches the version in package.json by incrementing the patch number
 */
function patchPackageVersion(packageDirName: string): void {
  if (!packageDirName) {
    console.error('Please provide the package directory name as an argument.');
    process.exit(1);
  }

  const targetDir = path.join(PACKAGES_BASE_DIR, packageDirName);
  const packageJsonPath = path.join(targetDir, 'package.json');

  const packageJson = readPackageJson(packageJsonPath);
  validatePackageVersion(packageJson);

  const oldVersion = packageJson.version!;
  packageJson.version = incrementPatchVersion(oldVersion);

  writePackageJson(packageJsonPath, packageJson);
  console.log(`Version updated to ${packageJson.version} at ${packageJsonPath}`);
}

// Entry point
const [, , packageDirName] = process.argv;
patchPackageVersion(String(packageDirName));
