import { describe, it, expect } from 'vitest';

const ENDPOINT = process.env.HASURA_GRAPHQL_ENDPOINT!;
const ADMIN = process.env.HASURA_ADMIN_SECRET;

async function gql<T>(query: string, variables?: Record<string, unknown>) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(ADMIN ? { 'x-hasura-admin-secret': ADMIN } : {}),
    },
    body: JSON.stringify({ query, variables }),
  });
  return res.json() as Promise<T>;
}

describe('organizations required fields', () => {
  it('rejects insert without created_by', async () => {
    const slug = `test-${Date.now()}`;

    const mutation = `
      mutation($name: String!, $slug: String!) {
        insert_organizations_one(object:{
          name: $name,
          slug: $slug
          # intentionally omitting created_by to hit NOT NULL constraint
        }) { id }
      }
    `;

    const json = await gql<{ errors?: Array<{ message: string }> }>(mutation, {
      name: 'Constraint Check',
      slug,
    });

    // We expect an error (NOT NULL / constraint violation)
    expect(Array.isArray((json as any).errors)).toBe(true);
    const msg = (json as any).errors?.map((e: any) => e.message).join(' | ') ?? '';
    expect(msg.toLowerCase()).toMatch(/not[- ]?null|null value|constraint|created_by/);
  });
});
