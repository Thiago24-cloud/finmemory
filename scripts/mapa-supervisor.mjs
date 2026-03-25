#!/usr/bin/env node
/**
 * FinMemory — Supervisor do mapa de preços (health + APIs públicas).
 *
 * Não aumenta performance do app em si: só verifica se tudo responde e sai com código ≠0 se falhar
 * (ideal para cron, Cloud Scheduler, GitHub Actions, UptimeRobot chamando um wrapper).
 *
 * Uso:
 *   MAP_SUPERVISOR_BASE_URL=https://finmemory.com.br node scripts/mapa-supervisor.mjs
 *   node scripts/mapa-supervisor.mjs --base=https://finmemory.com.br
 *   node scripts/mapa-supervisor.mjs --strict-config   # falha se /api/health vier degraded
 *
 * Variáveis:
 *   MAP_SUPERVISOR_BASE_URL — URL base (sem barra final)
 *   MAP_SUPERVISOR_TIMEOUT_MS — timeout por request (default 20000)
 */

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)=(.*)$/);
    if (m) return [m[1], m[2]];
    const f = a.replace(/^--/, '');
    return [f, true];
  })
);

const BASE = (
  args.base ||
  process.env.MAP_SUPERVISOR_BASE_URL ||
  'http://localhost:3000'
)
  .replace(/\/$/, '');
const TIMEOUT_MS = Math.max(
  5000,
  Number.parseInt(process.env.MAP_SUPERVISOR_TIMEOUT_MS || '20000', 10) || 20000
);
const STRICT_CONFIG = args['strict-config'] === true || process.env.MAP_SUPERVISOR_STRICT_CONFIG === '1';

/** Bbox pequeno no centro de SP (para testar filtro geográfico da API) */
const BBOX_SP = {
  sw_lat: -23.58,
  sw_lng: -46.68,
  ne_lat: -23.52,
  ne_lng: -46.6,
};

async function fetchJson(path, { expectOk = true } = {}) {
  const url = `${BASE}${path.startsWith('/') ? path : `/${path}`}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { _raw: text.slice(0, 200) };
    }
    if (expectOk && !res.ok) {
      return { ok: false, status: res.status, url, json };
    }
    return { ok: res.ok, status: res.status, url, json };
  } catch (e) {
    return { ok: false, status: 0, url, error: e.message || String(e) };
  } finally {
    clearTimeout(t);
  }
}

function qsBbox() {
  const p = new URLSearchParams({
    sw_lat: String(BBOX_SP.sw_lat),
    sw_lng: String(BBOX_SP.sw_lng),
    ne_lat: String(BBOX_SP.ne_lat),
    ne_lng: String(BBOX_SP.ne_lng),
  });
  return p.toString();
}

async function main() {
  const started = Date.now();
  const report = {
    base: BASE,
    at: new Date().toISOString(),
    checks: {},
    ok: true,
  };

  const health = await fetchJson('/api/health');
  report.checks.health = health;
  if (!health.ok) {
    report.ok = false;
  } else if (health.json?.status === 'degraded' && STRICT_CONFIG) {
    report.ok = false;
    report.checks.health = { ...health, failReason: 'degraded_and_strict_config' };
  }

  const pointsQ = `/api/map/points?${qsBbox()}`;
  const points = await fetchJson(pointsQ);
  report.checks.mapPointsBbox = points;
  if (!points.ok || !Array.isArray(points.json?.points)) {
    report.ok = false;
  }

  const storesQ = `/api/map/stores?${qsBbox()}`;
  const stores = await fetchJson(storesQ);
  report.checks.mapStoresBbox = stores;
  if (!stores.ok || !Array.isArray(stores.json?.stores)) {
    report.ok = false;
  }

  report.durationMs = Date.now() - started;
  report.pointsInBbox = points.json?.points?.length ?? null;
  report.storesInBbox = stores.json?.stores?.length ?? null;

  console.log(JSON.stringify(report, null, process.stdout.isTTY ? 2 : 0));

  if (!report.ok) {
    process.exit(1);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(JSON.stringify({ ok: false, error: e.message || String(e) }));
  process.exit(1);
});
