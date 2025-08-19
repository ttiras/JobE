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

describe('departments schema', () => {
  it('exposes id, organization_id, dept_code, name, parent_id', async () => {
    const query = `
      query {
        __type(name: "departments") {
          name
          fields { name }
        }
      }
    `;
    const json = await gql<{ data: { __type: { name: string, fields: { name: string }[] } | null } }>(query);

    const fields = new Set(json?.data?.__type?.fields?.map(f => f.name) ?? []);
    // minimal required columns we expect on the GraphQL object
    ['id','organization_id','dept_code','name','parent_id'].forEach(col => {
      expect(fields.has(col)).toBe(true);
    });
  });
});
