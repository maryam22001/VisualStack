import { PrismaClient } from '@prisma/client';

// On Vercel the Prisma Postgres integration injects Storage_DATABASE_URL;
// DATABASE_URL is kept for local development.
const datasourceUrl = process.env.Storage_DATABASE_URL || process.env.DATABASE_URL;

export const prisma = new PrismaClient(datasourceUrl ? { datasourceUrl } : undefined);
