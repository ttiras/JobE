import { describe, it, expect } from 'vitest';
import { createOrg, createDept, createPosition } from '../helpers/factories';
import { gqlAs } from '../helpers/gql';

// --- tests ---------------------------------------------------------------

describe('relationships: nested selects', () => {
  it(
    'positions expose department and organization fields and they resolve',
    async () => {
      const org = await createOrg({}, 'A');
      const dept = await createDept(org.id, { code: 'REL-ENG', name: 'Engineering' }, 'A');
      await createPosition(org.id, dept.id, { title: 'Engineer', pos_code: 'ENG-REL-1' }, 'A');

      const q = /* GraphQL */ `
        query($deptId:uuid!){
          positions(where:{department_id:{_eq:$deptId}}, limit:1){
            id
            department { id organization_id }
            organization { id }
          }
        }`;
      const r: any = await gqlAs(q, { deptId: dept.id }, 'A');
      const row = r?.positions?.[0] || r?.data?.positions?.[0];
      expect(row?.department?.id).toBe(dept.id);
      expect(row?.organization?.id).toBe(org.id);
      expect(row?.department?.organization_id).toBe(org.id);
    },
    20_000
  );
});
