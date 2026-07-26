import fs from 'node:fs';

const required = [
  'gateway/functions/[[path]].js',
  'gateway/public/index.html',
  'gateway/wrangler.jsonc'
];
for (const file of required) {
  if (!fs.existsSync(file)) throw new Error(`missing ${file}`);
}
const fn = fs.readFileSync('gateway/functions/[[path]].js', 'utf8');
const config = fs.readFileSync('gateway/wrangler.jsonc', 'utf8');
const checks = [
  ['catch-all Pages function', fn.includes('export async function onRequest')],
  ['private Worker forwarding', fn.includes('context.env.PUBLISHER.fetch(context.request)')],
  ['Pages output directory', config.includes('"pages_build_output_dir": "./public"')],
  ['service binding name', config.includes('"binding": "PUBLISHER"')],
  ['service binding target', config.includes('"service": "ein-bridge-publisher"')],
  ['gateway project name', config.includes('"name": "ein-bridge-publisher-gateway"')]
];
let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
  if (!ok) failed++;
}
if (failed) process.exit(1);
console.log(`PASS ${checks.length}/${checks.length} gateway checks`);
