#!/usr/bin/env node
/**
 * Expande itens de curadoria para as 6 filiais Mambo SP (data/curadoria/mambo-sp-lojas.json).
 * Gera SQL INSERT em promocoes_supermercados (supermercado=mambo), um registo por loja por item.
 *
 * Uso:
 *   node scripts/mambo-expand-curadoria.mjs data/curadoria/mambo-curadoria-exemplo-itens.json
 *   node scripts/mambo-expand-curadoria.mjs ./meus-itens.json meu-run-2026-04-05
 *
 * Formato do JSON: array ou { "items": [ { "nome_produto", "preco", "categoria"?, "imagem_url"? } ] }
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

const root = resolve(import.meta.dirname, '..');
const lojasPath = resolve(root, 'data/curadoria/mambo-sp-lojas.json');

const itemsPath = process.argv[2];
const runId = process.argv[3] || `curadoria-mambo-sp-${new Date().toISOString().slice(0, 10)}`;

if (!itemsPath) {
  console.error('Uso: node scripts/mambo-expand-curadoria.mjs <itens.json> [run_id]');
  process.exit(1);
}

const lojasList = JSON.parse(readFileSync(lojasPath, 'utf8'));
if (!Array.isArray(lojasList)) {
  console.error('mambo-sp-lojas.json deve ser um array');
  process.exit(1);
}

const itemsFile = readFileSync(resolve(root, itemsPath), 'utf8');
const parsed = JSON.parse(itemsFile);
const items = Array.isArray(parsed) ? parsed : parsed.items;
if (!Array.isArray(items) || items.length === 0) {
  console.error('itens.json: use array ou { "items": [...] } com pelo menos 1 item');
  process.exit(1);
}

const now = new Date().toISOString();
const expira = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
const ingest = `curadoria_json:mambo_sp:${runId}`;

function esc(s) {
  return String(s ?? '').replace(/'/g, "''");
}

const rows = [];
for (const it of items) {
  const nomeBase = String(it.nome_produto || it.product_name || '').trim();
  const preco = it.preco != null ? Number(it.preco) : it.price != null ? Number(it.price) : null;
  if (!nomeBase || preco == null || Number.isNaN(preco)) continue;
  const cat = String(it.categoria || it.category || 'Supermercado - Promoção').trim();
  const img = it.imagem_url || it.image_url || null;
  for (const L of lojasList) {
    const sid = String(L.place_id || L.slug).replace(/[^a-z0-9]/gi, '').slice(-10) || 'loja';
    const nome = `${nomeBase} · ${L.name} #${sid}`.slice(0, 280);
    rows.push({ nome, preco, cat, img, lat: L.lat, lng: L.lng });
  }
}

if (!rows.length) {
  console.error('Nenhuma linha válida (nome_produto + preco numérico).');
  process.exit(1);
}

console.log(`-- ${rows.length} linhas (${items.length} itens × ${lojasList.length} lojas) run_id=${runId}`);
console.log(`-- Opcional: desativar lote anterior`);
console.log(
  `-- UPDATE public.promocoes_supermercados SET ativo = false WHERE supermercado = 'mambo' AND ingest_source = '${esc(ingest)}' AND ativo = true;`
);
console.log('');
console.log(
  'INSERT INTO public.promocoes_supermercados (supermercado, nome_produto, preco, categoria, lat, lng, run_id, atualizado_em, expira_em, ativo, imagem_url, ingest_source) VALUES'
);
const vals = rows.map(
  (r) =>
    `  ('mambo', '${esc(r.nome)}', ${r.preco}, '${esc(r.cat)}', ${r.lat}, ${r.lng}, '${esc(runId)}', '${now}'::timestamptz, '${expira}'::timestamptz, true, ${r.img ? `'${esc(r.img)}'` : 'NULL'}, '${esc(ingest)}')`
);
console.log(vals.join(',\n') + ';');
