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
const catalog = read('src/catalog-do.ts');
const ui = read('src/ui.ts');
const wrangler = read('wrangler.jsonc');
const checks = [
  ['custom-domain host split', index.includes('host === adminHost') && index.includes('host === publicHost')],
  ['workers.dev single-origin fallback', index.includes('isSingleOriginHost(host)') && index.includes('url.pathname.startsWith("/p/")')],
  ['dynamic public origin', ui.includes('data-public-origin="${escapeHtml(publicOrigin)}"')],
  ['stable canonical public URL', index.includes('const canonical = url.pathname.match(') && index.includes('headers.set(\"cache-control\", \"no-store\")')],
  ['legacy revision URL redirects to canonical', index.includes('const location = `/p/${encodeURIComponent(slug)}`')],
  ['canonical route serves saved HTML directly', index.includes('http://site/revision/${encodeURIComponent(site.currentRevision)}') && !index.includes('return html(publicWrapper')],
  ['static script blocked', index.includes("script-src 'none'")],
  ['interactive connect blocked', index.includes("connect-src 'none'") && index.includes('sandbox allow-scripts')],
  ['session key automatic fallback', index.includes('/secret/session') && catalog.includes('app_secrets')],
  ['session secret minimum 64 chars', auth.includes('secret.length < 64')],
  ['same-origin CSRF check', auth.includes('new URL(request.url).origin')],
  ['google audience checked', auth.includes('INVALID_GOOGLE_AUDIENCE')],
  ['google issuer checked', auth.includes('INVALID_GOOGLE_ISSUER')],
  ['admin email checked', auth.includes('ACCOUNT_NOT_ALLOWED')],
  ['upload integrity checked', site.includes('UPLOAD_INTEGRITY_FAILED') && site.includes('x-chunk-sha256')],
  ['revision mode retained', site.includes('revision.mode') && site.includes('SET title=?,mode=?,current_revision=')],
  ['5MB UI limit', ui.includes('5 * 1024 * 1024')],
  ['real Google client ID included', wrangler.includes('464417267380-') && !wrangler.includes('REPLACE_DURING_DEPLOY')],
  ['no localStorage secret', !files.some(f => read(f).includes('localStorage'))]
];
let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
  if (!ok) failed++;
}
if (failed) process.exit(1);
console.log(`PASS ${checks.length}/${checks.length} static security/architecture checks`);
