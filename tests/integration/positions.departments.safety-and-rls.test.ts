import { describe, it, expect } from 'vitest';
import { createOrg, createDept, createPosition } from '../helpers/factories';
import { gqlAs, gqlAnon } from '../helpers/gql';
import { sessionA, testSuffix } from '../helpers/auth';
import { expectNotAuthorized } from '../helpers/assert';

// Keep simple enum literals for clarity
const TR = 'TR';
const US = 'US';

// --- Tests -------------------------------------------------------------------
describe('DB safety rails + RLS', () => {
  it('composite FK: position cannot point to a department from another org', async () => {
    const orgA = await createOrg({ country: TR }, 'A');
    const orgB = await createOrg({ country: US }, 'A');
    const deptA = await createDept(orgA.id, { code: 'A-ENG', name: 'Engineering' }, 'A');
    const deptB = await createDept(orgB.id, { code: 'B-SLS', name: 'Sales' }, 'A');
    const posA = await createPosition(orgA.id, deptA.id, { title: 'Backend Dev', pos_code: 'ENG-001' }, 'A');

    const upd = /* GraphQL */ `
      mutation($id:uuid!, $dept:uuid!){
        update_positions_by_pk(pk_columns:{id:$id}, _set:{department_id:$dept}) { id }
      }
    `;
    await expect(
      gqlAs(upd, { id: posA.id, dept: deptB.id }, 'A')
    ).rejects.toThrow(/foreign key|violat|constraint/i);
  }, 20_000);

  it('composite FK: reports_to must be in the same org', async () => {
    const orgA = await createOrg({ country: TR }, 'A');
    const orgB = await createOrg({ country: US }, 'A');
    const deptA = await createDept(orgA.id, { code: 'A-PROD', name: 'Product' }, 'A');
    const deptB = await createDept(orgB.id, { code: 'B-PROD', name: 'Product' }, 'A');
    const pA1 = await createPosition(orgA.id, deptA.id, { title: 'A Manager', pos_code: 'A-001' }, 'A');
    const pB1 = await createPosition(orgB.id, deptB.id, { title: 'B Manager', pos_code: 'B-001' }, 'A');

    const upd = /* GraphQL */ `
      mutation($id:uuid!, $boss:uuid!){
        update_positions_by_pk(pk_columns:{id:$id}, _set:{reports_to_id:$boss}) { id }
      }
    `;
    await expect(
      gqlAs(upd, { id: pA1.id, boss: pB1.id }, 'A')
    ).rejects.toThrow(/foreign key|violat|constraint/i);
  }, 20_000);

  it('composite FK: department.parent must stay in the same org', async () => {
    const orgA = await createOrg({ country: TR }, 'A');
    const orgB = await createOrg({ country: US }, 'A');
    const rootA = await createDept(orgA.id, { code: 'A-ROOT', name: 'Root A' }, 'A');
    const childA = await createDept(orgA.id, { code: 'A-CHILD', name: 'Child A' }, 'A');
    const rootB = await createDept(orgB.id, { code: 'B-ROOT', name: 'Root B' }, 'A');

    const upd = /* GraphQL */ `
      mutation($id:uuid!, $parent:uuid){
        update_departments_by_pk(pk_columns:{id:$id}, _set:{parent_id:$parent}) { id }
      }
    `;
    await expect(
      gqlAs(upd, { id: childA.id, parent: rootB.id }, 'A')
    ).rejects.toThrow(/foreign key|violat|constraint/i);
  }, 20_000);

  it('RLS: anonymous cannot query or insert positions', async () => {
    const sel = await gqlAnon<any>(`query { positions { id } }`);
    expectNotAuthorized(sel);

    const ins = await gqlAnon<any>(/* GraphQL */ `
      mutation {
        insert_positions_one(object:{
          organization_id:"00000000-0000-0000-0000-000000000000",
          department_id:"00000000-0000-0000-0000-000000000000",
          title:"x", pos_code:"x"
        }) { id }
      }
    `);
    expectNotAuthorized(ins);
  });

  it('organizations: currency defaults by country (TRY for TR, USD otherwise)', async () => {
    const { userId } = await sessionA();
    const tr = await createOrg({ country: TR, name: `TR Org ${testSuffix('tr')}` }, 'A');
    const us = await createOrg({ country: US, name: `US Org ${testSuffix('us')}` }, 'A');

    expect(tr.created_by).toBe(userId);
    expect(us.created_by).toBe(userId);
    expect(tr.country).toBe(TR);
    expect(us.country).toBe(US);
    expect(tr.currency).toBe('TRY');
    expect(us.currency).toBe('USD');
  }, 20_000);
});
