// tests/positions.fk.required.test.ts
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

const ADMIN = process.env.HASURA_ADMIN_SECRET;

// Admin GraphQL (bypasses RLS to test DB FK behavior)
async function gqlAdmin<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(ADMIN ? { 'x-hasura-admin-secret': ADMIN } : {}),
    },
    body: JSON.stringify({ query, variables }),
  });
  const text = await res.text();
  try {
    return (text ? JSON.parse(text) : {}) as T;
  } catch {
    return { errors: [{ message: `Invalid JSON from server: ${text.slice(0, 300)}` }] } as T;
  }
}

describe('positions → FK required', () => {
  it('rejects insert when organization_id or department_id does not exist', async () => {
    const mutation = /* GraphQL */ `
      mutation($o: uuid!, $d: uuid!) {
        insert_positions_one(object: {
          organization_id: $o,
          department_id:   $d,
          pos_code:        "DUPTEST",
          title:           "Bad Row"
        }) { id }
      }
    `;
    const json: any = await gqlAdmin(mutation, {
      o: crypto.randomUUID(),
      d: crypto.randomUUID(),
    });

    expect(Array.isArray(json?.errors)).toBe(true);
    const msg = (json.errors ?? []).map((e: any) => String(e.message)).join(' | ').toLowerCase();
    expect(msg).toMatch(/foreign key|violat|constraint/);
  });
});
