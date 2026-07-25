import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root,p),'utf8');
const files = ['src/index.ts','src/auth.ts','src/site-do.ts','src/catalog-do.ts','src/ui.ts','src/utils.ts','src/types.ts'];
for (const file of files) {
  if (!fs.existsSync(path.join(root,file))) throw new Error(`missing ${file}`);
}
const index = read('src/index.ts');
const auth = read('src/auth.ts');
const site = read('src/site-do.ts');
const ui = read('src/ui.ts');
const checks = [
  ['admin/public host split', index.includes('host === env.ADMIN_HOST.toLowerCase()') && index.includes('host === env.PUBLIC_HOST.toLowerCase()')],
  ['immutable revision route', index.includes('public,max-age=31536000,immutable') && index.includes('/r/${encodeURIComponent(site.currentRevision)}')],
  ['static script blocked', index.includes("script-src 'none'")],
  ['interactive connect blocked', index.includes("connect-src 'none'") && index.includes('sandbox allow-scripts')],
  ['session secret 64 chars', auth.includes('secret.length < 64')],
  ['google audience checked', auth.includes('INVALID_GOOGLE_AUDIENCE')],
  ['google issuer checked', auth.includes('INVALID_GOOGLE_ISSUER')],
  ['admin email checked', auth.includes('ACCOUNT_NOT_ALLOWED')],
  ['upload integrity checked', site.includes('UPLOAD_INTEGRITY_FAILED') && site.includes('x-chunk-sha256')],
  ['revision mode retained', site.includes('revision.mode') && site.includes('SET title=?,mode=?,current_revision=')],
  ['5MB UI limit', ui.includes('5 * 1024 * 1024')],
  ['no localStorage secret', !files.some(f => read(f).includes('localStorage'))]
];
let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
  if (!ok) failed++;
}
if (failed) process.exit(1);
console.log(`PASS ${checks.length}/${checks.length} static security/architecture checks`);
