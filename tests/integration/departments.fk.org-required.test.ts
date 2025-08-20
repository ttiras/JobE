// tests/departments.fk.org-required.test.ts
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

// Admin GraphQL (intentionally bypasses RLS to test pure FK behavior)
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

describe('departments → must reference an existing organization', () => {
  it('rejects insert when organization_id does not exist', async () => {
    const mutation = /* GraphQL */ `
      mutation($org: uuid!, $code: String!, $name: String!) {
        insert_departments_one(object: {
          organization_id: $org,
          dept_code: $code,
          name: $name
        }) { id }
      }
    `;

    const json = await gqlAdmin<{ errors?: Array<{ message: string }> }>(mutation, {
      org: crypto.randomUUID(),
      code: `qa-${Date.now()}`,
      name: 'Should Fail (No Org)',
    });

    // Expect a FK/constraint error
    expect(Array.isArray((json as any).errors)).toBe(true);
    const msg = (json as any).errors?.map((e: any) => String(e.message)).join(' | ') ?? '';
    expect(msg.toLowerCase()).toMatch(/foreign key|violates|constraint/);
  });
});
