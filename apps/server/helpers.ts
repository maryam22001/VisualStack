import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { startApi, wrongCodeFor, type Api } from './helpers';

describe('auth', () => {
  let api: Api;
  const email = 'maryam@example.com';
  let userId = '';
  let cookie = '';

  before(async () => { api = await startApi(); });
  after(() => api.close());

  it('register rejects a short password', async () => {
    const r = await api.call('/auth/register', 'POST', { fullName: 'Maryam Osman', email, password: 'short' });
    assert.equal(r.status, 400);
    assert.match(r.data.error, /at least 8/);
  });

  it('register creates user + workspace and sets NO session cookie', async () => {
    const r = await api.call('/auth/register', 'POST', { fullName: 'Maryam Osman', email, password: 'SuperSecret1' });
    assert.equal(r.status, 201);
    assert.equal(r.setCookie, '');
    assert.equal(r.data.emailSent, false); // SMTP is not configured in tests
    userId = r.data.user.id;
    assert.equal(api.db._workspaces.size, 1);
    assert.equal(api.db._members[0].role, 'owner');
  });

  it('duplicate email -> 409', async () => {
    const r = await api.call('/auth/register', 'POST', { fullName: 'Someone Else', email, password: 'SuperSecret1' });
    assert.equal(r.status, 409);
  });

  it('login while unverified -> 403 needsVerification, no cookie', async () => {
    const r = await api.call('/auth/login', 'POST', { email, password: 'SuperSecret1' });
    assert.equal(r.status, 403);
    assert.equal(r.data.needsVerification, true);
    assert.equal(r.data.userId, userId);
    assert.equal(r.setCookie, '');
  });

  it('resend inside the cooldown -> 429 with retryAfter', async () => {
    const r = await api.call('/auth/resend-code', 'POST', { email });
    assert.equal(r.status, 429);
    assert.ok(r.data.retryAfter > 0);
  });

  it('5 wrong codes burn the code; the right one is then refused', async () => {
    const real = api.db._users.get(userId).verificationCode;
    const statuses: number[] = [];
    for (let i = 0; i < 5; i++) statuses.push((await api.call('/auth/verify', 'POST', { userId, code: wrongCodeFor(real) })).status);
    assert.deepEqual(statuses, [400, 400, 400, 400, 429]);
    const late = await api.call('/auth/verify', 'POST', { userId, code: real });
    assert.equal(late.status, 400);
    assert.match(late.data.error, /no active code/i);
  });

  it('after the cooldown a fresh code can be requested and verifies the account', async () => {
    api.db._users.get(userId).verificationExpiresAt = new Date(Date.now() - 1000); // pretend 10+ min passed
    const r = await api.call('/auth/resend-code', 'POST', { email });
    assert.equal(r.status, 200);
    const v = await api.call('/auth/verify', 'POST', { userId, code: api.db._users.get(userId).verificationCode });
    assert.equal(v.status, 200);
    assert.equal(api.db._users.get(userId).isVerified, true);
  });

  it('wrong password -> 401; right password -> HttpOnly session cookie, no secrets in body', async () => {
    assert.equal((await api.call('/auth/login', 'POST', { email, password: 'nope-nope-nope' })).status, 401);
    const r = await api.call('/auth/login', 'POST', { email, password: 'SuperSecret1' });
    assert.equal(r.status, 200);
    assert.match(r.setCookie, /HttpOnly/i);
    assert.match(r.setCookie, /SameSite=Lax/i);
    assert.equal(r.data.user.currentWorkspaceName, "Maryam Osman's Workspace");
    assert.doesNotMatch(JSON.stringify(r.data), /passwordHash|verificationCode|resetCode|tokenVersion/);
    cookie = (r.setCookie.match(/token=[^;]+/) || [''])[0];
  });

  it('/auth/me works with the cookie and 401s without it', async () => {
    assert.equal((await api.call('/auth/me', 'GET', undefined, cookie)).status, 200);
    assert.equal((await api.call('/auth/me')).status, 401);
  });

  it('a tampered token is rejected', async () => {
    assert.equal((await api.call('/auth/me', 'GET', undefined, cookie + 'x')).status, 401);
  });

  it('legacy tokens without a version claim still work (version 0)', async () => {
    const legacy = jwt.sign({ userId }, process.env.JWT_SECRET!, { expiresIn: '1h' });
    assert.equal((await api.call('/auth/me', 'GET', undefined, `token=${legacy}`)).status, 200);
  });

  it('logout clears the cookie', async () => {
    const r = await api.call('/auth/logout', 'POST');
    assert.match(r.setCookie, /token=;/);
  });

  it('forgot-password answers identically for known and unknown emails', async () => {
    const unknown = await api.call('/auth/forgot-password', 'POST', { email: 'nobody@example.com' });
    const known = await api.call('/auth/forgot-password', 'POST', { email });
    assert.equal(unknown.status, 200);
    assert.deepEqual(unknown.data, known.data);
  });

  it('reset: wrong code, weak password, then success; code is single-use', async () => {
    const code = api.db._users.get(userId).resetCode as string;
    assert.equal((await api.call('/auth/reset-password', 'POST', { email, code: wrongCodeFor(code), newPassword: 'BrandNewPass9' })).status, 400);
    assert.equal((await api.call('/auth/reset-password', 'POST', { email, code, newPassword: 'short' })).status, 400);
    assert.equal((await api.call('/auth/reset-password', 'POST', { email, code, newPassword: 'BrandNewPass9' })).status, 200);
    assert.equal((await api.call('/auth/reset-password', 'POST', { email, code, newPassword: 'AnotherPass99' })).status, 400);
  });

  it('a password reset REVOKES sessions issued before it (all devices)', async () => {
    assert.equal((await api.call('/auth/me', 'GET', undefined, cookie)).status, 401);
  });

  it('old password no longer works, new one does', async () => {
    assert.equal((await api.call('/auth/login', 'POST', { email, password: 'SuperSecret1' })).status, 401);
    const r = await api.call('/auth/login', 'POST', { email, password: 'BrandNewPass9' });
    assert.equal(r.status, 200);
    cookie = (r.setCookie.match(/token=[^;]+/) || [''])[0];
  });

  it('"sign out everywhere" revokes every session', async () => {
    const second = (await api.call('/auth/login', 'POST', { email, password: 'BrandNewPass9' })).setCookie.match(/token=[^;]+/)![0];
    assert.equal((await api.call('/auth/me', 'GET', undefined, second)).status, 200);
    assert.equal((await api.call('/auth/logout-all', 'POST', {}, cookie)).status, 200);
    assert.equal((await api.call('/auth/me', 'GET', undefined, cookie)).status, 401);
    assert.equal((await api.call('/auth/me', 'GET', undefined, second)).status, 401);
  });
});
