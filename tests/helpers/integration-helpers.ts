// tests/integration/helpers.ts
/* Shared helpers for integration tests */
export const ENDPOINT = (() => {
  const v = process.env.HASURA_GRAPHQL_ENDPOINT;
  if (!v) throw new Error('HASURA_GRAPHQL_ENDPOINT is not set');
  return v;
})();

export const AUTH_URL = (() => {
  const raw = process.env.NHOST_AUTH_URL;
  if (!raw) throw new Error('NHOST_AUTH_URL is not set');
  return raw.replace(/\/+$/, '');
})();

/** Minimal GraphQL caller (optionally with Bearer token) */
export async function gql<T = any>(
  query: string,
  variables?: Record<string, unknown>,
  token?: string
): Promise<T> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ query, variables }),
  });
  return res.json() as Promise<T>;
}

/** Get enum values via GraphQL introspection. Tries a few common Hasura names. */
export async function getEnumValues(
  typeName: string,
  token?: string
): Promise<string[]> {
  const tryNames = [typeName, `${typeName}_enum`, `${typeName}_enum_enum`];
  for (const name of tryNames) {
    const q = `
      query($name:String!) {
        __type(name: $name) { enumValues { name } }
      }
    `;
    const r: any = await gql(q, { name }, token);
    const vals: string[] | undefined = r?.data?.__type?.enumValues?.map((v: any) => v?.name).filter(Boolean);
    if (Array.isArray(vals) && vals.length) return vals;
  }
  return [];
}

/** Pick an enum value (first that matches preferred list if provided, otherwise first available). */
export async function pickEnum(
  typeName: string,
  token?: string,
  preferred?: string[]
): Promise<string> {
  const values = await getEnumValues(typeName, token);
  if (!values.length) throw new Error(`Enum ${typeName} has no values`);
  if (preferred?.length) {
    for (const p of preferred) if (values.includes(p)) return p;
  }
  return values[0];
}

/** Convenience: create an organization with required fields */
export async function createOrg(
  token: string,
  name: string,
  country: string,
  opts?: { industryPreferred?: string[]; sizePreferred?: string[] }
): Promise<{ id: string; created_by: string; country: string; industry: string; size: string }> {
  const industry = await pickEnum('industries_enum', token, opts?.industryPreferred);
  const size = await pickEnum('org_size_enum', token, opts?.sizePreferred);

  const q = `
    mutation($name:String!, $country:String!, $industry:industries_enum!, $size:org_size_enum!) {
      insert_organizations_one(object:{
        name: $name,
        country: $country,
        industry: $industry,
        size: $size
      }) {
        id created_by country industry size
      }
    }
  `;
  const r: any = await gql(q, { name, country, industry, size }, token);
  if (r?.errors) {
    // surface detailed error in tests
    throw new Error(`createOrg errors: ${JSON.stringify(r.errors)}`);
  }
  return r.data.insert_organizations_one;
}

/** Convenience: create a department */
export async function createDept(
  token: string,
  organization_id: string,
  dept_code: string,
  name: string,
  parent_id?: string | null
): Promise<{ id: string; organization_id: string; dept_code: string; name: string; parent_id: string | null }> {
  const q = `
    mutation($organization_id:uuid!, $dept_code:String!, $name:String!, $parent_id:uuid) {
      insert_departments_one(object:{
        organization_id:$organization_id,
        dept_code:$dept_code,
        name:$name,
        parent_id:$parent_id
      }) {
        id organization_id dept_code name parent_id
      }
    }
  `;
  const r: any = await gql(q, { organization_id, dept_code, name, parent_id }, token);
  if (r?.errors) {
    throw new Error(`createDept errors: ${JSON.stringify(r.errors)}`);
  }
  return r.data.insert_departments_one;
}

/** Optional: create a position (handy for several tests) */
export async function createPos(
  token: string,
  organization_id: string,
  department_id: string,
  title: string,
  pos_code: string,
  reports_to_id?: string | null
): Promise<{ id: string; organization_id: string; department_id: string; title: string; pos_code: string; reports_to_id: string | null }> {
  const q = `
    mutation($organization_id:uuid!, $department_id:uuid!, $title:String!, $pos_code:String!, $reports_to_id:uuid) {
      insert_positions_one(object:{
        organization_id:$organization_id,
        department_id:$department_id,
        title:$title,
        pos_code:$pos_code,
        reports_to_id:$reports_to_id
      }) {
        id organization_id department_id title pos_code reports_to_id
      }
    }
  `;
  const r: any = await gql(
    q,
    { organization_id, department_id, title, pos_code, reports_to_id },
    token
  );
  if (r?.errors) {
    throw new Error(`createPos errors: ${JSON.stringify(r.errors)}`);
  }
  return r.data.insert_positions_one;
}

// Handy country codes for tests
export const TR = 'TR';
export const US = 'US';
