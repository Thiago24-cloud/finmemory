/**
 * Agente DIA com todas as lojas da listagem regional (ex.: lojas-sp-capital no JSON do site),
 * não só slugs sp-sao-paulo-* — para mapa em escala estado de SP.
 *
 * Uso: npm run promo:dia:sp-estado
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const agentDir = path.join(root, 'finmemory-agent');

const env = {
  ...process.env,
  DIA_REGION_INCLUDE_ALL_NODES: '1',
};
if (!env.DIA_MAX_STORE_PAGES) {
  env.DIA_MAX_STORE_PAGES = '700';
}

const r = spawnSync(process.execPath, ['agent.js', '--only=dia'], {
  cwd: agentDir,
  env,
  stdio: 'inherit',
});

process.exit(r.status === null ? 1 : r.status);
