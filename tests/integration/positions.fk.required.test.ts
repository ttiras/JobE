// tests/positions.fk.required.test.ts
import { describe, it, expect } from 'vitest';
import { gqlAdmin } from '../helpers/gql';
import { expectConstraintViolation } from '../helpers/assert';

describe('positions → FK required', () => {
  it('rejects insert when organization_id or department_id does not exist', async () => {
    const mutation = /* GraphQL */ `
      mutation($o: uuid!, $d: uuid!) {
        insert_positions_one(object: {
          organization_id: $o,
          department_id:   $d,
          pos_code:        "DUPTEST",
          title:           "Bad Row"
        }) { id }
      }
    `;
    const json: any = await gqlAdmin(mutation, { o: crypto.randomUUID(), d: crypto.randomUUID() });
    expect(Array.isArray(json?.errors)).toBe(true);
    expectConstraintViolation(json);
  });
});
