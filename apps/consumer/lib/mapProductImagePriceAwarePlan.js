/**
 * Plano de busca de imagem sensível a preço + unidade (nome sozinho engana: bolo fatia vs inteiro).
 * Heurísticas locais + refinamento opcional via Gemini (GEMINI_API_KEY).
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

const BRL = (n) => (Number.isFinite(n) && n > 0 ? n : null);

function norm(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function parseWeightKg(unitRaw, nameRaw) {
  const blob = `${unitRaw} ${nameRaw}`.toLowerCase().replace(',', '.');
  const kg = blob.match(/(\d+(?:\.\d+)?)\s*kg\b/);
  if (kg) return Number(kg[1]);
  const g = blob.match(/(\d+(?:\.\d+)?)\s*g\b/);
  if (g) return Number(g[1]) / 1000;
  const l = blob.match(/(\d+(?:\.\d+)?)\s*l\b/);
  if (l) return Number(l[1]);
  const ml = blob.match(/(\d+(?:\.\d+)?)\s*ml\b/);
  if (ml) return Number(ml[1]) / 1000;
  return null;
}

function isPerKgUnit(unitRaw, nameRaw) {
  const u = norm(unitRaw);
  const n = norm(nameRaw);
  return /\bkg\b|\bquilo\b|\b\/\s*kg\b/.test(u) || /\bkg\b/.test(n) && !/\bun\b|\bunidade\b|\bfatia\b/.test(u);
}

/**
 * Heurísticas do "cérebro" (Prompt 1) — sem API.
 * @param {{ nome: string, preco?: number|null, unidade?: string|null }}
 */
export function inferImageQualifiersFromPrice({ nome, preco, unidade }) {
  const name = String(nome || '').trim();
  const unit = String(unidade || '').trim();
  const price = BRL(Number(preco));
  const n = norm(name);
  const suffixes = [];
  let sizeHint = null;
  let quantityHint = null;
  let category = 'generic';

  const weightKg = parseWeightKg(unit, name);

  if (/\bsab[aã]o\b/.test(n) && /\b(em\s*p[oó]|po\b|tixan|ype|omo|brilhante)\b/.test(n)) {
    category = 'hygiene_powder';
    if (weightKg != null && weightKg >= 1.5) {
      sizeHint = 'pacote grande';
      suffixes.push('pacote grande', `${weightKg}kg`);
    } else if (weightKg != null && weightKg < 0.5) {
      sizeHint = 'caixa pequena';
      suffixes.push('caixa pequena', `${Math.round(weightKg * 1000)}g`);
    } else if (price != null && price >= 15) {
      sizeHint = 'pacote grande';
      suffixes.push('pacote grande', '2kg', '1,6kg');
    } else if (price != null && price < 8) {
      sizeHint = 'pacote pequeno';
      suffixes.push('pacote pequeno', '500g');
    }
  } else if (/\bsabonete\b|\bsab[aã]o\s*em\s*pedra\b|\bsab[aã]o\s*liquido\b/.test(n)) {
    category = 'hygiene_bar';
    sizeHint = price != null && price < 6 ? 'unidade barra' : 'pack';
    suffixes.push(price != null && price < 6 ? 'barra unidade' : 'pack sabonete');
  } else if (/\bpera\b|\bbanana\b|\bma[cç][aã]\b|\blaranja\b|\bmorango\b|\buva\b|\bfruta\b|\bhortifruti\b/.test(n)) {
    category = 'hortifruti';
    if (isPerKgUnit(unit, name) || (price != null && price >= 8)) {
      quantityHint = 'quilo';
      suffixes.push('quilo', 'bandeja', 'várias unidades');
    } else {
      quantityHint = 'unidade';
      suffixes.push('unidade', 'uma fruta');
    }
  } else if (/\bbolo\b|\btorta\b|\bpudim\b|\brocambole\b|\bpanetone\b/.test(n)) {
    category = 'bakery';
    if (price != null && price >= 35) {
      sizeHint = 'bolo inteiro grande';
      suffixes.push('bolo inteiro grande', 'festa', 'decorado');
    } else if (price != null && price >= 18) {
      sizeHint = 'bolo medio';
      suffixes.push('bolo medio', 'inteiro');
    } else if (price != null) {
      sizeHint = 'fatia ou individual';
      suffixes.push('fatia', 'individual', 'porcao');
    }
  } else if (/\brefrigerante\b|\bcoca\b|\bpepsi\b|\bguaran[aá]\b/.test(n)) {
    category = 'beverage';
    if (price != null && price >= 12) suffixes.push('2 litros', 'garrafa grande');
    else if (price != null && price < 6) suffixes.push('lata', '350ml');
    else suffixes.push('garrafa');
  } else if (weightKg != null) {
    category = 'packaged';
    if (weightKg >= 1) suffixes.push(`pacote ${weightKg}kg`);
    else suffixes.push(`embalagem ${Math.round(weightKg * 1000)}g`);
  }

  return {
    category,
    sizeHint,
    quantityHint,
    searchSuffixes: [...new Set(suffixes.filter(Boolean))],
    refinedProductLabel: [name, sizeHint, quantityHint, ...suffixes.slice(0, 2)]
      .filter(Boolean)
      .join(' ')
      .slice(0, 180),
  };
}

function priceAwareEnabled() {
  return process.env.MAP_PRODUCT_IMAGE_PRICE_AWARE !== '0';
}

function geminiRefineEnabled() {
  return (
    priceAwareEnabled() &&
    process.env.MAP_PRODUCT_IMAGE_GEMINI_REFINE === '1' &&
    Boolean(process.env.GEMINI_API_KEY?.trim())
  );
}

/**
 * Gemini refina termos de busca (Prompt 2) a partir de nome + preço + unidade.
 * @returns {Promise<{ searchQueries: string[], visionContext: string }|null>}
 */
export async function refineImageSearchWithGemini({ nome, preco, unidade, storeName }) {
  if (!geminiRefineEnabled()) return null;

  const heur = inferImageQualifiersFromPrice({ nome, preco, unidade });
  const modelName =
    process.env.MAP_PRODUCT_IMAGE_GEMINI_MODEL?.trim() ||
    process.env.GOOGLE_GENERATIVE_AI_MODEL?.trim() ||
    'gemini-2.5-flash';

  const prompt = `Você escolhe termos de busca de imagem para um mapa de preços de supermercado no Brasil (estilo iFood: fundo branco, produto centralizado).

Produto: ${nome}
Preço (R$): ${preco ?? 'desconhecido'}
Unidade: ${unidade || 'não informada'}
Loja: ${storeName || 'supermercado'}
Heurística inicial: ${JSON.stringify(heur)}

Regras:
- O preço indica tamanho/volume (ex.: bolo R$ 10 = fatia/pequeno; R$ 60 = bolo grande inteiro).
- Sabão em pó caro + peso grande = pacote grande; sabonete barato = uma unidade.
- Hortifruti: preço baixo = uma fruta; preço alto ou /kg = quilo ou bandeja.
- Inclua qualificadores na busca: "fundo branco", "embalagem", "pacote", tamanho correto.
- Não invente marca que não está no nome.

Responda APENAS JSON compacto (máx. 2 termos em searchQueries, visionContext até 80 caracteres):
{"searchQueries":["termo1","termo2"],"visionContext":"..."}`;

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY.trim());
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: { temperature: 0.2, maxOutputTokens: 1024 },
    });
    const result = await model.generateContent(prompt);
    const raw = result?.response?.text?.()?.trim() || '';
    const stripped = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

    let parsed = null;
    const jsonMatch = stripped.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch {
        /* JSON truncado — extrai searchQueries por regex */
      }
    }
    let searchQueries = Array.isArray(parsed?.searchQueries)
      ? parsed.searchQueries.map((q) => String(q).trim()).filter((q) => q.length >= 3)
      : [];
    if (!searchQueries.length) {
      const re = /"searchQueries"\s*:\s*\[([\s\S]*?)(?:\]|$)/;
      const m = stripped.match(re);
      if (m) {
        searchQueries = [...m[1].matchAll(/"([^"]{8,160})"/g)]
          .map((x) => x[1].trim())
          .filter((q) => q.length >= 8);
      }
    }
    if (!searchQueries.length) {
      console.warn('refineImageSearchWithGemini: sem queries', stripped.slice(0, 120));
      return null;
    }
    const visionContext =
      String(parsed?.visionContext || '').trim() ||
      (stripped.match(/"visionContext"\s*:\s*"([^"]{5,200})/)?.[1] ?? '') ||
      heur.refinedProductLabel ||
      '';

    return {
      searchQueries: searchQueries.slice(0, 6),
      visionContext: visionContext.slice(0, 300),
      heuristics: heur,
    };
  } catch (e) {
    console.warn('refineImageSearchWithGemini:', e?.message || e);
    return null;
  }
}

/**
 * @param {string[]} baseQueries
 * @param {{ searchSuffixes?: string[], refinedProductLabel?: string }} qualifiers
 */
export function mergePriceAwareIntoGoogleQueries(baseQueries, qualifiers) {
  const base = Array.isArray(baseQueries) ? [...baseQueries] : [];
  const label = String(qualifiers?.refinedProductLabel || '').trim();
  const suffixes = qualifiers?.searchSuffixes || [];
  const extra = [];

  if (label) {
    extra.push(`${label} fundo branco produto`);
    extra.push(`${label} embalagem supermercado Brasil`);
  }
  for (const s of suffixes) {
    extra.push(`${label || ''} ${s} fundo branco`.trim());
  }

  return [...new Set([...extra, ...base])].filter((q) => q && q.length >= 3).slice(0, 12);
}

/**
 * Plano completo: heurística + Gemini opcional.
 */
export async function buildPriceAwareImageContext(productName, storeName, opts = {}) {
  const nome = String(productName || '').trim();
  const preco = opts.price != null ? Number(opts.price) : null;
  const unidade = opts.unit != null ? String(opts.unit) : null;
  const store = String(storeName || '').trim();

  if (!priceAwareEnabled() || !nome) {
    return { qualifiers: null, gemini: null, visionLabel: nome };
  }

  const qualifiers = inferImageQualifiersFromPrice({ nome, preco, unidade });
  const gemini = await refineImageSearchWithGemini({ nome, preco, unidade, storeName: store });
  const visionLabel = gemini?.visionContext || qualifiers.refinedProductLabel || nome;

  return { qualifiers, gemini, visionLabel };
}
