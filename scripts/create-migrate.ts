import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

async function getMigrationName(): Promise<string> {
  const argName = process.argv[2];

  if (argName) {
    return argName;
  }

  // If no argument provided, ask user for input
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question('Digite o nome da migration: ', (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function createMigration() {
  // Get migration name from command line arguments or prompt user
  const migrationName = await getMigrationName();

  if (!migrationName) {
    console.error('Error: Migration name cannot be empty');
    process.exit(1);
  }

  // Convert name to snake_case if needed
  const snakeCaseName = migrationName
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');

  // Generate timestamp in the format YYYYMMDDHHmmss
  const now = new Date();
  const timestamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
  ].join('');

  // Create folder name with pattern: timestamp_name
  const folderName = `${timestamp}_${snakeCaseName}`;

  // Define paths
  const migrationsDir = path.join(process.cwd(), '..', '..', 'apps', 'api', 'prisma', 'migrations');
  const migrationFolder = path.join(migrationsDir, folderName);
  const migrationFile = path.join(migrationFolder, 'migration.sql');

  // Create migrations directory if it doesn't exist
  if (!fs.existsSync(migrationsDir)) {
    fs.mkdirSync(migrationsDir, { recursive: true });
  }

  // Create migration folder
  if (fs.existsSync(migrationFolder)) {
    console.error(`Error: Migration folder already exists: ${folderName}`);
    process.exit(1);
  }

  fs.mkdirSync(migrationFolder, { recursive: true });

  // Create empty migration.sql file
  fs.writeFileSync(migrationFile, '-- Migration SQL\n-- Add your migration SQL here\n', 'utf-8');

  console.log(`✅ Migration created successfully!`);
  console.log(`📁 Folder: ${folderName}`);
  console.log(`📄 File: ${migrationFile}`);
}

// Run the script
createMigration().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
