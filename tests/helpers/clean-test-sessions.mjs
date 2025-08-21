// scripts/clean-test-sessions.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dir = os.tmpdir();
let removed = 0;

for (const f of fs.readdirSync(dir)) {
  if (f.startsWith('jobe-test-session-') && f.endsWith('.json')) {
    try {
      fs.unlinkSync(path.join(dir, f));
      removed++;
    } catch {}
  }
}

console.log(`✅ Cleared ${removed} test session file(s) in ${dir}`);
