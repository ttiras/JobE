// tests/integration/org.organizations.insert.read.test.ts
import { describe, it, expect } from 'vitest';

const ENDPOINT = process.env.HASURA_GRAPHQL_ENDPOINT!;
const AUTH_URL = (() => {
  const raw = process.env.NHOST_AUTH_URL;
  if (!raw) throw new Error('NHOST_AUTH_URL is not set');
  return raw.replace(/\/+$/, '');
})();

async function gql<T>(query: string, variables?: Record<string, unknown>, token?: string) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ query, variables }),
  });
  return res.json() as Promise<T>;
}

async function signIn(email: string, password: string) {
  const r = await fetch(`${AUTH_URL}/signin/email-password`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const j: any = await r.json();
  const userId = j?.session?.user?.id ?? j?.user?.id;
  const token =
    j?.session?.accessToken ??
    j?.session?.access_token ??      // handle alt casing if present
    j?.accessToken ??
    j?.access_token;
  if (!userId || !token) throw new Error(`Signin failed: ${JSON.stringify(j)}`);
  return { userId: userId as string, token: token as string };
}

describe('org insert/read with real user', () => {
  it('inserts an org using the dashboard user and reads it back', async () => {
    const { userId, token } = await signIn('test@test.com', '1234test1234');

    const slug = `e2e-${Date.now()}`;
    const name = 'E2E Org (dashboard user)';

    const insert = `
      mutation($name: String!, $slug: String!) {
        insert_organizations_one(object:{
          name: $name,
          slug: $slug
        }) { id slug created_by }
      }
    `;
    // ⬇️ do NOT pass uid anymore
    const inserted: any = await gql(insert, { name, slug }, token);

    if (!inserted?.data?.insert_organizations_one) {
      // eslint-disable-next-line no-console
      console.error('Insert errors:', inserted?.errors);
    }

    expect(inserted?.data?.insert_organizations_one?.slug).toBe(slug);
    expect(inserted?.data?.insert_organizations_one?.created_by).toBe(userId);

    const query = `
      query($slug: String!) {
        organizations(where:{slug:{_eq:$slug}}) {
          id slug created_by name
        }
      }
    `;
    const got: any = await gql(query, { slug }, token);
    expect(got?.data?.organizations?.length).toBe(1);
    expect(got.data.organizations[0].slug).toBe(slug);
    expect(got.data.organizations[0].created_by).toBe(userId);
  });
});
