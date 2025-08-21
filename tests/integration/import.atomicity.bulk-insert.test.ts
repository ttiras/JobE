// tests/integration/import.atomicity.bulk-insert.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { sessionA, graphqlFetch, GRAPHQL_URL, testSuffix } from '../helpers/auth';

type Org = { id: string };

const CREATE_ORG = /* GraphQL */ `
  mutation CreateOrg($name: String!, $size: org_size_enum!, $industry: industries_enum_enum, $country: countries_enum_enum) {
    insert_organizations_one(object: { name: $name, size: $size, industry: $industry, country: $country }) { id }
  }
`;

const INSERT_MANY_DEPTS = /* GraphQL */ `
  mutation InsertMany($rows: [departments_insert_input!]!) {
    insert_departments(objects: $rows) { affected_rows }
  }
`;

const LIST_DEPTS = /* GraphQL */ `
  query Get($o: uuid!) {
    departments(where: { organization_id: { _eq: $o } }) { id }
  }
`;

function rc(p: string) {
  return `${p}-${testSuffix('t')}`.toLowerCase();
}

let token: string;
let org: Org;

async function q<T>(query: string, variables: any): Promise<T> {
  return graphqlFetch<T>(query, variables, { token, url: GRAPHQL_URL });
}

describe('Bulk insert for onboarding is atomic on error', () => {
  beforeAll(async () => {
    token = (await sessionA()).token;
    type CreateOrgResult = { insert_organizations_one: { id: string } };
    org = (await q<CreateOrgResult>(
      CREATE_ORG,
      { name: rc('Org'), size: 'S2_10', industry: 'CONSUMER', country: 'TR' } // <- underscore
    )).insert_organizations_one;
  });

  it('All-or-nothing on duplicate department code', async () => {
    const dupe = rc('fin');
    const rows = [
      { organization_id: org.id, dept_code: dupe, name: 'Finance 1' },
      { organization_id: org.id, dept_code: dupe, name: 'Finance 2' }, // duplicate per org
      { organization_id: org.id, dept_code: rc('it'), name: 'IT' },
    ];

    await expect(
      q<{ insert_departments: { affected_rows: number } }>(INSERT_MANY_DEPTS, { rows })
    ).rejects.toThrowError();

    const after = await q<{ departments: { id: string }[] }>(LIST_DEPTS, { o: org.id });
    expect(after.departments.length).toBe(0);
  });
});
