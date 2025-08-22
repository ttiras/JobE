// tests/integration/schema.positions.shape.test.ts
import { describe, it, expect } from 'vitest';
import { gqlAdmin, gqlAs } from '../helpers/gql';
import { createOrg, createDept, createPosition } from '../helpers/factories';

function extractFieldNames(resp: any): string[] {
  const fields = resp?.data?.__type?.fields ?? resp?.__type?.fields ?? [];
  return Array.isArray(fields) ? fields.map((f: any) => f?.name).filter(Boolean) : [];
}

describe('positions schema', () => {
  it('exposes expected columns and incumbents_count (no fte) with default = 1', async () => {
    // Introspect schema fields
    const introspect = /* GraphQL */ `
      query { __type(name: "positions") { fields { name } } }
    `;
    const schemaResp = await gqlAdmin<any>(introspect);
    const namesArr = extractFieldNames(schemaResp);
    const names = new Set(namesArr);

    const core = [
      'id',
      'organization_id',
      'department_id',
      'pos_code',
      'title',
      'reports_to_id',
      'is_manager',
      'is_active',
      'created_at',
      'updated_at',
      'incumbents_count', // required
    ];

    // deleted_at removed across all tables
    expect(names.has('deleted_at')).toBe(false);
    // fte should not exist
    expect(names.has('fte')).toBe(false);

    const missingCore = core.filter(c => !names.has(c));
    if (missingCore.length) {
      throw new Error(
        `positions missing fields: ${missingCore.join(', ')}\nGot: ${namesArr.sort().join(', ')}`
      );
    }

    // Runtime check: create minimal org/dept/position and ensure incumbents_count defaults to 1
    const org = await createOrg({ size: 'S2_10', country: 'US', industry: 'CONSUMER' }, 'A');
    const dept = await createDept(org.id, {}, 'A');
    const pos = await createPosition(org.id, dept.id, { title: 'Schema Test Position' }, 'A');

    const byPk = /* GraphQL */ `
      query($id: uuid!) {
        positions_by_pk(id: $id) { id incumbents_count pos_code }
      }
    `;
    const fetched = await gqlAs<{ positions_by_pk: { id: string; incumbents_count: number; pos_code: string } | null }>(byPk, { id: pos.id }, 'A');
    expect(fetched.positions_by_pk?.id).toBe(pos.id);
    expect(fetched.positions_by_pk?.incumbents_count).toBe(1);
    expect(fetched.positions_by_pk?.pos_code).toBeTruthy();
  });
});
