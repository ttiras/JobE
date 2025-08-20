// tests/helpers/auth.ts
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------
export type Session = { userId: string; token: string };

type PersistedSession = {
  userId: string;
  accessToken: string;
  refreshToken: string;
  // unix seconds when access token expires
  accessExp: number;
};

// -----------------------------------------------------------------------------
// Env helpers
// -----------------------------------------------------------------------------
function requiredEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name} in environment`);
  return v;
}

function firstEnv(...names: string[]): string {
  for (const n of names) {
    const v = (process.env[n] ?? '').trim();
    if (v) return v;
  }
  return '';
}

// Base URLs (trim trailing slashes)
export const AUTH_URL = requiredEnv('NHOST_AUTH_URL').replace(/\/+$/, '');
export const GRAPHQL_URL = (firstEnv('NHOST_GRAPHQL_URL', 'HASURA_GRAPHQL_ENDPOINT') || '').replace(/\/+$/, '');
if (!GRAPHQL_URL) throw new Error('GRAPHQL_URL missing: set HASURA_GRAPHQL_ENDPOINT or NHOST_GRAPHQL_URL');

// Test users
const USER_A = { email: requiredEnv('NHOST_TEST_EMAIL_A'), password: requiredEnv('NHOST_TEST_PASSWORD_A') };
const USER_B = { email: requiredEnv('NHOST_TEST_EMAIL_B'), password: requiredEnv('NHOST_TEST_PASSWORD_B') };

// Optional knobs
const DEFAULT_HTTP_TIMEOUT_MS = Number(process.env.TEST_HTTP_TIMEOUT_MS ?? 3000);
const AUTH_MAX_RETRIES = 5; // a bit higher since we now refresh and rarely re-signin
const REFRESH_SKEW_SEC = 30; // refresh if <=30s remaining

// -----------------------------------------------------------------------------
// Tiny utils
// -----------------------------------------------------------------------------
export function pause(ms: number) {
  return new Promise<void>((res) => setTimeout(res, ms));
}

function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = DEFAULT_HTTP_TIMEOUT_MS) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  return fetch(url, { ...init, signal: ctrl.signal }).finally(() => clearTimeout(t));
}

function isRetriable(status: number) {
  return status === 429 || (status >= 500 && status < 600);
}

function cachePathFor(email: string) {
  // One file per user in OS temp dir, safe for multiple workers/processes
  const key = email.replace(/[^a-z0-9_.@-]/gi, '_');
  return path.join(os.tmpdir(), `jobe-test-session-${key}.json`);
}

function readSessionFromDisk(email: string): PersistedSession | null {
  const p = cachePathFor(email);
  try {
    const raw = fs.readFileSync(p, 'utf8');
    return JSON.parse(raw) as PersistedSession;
  } catch {
    return null;
  }
}

function writeSessionToDisk(email: string, s: PersistedSession) {
  const p = cachePathFor(email);
  try {
    fs.writeFileSync(p, JSON.stringify(s), 'utf8');
  } catch {
    // ignore
  }
}

function nowSec() {
  return Math.floor(Date.now() / 1000);
}

// -----------------------------------------------------------------------------
// Auth flows (prefer refresh, fall back to sign-in)
// -----------------------------------------------------------------------------
async function signIn(email: string, password: string): Promise<PersistedSession> {
  const url = `${AUTH_URL}/signin/email-password`;

  let lastHttp: { status: number; body: string } | null = null;
  let lastErr: unknown;

  for (let i = 0; i <= AUTH_MAX_RETRIES; i++) {
    try {
      const r = await fetchWithTimeout(
        url,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email, password }),
        },
        DEFAULT_HTTP_TIMEOUT_MS
      );

      const text = await r.text();
      if (!r.ok) {
        lastHttp = { status: r.status, body: text.slice(0, 800) };
        if (isRetriable(r.status)) {
          const backoff = Math.min(400 * 2 ** i, 4000) + Math.floor(Math.random() * 150);
          await pause(backoff);
          continue;
        }
        throw new Error(`Signin HTTP ${r.status}: ${text.slice(0, 200)}`);
      }

      const j: any = text ? JSON.parse(text) : {};
      const accessToken: string =
        j?.session?.accessToken ?? j?.session?.access_token ?? j?.accessToken ?? j?.access_token;
      const userId: string = j?.session?.user?.id ?? j?.user?.id;
      const refreshToken: string = j?.session?.refreshToken ?? j?.refreshToken;
      const expiresIn: number = j?.session?.accessTokenExpiresIn ?? j?.accessTokenExpiresIn ?? 900;

      if (!accessToken || !userId || !refreshToken) {
        throw new Error(`Signin response missing fields: ${text.slice(0, 200)}`);
      }

      const accessExp = nowSec() + Math.max(60, Number(expiresIn) | 0);
      return { userId, accessToken, refreshToken, accessExp };
    } catch (err) {
      lastErr = err;
      // AbortError or network ⇒ retry with backoff (except on last attempt)
      if (i < AUTH_MAX_RETRIES) {
        const backoff = Math.min(400 * 2 ** i, 4000);
        await pause(backoff);
        continue;
      }
    }
  }

  const msg =
    lastErr instanceof Error
      ? lastErr.message
      : lastHttp
      ? `HTTP ${lastHttp.status} ${lastHttp.body}`
      : 'unknown error';
  throw new Error(`Signin to ${AUTH_URL} failed after ${AUTH_MAX_RETRIES + 1} attempts. Last error: ${msg}`);
}

async function refresh(refreshToken: string): Promise<{ accessToken: string; accessExp: number }> {
  const url = `${AUTH_URL}/token`;
  const r = await fetchWithTimeout(
    url,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    },
    DEFAULT_HTTP_TIMEOUT_MS
  );
  const text = await r.text();
  if (!r.ok) {
    throw new Error(`Refresh HTTP ${r.status}: ${text.slice(0, 200)}`);
  }
  const j: any = text ? JSON.parse(text) : {};
  const accessToken: string =
    j?.session?.accessToken ?? j?.session?.access_token ?? j?.accessToken ?? j?.access_token;
  const expiresIn: number = j?.session?.accessTokenExpiresIn ?? j?.accessTokenExpiresIn ?? 900;
  if (!accessToken) throw new Error(`Refresh response missing access token: ${text.slice(0, 200)}`);
  const accessExp = nowSec() + Math.max(60, Number(expiresIn) | 0);
  return { accessToken, accessExp };
}

async function getFreshSession(email: string, password: string): Promise<PersistedSession> {
  // 1) Try disk cache
  const cached = readSessionFromDisk(email);
  if (cached) {
    // If still valid for > skew, use it
    if (cached.accessExp - nowSec() > REFRESH_SKEW_SEC) {
      return cached;
    }
    // Else try refresh
    try {
      const { accessToken, accessExp } = await refresh(cached.refreshToken);
      const updated: PersistedSession = { ...cached, accessToken, accessExp };
      writeSessionToDisk(email, updated);
      return updated;
    } catch {
      // fall through to full sign-in
    }
  }

  // 2) Full sign-in
  const s = await signIn(email, password);
  writeSessionToDisk(email, s);
  return s;
}

// -----------------------------------------------------------------------------
// Public session API (with in-worker memoization to avoid redundant awaits)
// -----------------------------------------------------------------------------
const memCache: Record<string, Promise<PersistedSession>> = {};

function getSessionPersisted(email: string, password: string) {
  const key = `email:${email}`;
  if (!memCache[key]) {
    memCache[key] = getFreshSession(email, password);
  }
  return memCache[key];
}

export async function getSession(email: string, password: string): Promise<Session> {
  const s = await getSessionPersisted(email, password);
  return { userId: s.userId, token: s.accessToken };
}

export function sessionA() {
  return getSession(USER_A.email, USER_A.password);
}
export function sessionB() {
  return getSession(USER_B.email, USER_B.password);
}

// -----------------------------------------------------------------------------
// GraphQL helpers (with timeout)
// -----------------------------------------------------------------------------
type GraphqlOpts =
  | { user?: 'A' | 'B'; url?: string; token?: string; timeoutMs?: number }
  | undefined;

export async function graphqlFetch<TData = any>(
  query: string,
  variables?: Record<string, unknown>,
  opts?: GraphqlOpts
): Promise<TData> {
  const url = (opts?.url ?? GRAPHQL_URL).trim();
  if (!url) throw new Error('GRAPHQL_URL missing: set HASURA_GRAPHQL_ENDPOINT or NHOST_GRAPHQL_URL');

  let token = opts?.token;
  if (!token) {
    const s = (opts?.user ?? 'A') === 'A' ? await sessionA() : await sessionB();
    token = s.token;
  }

  const res = await fetchWithTimeout(
    url,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ query, variables }),
      // @ts-ignore
      keepalive: false,
    },
    opts?.timeoutMs ?? DEFAULT_HTTP_TIMEOUT_MS
  );

  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`Invalid JSON from GraphQL: ${text.slice(0, 800)}`);
  }

  if (!res.ok) {
    const snippet = typeof json === 'object' && json !== null ? JSON.stringify(json).slice(0, 800) : text.slice(0, 800);
    throw new Error(`GraphQL HTTP ${res.status} ${res.statusText}: ${snippet}`);
  }

  if (Array.isArray(json?.errors) && json.errors.length) {
    const msg = json.errors.map((e: any) => e?.message ?? '').join(' | ');
    throw new Error(msg || 'GraphQL error');
  }

  return json?.data as TData;
}

export function gqlA<TData = any>(query: string, variables?: Record<string, unknown>) {
  return graphqlFetch<TData>(query, variables, { user: 'A' });
}
export function gqlB<TData = any>(query: string, variables?: Record<string, unknown>) {
  return graphqlFetch<TData>(query, variables, { user: 'B' });
}

// -----------------------------------------------------------------------------
// Misc tiny helpers
// -----------------------------------------------------------------------------
export function testSuffix(prefix = 't') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}
