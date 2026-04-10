/**
 * Gera SQL de INSERT em public.promocoes_supermercados a partir de um JSON de curadoria.
 *
 * Uso:
 *   node scripts/generate-curadoria-promocoes-sql.mjs [caminho.json] [saida.sql]
 *
 * meta.unidades: opcional — [{ "lat", "lng", "nome"? }] replica cada produto para cada loja.
 * Por produto: valid_from, valid_until, validity_note, expira_em (opcionais).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const defaultJson = path.join(__dirname, '../data/curadoria/pomar-vila-madalena-ig-2026-04-04-a-09.json');
const jsonPath = path.resolve(process.argv[2] || defaultJson);
const outPath = process.argv[3]
  ? path.resolve(process.argv[3])
  : jsonPath.replace(/\.json$/i, '-insert.sql');

if (!fs.existsSync(jsonPath)) {
  console.error('Ficheiro não encontrado:', jsonPath);
  process.exit(1);
}

const j = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
const meta = j.meta || {};
const produtos = Array.isArray(j.produtos) ? j.produtos : [];

const esc = (s) => String(s).replace(/'/g, "''");
const slug = meta.supermercado_slug;
const metaLat = meta.lat;
const metaLng = meta.lng;

let unidades = [];
if (Array.isArray(meta.unidades) && meta.unidades.length) {
  unidades = meta.unidades
    .map((u) => ({
      lat: Number(u.lat),
      lng: Number(u.lng),
      nome: u.nome || '',
    }))
    .filter((u) => Number.isFinite(u.lat) && Number.isFinite(u.lng));
}
if (!unidades.length) {
  if (typeof metaLat !== 'number' || typeof metaLng !== 'number') {
    console.error('Defina meta.unidades[] ou meta.lat e meta.lng (números).');
    process.exit(1);
  }
  unidades = [{ lat: metaLat, lng: metaLng, nome: meta.loja || '' }];
}

if (!slug) {
  console.error('meta.supermercado_slug é obrigatório.');
  process.exit(1);
}

const runIdBase =
  meta.run_id || `curadoria-${String(slug).replace(/[^a-z0-9_-]/gi, '-')}-${new Date().toISOString().slice(0, 10)}`;
/** UNIQUE (supermercado, nome_produto, run_id): cada unidade precisa de run_id distinto quando há várias lojas com os mesmos produtos. */
function runIdForUnit(unitIndex) {
  return unidades.length > 1 ? `${runIdBase}-u${unitIndex + 1}` : runIdBase;
}
const runIdsToDelete =
  unidades.length > 1
    ? [...unidades.map((_, i) => runIdForUnit(i)), runIdBase]
    : [runIdBase];
const ingest =
  meta.ingest_source ||
  `curadoria_json:${String(slug).replace(/[^a-z0-9_-]/gi, '_')}:${new Date().toISOString().slice(0, 10)}`;
const defaultValidUntil = meta.validade_encarte_ate || new Date().toISOString().slice(0, 10);
const defaultExp =
  meta.expira_em || `${defaultValidUntil}T23:59:59-03:00`;
const upd = meta.atualizado_em || new Date().toISOString();

if (produtos.length === 0) {
  console.error('Nenhum item em produtos[]. Preencha o JSON antes de gerar o SQL.');
  process.exit(1);
}

/** UNIQUE (supermercado, nome_produto, run_id): o mesmo produto pode repetir-se no JSON (dias/encartes diferentes) — tornar nome único. */
function nomeProdutoComDesambiguacao(p, idx) {
  const nome = String(p.nome_produto ?? p.product_name ?? '').trim();
  if (!nome) return nome;
  const mesmoNome = produtos.filter(
    (x) => String(x.nome_produto ?? x.product_name ?? '').trim() === nome
  ).length;
  if (mesmoNome <= 1) return nome;
  const note = p.validity_note != null && String(p.validity_note).trim() ? String(p.validity_note).trim() : '';
  const vf = p.valid_from != null && p.valid_from !== '' ? String(p.valid_from).slice(0, 10) : '';
  const vu = p.valid_until != null && p.valid_until !== '' ? String(p.valid_until).slice(0, 10) : '';
  const tag = note || (vf && vu ? `${vf}–${vu}` : vf || vu || `#${idx + 1}`);
  return `${nome} · ${tag}`;
}

const lines = [];
lines.push('-- =============================================================================');
lines.push(`-- Curadoria → promocoes_supermercados (${meta.loja || slug})`);
lines.push(`-- Slug: ${slug} — ${unidades.length} unidade(s).`);
lines.push('-- Requer colunas valid_from e validity_note (migration 20260407120000 + 20260408130000).');
lines.push('-- Cole no SQL Editor do Supabase.');
lines.push('-- =============================================================================');
lines.push('');
lines.push(
  '-- 1) Idempotência: apagar todos os run_id deste encarte (várias unidades = vários run_id …-u1, …-u2).'
);
lines.push('DELETE FROM public.promocoes_supermercados');
lines.push(`WHERE supermercado = '${esc(slug)}'`);
lines.push(`  AND run_id IN (${runIdsToDelete.map((r) => `'${esc(r)}'`).join(', ')});`);
lines.push('');
lines.push(
  'INSERT INTO public.promocoes_supermercados (supermercado, nome_produto, preco, categoria, lat, lng, run_id, atualizado_em, expira_em, ativo, validade, valid_from, validity_note, ingest_source) VALUES'
);

const valueRows = [];
unidades.forEach((u, unitIndex) => {
  const runId = runIdForUnit(unitIndex);
  produtos.forEach((p, idx) => {
    const nome = nomeProdutoComDesambiguacao(p, idx);
    const preco = p.preco ?? p.promo_price ?? p.price;
    const cat = p.categoria || p.category || 'Outros';
    if (nome == null || preco == null) {
      throw new Error(`Item inválido (falta nome ou preço): ${JSON.stringify(p)}`);
    }
    const vu = p.valid_until || p.validade || defaultValidUntil;
    const vf = p.valid_from != null && p.valid_from !== '' ? p.valid_from : null;
    const exp = p.expira_em || `${vu}T23:59:59-03:00`;
    const vnote = p.validity_note != null && String(p.validity_note).trim() ? String(p.validity_note).trim() : null;
    const vfSql = vf ? `'${esc(vf)}'::date` : 'NULL';
    const vnSql = vnote ? `'${esc(vnote)}'` : 'NULL';
    valueRows.push(
      `  ('${esc(slug)}', '${esc(nome)}', ${Number(preco)}, '${esc(cat)}', ${u.lat}, ${u.lng}, '${esc(
        runId
      )}', '${esc(upd)}'::timestamptz, '${esc(exp)}'::timestamptz, true, '${esc(vu)}'::date, ${vfSql}, ${vnSql}, '${esc(
        ingest
      )}')`
    );
  });
});
lines.push(valueRows.join(',\n') + ';');
lines.push('');
lines.push(`-- Total: ${valueRows.length} linhas (${produtos.length} produtos × ${unidades.length} unidades)`);

fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
console.log('Wrote', outPath);
