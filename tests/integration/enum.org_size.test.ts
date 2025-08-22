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
  it('matches expected enum values', async () => {
    const query = /* GraphQL */ `
      query { __type(name: "org_size_enum") { kind name enumValues { name } } }
    `;

    const json = await gqlAdmin<{
      data: { __type: { kind: string; name: string; enumValues: { name: string }[] } | null };
    }>(query);

    const expected = [
      'S2_10',
      'S11_50',
      'S51_200',
      'S201_500',
      'S501_1000',
      'S1001_5000',
      'S5001_10000',
      'S10001_PLUS',
    ];

    expect(json?.data?.__type?.kind).toBe('ENUM');
    expect(json?.data?.__type?.name).toBe('org_size_enum');

    const values = (json?.data?.__type?.enumValues ?? []).map(v => v.name).sort();
    expect(values).toEqual([...expected].sort());
    // Ensure no duplicates
    expect(new Set(values).size).toBe(expected.length);
  });
});
