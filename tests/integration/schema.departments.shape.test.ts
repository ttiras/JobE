// tests/schema.departments.shape.test.ts
import { describe, it, expect } from 'vitest';
import { gqlAdmin } from '../helpers/gql';

describe('departments schema', () => {
  it('exposes id, organization_id, dept_code, name, parent_id', async () => {
    const query = /* GraphQL */ `
      query {
        __type(name: "departments") {
          name
          fields { name }
        }
      }
    `;
    const json = await gqlAdmin<{
      data: { __type: { name: string; fields: { name: string }[] } | null };
    }>(query);

    const fields = new Set(json?.data?.__type?.fields?.map(f => f.name) ?? []);
    const expected = ['id', 'organization_id', 'dept_code', 'name', 'parent_id'];
    expected.forEach(col => expect(fields.has(col)).toBe(true));
  });
});
