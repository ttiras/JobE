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

describe('organizations → created_by must reference auth.users', () => {
  it('rejects insert when created_by user does not exist', async () => {
    const mutation = `
      mutation($name: String!, $slug: String!, $user: uuid!) {
        insert_organizations_one(object:{
          name: $name,
          slug: $slug,
          created_by: $user
        }) { id }
      }
    `;
    const json = await gql<{ errors?: Array<{ message: string }> }>(mutation, {
      name: 'FK should fail',
      slug: `fk-test-${Date.now()}`, // lowercase to avoid slug-format issues
      user: crypto.randomUUID(),     // non-existent user id
    });

    expect(Array.isArray((json as any).errors)).toBe(true);
    const msg = (json as any).errors?.map((e: any) => e.message).join(' | ') ?? '';
    expect(msg.toLowerCase()).toMatch(/foreign key|violates|constraint|auth\.users/);
  });
});