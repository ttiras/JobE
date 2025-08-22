import { describe, it, expect, beforeAll } from 'vitest';
import { createOrg, createDept } from '../helpers/factories';
import { gqlAs } from '../helpers/gql';

function randCode(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`.toLowerCase();
}

let orgA: { id: string };
let orgB: { id: string };

const HOOK_TOUT = process.env.DOTENV_CONFIG_PATH?.includes('staging') ? 120_000 : 60_000;

beforeAll(async () => {
  // Create one org per user (tokens acquired lazily by gqlAs/createOrg helpers)
  orgA = await createOrg({ country: 'US', size: 'S2_10', industry: 'CONSUMER' }, 'A');
  orgB = await createOrg({ country: 'US', size: 'S2_10', industry: 'CONSUMER' }, 'B');
}, HOOK_TOUT);

describe('RLS: cross‑org writes are denied', () => {
  it(
    'User B cannot INSERT a department into Org A',
    async () => {
      const mutation = /* GraphQL */ `
        mutation($orgId: uuid!, $code: String!, $name: String!) {
          insert_departments_one(object:{ organization_id:$orgId, dept_code:$code, name:$name }) { id }
        }
      `;
      // Attempt cross-org insert as user B
      await expect(
        gqlAs(mutation, { orgId: orgA.id, code: randCode('fin'), name: 'Finance' }, 'B')
      ).rejects.toThrow(/not authorized|permission|violat|denied|validation-failed/i);
    },
    20_000
  );

  it(
    'User A cannot UPDATE a department to spoof organization_id to Org B',
    async () => {
      // Legit department in orgA by user A
      const dept = await createDept(orgA.id, { name: 'IT', code: randCode('it') }, 'A');
      const spoof = /* GraphQL */ `
        mutation($id: uuid!, $orgId: uuid!) {
          update_departments_by_pk(pk_columns:{ id:$id }, _set:{ organization_id:$orgId }) { id organization_id }
        }
      `;
      await expect(
        gqlAs(spoof, { id: dept.id, orgId: orgB.id }, 'A')
      ).rejects.toThrow(/not authorized|permission|violat|denied|validation-failed/i);
    },
    20_000
  );
});
