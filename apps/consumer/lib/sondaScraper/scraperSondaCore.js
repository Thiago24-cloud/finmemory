import { parsePriceBR } from '../ingest/money.js';
import { isLikelyNonProductScraperTitle } from '../mapStoreChainMatch.js';
import { isLowQualityProductImageUrl } from '../mapProductImageQuality.js';
import {
  SP_GRANDE_SP_CITIES,
  inferDddByCity,
  inferMacroRegion,
  normalizeGeoText,
} from '../ingest/run.js';
import {
  geocodeAddress,
  GRANDE_SP_GEOCODE_BBOX,
  SAO_PAULO_CITY_PROXIMITY,
} from '../geocode.js';

export const SCRAPER_SONDA_ORIGEM = 'scraper_sonda';
/** Site oficial (sonda.com.br redireciona para ofertas por CEP da loja física). */
export const SONDA_OFERTAS_BASE = 'https://www.sondadelivery.com.br/delivery';
export const SONDA_LOJAS_URL = 'https://www.sondadelivery.com.br/delivery/LojasFisicas';

export function nextSundayYmdBrazil(from = new Date()) {
  const tz = 'America/Sao_Paulo';
  const weekdayFmt = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' });
  const ymdFmt = new Intl.DateTimeFormat('fr-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const base = from.getTime();
  for (let i = 0; i < 14; i++) {
    const d = new Date(base + i * 86400000);
    if (weekdayFmt.format(d) === 'Sun') return ymdFmt.format(d);
  }
  return ymdFmt.format(new Date(base));
}

export function inferLocalityForCity(city) {
  const cityTrim = String(city || '').trim();
  if (!cityTrim) {
    return {
      locality_scope: 'Estadual',
      locality_city: null,
      locality_region: null,
      locality_state: 'SP',
      ddd_code: null,
      is_statewide: false,
    };
  }
  const n = normalizeGeoText(cityTrim);
  const locality_scope = SP_GRANDE_SP_CITIES.has(n) ? 'Grande SP' : 'Cidade';
  return {
    locality_scope,
    locality_city: cityTrim,
    locality_region: inferMacroRegion(cityTrim),
    locality_state: 'SP',
    ddd_code: inferDddByCity(cityTrim),
    is_statewide: false,
  };
}

/** @param {{ address: string, city?: string, lat?: number, lng?: number }} unit */
export async function resolveSondaUnitLatLng(unit) {
  if (Number.isFinite(unit.lat) && Number.isFinite(unit.lng)) {
    return { lat: unit.lat, lng: unit.lng };
  }
  const city = String(unit.city || '').trim();
  const queries = [
    `${unit.address}, ${city}, SP, Brasil`,
    `${unit.address}, Brasil`,
  ].filter((q) => q.length > 12);

  const geoOpts = {
    bbox: GRANDE_SP_GEOCODE_BBOX,
    proximity: city === 'São Paulo' ? SAO_PAULO_CITY_PROXIMITY : undefined,
  };

  for (const q of queries) {
    const coords = await geocodeAddress(q, geoOpts);
    if (!coords || !Number.isFinite(coords.lat) || !Number.isFinite(coords.lng)) continue;
    if (coords.lat < -24.2 || coords.lat > -22.7 || coords.lng < -47.2 || coords.lng > -45.9) {
      continue;
    }
    return coords;
  }
  return { lat: null, lng: null };
}

function normStreet(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(av|avenida|r|rua|al)\b\.?/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Lista lojas físicas publicadas no site (Lojas Físicas).
 * @param {import('playwright').Page} page
 */
export async function fetchSondaPhysicalStoresFromSite(page) {
  await page.goto(SONDA_LOJAS_URL, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await page.waitForTimeout(2000);
  return page.evaluate(() => {
    const text = document.body.innerText || '';
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    const stores = [];
    const re = /^(.+?)\s*-\s*(\d{5}-?\d{3})\s*-\s*([^/]+)\/SP/i;
    for (const line of lines) {
      const m = line.match(re);
      if (!m) continue;
      const cep = m[2].replace(/\D/g, '');
      if (cep.length !== 8) continue;
      stores.push({
        addressLine: m[1].trim(),
        cep,
        city: m[3].trim(),
      });
    }
    return stores;
  });
}

/**
 * Casa unidade do terminal com loja + CEP do site.
 * @param {{ address: string, label: string }} unit
 * @param {Array<{ addressLine: string, cep: string, city: string }>} stores
 */
export function matchUnitToPhysicalStore(unit, stores) {
  const unitNorm = normStreet(unit.address);
  const unitTokens = unitNorm.split(' ').filter((t) => t.length > 3);
  let best = null;
  let bestScore = 0;
  for (const st of stores) {
    const stNorm = normStreet(st.addressLine);
    let score = 0;
    for (const t of unitTokens) {
      if (stNorm.includes(t)) score += 2;
    }
    if (unit.label && stNorm.includes(normStreet(unit.label).split(' ')[0])) score += 1;
    if (score > bestScore) {
      bestScore = score;
      best = st;
    }
  }
  return bestScore >= 4 ? best : null;
}

/**
 * Define CEP da loja e lê ofertas publicadas no site para essa unidade.
 * @param {import('playwright').Page} page
 * @param {string} cep8
 */
export async function extractSondaOffersForStoreCep(page, cep8) {
  const cep = String(cep8 || '').replace(/\D/g, '');
  await page.goto(SONDA_OFERTAS_BASE, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await page.waitForTimeout(1500);

  const cepInput =
    '#ctl00_uscLogin_ucDisponibilidadeEntrega_txtCep, input[id*="txtCep"], input[name*="Cep"]';
  await page.fill(cepInput, cep).catch(async () => {
    await page.evaluate((c) => {
      const el = document.querySelector('input[id*="Cep"], input[name*="cep"]');
      if (el) {
        el.value = c;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, cep);
  });

  await page
    .locator('input[id*="btnConfirmar"], input[value*="Confirmar"], button, a')
    .filter({ hasText: /confirmar/i })
    .first()
    .click({ timeout: 8000 })
    .catch(() => {});
  await page.waitForTimeout(2500);

  async function scrollPage() {
    await page.evaluate(async () => {
      await new Promise((resolve) => {
        let y = 0;
        const step = () => {
          y += 500;
          window.scrollTo(0, y);
          if (y < document.body.scrollHeight) requestAnimationFrame(step);
          else resolve();
        };
        step();
      });
    });
  }

  async function scrapeCurrentPage() {
    return page.evaluate(() => {
      const items = [];
      const seen = new Set();
      document
        .querySelectorAll(
          'article, [class*="product"], [class*="Product"], [class*="card"], [class*="shelf"], [class*="vitrine"]'
        )
        .forEach((card) => {
          const blob = card.innerText || '';
          let nome = card
            .querySelector('h2, h3, h4, [class*="name"], [class*="title"], [class*="Name"]')
            ?.innerText?.trim();
          if (!nome || /^por\s*$/i.test(nome) || nome.length < 4) {
            const lines = blob
              .split('\n')
              .map((l) => l.trim())
              .filter((l) => l.length >= 4);
            const isNoise = (l) =>
              /^por\s*$/i.test(l) ||
              /^\d+\s*%\s*off$/i.test(l) ||
              /R\$\s*[\d.,]+/i.test(l);
            nome =
              lines.find((l) => !isNoise(l) && l.length >= 8) ||
              lines.find((l) => !isNoise(l) && l.length >= 4) ||
              nome;
          }
          const preco =
            card.querySelector('[class*="price"], [class*="Price"], [class*="preco"]')?.innerText?.trim() ||
            (blob.match(/Por\s+R\$\s*[\d.,]+/i) || [])[0] ||
            (blob.match(/R\$\s*[\d.,]+/) || [])[0];
          const imagem = card.querySelector('img')?.src;
          if (!nome || /^por\s*$/i.test(nome) || /^\d+\s*%\s*off$/i.test(nome) || nome.length < 4) return;
          if (!preco || !/R\$\s*[\d.,]+/.test(preco)) return;
          const key = `${nome}|${preco}`;
          if (seen.has(key)) return;
          seen.add(key);
          items.push({ nome, preco, imagem: imagem || null });
        });
      return items;
    });
  }

  const merged = new Map();

  const addItems = (list) => {
    for (const it of list || []) {
      const key = `${it.nome}|${it.preco}`;
      if (!merged.has(key)) merged.set(key, it);
    }
  };

  await page.goto('https://www.sondadelivery.com.br/', {
    waitUntil: 'domcontentloaded',
    timeout: 90_000,
  });
  await page.waitForTimeout(2000);
  await scrollPage();
  addItems(await scrapeCurrentPage());

  const hotsites = await page.evaluate(() =>
    [...document.querySelectorAll('a[href*="/delivery/hotsite/"]')]
      .map((a) => a.href)
      .filter((h, i, arr) => arr.indexOf(h) === i)
      .filter((h) => /ofertas|superofertas/i.test(h))
      .slice(0, 12)
  );

  for (const url of hotsites) {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90_000 }).catch(() => {});
    await page.waitForTimeout(1500);
    await scrollPage();
    addItems(await scrapeCurrentPage());
  }

  return [...merged.values()];
}

/**
 * @param {Array<{ nome: string, preco: string, imagem?: string | null }>} raw
 * @param {string} validUntilYmd
 */
export function mapSondaOffersToProdutosFila(raw, validUntilYmd) {
  const out = [];
  const seen = new Set();
  for (const o of raw || []) {
    const name = String(o.nome || '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 200);
    if (!name || name.length < 4 || /^por\s*$/i.test(name) || isLikelyNonProductScraperTitle(name)) continue;
    const price = parsePriceBR(o.preco);
    if (!Number.isFinite(price) || price <= 0) continue;
    const key = `${name}|${price}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const img = o.imagem && !isLowQualityProductImageUrl(o.imagem) ? o.imagem : null;
    out.push({
      nome: name,
      name,
      price,
      preco: price,
      image_url: img,
      imagem_url: img,
      valid_until: validUntilYmd,
      unidade: null,
    });
  }
  return out;
}
