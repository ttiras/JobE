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

describe('departments → must reference an existing organization', () => {
  it('rejects insert when organization_id does not exist', async () => {
    const mutation = `
      mutation($org: uuid!, $code: String!, $name: String!) {
        insert_departments_one(object: {
          organization_id: $org,
          dept_code: $code,
          name: $name
        }) { id }
      }
    `;
    const json = await gql<{ errors?: Array<{ message: string }> }>(mutation, {
      org: crypto.randomUUID(),
      code: `qa-${Date.now()}`,
      name: 'Should Fail (No Org)',
    });

    // Expect a FK/constraint error
    expect(Array.isArray((json as any).errors)).toBe(true);
    const msg = (json as any).errors?.map((e: any) => e.message).join(' | ') ?? '';
    expect(msg.toLowerCase()).toMatch(/foreign key|violates|constraint/);
  });
});
