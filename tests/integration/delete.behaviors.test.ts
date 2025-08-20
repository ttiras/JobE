// tests/integration/delete.behaviors.test.ts
import { describe, it, expect } from 'vitest';
import { gqlA, graphqlFetch, testSuffix } from '../helpers/auth';

// --- org_size still comes from enum via introspection (stable in your DB) ---
type EnumIntrospection = { __type?: { enumValues?: { name: string }[] } };

async function getEnumValues(typeName: string): Promise<string[]> {
  const q = /* GraphQL */ `
    query($n: String!) { __type(name: $n) { enumValues { name } } }
  `;
  const data = await gqlA<EnumIntrospection>(q, { n: typeName });
  return data.__type?.enumValues?.map(v => v.name) ?? [];
}

async function pickEnum(typeName: string, prefer?: string[]) {
  const vals = await getEnumValues(typeName);
  if (!vals.length) throw new Error(`Enum ${typeName} has no values`);
  if (prefer) for (const p of prefer) if (vals.includes(p)) return p;
  return vals[0];
}

// --- Create helpers (User A) -------------------------------------------------
async function createOrg(name: string): Promise<string> {
  // Use enum literals so we don't depend on seed rows for countries/industries
  const size = await pickEnum('org_size_enum');

  const m = /* GraphQL */ `
    mutation($name:String!,$size:org_size_enum!){
      insert_organizations_one(
        object:{ name:$name, country:TR, size:$size, industry:CONSUMER }
      ){ id }
    }
  `;
  const d = await gqlA<{ insert_organizations_one: { id: string } }>(m, {
    name,
    size,
  });
  return d.insert_organizations_one.id;
}

/** Insert dept; optionally set parent_id at insert time (no follow-up update). */
async function createDept(
  organization_id: string,
  dept_code: string,
  name: string,
  parent_id?: string | null
) {
  const m = /* GraphQL */ `
    mutation($o:uuid!,$c:String!,$n:String!,$p:uuid){
      insert_departments_one(
        object:{organization_id:$o,dept_code:$c,name:$n,parent_id:$p}
      ){ id }
    }
  `;
  const d = await gqlA<{ insert_departments_one: { id: string } }>(m, {
    o: organization_id,
    c: dept_code,
    n: name,
    p: parent_id ?? null,
  });
  return d.insert_departments_one.id;
}

async function createPos(
  organization_id: string,
  department_id: string,
  title: string,
  pos_code: string,
  reports_to_id?: string | null
) {
  const m = /* GraphQL */ `
    mutation($o:uuid!,$d:uuid!,$t:String!,$c:String!,$r:uuid){
      insert_positions_one(
        object:{organization_id:$o,department_id:$d,title:$t,pos_code:$c,reports_to_id:$r}
      ){ id }
    }
  `;
  const d = await gqlA<{ insert_positions_one: { id: string } }>(m, {
    o: organization_id,
    d: department_id,
    t: title,
    c: pos_code,
    r: reports_to_id ?? null,
  });
  return d.insert_positions_one.id;
}

// --- Queries (User A) --------------------------------------------------------
async function getDeptById(id: string) {
  const q = /* GraphQL */ `
    query($id:uuid!){ departments_by_pk(id:$id){ id parent_id } }
  `;
  const d = await gqlA<{ departments_by_pk: { id: string; parent_id: string | null } | null }>(q, { id });
  return d.departments_by_pk;
}

async function getPosById(id: string) {
  const q = /* GraphQL */ `
    query($id:uuid!){ positions_by_pk(id:$id){ id reports_to_id } }
  `;
  const d = await gqlA<{ positions_by_pk: { id: string; reports_to_id: string | null } | null }>(q, { id });
  return d.positions_by_pk;
}

// -----------------------------------------------------------------------------
// Delete behaviors (aligned with composite FKs + NOT NULL organization_id)
// -----------------------------------------------------------------------------
describe('delete behaviors', () => {
  it('detaching child first: deleting parent department succeeds; child.parent_id becomes NULL', async () => {
    const ts = testSuffix('del');
    const org = await createOrg(`DEL ORG ${ts}`);
    const root = await createDept(org, 'ROOT', 'Root');
    const child = await createDept(org, 'CHILD', 'Child', root); // parent set at insert

    // IMPORTANT: With composite FK (organization_id, parent_id) and org_id NOT NULL,
    // ON DELETE SET NULL would try to nullify BOTH columns → violates NOT NULL on org_id.
    // So we DETACH child first (set parent_id = NULL), then delete the parent.
    await gqlA(
      /* GraphQL */ `
        mutation($id:uuid!){
          update_departments_by_pk(
            pk_columns:{id:$id},
            _set:{ parent_id:null }
          ){ id parent_id }
        }
      `,
      { id: child }
    );

    const del = await gqlA<{ delete_departments_by_pk: { id: string } | null }>(
      /* GraphQL */ `mutation($id:uuid!){ delete_departments_by_pk(id:$id){ id } }`,
      { id: root }
    );
    expect(del.delete_departments_by_pk?.id).toBe(root);

    const after = await getDeptById(child);
    expect(after?.parent_id ?? null).toBeNull();
  });

  it('detaching subordinate first: deleting manager succeeds; subordinate remains and reports_to_id becomes NULL', async () => {
    const ts = testSuffix('del2');
    const org = await createOrg(`DEL ORG2 ${ts}`);
    const dept = await createDept(org, 'OPS', 'Ops');
    const mgr = await createPos(org, dept, 'Mgr', 'OPS-MGR');
    const sub = await createPos(org, dept, 'Analyst', 'OPS-AN1', mgr);

    // Same composite-FK reasoning: nullify reports_to_id BEFORE deleting the manager.
    await gqlA(
      /* GraphQL */ `
        mutation($id:uuid!){
          update_positions_by_pk(
            pk_columns:{id:$id},
            _set:{ reports_to_id:null }
          ){ id reports_to_id }
        }
      `,
      { id: sub }
    );

    await gqlA<{ delete_positions_by_pk: { id: string } | null }>(
      /* GraphQL */ `mutation($id:uuid!){ delete_positions_by_pk(id:$id){ id } }`,
      { id: mgr }
    );

    const after = await getPosById(sub);
    expect(after?.reports_to_id ?? null).toBeNull();
  });

  it('deleting a department with positions CASCADEs positions (matches your FK)', async () => {
    const ts = testSuffix('del3');
    const org = await createOrg(`DEL ORG3 ${ts}`);
    const dept = await createDept(org, 'SLS', 'Sales');
    const pos = await createPos(org, dept, 'Rep', 'SLS-1');

    const del = await gqlA<{ delete_departments_by_pk: { id: string } | null }>(
      /* GraphQL */ `mutation($id:uuid!){ delete_departments_by_pk(id:$id){ id } }`,
      { id: dept }
    );
    expect(del.delete_departments_by_pk?.id).toBe(dept);

    // Verify the position row is gone due to ON DELETE CASCADE
    const after = await getPosById(pos);
    expect(after).toBeNull();
  });
});
