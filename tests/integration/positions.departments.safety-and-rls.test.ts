import { describe, it, expect } from 'vitest';
import { getSession } from '../helpers/auth';

const ENDPOINT = process.env.HASURA_GRAPHQL_ENDPOINT!;

// Stable enum literals (hard-coded)
const TR = 'TR';
const US = 'US';
const ORG_SIZE: 'S2_10' = 'S2_10';
const INDUSTRY: 'CONSUMER' = 'CONSUMER';

// --- Generic gql helper ------------------------------------------------------
async function gql<T>(
  query: string,
  variables?: Record<string, unknown>,
  token?: string
): Promise<T> {
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

// --- Create helpers ----------------------------------------------------------
async function createOrg(token: string, name: string, country: string) {
  const insert = `
    mutation($name:String!){
      insert_organizations_one(object:{
        name:$name, 
        industry:${INDUSTRY}, 
        country:${country}, 
        size:${ORG_SIZE}
      }){
        id name created_by country currency industry size
      }
    }
  `;
  const r: any = await gql(insert, { name }, token);
  if (r.errors) console.error('createOrg errors:', r.errors);
  return r?.data?.insert_organizations_one as {
    id: string;
    name: string;
    created_by: string;
    country: string;
    currency: string;
  };
}

async function createDept(
  token: string,
  organization_id: string,
  dept_code: string,
  name: string,
  parent_id?: string | null
) {
  const insert = `
    mutation($organization_id:uuid!, $dept_code:String!, $name:String!, $parent_id:uuid){
      insert_departments_one(object:{
        organization_id:$organization_id, dept_code:$dept_code, name:$name, parent_id:$parent_id
      }){
        id organization_id dept_code name parent_id
      }
    }
  `;
  const r: any = await gql(insert, { organization_id, dept_code, name, parent_id }, token);
  if (r.errors) console.error('createDept errors:', r.errors);
  return r?.data?.insert_departments_one as { id: string; organization_id: string };
}

async function createPos(
  token: string,
  organization_id: string,
  department_id: string,
  title: string,
  pos_code: string,
  reports_to_id?: string | null
) {
  const insert = `
    mutation($organization_id:uuid!, $department_id:uuid!, $title:String!, $pos_code:String!, $reports_to_id:uuid){
      insert_positions_one(object:{
        organization_id:$organization_id,
        department_id:$department_id,
        title:$title,
        pos_code:$pos_code,
        reports_to_id:$reports_to_id
      }){
        id organization_id department_id title pos_code reports_to_id
      }
    }
  `;
  const r: any = await gql(insert, { organization_id, department_id, title, pos_code, reports_to_id }, token);
  if (r.errors) console.error('createPos errors:', r.errors);
  return r?.data?.insert_positions_one as { id: string; organization_id: string; department_id: string };
}

function expectErrorMsg(errors: any[], re: RegExp) {
  expect(Array.isArray(errors)).toBe(true);
  const msg = (errors ?? []).map((e: any) => e.message).join(' | ').toLowerCase();
  expect(msg).toMatch(re);
}

// --- Tests -------------------------------------------------------------------
describe('DB safety rails + RLS', () => {
  it('composite FK: position cannot point to a department from another org', async () => {
    const { token } = await getSession(process.env.NHOST_TEST_EMAIL_A!, process.env.NHOST_TEST_PASSWORD_A!);

    const orgA = await createOrg(token, `ACME A ${Date.now()}`, TR);
    const orgB = await createOrg(token, `ACME B ${Date.now()}`, US);

    const deptA = await createDept(token, orgA.id, 'A-ENG', 'Engineering');
    const deptB = await createDept(token, orgB.id, 'B-SLS', 'Sales');

    const posA = await createPos(token, orgA.id, deptA.id, 'Backend Dev', 'ENG-001');
    expect(posA.organization_id).toBe(orgA.id);

    const upd = `
      mutation($id:uuid!, $dept:uuid!){
        update_positions_by_pk(pk_columns:{id:$id}, _set:{department_id:$dept}) {
          id
        }
      }
    `;
    const r: any = await gql(upd, { id: posA.id, dept: deptB.id }, token);
    expectErrorMsg(r.errors, /foreign key|violates|constraint/i);
  }, 20_000);

  it('composite FK: reports_to must be in the same org', async () => {
    const { token } = await getSession(process.env.NHOST_TEST_EMAIL_A!, process.env.NHOST_TEST_PASSWORD_A!);

    const orgA = await createOrg(token, `ORG A ${Date.now()}`, TR);
    const orgB = await createOrg(token, `ORG B ${Date.now()}`, US);

    const deptA = await createDept(token, orgA.id, 'A-PROD', 'Product');
    const deptB = await createDept(token, orgB.id, 'B-PROD', 'Product');

    const pA1 = await createPos(token, orgA.id, deptA.id, 'A Manager', 'A-001');
    const pB1 = await createPos(token, orgB.id, deptB.id, 'B Manager', 'B-001');

    const upd = `
      mutation($id:uuid!, $boss:uuid!){
        update_positions_by_pk(pk_columns:{id:$id}, _set:{reports_to_id:$boss}) {
          id
        }
      }
    `;
    const r: any = await gql(upd, { id: pA1.id, boss: pB1.id }, token);
    expectErrorMsg(r.errors, /foreign key|violates|constraint/i);
  }, 20_000);

  it('composite FK: department.parent must stay in the same org', async () => {
    const { token } = await getSession(process.env.NHOST_TEST_EMAIL_A!, process.env.NHOST_TEST_PASSWORD_A!);

    const orgA = await createOrg(token, `PARENT A ${Date.now()}`, TR);
    const orgB = await createOrg(token, `PARENT B ${Date.now()}`, US);

    const rootA = await createDept(token, orgA.id, 'A-ROOT', 'Root A');
    const childA = await createDept(token, orgA.id, 'A-CHILD', 'Child A');
    const rootB = await createDept(token, orgB.id, 'B-ROOT', 'Root B');

    const upd = `
      mutation($id:uuid!, $parent:uuid){
        update_departments_by_pk(pk_columns:{id:$id}, _set:{parent_id:$parent}) {
          id
        }
      }
    `;
    const r: any = await gql(upd, { id: childA.id, parent: rootB.id }, token);
    expectErrorMsg(r.errors, /foreign key|violates|constraint/i);
  }, 20_000);

  it('RLS: anonymous cannot query or insert positions', async () => {
    // select
    const q = `query { positions { id } }`;
    const sel: any = await gql(q);
    expect(Array.isArray(sel?.errors)).toBe(true);
    const selMsg = (sel.errors ?? []).map((e: any) => e.message).join(' | ').toLowerCase();
    expect(selMsg).toMatch(/not authorized|no select permission|forbidden|not found in type/);

    // insert
    const m = `
      mutation {
        insert_positions_one(object:{
          organization_id:"00000000-0000-0000-0000-000000000000",
          department_id:"00000000-0000-0000-0000-000000000000",
          title:"x", pos_code:"x"
        }) { id }
      }
    `;
    const ins: any = await gql(m);
    expect(Array.isArray(ins?.errors)).toBe(true);
    const insMsg = (ins.errors ?? []).map((e: any) => e.message).join(' | ').toLowerCase();
    expect(insMsg).toMatch(/not authorized|no insert permission|forbidden|validation-failed|no mutations exist/);
  });

  it('organizations: currency defaults by country (TRY for TR, USD otherwise)', async () => {
    const { token, userId } = await getSession(process.env.NHOST_TEST_EMAIL_A!, process.env.NHOST_TEST_PASSWORD_A!);

    const tr = await createOrg(token, `TR Org ${Date.now()}`, TR);
    const us = await createOrg(token, `US Org ${Date.now()}`, US);

    expect(tr.created_by).toBe(userId);
    expect(us.created_by).toBe(userId);
    expect(tr.country).toBe(TR);
    expect(us.country).toBe(US);
    expect(tr.currency).toBe('TRY');
    expect(us.currency).toBe('USD');
  }, 20_000);
});
