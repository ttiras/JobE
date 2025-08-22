import { describe, it, expect } from 'vitest';
import { createOrg, createDept, createPosition } from '../helpers/factories';
import { gqlAs } from '../helpers/gql';

describe('positions: pos_code unique per (org, dept)', () => {
  it(
    'rejects duplicate in same (org, dept) and allows same code in another dept',
    async () => {
      const org = await createOrg({}, 'A');
      const eng = await createDept(org.id, { code: 'ENG', name: 'Engineering' }, 'A');
      const sls = await createDept(org.id, { code: 'SLS', name: 'Sales' }, 'A');

      const code = 'P-001';
      await createPosition(org.id, eng.id, { title: 'Engineer', pos_code: code }, 'A');

      const dupMutation = /* GraphQL */ `
        mutation($organization_id:uuid!,$department_id:uuid!,$title:String!,$pos_code:String!){
          insert_positions_one(object:{organization_id:$organization_id,department_id:$department_id,title:$title,pos_code:$pos_code}){ id }
        }
      `;
      let dupErr = '';
      try {
        await gqlAs(dupMutation, { organization_id: org.id, department_id: eng.id, title: 'Engineer 2', pos_code: code }, 'A');
        throw new Error('Expected uniqueness violation');
      } catch (e: any) {
        dupErr = String(e?.message || e).toLowerCase();
      }
      expect(dupErr).toMatch(/unique|duplicate|already exists/);

      const okMutation = /* GraphQL */ `
        mutation($organization_id:uuid!,$department_id:uuid!,$title:String!,$pos_code:String!){
          insert_positions_one(object:{organization_id:$organization_id,department_id:$department_id,title:$title,pos_code:$pos_code}){ id }
        }
      `;
      const ok: any = await gqlAs(okMutation, { organization_id: org.id, department_id: sls.id, title: 'Sales Rep', pos_code: code }, 'A');
      const okId = ok?.insert_positions_one?.id || ok?.data?.insert_positions_one?.id;
      expect(okId).toBeTruthy();
    },
    20_000
  );
});
