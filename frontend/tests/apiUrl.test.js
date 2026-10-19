/**
 * API URL / profile-request contract tests.
 *
 * Guards the production wiring behind `GET /api/auth/me` (getMe in api.js):
 *   - default (unset VITE_API_URL) => relative '/api' base, which only works
 *     behind the Vite dev proxy and 404s on Vercel — the regression that
 *     broke production login/profile hydration;
 *   - production VITE_API_URL => absolute base on the Render backend, always
 *     ending in /api exactly once, so getMe resolves to
 *     https://ecoguardian-api-gusv.onrender.com/api/auth/me.
 *
 * Run: npm test  (from frontend/) -> node --test
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import axios from 'axios';
import { resolveApiBaseURL, DEFAULT_API_BASE } from '../src/services/apiConfig.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Deployed backend origin (Render) — the real production contract. */
const PROD_ORIGIN = 'https://ecoguardian-api-gusv.onrender.com';

/** The URL the profile request would actually hit (axios own URL builder). */
function profileRequestURL(env) {
  return axios.create({ baseURL: resolveApiBaseURL(env) }).getUri({ url: '/auth/me' });
}

test('resolveApiBaseURL: defaults to the relative /api base when VITE_API_URL is unset', () => {
  assert.strictEqual(resolveApiBaseURL({}), DEFAULT_API_BASE);
  assert.strictEqual(resolveApiBaseURL(), DEFAULT_API_BASE);
  assert.strictEqual(resolveApiBaseURL({ VITE_SUPABASE_URL: 'https://x.supabase.co' }), '/api');
});

test('resolveApiBaseURL: blank / whitespace values fall back to the default', () => {
  assert.strictEqual(resolveApiBaseURL({ VITE_API_URL: '' }), '/api');
  assert.strictEqual(resolveApiBaseURL({ VITE_API_URL: '   ' }), '/api');
  assert.strictEqual(resolveApiBaseURL({ VITE_API_URL: '///' }), '/api');
});

test('resolveApiBaseURL: production origin gets the required /api suffix', () => {
  assert.strictEqual(
    resolveApiBaseURL({ VITE_API_URL: PROD_ORIGIN }),
    `${PROD_ORIGIN}/api`
  );
});

test('resolveApiBaseURL: /api appears EXACTLY ONCE for both config forms and is idempotent', () => {
  const withoutSuffix = resolveApiBaseURL({ VITE_API_URL: PROD_ORIGIN });
  const withSuffix = resolveApiBaseURL({ VITE_API_URL: `${PROD_ORIGIN}/api` });
  assert.strictEqual(withoutSuffix, `${PROD_ORIGIN}/api`);
  assert.strictEqual(withSuffix, `${PROD_ORIGIN}/api`);
  assert.strictEqual(withoutSuffix.match(/\/api\b/g).length, 1, 'no /api/api duplication');
  // Re-resolving an already-resolved value must not stack another /api.
  assert.strictEqual(resolveApiBaseURL({ VITE_API_URL: withoutSuffix }), withoutSuffix);
});

test('resolveApiBaseURL: an explicit /api value is preserved, trailing slashes tolerated', () => {
  assert.strictEqual(
    resolveApiBaseURL({ VITE_API_URL: `${PROD_ORIGIN}/api` }),
    `${PROD_ORIGIN}/api`
  );
  assert.strictEqual(
    resolveApiBaseURL({ VITE_API_URL: `${PROD_ORIGIN}/api/` }),
    `${PROD_ORIGIN}/api`
  );
  assert.strictEqual(resolveApiBaseURL({ VITE_API_URL: '/api' }), '/api');
});

test('profile request (getMe): default base resolves to same-origin /api/auth/me (dev proxy only)', () => {
  const url = profileRequestURL({});
  assert.strictEqual(url, '/api/auth/me');
  assert.ok(url.startsWith('/'), 'relative URL — 404s on Vercel unless VITE_API_URL is set');
});

test('profile request (getMe): production base resolves to https://<backend>/api/auth/me', () => {
  const url = profileRequestURL({ VITE_API_URL: PROD_ORIGIN });
  assert.strictEqual(url, `${PROD_ORIGIN}/api/auth/me`);
});

test('profile request (getMe): final URL is exactly the backend route (regression for prod 404)', () => {
  // Observed production bug: baseURL without /api produced
  // https://ecoguardian-api-gusv.onrender.com/auth/me -> 404.
  for (const value of [PROD_ORIGIN, `${PROD_ORIGIN}/api`, `${PROD_ORIGIN}/api/`]) {
    const url = profileRequestURL({ VITE_API_URL: value });
    assert.strictEqual(url, 'https://ecoguardian-api-gusv.onrender.com/api/auth/me');
    assert.ok(!url.includes('.com/auth/me'), 'leading-slash join must not discard the /api prefix');
    assert.ok(!url.includes('/api/api/'), '/api must appear exactly once');
    assert.ok(url.startsWith('https://ecoguardian-api-gusv.onrender.com/api/'), 'backend origin preserved');
  }
});

test('profile request (getMe): with VITE_API_URL set the request is absolute (cross-origin-safe)', () => {
  const url = profileRequestURL({ VITE_API_URL: PROD_ORIGIN });
  assert.ok(/^https:\/\//.test(url), 'absolute URL — no dependency on the Vercel origin or dev proxy');
});

test('api.js: client uses the resolver and getMe targets the backend /auth/me route', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'services', 'api.js'), 'utf8');
  assert.match(source, /baseURL:\s*resolveApiBaseURL\(import\.meta\.env\)/);
  assert.match(source, /getMe:\s*\(\)\s*=>\s*api\.get\(['"]\/auth\/me['"]\)/);
});
