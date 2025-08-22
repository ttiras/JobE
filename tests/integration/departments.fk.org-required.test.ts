// tests/departments.fk.org-required.test.ts
import { describe, it, expect } from 'vitest';
import { gqlAdmin } from '../helpers/gql';
import { expectConstraintViolation } from '../helpers/assert';

describe('departments → must reference an existing organization', () => {
  it('rejects insert when organization_id does not exist', async () => {
    const mutation = /* GraphQL */ `
      mutation($org: uuid!, $code: String!, $name: String!) {
        insert_departments_one(object: {
          organization_id: $org,
          dept_code: $code,
          name: $name
        }) { id }
      }
    `;

    const json: any = await gqlAdmin(mutation, {
      org: crypto.randomUUID(),
      code: `qa-${Date.now()}`,
      name: 'Should Fail (No Org)',
    });

    expect(Array.isArray(json?.errors)).toBe(true);
    expectConstraintViolation(json);
  });
});
