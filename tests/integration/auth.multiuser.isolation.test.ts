import { describe, it, expect } from 'vitest';
import { sessionA, sessionB } from '../helpers/auth';
import { createOrg, createDept, createPosition } from '../helpers/factories';
import { gqlAs } from '../helpers/gql';

// ─────────────────────────────────────────────────────────────────────────────
// Staging-aware timeouts
// ─────────────────────────────────────────────────────────────────────────────
const IS_STAGING =
  (process.env.DOTENV_CONFIG_PATH ?? '').includes('staging') ||
  process.env.NODE_ENV === 'staging' ||
  process.env.CI === 'true';
const IT_TIMEOUT = IS_STAGING ? 120_000 : 60_000;

// ─────────────────────────────────────────────────────────────────────────────
// Test
// ─────────────────────────────────────────────────────────────────────────────
describe('multi-user isolation + same-org safety', () => {
  it(
    'each user can only see/mutate their own org/dept/pos; composite FKs block cross-org refs',
    async () => {
      // Create separate orgs (helpers acquire tokens lazily)
      const orgA = await createOrg({ country: 'TR', size: 'S2_10', industry: 'CONSUMER' }, 'A');
      const orgB = await createOrg({ country: 'US', size: 'S2_10', industry: 'CONSUMER' }, 'B');
      const { userId: u1 } = await sessionA();
      const { userId: u2 } = await sessionB();
      expect(orgA.created_by).toBe(u1);
      expect(orgB.created_by).toBe(u2);

      // Departments
      const deptA = await createDept(orgA.id, { code: 'A-ENG', name: 'Engineering' }, 'A');
      const deptB = await createDept(orgB.id, { code: 'B-SLS', name: 'Sales' }, 'B');

      // Top positions
      const posA = await createPosition(orgA.id, deptA.id, { title: 'A Manager', pos_code: 'A-001' }, 'A');
      const posB = await createPosition(orgB.id, deptB.id, { title: 'B Manager', pos_code: 'B-001' }, 'B');

      // RLS visibility checks
      const sel = /* GraphQL */ `
        query($orgId: uuid!) {
          organizations_by_pk(id:$orgId){ id }
          departments(where:{organization_id:{_eq:$orgId}}){ id }
          positions(where:{organization_id:{_eq:$orgId}}){ id }
        }
      `;
      const viewBAsA = await gqlAs<any>(sel, { orgId: orgB.id }, 'A');
      expect(viewBAsA.organizations_by_pk ?? null).toBeNull();
      expect((viewBAsA.departments ?? []).length).toBe(0);
      expect((viewBAsA.positions ?? []).length).toBe(0);

      const viewAAsB = await gqlAs<any>(sel, { orgId: orgA.id }, 'B');
      expect(viewAAsB.organizations_by_pk ?? null).toBeNull();
      expect((viewAAsB.departments ?? []).length).toBe(0);
      expect((viewAAsB.positions ?? []).length).toBe(0);

      // Cross-org department mismatch on position insert
      const badInsert1 = /* GraphQL */ `
        mutation($oid: uuid!, $did: uuid!) {
          insert_positions_one(object:{ organization_id:$oid, department_id:$did, title:"Cross Dept", pos_code:"X-999" }) { id }
        }
      `;
      let err1 = '';
      try {
        await gqlAs(badInsert1, { oid: orgA.id, did: deptB.id }, 'A');
        throw new Error('expected FK violation (dept from other org)');
      } catch (e: any) {
        err1 = String(e.message || e).toLowerCase();
      }
      expect(err1).toMatch(/foreign key|violat|constraint|not present/);

      // Cross-org reports_to manager
      const badInsert2 = /* GraphQL */ `
        mutation($oid: uuid!, $did: uuid!, $rid: uuid!) {
          insert_positions_one(object:{ organization_id:$oid, department_id:$did, title:"Cross Reports", pos_code:"X-998", reports_to_id:$rid }) { id }
        }
      `;
      let err2 = '';
      try {
        await gqlAs(badInsert2, { oid: orgA.id, did: deptA.id, rid: posB.id }, 'A');
        throw new Error('expected FK violation (reports_to cross org)');
      } catch (e: any) {
        err2 = String(e.message || e).toLowerCase();
      }
      expect(err2).toMatch(/foreign key|violat|constraint|not present/);

      // RLS update denial: user B updating user A's dept
      const upd = /* GraphQL */ `
        mutation($id: uuid!) { update_departments_by_pk(pk_columns:{id:$id}, _set:{name:"HACKED"}) { id name } }
      `;
      try {
        const res = await gqlAs<any>(upd, { id: deptA.id }, 'B');
        // Some policies return null silently
        expect(res.update_departments_by_pk ?? null).toBeNull();
      } catch (e: any) {
        const msg = String(e.message || e).toLowerCase();
        expect(msg).toMatch(/not authorized|no update permission|forbidden|check constraint/);
      }
    },
    IT_TIMEOUT
  );
});
