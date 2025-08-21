import { describe, it, expect } from 'vitest';
import { gqlA, sessionA, testSuffix } from '../helpers/auth';

describe('org insert/read with real user', () => {
  it(
    'inserts an org using all required fields and reads it back',
    async () => {
      const { userId } = await sessionA();
      const ts = testSuffix('org-read');

      // hard-coded enums instead of introspection
      const industry = 'CONSUMER';   // industries_enum_enum
      const country  = 'US';     // countries_enum_enum
      const size     = 'S2_10';  // org_size_enum

      const expectedCurrency = 'USD';

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
