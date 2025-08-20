// tests/integration/schema.positions.shape.test.ts
import { describe, it, expect } from 'vitest';
import { GRAPHQL_URL, gqlA } from '../helpers/auth';

const ENDPOINT =
  (GRAPHQL_URL && GRAPHQL_URL.trim()) ||
  process.env.NHOST_GRAPHQL_URL ||
  process.env.HASURA_GRAPHQL_ENDPOINT ||
  '';

if (!ENDPOINT) {
  throw new Error(
    'GraphQL endpoint missing. Set NHOST_GRAPHQL_URL (preferred) or HASURA_GRAPHQL_ENDPOINT.'
  );
}

// Support either env name for convenience
const ADMIN = process.env.HASURA_ADMIN_SECRET || process.env.HASURA_GRAPHQL_ADMIN_SECRET;

// --- Admin query (bypass RLS) ------------------------------------------------
async function gqlAdmin<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(ADMIN ? { 'x-hasura-admin-secret': ADMIN } : {}),
    },
    body: JSON.stringify({ query, variables }),
  });
  const text = await res.text();
  try {
    return (text ? JSON.parse(text) : {}) as T;
  } catch {
    return { errors: [{ message: `Invalid JSON from server: ${text.slice(0, 300)}` }] } as T;
  }
}

// Normalize either shape (admin vs user) into a single array of field names
function extractFieldNames(resp: any): string[] {
  const fields = resp?.data?.__type?.fields ?? resp?.__type?.fields ?? [];
  return Array.isArray(fields) ? fields.map((f: any) => f?.name).filter(Boolean) : [];
}

describe('positions schema', () => {
  it('exposes expected columns on positions object', async () => {
    const q = /* GraphQL */ `
      query {
        __type(name: "positions") {
          fields { name }
        }
      }
    `;

    const resp = ADMIN
      ? await gqlAdmin<any>(q)
      : await gqlA<any>(q);

    const namesArr = extractFieldNames(resp);
    const names = new Set(namesArr);

    // Core columns expected
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
    ];

    // deleted_at must be gone
    expect(names.has('deleted_at')).toBe(false);

    // Either incumbents_count (preferred) or fte (legacy)
    const hasIncumbentsOrFte = names.has('incumbents_count') || names.has('fte');

    const missingCore = core.filter(c => !names.has(c));
    if (missingCore.length || !hasIncumbentsOrFte) {
      throw new Error(
        `positions is missing fields: ${missingCore.join(', ') || '(core ok)'}; ` +
          `and incumbents_count/fte present? ${hasIncumbentsOrFte}\n` +
          `Got fields: ${namesArr.sort().join(', ')}`
      );
    }

    expect(true).toBe(true);
  });
});
