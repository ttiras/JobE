import { describe, it, expect, beforeAll } from 'vitest';
import { sessionA, sessionB, graphqlFetch, GRAPHQL_URL, testSuffix, pause } from '../helpers/auth';

type Org = { id: string };

const CREATE_ORG = /* GraphQL */ `
  mutation CreateOrg($name: String!) {
    insert_organizations_one(
      object: { name: $name, size: S2_10, industry: CONSUMER, country: US }
    ) { id }
  }
`;

const ADD_DEPT = /* GraphQL */ `
  mutation AddDept($orgId: uuid!, $dept_code: String!, $name: String!) {
    insert_departments_one(object: {
      organization_id: $orgId, dept_code: $dept_code, name: $name
    }) { id }
  }
`;

const SPOOF_ORG = /* GraphQL */ `
  mutation Spoof($id: uuid!, $orgId: uuid!) {
    update_departments_by_pk(
      pk_columns: { id: $id }, _set: { organization_id: $orgId }
    ) { id organization_id }
  }
`;

function rc(p: string) {
  return `${p}-${testSuffix('t')}`.toLowerCase();
}

let orgA: Org;
let orgB: Org;
let tokenA: string;
let tokenB: string;

// tiny gql helper that throws on GraphQL errors immediately
async function q<T>(query: string, variables: any, token: string): Promise<T> {
  const data = await graphqlFetch<any>(query, variables, { token, url: GRAPHQL_URL, timeoutMs: 6000 });
  return data as T;
}

// ---- robust beforeAll -------------------------------------------------------
const HOOK_TOUT = process.env.DOTENV_CONFIG_PATH?.includes('staging') ? 90_000 : 40_000;

beforeAll(
  async () => {
    // Guarded signin to avoid silent hangs
    async function guarded<T>(fn: () => Promise<T>, label: string): Promise<T> {
      const t = setTimeout(() => {
        // Make it VERY obvious which step hung
        throw new Error(`Timeout in beforeAll during: ${label}`);
      }, Math.min(HOOK_TOUT - 1000, 25_000));
      try {
        return await fn();
      } finally {
        clearTimeout(t);
      }
    }

    // Sign in sequentially; small pause helps avoid transient 429s on staging
    const a = await guarded(() => sessionA(), 'sessionA() signin/refresh');
    await pause(600);
    const b = await guarded(() => sessionB(), 'sessionB() signin/refresh');

    tokenA = a.token;
    tokenB = b.token;

    // Create one org per user
    type CreateOrgResult = { insert_organizations_one: { id: string } };
    orgA = (await q<CreateOrgResult>(CREATE_ORG, { name: rc('org-a') }, tokenA)).insert_organizations_one;
    orgB = (await q<CreateOrgResult>(CREATE_ORG, { name: rc('org-b') }, tokenB)).insert_organizations_one;
  },
  HOOK_TOUT
);

// ---- tests ------------------------------------------------------------------
describe('RLS: cross‑org writes are denied', () => {
  it(
    'User B cannot INSERT a department into Org A',
    async () => {
      await expect(
        q<{ insert_departments_one: { id: string } }>(
          ADD_DEPT,
          { orgId: orgA.id, dept_code: rc('fin'), name: 'Finance' },
          tokenB
        )
      ).rejects.toThrowError();
    },
    20_000
  );

  it(
    'User A cannot UPDATE a department to spoof organization_id to Org B',
    async () => {
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
    },
    20_000
  );
});
