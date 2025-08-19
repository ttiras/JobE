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

describe('org_size enum', () => {
  it('is exposed as a GraphQL ENUM with at least one value', async () => {
    const query = `
      query {
        __type(name: "org_size_enum") {
          kind
          name
          enumValues { name }
        }
      }
    `;
    const json = await gql<{ data: { __type: { kind: string; name: string; enumValues: { name: string }[] } | null } }>(query);

    expect(json?.data?.__type?.kind).toBe('ENUM');
    expect(json?.data?.__type?.name).toBe('org_size_enum');
    expect((json?.data?.__type?.enumValues ?? []).length).toBeGreaterThan(0);
  });
});
