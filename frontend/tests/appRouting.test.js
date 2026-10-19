/**
 * Logout redirect / SPA routing / password-recovery contract tests.
 *
 * Guards the three production regressions observed on Vercel:
 *   1. Logout 404 — the 401 interceptor hard-navigates to /login, which
 *      Vercel served as an edge 404 because no SPA rewrite existed, and the
 *      logout click raced the Supabase sign-out (Login bounced a stale user
 *      back to /dashboard whose fetches then hit the dying session).
 *   2. Recovery 404 — Supabase's reset link redirects the browser to
 *      /reset-password, a client-only route that also 404'd at the edge.
 *   3. Missed recovery markers — auth-js clears window.location.hash during
 *      client init, long before the lazily-loaded ResetPassword effect runs.
 *
 * Run: npm test  (from frontend/) -> node --test
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = (...p) => path.join(__dirname, '..', 'src', ...p);
const read = (...p) => fs.readFileSync(src(...p), 'utf8');

// ── Deployment: SPA fallback ────────────────────────────────────────────────

test('vercel.json: exists at the frontend root (Vercel Root Directory = frontend)', () => {
  const file = path.join(__dirname, '..', 'vercel.json');
  assert.ok(fs.existsSync(file), 'frontend/vercel.json must exist');
});

test('vercel.json: catch-all rewrite serves index.html for every client route', () => {
  const config = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'vercel.json'), 'utf8'));
  assert.ok(Array.isArray(config.rewrites), 'rewrites array required');
  const spa = config.rewrites.find((r) => r.destination === '/index.html');
  assert.ok(spa, 'an index.html rewrite is required');
  // The source must cover the routes that 404'd in production.
  const re = new RegExp(`^${spa.source}$`);
  for (const route of ['/login', '/forgot-password', '/reset-password', '/dashboard', '/privacy', '/terms']) {
    assert.ok(re.test(route), `rewrite source "${spa.source}" must match ${route}`);
  }
});

// ── Routes: declared client routes that auth flows target ───────────────────

test('App.jsx declares every route the auth flows navigate to', () => {
  const app = read('App.jsx');
  for (const route of ['/login', '/forgot-password', '/reset-password', '/privacy', '/terms']) {
    assert.ok(
      app.includes(`path="${route}"`),
      `route ${route} must be declared in App.jsx (do not invent route names)`
    );
  }
});

test('logout redirect target: Layout navigates to /login and /login exists', () => {
  const layout = read('components', 'Layout.jsx');
  const line = layout.split('\n').find((l) => l.includes('handleLogout ='));
  assert.ok(line, 'Layout must define handleLogout');
  assert.match(line, /navigate\(['"]\/login['"]\)/, 'logout must land on the /login route');
  assert.ok(read('App.jsx').includes('path="/login"'), '/login route must exist');
});

test('logout ordering: session is fully cleared BEFORE navigating (no stale-user bounce)', async () => {
  const layout = read('components', 'Layout.jsx');
  const line = layout.split('\n').find((l) => l.includes('handleLogout ='));
  assert.match(
    line,
    /await\s+logout\(\)/,
    'handleLogout must await logout() so Login mounts with user=null; ' +
      'otherwise Login bounces the stale user to /dashboard whose fetches race ' +
      'the sign-out, get a 401, and hard-navigate (the observed logout 404)'
  );
  const logoutIdx = line.indexOf('await logout()');
  const navIdx = line.indexOf("navigate('/login')");
  assert.ok(navIdx > logoutIdx, 'navigate("/login") must come after await logout()');
});

test('api.js 401 handler still hard-navigates to /login (documented contract: SPA rewrite covers it)', () => {
  const api = read('services', 'api.js');
  assert.match(
    api,
    /window\.location\.href\s*=\s*['"]\/login['"]/,
    'the 401 handler redirects to /login; vercel.json must keep serving the SPA there'
  );
});

// ── Google OAuth login: untouched contract ──────────────────────────────────

test('Google OAuth redirectTo is the deployment origin (root is always served)', () => {
  const login = read('pages', 'Login.jsx');
  assert.match(login, /signInWithOAuth/);
  assert.match(login, /redirectTo:\s*window\.location\.origin/);
});

// ── Forgot password: redirect target matches a real route ───────────────────

test('ForgotPassword: resetPasswordForEmail redirectTo targets the declared /reset-password route', () => {
  const forgot = read('pages', 'ForgotPassword.jsx');
  const m = forgot.match(/redirectTo:[^\n]*['"`]([^'"`]*\/reset-password)['"`]/);
  assert.ok(m, 'resetPasswordForEmail must set a redirectTo ending in /reset-password');
  assert.ok(
    m[1].endsWith('/reset-password'),
    `redirectTo must be the /reset-password route, got: ${m[1]}`
  );
  assert.ok(read('App.jsx').includes('path="/reset-password"'), 'declared route must exist');
});

// ── Recovery session detection: markers survive auth-js URL cleanup ─────────

test('supabaseClient: recovery markers are captured BEFORE createClient clears the URL', () => {
  const client = read('services', 'supabaseClient.js');
  const markerIdx = client.indexOf('export const hadRecoveryAuthParams');
  const createIdx = client.indexOf('createClient(supabaseUrl');
  assert.ok(markerIdx !== -1, 'supabaseClient must export hadRecoveryAuthParams');
  assert.ok(createIdx !== -1, 'supabaseClient creates the client');
  assert.ok(
    markerIdx < createIdx,
    'marker must be captured before createClient() (auth-js clears location.hash during init)'
  );
});

test('ResetPassword: recovery readiness uses the captured marker and the PASSWORD_RECOVERY event', () => {
  const reset = read('pages', 'ResetPassword.jsx');
  assert.match(reset, /import\s*{[^}]*hadRecoveryAuthParams[^}]*}\s*from\s*['"]\.\.\/services\/supabaseClient['"]/);
  assert.match(
    reset,
    /hasRecoveryParams\s*=[^;]*hadRecoveryAuthParams/,
    'hasRecoveryParams must fall back to the module-load snapshot (hash is cleared before the effect runs)'
  );
  assert.match(reset, /PASSWORD_RECOVERY/, 'PASSWORD_RECOVERY event must be observed');
});

// ── Password update handling ────────────────────────────────────────────────

test('ResetPassword: submits via supabase.auth.updateUser({ password }) with success and error UX', () => {
  const reset = read('pages', 'ResetPassword.jsx');
  assert.match(reset, /supabase\.auth\.updateUser\(\{\s*password:\s*form\.newPassword\s*\}\)/);
  assert.match(reset, /toast\.error/, 'failures must surface a visible error');
  assert.match(reset, /Password updated/, 'success state must be shown after update');
  assert.match(reset, /signOut\(\)/, 'recovery session must end after a successful update');
});

test('ResetPassword: expired/invalid links land on the "Link required" recovery screen, not a blank page', () => {
  const reset = read('pages', 'ResetPassword.jsx');
  assert.match(reset, /Link required/);
  assert.match(reset, /Request a new link/, 'must offer a path back to forgot-password');
  assert.match(reset, /to="\/forgot-password"/);
});
