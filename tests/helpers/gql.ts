// tests/helpers/gql.ts
import 'dotenv/config';
import { GRAPHQL_URL, graphqlFetch } from './auth';

const ENDPOINT = (
  (GRAPHQL_URL && GRAPHQL_URL.trim()) ||
  process.env.NHOST_GRAPHQL_URL ||
  process.env.HASURA_GRAPHQL_ENDPOINT ||
  ''
);

const ADMIN = process.env.HASURA_ADMIN_SECRET || '';

export async function gqlAnon<T = any>(query: string, variables?: Record<string, unknown>, url = ENDPOINT): Promise<T> {
  if (!url) throw new Error('GraphQL endpoint missing. Set NHOST_GRAPHQL_URL or HASURA_GRAPHQL_ENDPOINT.');
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  const text = await res.text();
  try {
    return (text ? JSON.parse(text) : {}) as T;
  } catch {
    return { errors: [{ message: `Invalid JSON from server: ${text.slice(0, 300)}` }] } as T;
  }
}

export async function gqlAdmin<T = any>(query: string, variables?: Record<string, unknown>, url = ENDPOINT): Promise<T> {
  if (!url) throw new Error('GraphQL endpoint missing. Set NHOST_GRAPHQL_URL or HASURA_GRAPHQL_ENDPOINT.');
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (ADMIN) headers['x-hasura-admin-secret'] = ADMIN;
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables }),
  });
  const text = await res.text();
  try {
    return (text ? JSON.parse(text) : {}) as T;
  } catch {
    return { errors: [{ message: `Invalid JSON from server: ${text.slice(0, 300)}` }] } as T;
  }
}

export function gqlAs<T = any>(query: string, variables?: Record<string, unknown>, user: 'A' | 'B' = 'A') {
  return graphqlFetch<T>(query, variables, { user });
}
