// tests/auth.anonymous.cannot-insert-org.test.ts
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

// Anonymous GraphQL call: no auth headers on purpose
async function gqlAnonymous<T>(query: string, variables?: Record<string, unknown>) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' }, // no Authorization
    body: JSON.stringify({ query, variables }),
  });
  const text = await res.text();
  try {
    return (text ? JSON.parse(text) : {}) as T;
  } catch {
    // Return a shape similar to GraphQL error for assertion readability
    return { errors: [{ message: `Invalid JSON from server: ${text.slice(0, 300)}` }] } as T;
  }
}

describe('permissions: anonymous', () => {
  it('cannot insert an organization', async () => {
    const q = /* GraphQL */ `
      mutation($name:String!, $industry:String!){
        insert_organizations_one(object:{
          name:$name, industry:$industry
        }) { id }
      }
    `;

    const json: any = await gqlAnonymous(q, {
      name: 'Anon Org',
      industry: 'OTHER',
    });

    // Should be blocked by Hasura permissions
    expect(Array.isArray(json?.errors)).toBe(true);

    const msg = (json.errors ?? [])
      .map((e: any) => e?.message ?? '')
      .join(' | ')
      .toLowerCase();

    // Cover common Hasura/GraphQL phrasing
    expect(msg).toMatch(
      /not authorized|permission|access denied|unauthorized|no mutations exist/
    );
  });
});
