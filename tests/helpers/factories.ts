// tests/helpers/factories.ts
import { gqlAs } from './gql';
import { testSuffix } from './auth';

export type OrgInput = {
  name?: string;
  industry?: 'CONSUMER';
  country?: 'TR' | 'US';
  // Correct org_size enum values
  size?:
    | 'S2_10'
    | 'S11_50'
    | 'S51_200'
    | 'S201_500'
    | 'S501_1000'
    | 'S1001_5000'
    | 'S5001_10000'
    | 'S10001_PLUS';
};

export async function createOrg(input: OrgInput = {}, user: 'A' | 'B' = 'A') {
  const name = input.name ?? `Org ${testSuffix('org')}`;
  const industry = input.industry ?? 'CONSUMER';
  const country = input.country ?? 'US';
  const size = input.size ?? 'S2_10';

  const q = /* GraphQL */ `
    mutation($name:String!,$industry:industries_enum_enum!,$country:countries_enum_enum!,$size:org_size_enum!){
      insert_organizations_one(object:{ name:$name, industry:$industry, country:$country, size:$size }){
        id name industry country size currency created_by
      }
    }
  `;

  const data = await gqlAs<{ insert_organizations_one: any }>(q, { name, industry, country, size }, user);
  return data.insert_organizations_one as {
    id: string; name: string; industry: string; country: string; size: string; currency: string; created_by: string;
  };
}

// Provide varied org inputs to spread coverage across enum values
export function variedOrg(index: number): OrgInput {
  const sizes: OrgInput['size'][] = [
    'S2_10',
    'S11_50',
    'S51_200',
    'S201_500',
    'S501_1000',
    'S1001_5000',
    'S5001_10000',
    'S10001_PLUS',
  ];
  return {
    industry: 'CONSUMER',
    country: index % 2 === 0 ? 'US' : 'TR',
    size: sizes[index % sizes.length],
  };
}

export async function createDept(orgId: string, props: { code?: string; name?: string; parent_id?: string | null } = {}, user: 'A' | 'B' = 'A') {
  const dept_code = props.code ?? testSuffix('dept').slice(0, 12);
  const name = props.name ?? `Dept ${dept_code}`;

  const q = /* GraphQL */ `
    mutation($organization_id:uuid!,$dept_code:String!,$name:String!,$parent_id:uuid){
      insert_departments_one(object:{ organization_id:$organization_id, dept_code:$dept_code, name:$name, parent_id:$parent_id }){
        id organization_id dept_code name parent_id
      }
    }
  `;

  const data = await gqlAs<{ insert_departments_one: any }>(q, { organization_id: orgId, dept_code, name, parent_id: props.parent_id ?? null }, user);
  return data.insert_departments_one as { id: string; organization_id: string; dept_code: string; name: string; parent_id: string | null };
}

export async function createPosition(orgId: string, deptId: string, props: { title?: string; pos_code?: string } = {}, user: 'A' | 'B' = 'A') {
  const title = props.title ?? `Pos ${testSuffix('pos')}`;
  const pos_code = props.pos_code ?? testSuffix('pc').replace(/[^a-z0-9]/gi, '').slice(0, 16);
  const q = /* GraphQL */ `
    mutation($organization_id:uuid!,$department_id:uuid!,$title:String!,$pos_code:String!){
      insert_positions_one(object:{ organization_id:$organization_id, department_id:$department_id, title:$title, pos_code:$pos_code }){
        id organization_id department_id title pos_code
      }
    }
  `;
  const data = await gqlAs<{ insert_positions_one: any }>(q, { organization_id: orgId, department_id: deptId, title, pos_code }, user);
  return data.insert_positions_one as { id: string; organization_id: string; department_id: string; title: string; pos_code: string };
}

export async function withTempOrg<T>(fn: (org: { id: string }) => Promise<T>, user: 'A' | 'B' = 'A', input: OrgInput = {}) {
  const org = await createOrg(input, user);
  return fn(org);
}
