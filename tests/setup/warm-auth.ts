// tests/setup/warm-auth.ts
import 'dotenv/config';
import { sessionA, sessionB } from '../helpers/auth';

const isStaging =
  process.env.DOTENV_CONFIG_PATH?.includes('staging') ||
  process.env.NODE_ENV === 'staging' ||
  process.env.CI === 'true';

// small utility pause
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// race a promise against a timeout with a nice label
async function withTimeout<T>(label: string, p: Promise<T>, ms: number): Promise<T> {
  let to: NodeJS.Timeout | undefined;
  try {
    const t = new Promise<never>((_, rej) =>
      (to = setTimeout(() => rej(new Error(`warm-auth timeout: ${label} after ${ms}ms`)), ms))
    );
    return await Promise.race([p, t]);
  } finally {
    if (to) clearTimeout(to);
  }
}

export default async function () {
  if (!isStaging) return; // local stays fast

  const perCallTimeout = Number(process.env.WARM_AUTH_TIMEOUT_MS ?? 30_000);

  // Best-effort warm-up; serialize to avoid concurrent signin spikes (429).
  try {
    await withTimeout('sessionA() signin/refresh', sessionA(), perCallTimeout);
  } catch (err) {
    console.warn('[warm-auth] sessionA warm-up failed:', (err as Error)?.message || err);
  }

  // tiny stagger before the second signin
  await wait(400);

  try {
    await withTimeout('sessionB() signin/refresh', sessionB(), perCallTimeout);
  } catch (err) {
    console.warn('[warm-auth] sessionB warm-up failed:', (err as Error)?.message || err);
  }
}
