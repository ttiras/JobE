// tests/enum.org_size.test.ts
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

// Admin (or anonymous) GraphQL call
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

describe('org_size enum', () => {
  it('is exposed as a GraphQL ENUM with at least one value', async () => {
    const query = /* GraphQL */ `
      query {
        __type(name: "org_size_enum") {
          kind
          name
          enumValues { name }
        }
      }
    `;

    const json = await gqlAdmin<{
      data: { __type: { kind: string; name: string; enumValues: { name: string }[] } | null };
    }>(query);

    expect(json?.data?.__type?.kind).toBe('ENUM');
    expect(json?.data?.__type?.name).toBe('org_size_enum');
    expect((json?.data?.__type?.enumValues ?? []).length).toBeGreaterThan(0);
  });
});
