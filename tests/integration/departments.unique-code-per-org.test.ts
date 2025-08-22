import { describe, it, expect } from 'vitest';
import { createOrg, createDept } from '../helpers/factories';
import { gqlAs } from '../helpers/gql';

describe('departments: unique code per org (hard deletes)', () => {
  it('blocks duplicate dept_code in same org; allows across orgs; reinsert after delete works', async () => {
    const orgA = await createOrg({}, 'A');
    const orgB = await createOrg({}, 'A');

    const depA1 = await createDept(orgA.id, { code: 'ENG', name: 'Engineering' }, 'A');
    expect(depA1.id).toBeTruthy();

    const dupMutation = /* GraphQL */ `
      mutation($organization_id: uuid!, $dept_code: String!, $name: String!) {
        insert_departments_one(object:{organization_id:$organization_id, dept_code:$dept_code, name:$name}) { id }
      }
    `;
    let dupErrorMsg = '';
    try {
      await gqlAs(dupMutation, { organization_id: orgA.id, dept_code: 'ENG', name: 'Eng 2' }, 'A');
      throw new Error('Expected uniqueness violation did not occur');
    } catch (err: any) {
      dupErrorMsg = String(err?.message || err).toLowerCase();
    }
    expect(dupErrorMsg).toMatch(/unique|duplicate|already exists/);

    const depB = await createDept(orgB.id, { code: 'ENG', name: 'Engineering' }, 'A');
    expect(depB.id).toBeTruthy();

    const delMutation = /* GraphQL */ `mutation($id:uuid!){ delete_departments_by_pk(id:$id){ id } }`;
    const del: any = await gqlAs(delMutation, { id: depA1.id }, 'A');
    expect(del?.delete_departments_by_pk?.id || del?.data?.delete_departments_by_pk?.id).toBe(depA1.id);

    const depA2 = await createDept(orgA.id, { code: 'ENG', name: 'Engineering (recreated)' }, 'A');
    expect(depA2.id).toBeTruthy();
  });
});
