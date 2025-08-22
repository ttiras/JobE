// tests/auth.anonymous.cannot-insert-org.test.ts
import { describe, it, expect } from 'vitest';
import { gqlAnon } from '../helpers/gql';

describe('permissions: anonymous', () => {
  it('cannot insert an organization', async () => {
    const q = /* GraphQL */ `
      mutation($name:String!, $industry:industries_enum_enum!, $country:countries_enum_enum!, $size:org_size_enum!){
        insert_organizations_one(object:{ name:$name, industry:$industry, country:$country, size:$size }) { id }
      }
    `;

    const vars = { name: 'Anon Org', industry: 'CONSUMER', country: 'US', size: 'S2_10' };
    const json: any = await gqlAnon(q, vars);

    expect(Array.isArray(json?.errors)).toBe(true);

    const msg = (json.errors || []).map((e: any) => e?.message || '').join(' | ');
    expect(msg).not.toMatch(/null value|constraint|violates|foreign key|missing/i);

    const first = json.errors[0] || {};
    expect(first.message).toMatch(/no mutations exist/i);
    expect(first?.extensions?.code).toBe('validation-failed');
  });
});
