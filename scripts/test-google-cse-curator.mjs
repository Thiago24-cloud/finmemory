#!/usr/bin/env node
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const apiKey = process.env.GOOGLE_API_KEY;
const cseId = process.env.GOOGLE_CSE_ID;
if (!apiKey || !cseId) {
  console.error('GOOGLE_API_KEY ou GOOGLE_CSE_ID ausentes');
  process.exit(1);
}

const query = process.argv[2] || 'Whey Sabor Mousse de Morango';
const url = new URL('https://www.googleapis.com/customsearch/v1');
url.searchParams.set('key', apiKey);
url.searchParams.set('cx', cseId);
url.searchParams.set('q', query);
url.searchParams.set('searchType', 'image');
url.searchParams.set('imgType', 'photo');
url.searchParams.set('imgColorType', 'white');
url.searchParams.set('safe', 'active');
url.searchParams.set('num', '3');
url.searchParams.set('gl', 'br');
url.searchParams.set('hl', 'pt-BR');

const res = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
const payload = await res.json().catch(() => ({}));

console.log(
  JSON.stringify(
    {
      query,
      status: res.status,
      ok: res.ok,
      params: {
        searchType: 'image',
        imgType: 'photo',
        imgColorType: 'white',
        safe: 'active',
        num: 3,
      },
      firstLinks: Array.isArray(payload?.items)
        ? payload.items.slice(0, 3).map((i) => i?.link).filter(Boolean)
        : [],
      googleError: payload?.error || null,
    },
    null,
    2
  )
);

process.exit(res.ok ? 0 : 2);
