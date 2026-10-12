#!/usr/bin/env node
/**
 * Smoke test for a RUNNING VisualStack server (local or deployed).
 *
 *   npm run smoke                                   # http://localhost:5000
 *   API_URL=https://app.example.com npm run smoke   # a deployed instance
 *   API_URL=... ORIGIN=https://app.example.com WEB=1 npm run smoke
 *
 *   ORIGIN  browser origin to test CORS for (only needed when web and API are on different origins)
 *   WEB=1   also check that the API serves the web app (single-service deployment)
 *
 * It never creates accounts or sends email: it only checks that the service is alive, wired to
 * its database, rejects anonymous access, and sends the right headers.
 */
const API = (process.env.API_URL || 'http://localhost:5000').replace(/\/+$/, '');
const ORIGIN = process.env.ORIGIN;
const WEB = process.env.WEB === '1';

let failed = 0;
const results = [];
const check = (name, ok, detail = '') => {
  if (!ok) failed++;
  results.push(`${ok ? '  PASS' : '  FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
};

async function hit(path, init = {}) {
  const res = await fetch(API + path, { redirect: 'manual', ...init });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not JSON */ }
  return { res, text, json };
}

console.log(`\nVisualStack smoke test -> ${API}\n`);

try {
  const health = await hit('/api/health');
  check('GET /api/health is 200', health.res.status === 200, `status ${health.res.status}`);
  check('health reports the database is up', health.json?.db === 'up', JSON.stringify(health.json));

  const me = await hit('/api/auth/me');
  check('GET /api/auth/me without a session -> 401', me.res.status === 401);

  const ws = await hit('/api/workspaces');
  check('GET /api/workspaces without a session -> 401', ws.res.status === 401);

  const designs = await hit('/api/workspaces/00000000-0000-0000-0000-000000000000/designs');
  check('designs are not readable anonymously -> 401', designs.res.status === 401);

  const bad = await hit('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'nobody@example.invalid', password: 'wrong-password-123' })
  });
  check('login with bad credentials -> 401 JSON', bad.res.status === 401 && typeof bad.json?.error === 'string');
  check('no session cookie is issued on failed login', !bad.res.headers.get('set-cookie'));

  const forgot = await hit('/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'nobody@example.invalid' })
  });
  check('forgot-password does not reveal unknown emails (200)', forgot.res.status === 200);

  const unknown = await hit('/api/does-not-exist');
  check('unknown API route -> JSON 404', unknown.res.status === 404 && typeof unknown.json?.error === 'string');

  const h = health.res.headers;
  check('security headers present', h.get('x-content-type-options') === 'nosniff' && !!h.get('x-frame-options'));
  check('X-Powered-By is hidden', h.get('x-powered-by') === null);
  if (API.startsWith('https://')) check('HSTS header on HTTPS', !!h.get('strict-transport-security'));

  if (ORIGIN) {
    const pre = await hit('/api/auth/login', {
      method: 'OPTIONS',
      headers: { Origin: ORIGIN, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type' }
    });
    check(`CORS allows ${ORIGIN} with credentials`,
      pre.res.headers.get('access-control-allow-origin') === ORIGIN &&
      pre.res.headers.get('access-control-allow-credentials') === 'true');
    const evil = await hit('/api/auth/login', {
      method: 'OPTIONS',
      headers: { Origin: 'https://evil.example', 'Access-Control-Request-Method': 'POST' }
    });
    check('CORS does NOT allow an unlisted origin', evil.res.headers.get('access-control-allow-origin') !== 'https://evil.example');
  }

  if (WEB) {
    const root = await hit('/');
    check('GET / serves the web app', root.res.status === 200 && /<div id="root"/.test(root.text));
    const deep = await hit('/some/client/route');
    check('client-side routes fall back to index.html', deep.res.status === 200 && /<div id="root"/.test(deep.text));
  }
} catch (err) {
  check('server is reachable', false, err?.cause?.code || err.message);
}

console.log(results.join('\n'));
console.log(`\n${failed === 0 ? 'ALL CHECKS PASSED' : `${failed} CHECK(S) FAILED`}\n`);
process.exit(failed === 0 ? 0 : 1);
