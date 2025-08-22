import { describe, it, expect } from 'vitest';
import { createOrg, createDept, createPosition } from '../helpers/factories';
import { gqlAs } from '../helpers/gql';
import { testSuffix } from '../helpers/auth';

// --- Stable enum literals (hard-coded) ---------------------------------------
const ORG_SIZE: 'S2_10' = 'S2_10';        // one valid literal
const COUNTRY = 'TR';                     // stable country enum
const INDUSTRY = 'CONSUMER';              // stable industry enum

// --- Delete behaviors (aligned with composite FKs + NOT NULL organization_id)
// -----------------------------------------------------------------------------
describe('delete behaviors', () => {
  it('detaching child first: deleting parent department succeeds; child.parent_id becomes NULL', async () => {
    const ts = testSuffix('del');
    const org = await createOrg({ name: `DEL ORG ${ts}` }, 'A');
    const root = await createDept(org.id, { code: 'ROOT', name: 'Root' }, 'A');
    const child = await createDept(org.id, { code: 'CHILD', name: 'Child', parent_id: root.id }, 'A');

    await gqlAs(/* GraphQL */ `mutation($id:uuid!){ update_departments_by_pk(pk_columns:{id:$id}, _set:{ parent_id:null }){ id parent_id } }`, { id: child.id }, 'A');

    await gqlAs(/* GraphQL */ `mutation($id:uuid!){ delete_departments_by_pk(id:$id){ id } }`, { id: root.id }, 'A');

    const after = await gqlAs<{ departments_by_pk: { id: string; parent_id: string | null } | null }>(
      /* GraphQL */ `query($id:uuid!){ departments_by_pk(id:$id){ id parent_id } }`,
      { id: child.id },
      'A'
    );
    expect(after.departments_by_pk?.parent_id ?? null).toBeNull();
  });

  it('detaching subordinate first: deleting manager succeeds; subordinate remains and reports_to_id becomes NULL', async () => {
    const ts = testSuffix('del2');
    const org = await createOrg({ name: `DEL ORG2 ${ts}` }, 'A');
    const dept = await createDept(org.id, { code: 'OPS', name: 'Ops' }, 'A');
    const mgr = await createPosition(org.id, dept.id, { title: 'Mgr', pos_code: 'OPS-MGR' }, 'A');
    const sub = await createPosition(org.id, dept.id, { title: 'Analyst', pos_code: 'OPS-AN1' }, 'A');

    // attach subordinate to manager (since factory did not set reports_to_id)
    await gqlAs(/* GraphQL */ `mutation($id:uuid!,$rid:uuid!){ update_positions_by_pk(pk_columns:{id:$id}, _set:{ reports_to_id:$rid }){ id reports_to_id } }`, { id: sub.id, rid: mgr.id }, 'A');

    await gqlAs(/* GraphQL */ `mutation($id:uuid!){ update_positions_by_pk(pk_columns:{id:$id}, _set:{ reports_to_id:null }){ id reports_to_id } }`, { id: sub.id }, 'A');

    await gqlAs(/* GraphQL */ `mutation($id:uuid!){ delete_positions_by_pk(id:$id){ id } }`, { id: mgr.id }, 'A');

    const after = await gqlAs<{ positions_by_pk: { id: string; reports_to_id: string | null } | null }>(
      /* GraphQL */ `query($id:uuid!){ positions_by_pk(id:$id){ id reports_to_id } }`,
      { id: sub.id },
      'A'
    );
    expect(after.positions_by_pk?.reports_to_id ?? null).toBeNull();
  });

  it('deleting a department with positions CASCADEs positions (matches your FK)', async () => {
    const ts = testSuffix('del3');
    const org = await createOrg({ name: `DEL ORG3 ${ts}` }, 'A');
    const dept = await createDept(org.id, { code: 'SLS', name: 'Sales' }, 'A');
    const pos = await createPosition(org.id, dept.id, { title: 'Rep', pos_code: 'SLS-1' }, 'A');

    await gqlAs(/* GraphQL */ `mutation($id:uuid!){ delete_departments_by_pk(id:$id){ id } }`, { id: dept.id }, 'A');

    const after = await gqlAs<{ positions_by_pk: { id: string } | null }>(
      /* GraphQL */ `query($id:uuid!){ positions_by_pk(id:$id){ id } }`,
      { id: pos.id },
      'A'
    );
    expect(after.positions_by_pk).toBeNull();
  });
});
