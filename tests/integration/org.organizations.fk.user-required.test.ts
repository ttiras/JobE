// tests/org.organizations.fk.user-required.test.ts
import { describe, it, expect } from 'vitest';
import { gqlAdmin } from '../helpers/gql';
import { expectConstraintViolation } from '../helpers/assert';

describe('organizations → created_by must reference auth.users', () => {
  it('rejects insert when created_by user does not exist', async () => {
    const mutation = /* GraphQL */ `
      mutation($name: String!, $user: uuid!) {
        insert_organizations_one(object:{ name: $name, created_by: $user }) { id }
      }
    `;

    const json: any = await gqlAdmin(mutation, { name: 'FK should fail', user: crypto.randomUUID() });
    expect(Array.isArray(json?.errors)).toBe(true);
    expectConstraintViolation(json);
  });
});
