import { describe, it, expect } from 'vitest';
import { sessionA } from '../helpers/auth';
import { createOrg } from '../helpers/factories';
import { gqlAs } from '../helpers/gql';

describe('org insert/read with real user', () => {
  it(
    'inserts an org using all required fields and reads it back',
    async () => {
      const { userId } = await sessionA();
      const org = await createOrg({ industry: 'CONSUMER', country: 'US', size: 'S2_10' }, 'A');

      expect(org.created_by).toBe(userId);
      expect(org.industry).toBe('CONSUMER');
      expect(org.country).toBe('US');
      expect(org.size).toBe('S2_10');
      expect(org.currency).toBe('USD');

      // Read-after-write: creator should be able to read
      const byPk = /* GraphQL */ `
        query($id: uuid!) {
          organizations_by_pk(id: $id) {
            id created_by name industry country size currency
          }
        }
      `;
      const gotA = await gqlAs<{ organizations_by_pk: {
        id: string; created_by: string; name: string; industry: string; country: string; size: string; currency: string;
      } | null }>(byPk, { id: org.id }, 'A');

      expect(gotA.organizations_by_pk?.id).toBe(org.id);
      expect(gotA.organizations_by_pk?.created_by).toBe(userId);

      // A different user should not be able to read under RLS
      const gotB = await gqlAs<{ organizations_by_pk: any | null }>(byPk, { id: org.id }, 'B');
      expect(gotB.organizations_by_pk).toBeNull();
    },
    20_000
  );
});
