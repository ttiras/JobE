// tests/auth.anonymous.cannot-read-depts-positions.test.ts
import { describe, it, expect } from 'vitest';
import { GRAPHQL_URL } from '../helpers/auth';

const ENDPOINT =
  (GRAPHQL_URL && GRAPHQL_URL.trim()) ||
  process.env.NHOST_GRAPHQL_URL ||
  process.env.HASURA_GRAPHQL_ENDPOINT ||
  '';

if (!ENDPOINT) {
  throw new Error(
    'GraphQL endpoint missing. Set NHOST_GRAPHQL_URL (preferred) or HASURA_GRAPHQL_ENDPOINT.'
  );
}

// Anonymous GraphQL call (intentionally no Authorization header)
async function gqlAnonymous<T>(q: string): Promise<T> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query: q }),
  });
  const text = await res.text();
  try {
    return (text ? JSON.parse(text) : {}) as T;
  } catch {
    return { errors: [{ message: `Invalid JSON from server: ${text.slice(0, 300)}` }] } as T;
  }
}

function errMsg(errors: any[]) {
  return (errors ?? []).map((e: any) => e?.message ?? '').join(' | ').toLowerCase();
}

describe('RLS: anonymous cannot read departments/positions', () => {
  it('blocks departments', async () => {
    const q = /* GraphQL */ `query { departments { id } }`;
    const r: any = await gqlAnonymous(q);
    expect(Array.isArray(r?.errors)).toBe(true);
    expect(errMsg(r.errors)).toMatch(
      /not authorized|no select permission|forbidden|not found in type/
    );
  });

  it('blocks positions', async () => {
    const q = /* GraphQL */ `query { positions { id } }`;
    const r: any = await gqlAnonymous(q);
    expect(Array.isArray(r?.errors)).toBe(true);
    expect(errMsg(r.errors)).toMatch(
      /not authorized|no select permission|forbidden|not found in type/
    );
  });
});
