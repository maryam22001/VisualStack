import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { startApi, type Api } from '../helpers';

describe('single-origin hosting (API serves the built web app)', () => {
  let api: Api;
  let dir: string;

  before(async () => {
      try{
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vs-web-'));
    fs.mkdirSync(path.join(dir, 'assets'));
    fs.writeFileSync(path.join(dir, 'index.html'), '<!doctype html><title>VisualStack</title><div id="root"></div>');
    fs.writeFileSync(path.join(dir, 'assets', 'app-abc123.js'), 'console.log("hi")');
    api = await startApi({ SERVE_WEB: 'true', WEB_DIST_DIR: dir });
      }catch(error){
        console.error("Test setup failed:", error);
        throw error;
      }
  });
  after(() => { api.close(); fs.rmSync(dir, { recursive: true, force: true }); });

  it('serves index.html at / (never cached)', async () => {
    const r = await api.raw('/');
    assert.equal(r.status, 200);
    assert.match(String(r.data), /id="root"/);
    assert.match(r.headers.get('cache-control') || '', /no-cache/);
  });

  it('falls back to index.html for client-side routes', async () => {
    const r = await api.raw('/some/deep/link');
    assert.equal(r.status, 200);
    assert.match(String(r.data), /id="root"/);
  });

  it('serves fingerprinted assets with long-lived caching', async () => {
    const r = await api.raw('/assets/app-abc123.js');
    assert.equal(r.status, 200);
    assert.match(r.headers.get('cache-control') || '', /immutable/);
  });

  it('unknown API routes return JSON 404, not the web app', async () => {
    const r = await api.raw('/api/nope');
    assert.equal(r.status, 404);
    assert.equal(r.data.error, 'Not found.');
  });

  it('health check reports the database', async () => {
    const r = await api.call('/health');
    assert.equal(r.status, 200);
    assert.equal(r.data.db, 'up');
  });

  it('sets baseline security headers and hides the framework', async () => {
    const r = await api.raw('/api/health');
    assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(r.headers.get('x-frame-options'), 'SAMEORIGIN');
    assert.equal(r.headers.get('x-powered-by'), null);
  });

  it('malformed JSON gets a clean 400', async () => {
    const r = await api.raw('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{oops' });
    assert.equal(r.status, 400);
    assert.equal(r.data.error, 'Invalid JSON body.');
  });
});
