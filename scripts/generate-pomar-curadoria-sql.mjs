import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const jsonPath = path.join(__dirname, '../data/curadoria/pomar-vila-madalena-ig-2026-04-04-a-09.json');
const outPath = path.join(__dirname, '../data/curadoria/pomar-vila-madalena-insert.sql');

const j = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
const esc = (s) => String(s).replace(/'/g, "''");
const slug = j.meta.supermercado_slug;
const lat = j.meta.lat;
const lng = j.meta.lng;
const run = 'curadoria-ig-pomar-vm-2026-04-09';
const ingest = 'curadoria_json:pomar_vila_madalena:2026-04-09';
const exp = '2026-04-10T05:59:59+00:00';
const upd = '2026-04-05T15:00:00+00:00';
const val = '2026-04-09';

const lines = [];
lines.push('-- =============================================================================');
lines.push('-- Pomar da Vila — Vila Madalena (curadoria Instagram → promocoes_supermercados)');
lines.push('-- Endereço: Rua Mourato Coelho, 1458 — lat/lng aproximados (ajuste se precisar)');
lines.push('-- Cole no SQL Editor do Supabase (role: pode precisar service role se RLS bloquear INSERT)');
lines.push('-- =============================================================================');
lines.push('');
lines.push('-- 1) Opcional: desativar lote anterior desta mesma importação (rodar de novo sem duplicar visível)');
lines.push(
  `UPDATE public.promocoes_supermercados SET ativo = false WHERE supermercado = '${esc(slug)}' AND ingest_source = '${esc(ingest)}' AND ativo = true;`
);
lines.push('');
lines.push('-- 2) Se a tua tabela for o schema ANTIGO (product_name, price, store_name, store_key),');
lines.push('--    não uses este ficheiro; migra conforme finmemory-agent/supabase_schema.sql');
lines.push('');
lines.push(
  'INSERT INTO public.promocoes_supermercados (supermercado, nome_produto, preco, categoria, lat, lng, run_id, atualizado_em, expira_em, ativo, validade, ingest_source) VALUES'
);

const rowSql = j.produtos.map(
  (p) =>
    `  ('${esc(slug)}', '${esc(p.nome_produto)}', ${Number(p.preco)}, '${esc(p.categoria)}', ${lat}, ${lng}, '${run}', '${upd}'::timestamptz, '${exp}'::timestamptz, true, '${val}'::date, '${ingest}')`
);
lines.push(rowSql.join(',\n') + ';');
lines.push('');
lines.push(`-- Total: ${j.produtos.length} linhas`);
lines.push('');
lines.push('-- -----------------------------------------------------------------------------');
lines.push('-- 3) Opcional — pin verde da loja em public.stores (o mapa usa name, lat, lng, active).');
lines.push('--    Descomenta e ajusta se ainda não existir esta unidade. Confirma colunas no teu projeto.');
lines.push('-- -----------------------------------------------------------------------------');
lines.push('-- INSERT INTO public.stores (name, type, address, lat, lng, neighborhood, active)');
lines.push("-- VALUES (");
lines.push("--   'Pomar da Vila — Vila Madalena',");
lines.push("--   'supermarket',");
lines.push("--   'Rua Mourato Coelho, 1458, São Paulo, SP',");
lines.push(`--   ${lat},`);
lines.push(`--   ${lng},`);
lines.push("--   'Vila Madalena',");
lines.push('--   true');
lines.push('-- );');

fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
console.log('Wrote', outPath);
