// tests/integration/org.organizations.insert.read.test.ts
import { describe, it, expect } from 'vitest';
import { gqlA, sessionA, testSuffix } from '../helpers/auth';

// --- enum helpers (via User A token) -----------------------------------------
type EnumVals = { __type?: { enumValues?: { name: string }[] } };

async function enumValues(name: string): Promise<string[]> {
  const q = /* GraphQL */ `query($t:String!){ __type(name:$t){ enumValues { name } } }`;
  const d = await gqlA<EnumVals>(q, { t: name });
  return d.__type?.enumValues?.map(v => v.name) ?? [];
}

async function pickEnum(name: string, prefer?: string[]) {
  const vals = await enumValues(name);
  if (!vals.length) throw new Error(`Enum ${name} has no values`);
  if (prefer) for (const p of prefer) if (vals.includes(p)) return p;
  return vals[0];
}

// --- test --------------------------------------------------------------------
describe('org insert/read with real user', () => {
  it(
    'inserts an org using all required fields and reads it back',
    async () => {
      const { userId } = await sessionA();
      const ts = testSuffix('org-read');

      // NOTE: in your schema these are *_enum_enum, not *_enum
      const industry = await pickEnum('industries_enum_enum');
      const country  = await pickEnum('countries_enum_enum', ['TR', 'US']);
      const size     = await pickEnum('org_size_enum');

      const expectedCurrency = country === 'TR' ? 'TRY' : 'USD';

      const insert = /* GraphQL */ `
        mutation($name:String!,$industry:industries_enum_enum!,$country:countries_enum_enum!,$size:org_size_enum!){
          insert_organizations_one(object:{
            name:$name, industry:$industry, country:$country, size:$size
          }){ id created_by industry country size currency }
        }
      `;
      const name = `E2E Org ${ts}`;
      const ins = await gqlA<{ insert_organizations_one: {
        id: string; created_by: string; industry: string; country: string; size: string; currency: string;
      } }>(insert, { name, industry, country, size });

      const row = ins.insert_organizations_one;
      expect(row.created_by).toBe(userId);
      expect(row.industry).toBe(industry);
      expect(row.country).toBe(country);
      expect(row.size).toBe(size);
      expect(row.currency).toBe(expectedCurrency);

      const query = /* GraphQL */ `
        query($id:uuid!){
          organizations_by_pk(id:$id){
            id created_by name industry country size currency
          }
        }
      `;
      const got = await gqlA<{ organizations_by_pk: {
        id: string; created_by: string; name: string; industry: string; country: string; size: string; currency: string;
      } | null }>(query, { id: row.id });

      expect(got.organizations_by_pk?.id).toBe(row.id);
      expect(got.organizations_by_pk?.created_by).toBe(userId);
    },
    20_000
  );
});
