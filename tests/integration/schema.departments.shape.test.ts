// tests/schema.departments.shape.test.ts
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

describe('departments schema', () => {
  it('exposes id, organization_id, dept_code, name, parent_id', async () => {
    const query = /* GraphQL */ `
      query {
        __type(name: "departments") {
          name
          fields { name }
        }
      }
    `;
    const json = await gqlAdmin<{
      data: { __type: { name: string; fields: { name: string }[] } | null };
    }>(query);

    const fields = new Set(json?.data?.__type?.fields?.map(f => f.name) ?? []);
    // minimal required columns we expect on the GraphQL object
    ['id', 'organization_id', 'dept_code', 'name', 'parent_id'].forEach(col => {
      expect(fields.has(col)).toBe(true);
    });
  });
});
