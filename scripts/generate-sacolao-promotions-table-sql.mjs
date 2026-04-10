/**
 * Gera INSERT em public.promotions a partir do JSON da curadoria Sacolão (1.ª unidade em meta.unidades = loja do encarte no popup).
 * A secção "Promoções (encarte)" no mapa lê esta tabela; promocoes_supermercados alimenta outro fluxo.
 *
 * Uso:
 *   node scripts/generate-sacolao-promotions-table-sql.mjs [caminho.json] [saida.sql]
 *   (omitindo args: JSON de exemplo no repo + mesmo nome com sufixo -promotions-insert.sql)
 *
 * meta.promotions_source — opcional; senão usa meta.ingest_source + ':promotions_vm'.
 * Requer migration: valid_dates em promotions (20260409150000).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultJson = path.join(__dirname, '../data/curadoria/sacolao-sao-jorge-operacao-abre-mes-2026-04.json');
const jsonPath = path.resolve(process.argv[2] || defaultJson);
const outPath = process.argv[3]
  ? path.resolve(process.argv[3])
  : jsonPath.replace(/\.json$/i, '-promotions-insert.sql');

if (!fs.existsSync(jsonPath)) {
  console.error('Ficheiro não encontrado:', jsonPath);
  process.exit(1);
}

const esc = (s) => String(s).replace(/'/g, "''");

function deriveValidDates(p) {
  const note = p.validity_note || '';
  const vf = p.valid_from;
  const vu = p.valid_until;
  const noteLower = note.toLowerCase();
  if (/seg e sex|segunda e sexta/.test(noteLower)) {
    const m = /\b(\d{1,2})\s+e\s+(\d{1,2})\/(\d{2})\/(\d{4})/.exec(note);
    if (m) {
      const d1 = m[1].padStart(2, '0');
      const d2 = m[2].padStart(2, '0');
      const mo = m[3];
      const y = m[4];
      return [`${y}-${mo}-${d1}`, `${y}-${mo}-${d2}`];
    }
  }
  if (vf && vu && vf === vu) return [vf];
  return null;
}

function sqlValidDates(arr) {
  if (!arr?.length) return 'NULL';
  return `ARRAY[${arr.map((d) => `'${esc(d)}'`).join(', ')}]::text[]`;
}

const j = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
const meta = j.meta || {};
const produtos = Array.isArray(j.produtos) ? j.produtos : [];

const sourceTag =
  (meta.promotions_source && String(meta.promotions_source).trim()) ||
  (meta.ingest_source
    ? `${String(meta.ingest_source).trim()}:promotions_vm`
    : 'curadoria:sacolao:promotions_vm');

/** Mesmo nome em várias linhas (dias diferentes) — product_name único em public.promotions. */
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
const unidadeVm = Array.isArray(meta.unidades) && meta.unidades[0] ? meta.unidades[0] : null;
const storeLabel = unidadeVm?.nome || 'Sacolão São Jorge — Vila Madalena';

const lines = [];
lines.push('-- =============================================================================');
lines.push('-- Curadoria → public.promotions (Sacolão São Jorge — Vila Madalena)');
lines.push('-- Liga a loja em public.stores por nome (ajuste se o nome for diferente).');
lines.push('-- Requer colunas valid_dates (migration 20260409150000).');
lines.push('-- Cole no SQL Editor do Supabase após a loja existir.');
lines.push('-- =============================================================================');
lines.push('');
lines.push(`UPDATE public.promotions SET active = false WHERE source = '${esc(sourceTag)}' AND active = true;`);
lines.push('');
lines.push(
  `INSERT INTO public.promotions (product_name, promo_price, category, store_name, store_id, valid_from, valid_until, valid_dates, validity_note, active, is_individual_product, source)`
);
lines.push('SELECT v.* FROM (VALUES');

const valueRows = [];
produtos.forEach((p, idx) => {
  const nome = nomeProdutoComDesambiguacao(p, idx);
  const preco = p.preco ?? p.promo_price;
  const cat = p.categoria || p.category || 'Outros';
  const vnote = p.validity_note != null && String(p.validity_note).trim() ? String(p.validity_note).trim() : null;
  const vd = deriveValidDates(p);
  let vfOut = 'NULL';
  let vuOut = 'NULL';
  let vdOut = sqlValidDates(vd);
  if (vd?.length) {
    vfOut = 'NULL';
    vuOut = 'NULL';
  } else if (p.valid_from && p.valid_until) {
    vfOut = `'${esc(p.valid_from)}'::date`;
    vuOut = `'${esc(p.valid_until)}'::date`;
    vdOut = 'NULL';
  } else if (p.valid_from) {
    vfOut = `'${esc(p.valid_from)}'::date`;
    vuOut = p.valid_until ? `'${esc(p.valid_until)}'::date` : 'NULL';
    vdOut = 'NULL';
  }

  valueRows.push(
    `  ('${esc(nome)}', ${Number(preco)}, '${esc(cat)}', '${esc(storeLabel)}', ${vfOut}, ${vuOut}, ${vdOut}, ${vnote ? `'${esc(vnote)}'` : 'NULL'})`
  );
});

lines.push(valueRows.join(',\n'));
lines.push(
  `) AS t(product_name, promo_price, category, store_name, valid_from, valid_until, valid_dates, validity_note)`
);
lines.push(
  `CROSS JOIN LATERAL (SELECT id FROM public.stores WHERE active = true AND name ILIKE '%Sacolão%São Jorge%Vila Madalena%' LIMIT 1) s`
);
lines.push(
  `CROSS JOIN LATERAL (SELECT t.product_name, t.promo_price, t.category, t.store_name, s.id AS store_id, t.valid_from, t.valid_until, t.valid_dates, t.validity_note, true AS active, true AS is_individual_product, '${esc(
    sourceTag
  )}' AS source) v;`
);
lines.push('');
lines.push(`-- Total: ${valueRows.length} linhas`);

fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
console.log('Wrote', outPath, `(${valueRows.length} produtos)`);
