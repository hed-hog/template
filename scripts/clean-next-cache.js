// Removes the Next.js / Turborepo build caches for the given apps so the dev
// server always boots from the current source (avoids serving a stale frontend
// bundle after branch changes). Pass app names as arguments, e.g.
//   node ./scripts/clean-next-cache.js admin web
// Defaults to "admin" when no argument is given.
//
// Surgical on purpose: it only deletes the app-scoped .next/.turbo caches and
// never touches node_modules, lockfiles or dist (see scripts/clean.js for the
// full reset). Apps without these caches (e.g. the NestJS api) are simply
// skipped.
const fs = require('fs');
const path = require('path');

const rootDir = process.cwd();
const apps = process.argv.slice(2);
if (apps.length === 0) apps.push('admin');

for (const app of apps) {
  const appDir = path.join(rootDir, 'apps', app);
  for (const cache of ['.next', '.turbo']) {
    const target = path.join(appDir, cache);
    if (!fs.existsSync(target)) continue;
    fs.rmSync(target, { recursive: true, force: true });
    console.log(`Cleaned cache: ${path.relative(rootDir, target)}`);
  }
}
