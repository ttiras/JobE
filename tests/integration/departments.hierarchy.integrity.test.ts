import { describe, it, expect, beforeAll } from 'vitest';
import { createOrg, createDept } from '../helpers/factories';
import { gqlAs } from '../helpers/gql';

let org1: { id: string };
let org2: { id: string };

beforeAll(async () => {
  org1 = await createOrg({ country: 'TR', size: 'S2_10', industry: 'CONSUMER' }, 'A');
  org2 = await createOrg({ country: 'TR', size: 'S2_10', industry: 'CONSUMER' }, 'A');
});

describe('Departments hierarchy integrity', () => {
  it('Parent must be in the same org', async () => {
    const parentInOrg1 = await createDept(org1.id, { code: 'sales', name: 'Sales' }, 'A');

    try {
      const bad = await createDept(org2.id, { code: 'sales-tr', name: 'Sales TR', parent_id: parentInOrg1.id }, 'A');
      throw new Error(`cross-org parent accepted (dept id=${bad.id})`);
    } catch (e: any) {
      const msg = String(e.message || e).toLowerCase();
      expect(msg).not.toMatch(/cross-org parent accepted/);
      // Accept stripped generic or detailed constraint
      expect(/database query error|foreign key|violat|constraint/.test(msg)).toBe(true);
    }
  });

  it('Rejects direct self-parent (state + error)', async () => {
    const d = await createDept(org1.id, { code: 'ops', name: 'Ops' }, 'A');

    const setParent = /* GraphQL */ `
      mutation($id: uuid!, $parent: uuid) { update_departments_by_pk(pk_columns:{id:$id}, _set:{ parent_id:$parent }) { id parent_id } }
    `;

    let errMsg: string | null = null;
    let returnedRow: any = null;
    try {
      const res: any = await gqlAs(setParent, { id: d.id, parent: d.id }, 'A');
      returnedRow = res.update_departments_by_pk || null; // might be null if silently rejected
      if (returnedRow) throw new Error('self-parent update unexpectedly returned a row');
    } catch (e: any) {
      errMsg = String(e.message || e).toLowerCase();
      if (/unexpectedly returned a row/.test(errMsg)) throw e; // hard fail
    }

    // Must either have an error OR a null result with invariant preserved
    if (errMsg) {
      expect(/database query error|self parent|self-parent|cannot be its own parent|constraint|violat/.test(errMsg)).toBe(true);
    } else {
      expect(returnedRow).toBeNull();
    }

    const sel = /* GraphQL */ `query($id: uuid!){ departments_by_pk(id:$id){ id parent_id } }`;
    const after: any = await gqlAs(sel, { id: d.id }, 'A');
    expect(after.departments_by_pk.parent_id).toBeNull();
  });

  it('Rejects indirect cycle (state + error)', async () => {
    const a = await createDept(org1.id, { code: 'a', name: 'A' }, 'A');
    const b = await createDept(org1.id, { code: 'b', name: 'B', parent_id: a.id }, 'A');
    const c = await createDept(org1.id, { code: 'c', name: 'C', parent_id: b.id }, 'A');

    const setParent = /* GraphQL */ `
      mutation($id: uuid!, $parent: uuid) { update_departments_by_pk(pk_columns:{id:$id}, _set:{ parent_id:$parent }) { id parent_id } }
    `;
    let errMsg: string | null = null;
    let returnedRow: any = null;
    try {
      const res: any = await gqlAs(setParent, { id: a.id, parent: c.id }, 'A');
      returnedRow = res.update_departments_by_pk || null;
      if (returnedRow) throw new Error('cycle update unexpectedly returned a row');
    } catch (e: any) {
      errMsg = String(e.message || e).toLowerCase();
      if (/unexpectedly returned a row/.test(errMsg)) throw e;
    }

    if (errMsg) {
      expect(/database query error|cycle detected|cycle|constraint|violat/.test(errMsg)).toBe(true);
    } else {
      expect(returnedRow).toBeNull();
    }

    const sel = /* GraphQL */ `
      query($a: uuid!, $b: uuid!, $c: uuid!){
        a: departments_by_pk(id:$a){ id parent_id }
        b: departments_by_pk(id:$b){ id parent_id }
        c: departments_by_pk(id:$c){ id parent_id }
      }
    `;
    const after: any = await gqlAs(sel, { a: a.id, b: b.id, c: c.id }, 'A');
    expect(after.a.parent_id).toBeNull();
    expect(after.b.parent_id).toBe(a.id);
    expect(after.c.parent_id).toBe(b.id);
  });
});
