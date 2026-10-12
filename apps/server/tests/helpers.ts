/**
 * Test harness: boots the REAL Express app with an in-memory stand-in for Prisma,
 * so the whole HTTP layer (routing, validation, cookies, auth, roles) is exercised
 * without needing PostgreSQL.  Run with:  npm test --workspace=apps/server
 */
import { randomUUID } from 'crypto';
import path from 'path';
import type { AddressInfo } from 'net';

export function createFakeDb() {
  const users = new Map<string, any>();
  const workspaces = new Map<string, any>();
  const members: any[] = [];
  const designs = new Map<string, any>();

  const userDefaults = () => ({
    isVerified: false, verificationCode: null, verificationExpiresAt: null, verificationAttempts: 0,
    resetCode: null, resetExpiresAt: null, resetAttempts: 0, tokenVersion: 0, createdAt: new Date()
  });
  const applyUpdate = (obj: any, data: any) => {
    for (const [k, v] of Object.entries<any>(data)) {
      obj[k] = v && typeof v === 'object' && 'increment' in v ? (obj[k] ?? 0) + v.increment : v;
    }
    return obj;
  };
  const pick = (obj: any, select: any) =>
    Object.fromEntries(Object.keys(select).filter((k) => select[k]).map((k) => [k, obj[k]]));
  const memberWith = (m: any, include: any) => {
    const out: any = { ...m };
    if (include?.workspace) out.workspace = workspaces.get(m.workspaceId);
    if (include?.user) out.user = pick(users.get(m.userId), include.user.select ?? { id: true, fullName: true, email: true });
    return out;
  };
  const findMember = (w: any) => members.find((m) => m.workspaceId === w.workspaceId && m.userId === w.userId);

  const db: any = {
    user: {
      findUnique: async (args: any) => {
        const { where } = args;
        const u = where.id ? users.get(where.id) : [...users.values()].find((x) => x.email === where.email);
        if (!u) return null;
        if (args.select) return pick(u, args.select);
        const out = { ...u };
        if (args.include?.ownedWorkspaces) out.ownedWorkspaces = [...workspaces.values()].filter((w) => w.ownerId === u.id);
        if (args.include?.memberships) out.memberships = members.filter((m) => m.userId === u.id).map((m) => memberWith(m, { workspace: true }));
        return out;
      },
      create: async ({ data }: any) => { const u = { ...userDefaults(), id: randomUUID(), ...data }; users.set(u.id, u); return { ...u }; },
      update: async ({ where, data }: any) => ({ ...applyUpdate(users.get(where.id), data) })
    },
    workspace: {
      create: async ({ data }: any) => {
        const w = { id: randomUUID(), name: data.name, ownerId: data.ownerId };
        workspaces.set(w.id, w);
        if (data.members?.create) members.push({ workspaceId: w.id, ...data.members.create });
        return w;
      }
    },
    workspaceMember: {
      findUnique: async ({ where, include }: any) => { const m = findMember(where.workspaceId_userId); return m ? memberWith(m, include) : null; },
      findMany: async ({ where, include }: any) =>
        members.filter((m) => (!where.userId || m.userId === where.userId) && (!where.workspaceId || m.workspaceId === where.workspaceId)).map((m) => memberWith(m, include)),
      create: async ({ data }: any) => { members.push({ ...data }); return data; },
      update: async ({ where, data }: any) => ({ ...applyUpdate(findMember(where.workspaceId_userId), data) }),
      delete: async ({ where }: any) => { members.splice(members.indexOf(findMember(where.workspaceId_userId)), 1); return {}; }
    },
    design: {
      findMany: async ({ where }: any) => [...designs.values()].filter((d) => d.workspaceId === where.workspaceId),
      findUnique: async ({ where }: any) => designs.get(where.id) ?? null,
      create: async ({ data }: any) => { const d = { id: randomUUID(), createdAt: new Date(), updatedAt: new Date(), ...data }; designs.set(d.id, d); return d; },
      update: async ({ where, data }: any) => ({ ...applyUpdate(designs.get(where.id), data) }),
      delete: async ({ where }: any) => { designs.delete(where.id); return {}; }
    },
    $transaction: async (ops: Promise<unknown>[]) => Promise.all(ops),
    $queryRaw: async () => [{ ok: 1 }],
    // test-only handles
    _users: users, _workspaces: workspaces, _members: members, _designs: designs
  };
  return db;
}

export type Api = Awaited<ReturnType<typeof startApi>>;

export async function startApi(config: any = {}) {
  const db = createFakeDb();
  Object.assign(process.env, { NODE_ENV: 'test', JWT_SECRET: 'x'.repeat(48) }, config);

  // Replace the PrismaClient module BEFORE the app (and its controllers) are loaded.
  const dbPath = require.resolve(path.resolve(__dirname, '../src/services/db.service.ts'));
  require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: { prisma: db } } as any;
  const { app } = require(path.resolve(__dirname, '../src/app.ts'));

  const server = app.listen(0);
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  // Keep test output readable (the Dev Mailer prints codes to the console).
  const real = { log: console.log, warn: console.warn, error: console.error };
  console.log = console.warn = console.error = () => { };

  async function raw(p: string, init: RequestInit = {}) {
    const res = await fetch(base + p, init);
    const text = await res.text();
    let data: any = {};
    try { data = JSON.parse(text); } catch { data = text; }
    return { status: res.status, data, headers: res.headers, setCookie: res.headers.get('set-cookie') || '' };
  }
  async function call(p: string, method = 'GET', body?: unknown, cookie?: string) {
    return raw('/api' + p, {
      method,
      headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
  }

  /** register -> read the code from the DB -> verify -> login. Returns a signed-in user. */
  async function signUp(fullName: string, email: string, password = 'SuperSecret1') {
    const reg = await call('/auth/register', 'POST', { fullName, email, password });
    const userId = reg.data.user.id as string;
    await call('/auth/verify', 'POST', { userId, code: db._users.get(userId).verificationCode });
    const login = await call('/auth/login', 'POST', { email, password });
    const cookie = (login.setCookie.match(/token=[^;]+/) || [''])[0];
    const workspaceId = login.data.user.currentWorkspaceId as string;
    return { userId, email, password, cookie, workspaceId };
  }

  return {
    db, base, raw, call, signUp,
    close: () => { Object.assign(console, real); server.close(); }
  };
}

export const wrongCodeFor = (code: string) => (code === '000000' ? '111111' : '000000');