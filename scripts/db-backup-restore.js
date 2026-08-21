const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const backupDir = path.join(rootDir, 'backups');
const backupPath = path.join(backupDir, 'hedhog-backup.dump');
const composePath = path.join(rootDir, 'docker-compose.yaml');
const apiEnvPath = path.join(rootDir, 'apps', 'api', '.env');

const action = process.argv[2];

if (!['backup', 'restore', 'print-config'].includes(action)) {
  console.error('Usage: node ./scripts/db-backup-restore.js <backup|restore>');
  process.exit(1);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: rootDir,
    stdio: 'inherit',
    shell: false,
    ...options,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status}`);
  }
}

function output(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: rootDir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  });
}

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  return fs
    .readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .reduce((env, line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return env;

      const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!match) return env;

      const [, key, rawValue] = match;
      env[key] = rawValue.trim().replace(/^['"]|['"]$/g, '');
      return env;
    }, {});
}

function findComposePostgres() {
  if (!fs.existsSync(composePath)) {
    return null;
  }

  try {
    const config = JSON.parse(output('docker', ['compose', 'config', '--format', 'json']));
    const services = config.services || {};
    const serviceName = Object.keys(services).find((name) => {
      const service = services[name] || {};
      const env = service.environment || {};
      const image = String(service.image || '').toLowerCase();
      return Boolean(env.POSTGRES_DB || env.POSTGRES_USER || image.includes('postgres'));
    });

    if (!serviceName) {
      return null;
    }

    const service = services[serviceName];
    const env = service.environment || {};

    return {
      type: 'compose',
      serviceName,
      database: env.POSTGRES_DB || env.POSTGRES_USER || 'postgres',
      user: env.POSTGRES_USER || 'postgres',
    };
  } catch {
    return null;
  }
}

function findEnvDatabaseUrl() {
  const env = parseEnvFile(apiEnvPath);
  if (!env.DATABASE_URL) {
    return null;
  }

  const url = new URL(env.DATABASE_URL);
  const database = decodeURIComponent(url.pathname.replace(/^\//, ''));

  if (!database) {
    throw new Error(`DATABASE_URL in ${apiEnvPath} does not include a database name.`);
  }

  return {
    type: 'url',
    database,
    url: env.DATABASE_URL,
    maintenanceUrl: makeMaintenanceUrl(url),
  };
}

function makeMaintenanceUrl(url) {
  const maintenance = new URL(url.toString());
  maintenance.pathname = '/postgres';
  return maintenance.toString();
}

function quoteIdentifier(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function resolveConnection() {
  return findComposePostgres() || findEnvDatabaseUrl();
}

function backupWithCompose(connection) {
  fs.mkdirSync(backupDir, { recursive: true });

  const remoteBackupPath = '/tmp/hedhog-backup.dump';
  run('docker', [
    'compose',
    'exec',
    '-T',
    connection.serviceName,
    'pg_dump',
    '-U',
    connection.user,
    '-d',
    connection.database,
    '-Fc',
    '-f',
    remoteBackupPath,
  ]);
  run('docker', ['compose', 'cp', `${connection.serviceName}:${remoteBackupPath}`, backupPath]);
  run('docker', ['compose', 'exec', '-T', connection.serviceName, 'rm', '-f', remoteBackupPath]);
}

function restoreWithCompose(connection) {
  if (!fs.existsSync(backupPath)) {
    throw new Error(`Backup file not found: ${backupPath}`);
  }

  const remoteBackupPath = '/tmp/hedhog-backup.dump';
  run('docker', ['compose', 'cp', backupPath, `${connection.serviceName}:${remoteBackupPath}`]);
  run('docker', [
    'compose',
    'exec',
    '-T',
    connection.serviceName,
    'psql',
    '-U',
    connection.user,
    '-d',
    'postgres',
    '-c',
    `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${connection.database.replace(/'/g, "''")}';`,
  ]);
  run('docker', [
    'compose',
    'exec',
    '-T',
    connection.serviceName,
    'psql',
    '-U',
    connection.user,
    '-d',
    'postgres',
    '-c',
    `DROP DATABASE IF EXISTS ${quoteIdentifier(connection.database)};`,
  ]);
  run('docker', [
    'compose',
    'exec',
    '-T',
    connection.serviceName,
    'psql',
    '-U',
    connection.user,
    '-d',
    'postgres',
    '-c',
    `CREATE DATABASE ${quoteIdentifier(connection.database)} OWNER ${quoteIdentifier(connection.user)};`,
  ]);
  run('docker', [
    'compose',
    'exec',
    '-T',
    connection.serviceName,
    'pg_restore',
    '-U',
    connection.user,
    '-d',
    connection.database,
    '--clean',
    '--if-exists',
    '--no-owner',
    remoteBackupPath,
  ]);
  run('docker', ['compose', 'exec', '-T', connection.serviceName, 'rm', '-f', remoteBackupPath]);
}

function backupWithUrl(connection) {
  fs.mkdirSync(backupDir, { recursive: true });
  run('pg_dump', [connection.url, '-Fc', '-f', backupPath]);
}

function restoreWithUrl(connection) {
  if (!fs.existsSync(backupPath)) {
    throw new Error(`Backup file not found: ${backupPath}`);
  }

  run('psql', [
    connection.maintenanceUrl,
    '-c',
    `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${connection.database.replace(/'/g, "''")}';`,
  ]);
  run('psql', [connection.maintenanceUrl, '-c', `DROP DATABASE IF EXISTS ${quoteIdentifier(connection.database)};`]);
  run('psql', [connection.maintenanceUrl, '-c', `CREATE DATABASE ${quoteIdentifier(connection.database)};`]);
  run('pg_restore', ['-d', connection.url, '--clean', '--if-exists', '--no-owner', backupPath]);
}

function main() {
  const connection = resolveConnection();
  if (!connection) {
    throw new Error('Could not detect a PostgreSQL connection from docker-compose.yaml or apps/api/.env.');
  }

  if (action === 'print-config') {
    console.log(JSON.stringify(connection, null, 2));
    return;
  }

  console.log(`Using ${connection.type === 'compose' ? `docker compose service "${connection.serviceName}"` : 'apps/api/.env DATABASE_URL'}.`);
  console.log(`${action === 'backup' ? 'Backup' : 'Restore'} target: ${connection.database}`);
  console.log(`Backup file: ${backupPath}`);

  if (action === 'backup') {
    connection.type === 'compose' ? backupWithCompose(connection) : backupWithUrl(connection);
  } else {
    connection.type === 'compose' ? restoreWithCompose(connection) : restoreWithUrl(connection);
  }
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
