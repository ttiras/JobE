// tests/auth.anonymous.cannot-read-depts-positions.test.ts
import { describe, it } from 'vitest';
import { gqlAnon } from '../helpers/gql';
import { expectNotAuthorized } from '../helpers/assert';

describe('RLS: anonymous cannot read departments/positions', () => {
  it('blocks departments', async () => {
    const r = await gqlAnon<any>(/* GraphQL */ `query { departments { id } }`);
    expectNotAuthorized(r);
  });

  it('blocks positions', async () => {
    const r = await gqlAnon<any>(/* GraphQL */ `query { positions { id } }`);
    expectNotAuthorized(r);
  });
});
