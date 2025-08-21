import { describe, it, expect, beforeAll } from 'vitest';
import { sessionA, graphqlFetch, GRAPHQL_URL, testSuffix } from '../helpers/auth';

type Org = { id: string };

const CREATE_ORG = /* GraphQL */ `
  mutation CreateOrg($name: String!, $size: org_size_enum!, $industry: industries_enum_enum, $country: countries_enum_enum) {
    insert_organizations_one(object: { name: $name, size: $size, industry: $industry, country: $country }) { id }
  }
`;

const INSERT_DEPT = /* GraphQL */ `
  mutation Mk($o: uuid!, $c: String!, $n: String!, $parent: uuid) {
    insert_departments_one(object: { organization_id: $o, dept_code: $c, name: $n, parent_id: $parent }) { id }
  }
`;

const SET_PARENT = /* GraphQL */ `
  mutation Self($id: uuid!, $parent: uuid) {
    update_departments_by_pk(pk_columns: { id: $id }, _set: { parent_id: $parent }) { id }
  }
`;

function rc(p: string) {
  return `${p}-${testSuffix('t')}`.toLowerCase();
}

let token: string;
let org1: Org;
let org2: Org;

async function q<T>(query: string, variables: any): Promise<T> {
  return graphqlFetch<T>(query, variables, { token, url: GRAPHQL_URL });
}

describe('Departments hierarchy integrity', () => {
  beforeAll(async () => {
    token = (await sessionA()).token;

    type CreateOrgResult = { insert_organizations_one: { id: string } };
    org1 = (await q<CreateOrgResult>(CREATE_ORG, { name: rc('OrgA'), size: 'S2_10', industry: 'CONSUMER', country: 'TR' })).insert_organizations_one;
    org2 = (await q<CreateOrgResult>(CREATE_ORG, { name: rc('OrgA'), size: 'S2_10', industry: 'CONSUMER', country: 'TR' })).insert_organizations_one;
  });

  it('Parent must be in the same org', async () => {
    const parentInOrg1 = (await q<{ insert_departments_one: { id: string } }>(
      INSERT_DEPT,
      { o: org1.id, c: rc('sales'), n: 'Sales' }
    )).insert_departments_one;

    await expect(
      q<{ insert_departments_one: { id: string } }>(
        INSERT_DEPT,
        { o: org2.id, c: rc('sales-tr'), n: 'Sales TR', parent: parentInOrg1.id }
      )
    ).rejects.toThrowError();
  });

  it('A department cannot be its own parent (self‑cycle)', async () => {
    const d = (await q<{ insert_departments_one: { id: string } }>(
      INSERT_DEPT,
      { o: org1.id, c: rc('ops'), n: 'Ops' }
    )).insert_departments_one;

    await expect(
      q<{ update_departments_by_pk: { id: string } | null }>(SET_PARENT, { id: d.id, parent: d.id })
    ).rejects.toThrowError();
  });
});
