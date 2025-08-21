// tests/integration/auth.cross-org.write-denied.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { sessionA, sessionB, graphqlFetch, GRAPHQL_URL, testSuffix } from '../helpers/auth';

type Org = { id: string };

const CREATE_ORG = /* GraphQL */ `
  mutation CreateOrg($name: String!, $size: org_size_enum!, $industry: industries_enum_enum, $country: countries_enum_enum) {
    insert_organizations_one(object: { name: $name, size: $size, industry: $industry, country: $country }) { id }
  }
`;

const ADD_DEPT = /* GraphQL */ `
  mutation AddDept($orgId: uuid!, $dept_code: String!, $name: String!) {
    insert_departments_one(object: { organization_id: $orgId, dept_code: $dept_code, name: $name }) { id }
  }
`;

const SPOOF_ORG = /* GraphQL */ `
  mutation Spoof($id: uuid!, $orgId: uuid!) {
    update_departments_by_pk(pk_columns: { id: $id }, _set: { organization_id: $orgId }) { id organization_id }
  }
`;

function rc(p: string) {
  return `${p}-${testSuffix('t')}`.toLowerCase();
}

let orgA: Org;
let orgB: Org;
let tokenA: string;
let tokenB: string;

async function q<T>(query: string, variables: any, token: string): Promise<T> {
  return graphqlFetch<T>(query, variables, { token, url: GRAPHQL_URL });
}

describe('RLS: cross‑org writes are denied', () => {
  beforeAll(async () => {
    const a = await sessionA();
    const b = await sessionB();
    tokenA = a.token;
    tokenB = b.token;

    type CreateOrgResult = { insert_organizations_one: { id: string } };
    orgA = (await q<CreateOrgResult>(
      CREATE_ORG,
      { name: rc('OrgA'), size: 'S2_10', industry: 'CONSUMER', country: 'TR' },
      tokenA
    )).insert_organizations_one;

    orgB = (await q<CreateOrgResult>(
      CREATE_ORG,
      { name: rc('OrgB'), size: 'S2_10', industry: 'CONSUMER', country: 'TR' },
      tokenB
    )).insert_organizations_one;
  });

  it('User B cannot INSERT a department into Org A', async () => {
    await expect(
      q<{ insert_departments_one: { id: string } }>(
        ADD_DEPT,
        { orgId: orgA.id, dept_code: rc('fin'), name: 'Finance' },
        tokenB
      )
    ).rejects.toThrowError();
  });

  it('User A cannot UPDATE a department to spoof organization_id to Org B', async () => {
    const created = await q<{ insert_departments_one: { id: string } }>(
      ADD_DEPT,
      { orgId: orgA.id, dept_code: rc('it'), name: 'IT' },
      tokenA
    );

    await expect(
      q<{ update_departments_by_pk: { id: string; organization_id: string } | null }>(
        SPOOF_ORG,
        { id: created.insert_departments_one.id, orgId: orgB.id },
        tokenA
      )
    ).rejects.toThrowError();
  });
});
