// Applies pending Prisma migrations to the production database during Vercel builds.
// Skipped locally so `npm install` never touches a developer's database.
const { execSync } = require('node:child_process');

const url = process.env.Storage_DATABASE_URL;

if (!process.env.VERCEL || !url) {
  console.log('[migrate] Skipping prisma migrate deploy (not a Vercel build or no Storage_DATABASE_URL).');
  process.exit(0);
}

execSync('npx prisma migrate deploy', {
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: url },
});
