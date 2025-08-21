import { describe, it, expect } from 'vitest';
import { getSession } from '../helpers/auth';

const ENDPOINT =
  process.env.NHOST_GRAPHQL_URL?.trim() ||
  process.env.HASURA_GRAPHQL_ENDPOINT?.trim() ||
  '';

if (!ENDPOINT) {
  throw new Error('GraphQL endpoint missing. Set NHOST_GRAPHQL_URL or HASURA_GRAPHQL_ENDPOINT.');
}

async function gql<T>(q: string, vars?: any, token?: string): Promise<T> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ query: q, variables: vars }),
  });
  // don’t throw on errors — tests assert on them
  return res.json() as Promise<T>;
}

// --- helpers -------------------------------------------------------------

async function createOrg(token: string, name: string, countryPref: string = 'US') {
  const industry = 'CONSUMER';     // fixed industries_enum_enum
  const size = 'S2_10';        // fixed org_size_enum
  const country = countryPref; // use arg, default US

  const m = `
    mutation($name:String!,$industry:industries_enum_enum!,$country:countries_enum_enum!,$size:org_size_enum!){
      insert_organizations_one(object:{
        name:$name, industry:$industry, country:$country, size:$size
      }){ id }
    }`;
  const r: any = await gql(m, { name, industry, country, size }, token);
  return r?.data?.insert_organizations_one?.id as string;
}

async function createDept(token: string, organization_id: string, dept_code: string, name: string) {
  const m = `
    mutation($organization_id:uuid!, $dept_code:String!, $name:String!){
      insert_departments_one(object:{
        organization_id:$organization_id, dept_code:$dept_code, name:$name
      }){ id }
    }`;
  const r: any = await gql(m, { organization_id, dept_code, name }, token);

  if (r.errors) throw new Error(JSON.stringify(r.errors));
  return r?.data?.insert_departments_one?.id as string;
}

// --- tests ---------------------------------------------------------------

describe('departments: unique code per org (hard deletes)', () => {
  it('blocks duplicate dept_code in same org; allows across orgs; reinsert after delete works', async () => {
    const { token } = await getSession(
      process.env.NHOST_TEST_EMAIL_A!,
      process.env.NHOST_TEST_PASSWORD_A!
    );

    const orgA = await createOrg(token, `ORG-A ${Date.now()}`, 'US');
    const orgB = await createOrg(token, `ORG-B ${Date.now()}`, 'US');

    const depA1 = await createDept(token, orgA, 'ENG', 'Engineering');
    expect(depA1).toBeTruthy();

    // duplicate in same org should fail — assert on errors without throwing
    const dup: any = await gql(
      `
      mutation($org: uuid!, $code: String!, $name: String!) {
        insert_departments_one(object:{organization_id:$org, dept_code:$code, name:$name}){ id }
      }`,
      { org: orgA, code: 'ENG', name: 'Eng 2' },
      token
    );
    const dupMsg = (dup.errors ?? []).map((e: any) => e.message).join(' ').toLowerCase();
    expect(Array.isArray(dup.errors)).toBe(true);
    expect(dupMsg).toMatch(/already exists|duplicate|unique/);

    // same code in another org is fine
    const depB = await createDept(token, orgB, 'ENG', 'Engineering');
    expect(depB).toBeTruthy();

    // hard delete in orgA
    const del: any = await gql(
      `mutation($id:uuid!){ delete_departments_by_pk(id:$id){ id } }`,
      { id: depA1 },
      token
    );
    expect(del?.data?.delete_departments_by_pk?.id).toBe(depA1);

    // Re-insert same code in orgA after delete should succeed
    const depA2 = await createDept(token, orgA, 'ENG', 'Engineering (recreated)');
    expect(depA2).toBeTruthy();
  });
});
