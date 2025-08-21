import { describe, it, expect } from 'vitest';
import { getSession } from '../helpers/auth';

const ENDPOINT = process.env.HASURA_GRAPHQL_ENDPOINT!;

async function gql<T>(q: string, vars?: Record<string, unknown>, token?: string): Promise<T> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ query: q, variables: vars }),
  });
  return res.json() as Promise<T>;
}

// --- helpers -------------------------------------------------------------

async function createOrg(token: string, name: string) {
  const industry = 'CONSUMER';         // any valid industries_enum_enum
  const size = 'S2_10';            // one fixed org_size_enum
  const country = 'TR';            // or 'US'

  const m = `
    mutation($name:String!,$industry:industries_enum_enum!,$country:countries_enum_enum!,$size:org_size_enum!){
      insert_organizations_one(object:{
        name:$name, industry:$industry, country:$country, size:$size
      }) { id }
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
  return r?.data?.insert_departments_one?.id as string;
}

async function createPos(token: string, organization_id: string, department_id: string, title: string, pos_code: string) {
  const m = `
    mutation($organization_id:uuid!,$department_id:uuid!,$title:String!,$pos_code:String!){
      insert_positions_one(object:{
        organization_id:$organization_id, department_id:$department_id, title:$title, pos_code:$pos_code
      }) { id }
    }`;
  const r: any = await gql(m, { organization_id, department_id, title, pos_code }, token);
  return r?.data?.insert_positions_one?.id as string;
}

// --- tests ---------------------------------------------------------------

describe('relationships: nested selects', () => {
  it(
    'positions expose department and organization fields and they resolve',
    async () => {
      const { token } = await getSession(
        process.env.NHOST_TEST_EMAIL_A!,
        process.env.NHOST_TEST_PASSWORD_A!
      );

      const orgId = await createOrg(token, `REL ORG ${Date.now()}`);
      const deptId = await createDept(token, orgId, 'REL-ENG', 'Engineering');
      await createPos(token, orgId, deptId, 'Engineer', 'ENG-REL-1');

      const q = `
        query($deptId:uuid!){
          positions(where:{department_id:{_eq:$deptId}}, limit:1){
            id
            department { id organization_id }
            organization { id }
          }
        }`;
      const r: any = await gql(q, { deptId }, token);
      const row = r?.data?.positions?.[0];
      expect(row?.department?.id).toBe(deptId);
      expect(row?.organization?.id).toBe(orgId);
      expect(row?.department?.organization_id).toBe(orgId);
    },
    20_000
  );
});
