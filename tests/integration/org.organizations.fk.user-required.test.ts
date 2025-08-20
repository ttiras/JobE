// tests/org.organizations.fk.user-required.test.ts
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

// Admin GraphQL (bypass RLS to validate DB FK)
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

describe('organizations → created_by must reference auth.users', () => {
  it('rejects insert when created_by user does not exist', async () => {
    const mutation = /* GraphQL */ `
      mutation($name: String!, $user: uuid!) {
        insert_organizations_one(object:{
          name: $name,
          created_by: $user
        }) { id }
      }
    `;

    const json = await gqlAdmin<{ errors?: Array<{ message: string }> }>(mutation, {
      name: 'FK should fail',
      user: crypto.randomUUID(), // non-existent user id
    });

    expect(Array.isArray((json as any).errors)).toBe(true);
    const msg = (json as any).errors?.map((e: any) => String(e.message)).join(' | ') ?? '';
    expect(msg.toLowerCase()).toMatch(/foreign key|violates|constraint|auth\.users/);
  });
});
