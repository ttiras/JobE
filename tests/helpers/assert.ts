// tests/helpers/assert.ts
export function expectErrorsLike(json: any, pattern: RegExp | ((msg: string) => boolean)) {
  const arr = (json?.errors ?? []) as Array<{ message?: string }>;
  const msg = arr.map(e => e?.message ?? '').join(' | ');
  if (pattern instanceof RegExp) {
    expect(msg).toMatch(pattern);
  } else {
    expect(pattern(msg)).toBe(true);
  }
}

export function expectNotAuthorized(json: any) {
  expectErrorsLike(json, /not authorized|permission|access denied|unauthorized|no mutations exist|field .* not found/i);
}

export function expectConstraintViolation(json: any) {
  expectErrorsLike(json, /not[- ]?null|null value|constraint|violates|foreign key|unique/i);
}
