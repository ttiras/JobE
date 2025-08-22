import { describe, it, expect, beforeAll } from 'vitest';
import { getSession } from '../helpers/auth';

// ─────────────────────────────────────────────────────────────────────────────
// Staging-aware timeouts
// ─────────────────────────────────────────────────────────────────────────────
const IS_STAGING =
  (process.env.DOTENV_CONFIG_PATH ?? '').includes('staging') ||
  process.env.NODE_ENV === 'staging' ||
  process.env.CI === 'true';

const HOOK_TIMEOUT = IS_STAGING ? 120_000 : 60_000;  // extended for slower CI
const IT_TIMEOUT   = IS_STAGING ? 120_000 : 60_000;  // extended scenario timeout

// ─────────────────────────────────────────────────────────────────────────────
// Hard-coded enums (kept in sync with Hasura migrations/metadata)
// ─────────────────────────────────────────────────────────────────────────────
const ENUMS = {
  SIZE: 'S2_10' as const,
  INDUSTRY: 'CONSUMER' as const,
  TR: 'TR' as const,
  US: 'US' as const,
};

// ─────────────────────────────────────────────────────────────────────────────
// Endpoint
// ─────────────────────────────────────────────────────────────────────────────
const ENDPOINT =
  process.env.NHOST_GRAPHQL_URL?.trim() ||
  process.env.HASURA_GRAPHQL_ENDPOINT?.trim() ||
  '';

if (!ENDPOINT) {
  throw new Error('GraphQL endpoint missing. Set NHOST_GRAPHQL_URL or HASURA_GRAPHQL_ENDPOINT.');
}

// ─────────────────────────────────────────────────────────────────────────────
// Non-throwing gql (so we can assert on .errors for negative cases)
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// Small helpers (pure GraphQL, sequential calls)
// ─────────────────────────────────────────────────────────────────────────────
async function createOrg(
  token: string,
  name: string,
  country: string,
  industry: string,
  size: string
) {
  const m = `
    mutation($name: String!, $industry: industries_enum_enum!, $country: countries_enum_enum!, $size: org_size_enum!) {
      insert_organizations_one(object:{
        name: $name,
        industry: $industry,
        country: $country,
        size: $size
      }) {
        id name created_by industry country size
      }
    }
  `;
  const r: any = await gql(m, { name, industry, country, size }, token);
  return r?.data?.insert_organizations_one as
    | { id: string; name: string; created_by: string; industry: string; country: string; size: string }
    | undefined;
}

async function createDept(
  token: string,
  organization_id: string,
  dept_code: string,
  name: string,
  parent_id?: string | null
) {
  const m = `
    mutation($organization_id: uuid!, $dept_code: String!, $name: String!, $parent_id: uuid) {
      insert_departments_one(object:{
        organization_id: $organization_id,
        dept_code: $dept_code,
        name: $name,
        parent_id: $parent_id
      }) {
        id organization_id dept_code name parent_id
      }
    }
  `;
  const r: any = await gql(m, { organization_id, dept_code, name, parent_id }, token);
  return r?.data?.insert_departments_one as
    | { id: string; organization_id: string; dept_code: string; name: string; parent_id: string | null }
    | undefined;
}

async function createPos(
  token: string,
  organization_id: string,
  department_id: string,
  title: string,
  pos_code: string,
  reports_to_id?: string | null
) {
  const m = `
    mutation($organization_id: uuid!, $department_id: uuid!, $title: String!, $pos_code: String!, $reports_to_id: uuid) {
      insert_positions_one(object:{
        organization_id: $organization_id,
        department_id: $department_id,
        title: $title,
        pos_code: $pos_code,
        reports_to_id: $reports_to_id
      }) {
        id organization_id department_id title pos_code reports_to_id
      }
    }
  `;
  const r: any = await gql(
    m,
    { organization_id, department_id, title, pos_code, reports_to_id: reports_to_id ?? null },
    token
  );
  return r?.data?.insert_positions_one as
    | {
        id: string;
        organization_id: string;
        department_id: string;
        title: string;
        pos_code: string;
        reports_to_id: string | null;
      }
    | undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// Warm-up: sign in once for both users (sequential to avoid 429 on staging)
// ─────────────────────────────────────────────────────────────────────────────
let token1 = '';
let token2 = '';
let u1 = '';
let u2 = '';

beforeAll(async () => {
  const s1 = await getSession(
    process.env.NHOST_TEST_EMAIL_A!,
    process.env.NHOST_TEST_PASSWORD_A!
  );
  token1 = s1.token; u1 = s1.userId;

  const s2 = await getSession(
    process.env.NHOST_TEST_EMAIL_B!,
    process.env.NHOST_TEST_PASSWORD_B!
  );
  token2 = s2.token; u2 = s2.userId;
}, HOOK_TIMEOUT);

// ─────────────────────────────────────────────────────────────────────────────
// Test
// ─────────────────────────────────────────────────────────────────────────────
describe('multi-user isolation + same-org safety', () => {
  it(
    'each user can only see/mutate their own org/dept/pos; composite FKs block cross-org refs',
    async () => {
      // Create separate orgs
      const orgA = await createOrg(token1, `Org A ${Date.now()}`, ENUMS.TR, ENUMS.INDUSTRY, ENUMS.SIZE);
      const orgB = await createOrg(token2, `Org B ${Date.now()}`, ENUMS.US, ENUMS.INDUSTRY, ENUMS.SIZE);

      expect(orgA?.created_by).toBe(u1);
      expect(orgB?.created_by).toBe(u2);
      if (!orgA || !orgB) throw new Error('Org creation failed');

      // Create departments
      const deptA = await createDept(token1, orgA.id, 'A-ENG', 'Engineering');
      const deptB = await createDept(token2, orgB.id, 'B-SLS', 'Sales');
      if (!deptA || !deptB) throw new Error('Dept creation failed');

      // Create top positions in each org
      const posA = await createPos(token1, orgA.id, deptA.id, 'A Manager', 'A-001');
      const posB = await createPos(token2, orgB.id, deptB.id, 'B Manager', 'B-001');
      if (!posA || !posB) throw new Error('Position creation failed');

      // RLS: user1 should not see user2's data
      const selOtherWithU1 = `
        query($orgId: uuid!) {
          organizations_by_pk(id:$orgId) { id }  # may be hidden entirely by RLS (null)
          departments(where:{organization_id:{_eq:$orgId}}) { id }
          positions(where:{organization_id:{_eq:$orgId}}) { id }
        }
      `;
      const r1: any = await gql(selOtherWithU1, { orgId: orgB.id }, token1);
      expect(r1?.data?.organizations_by_pk ?? null).toBeNull();
      expect((r1?.data?.departments ?? []).length).toBe(0);
      expect((r1?.data?.positions ?? []).length).toBe(0);

      // And vice-versa for user2 against orgA
      const r2: any = await gql(selOtherWithU1, { orgId: orgA.id }, token2);
      expect(r2?.data?.organizations_by_pk ?? null).toBeNull();
      expect((r2?.data?.departments ?? []).length).toBe(0);
      expect((r2?.data?.positions ?? []).length).toBe(0);

      // Composite FK guard: user1 tries to insert a position in orgA but with department from orgB
      const badInsert1 = `
        mutation($oid: uuid!, $did: uuid!) {
          insert_positions_one(object:{
            organization_id: $oid,
            department_id: $did,
            title: "Cross Dept",
            pos_code: "X-999"
          }) { id }
        }
      `;
      const b1: any = await gql(badInsert1, { oid: orgA.id, did: deptB.id }, token1);
      expect(Array.isArray(b1?.errors)).toBe(true);
      const msg1 = (b1.errors ?? []).map((e: any) => String(e.message).toLowerCase()).join(' | ');
      expect(msg1).toMatch(/foreign key|violat|constraint|not present/);

      // Composite FK guard: user1 tries to point reports_to_id to a manager from orgB
      const badInsert2 = `
        mutation($oid: uuid!, $did: uuid!, $rid: uuid!) {
          insert_positions_one(object:{
            organization_id: $oid,
            department_id: $did,
            title: "Cross Reports",
            pos_code: "X-998",
            reports_to_id: $rid
          }) { id }
        }
      `;
      const b2: any = await gql(badInsert2, { oid: orgA.id, did: deptA.id, rid: posB.id }, token1);
      expect(Array.isArray(b2?.errors)).toBe(true);
      const msg2 = (b2.errors ?? []).map((e: any) => String(e.message).toLowerCase()).join(' | ');
      expect(msg2).toMatch(/foreign key|violat|constraint|not present/);

      // RLS on updates: user2 cannot update user1's department
      const upd = `
        mutation($id: uuid!) {
          update_departments_by_pk(pk_columns:{id:$id}, _set:{name:"HACKED"}) {
            id name
          }
        }
      `;
      const utry: any = await gql(upd, { id: deptA.id }, token2);
      if (Array.isArray(utry?.errors)) {
        const umsg = (utry.errors ?? [])
          .map((e: any) => String(e.message).toLowerCase())
          .join(' | ');
        expect(umsg).toMatch(/not authorized|no update permission|forbidden|check constraint/i);
      } else {
        // Some RLS configs return null without error
        expect(utry?.data?.update_departments_by_pk ?? null).toBeNull();
      }
    },
    IT_TIMEOUT
  );
});
