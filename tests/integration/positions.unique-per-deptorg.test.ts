import { describe, it, expect } from 'vitest';
import { getSession } from '../helpers/auth';

const ENDPOINT = process.env.HASURA_GRAPHQL_ENDPOINT!;

async function gql<T>(q: string, vars?: any, token?: string): Promise<T> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ query: q, variables: vars }),
  });
  return res.json() as Promise<T>;
}

// ── helpers (no enum queries) ────────────────────────────────────────────────
async function createOrg(token: string, name: string) {
  const m = `
    mutation($name:String!){
      insert_organizations_one(
        object:{
          name:$name,
          industry:CONSUMER,
          country:TR,
          size:S2_10
        }
      ){ id }
    }`;
  const r: any = await gql(m, { name }, token);
  return r?.data?.insert_organizations_one?.id as string;
}

async function createDept(token: string, organization_id: string, dept_code: string, name: string) {
  const m = `
    mutation($organization_id:uuid!, $dept_code:String!, $name:String!){
      insert_departments_one(object:{organization_id:$organization_id,dept_code:$dept_code,name:$name}){ id }
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

// ── test ─────────────────────────────────────────────────────────────────────
describe('positions: pos_code unique per (org, dept)', () => {
  it(
    'rejects duplicate in same (org, dept) and allows same code in another dept',
    async () => {
      const { token } = await getSession(process.env.NHOST_TEST_EMAIL_A!, process.env.NHOST_TEST_PASSWORD_A!);

      const org = await createOrg(token, `UQ ORG ${Date.now()}`);
      const eng = await createDept(token, org, 'ENG', 'Engineering');
      const sls = await createDept(token, org, 'SLS', 'Sales');

      const code = 'P-001';
      await createPos(token, org, eng, 'Engineer', code);

      // duplicate same dept should fail
      const dupe: any = await gql(
        `mutation($o:uuid!,$d:uuid!,$t:String!,$c:String!){
          insert_positions_one(object:{organization_id:$o,department_id:$d,title:$t,pos_code:$c}){ id }
        }`,
        { o: org, d: eng, t: 'Engineer 2', c: code },
        token
      );
      expect(Array.isArray(dupe?.errors)).toBe(true);

      // same code in different dept should succeed
      const ok: any = await gql(
        `mutation($o:uuid!,$d:uuid!,$t:String!,$c:String!){
          insert_positions_one(object:{organization_id:$o,department_id:$d,title:$t,pos_code:$c}){ id }
        }`,
        { o: org, d: sls, t: 'Sales Rep', c: code },
        token
      );
      expect(ok?.data?.insert_positions_one?.id).toBeTruthy();
    },
    20_000
  );
});
