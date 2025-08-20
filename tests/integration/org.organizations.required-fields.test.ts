// tests/org.organizations.required-fields.test.ts
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

// Admin GraphQL call (bypasses RLS to test pure NOT NULL/constraint behavior)
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

describe('organizations required fields', () => {
  it('rejects insert without created_by', async () => {
    const mutation = /* GraphQL */ `
      mutation($name: String!) {
        insert_organizations_one(object:{
          name: $name
        }) { id }
      }
    `;

    const json = await gqlAdmin<{ errors?: Array<{ message: string }> }>(mutation, {
      name: 'Constraint Check',
    });

    // Expect NOT NULL / constraint violation on created_by
    expect(Array.isArray((json as any).errors)).toBe(true);
    const msg = (json as any).errors?.map((e: any) => String(e.message)).join(' | ') ?? '';
    expect(msg.toLowerCase()).toMatch(/not[- ]?null|null value|constraint|created_by/);
  });
});
