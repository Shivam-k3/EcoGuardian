/**
 * API base-URL resolution for the shared axios client (api.js).
 *
 * - Local dev: no env var needed. The Vite dev server proxies `/api` to
 *   http://localhost:5000 (vite.config.js), so the relative default works.
 * - Production: the frontend (Vercel) and the Express backend (Render) are on
 *   different origins, so the relative default resolves against the Vercel
 *   domain and 404s (Vercel has no /api function). Set VITE_API_URL to the
 *   deployed backend origin at build time, e.g.
 *   VITE_API_URL=https://your-backend.onrender.com
 *
 * Every backend route is mounted under /api (backend/server.js), so the
 * `/api` suffix is appended when the configured value does not already end
 * with it — this prevents the exact 404 class of misconfiguration.
 */
export const DEFAULT_API_BASE = '/api';

export function resolveApiBaseURL(env = {}) {
  const raw = env?.VITE_API_URL;
  if (raw == null) return DEFAULT_API_BASE;
  const trimmed = String(raw).trim().replace(/\/+$/, '');
  if (!trimmed) return DEFAULT_API_BASE;
  return /\/api$/i.test(trimmed) ? trimmed : `${trimmed}/api`;
}
