// Loads the built package through both module systems (run after `npm run build`).
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const cjs = require('../dist/index.cjs');
const esm = await import('../dist/index.js');

for (const [name, mod] of [['cjs', cjs], ['esm', esm]]) {
  const client = new mod.Pidgely('pdg_smoke');
  for (const resource of ['emails', 'batch', 'domains', 'apiKeys', 'contacts', 'segments', 'audiences', 'broadcasts', 'templates', 'webhooks', 'suppressions']) {
    if (!client[resource]) throw new Error(`${name}: missing ${resource}`);
  }
  if (typeof mod.verifyWebhook !== 'function') throw new Error(`${name}: missing verifyWebhook`);
  console.log(`${name}: ok (pidgely-node/${mod.VERSION})`);
}
