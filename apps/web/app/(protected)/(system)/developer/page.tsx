import { readFile } from 'fs/promises';
import DeveloperPage from './components/developer-page';
import { DeveloperProvider } from './components/developer-provider';

async function getNextVersion() {
  const appRoot = process.cwd();
  try {
    const nextVersion = await readFile(
      `${appRoot}/node_modules/next/package.json`,
      'utf-8',
    );
    return JSON.parse(nextVersion).version;
  } catch (err) {
    return 'unknown';
  }
}

async function getBranchName() {
  const appRoot = process.cwd();
  try {
    const branchName = await readFile(`${appRoot}/.git/HEAD`, 'utf-8');
    return branchName.split('/').pop()?.trim() || 'unknown';
  } catch (err) {
    return 'unknown';
  }
}

async function getDatabaseType() {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/healthy/database`,
  );

  return res.json();
}

export default async function Page() {
  const nodeVersion = process.versions.node;
  const nextVersion = await getNextVersion();
  const branchName = await getBranchName();
  const databaseType = await getDatabaseType();

  return (
    <DeveloperProvider
      nodeVersion={nodeVersion}
      nextVersion={nextVersion}
      branchName={branchName}
      databaseType={databaseType.database}
      databaseStatus={databaseType.connected}
    >
      <DeveloperPage />
    </DeveloperProvider>
  );
}
