// tests/org.organizations.required-fields.test.ts
import { describe, it, expect } from 'vitest';
import { gqlAdmin } from '../helpers/gql';
import { expectConstraintViolation } from '../helpers/assert';

describe('organizations required fields', () => {
  it('rejects insert without created_by (admin bypasses preset)', async () => {
    const mutation = /* GraphQL */ `
      mutation($name: String!) {
        insert_organizations_one(object:{ name: $name }) { id }
      }
    `;

    const json: any = await gqlAdmin(mutation, { name: 'Constraint Check' });
    expect(Array.isArray(json?.errors)).toBe(true);
    expectConstraintViolation(json); // generic NOT NULL / constraint pattern
  });
});
