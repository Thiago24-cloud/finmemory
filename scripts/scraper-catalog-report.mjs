#!/usr/bin/env node
import { config } from 'dotenv';
import { resolve } from 'path';
import { fetchDiaScraperStoresFromOfficial } from '../lib/diaScraper/fetchDiaCatalogStores.js';
import { fetchAtacadaoScraperStoresFromOfficial } from '../lib/atacadaoScraper/fetchAtacadaoCatalogStores.js';
import { DIA_SCRAPER_STORES } from '../lib/diaScraper/storesCatalog.js';
import { ATACADAO_SCRAPER_STORES } from '../lib/atacadaoScraper/storesCatalog.js';

config({ path: resolve(process.cwd(), '.env') });
config({ path: resolve(process.cwd(), '.env.local'), override: true });

const dia = await fetchDiaScraperStoresFromOfficial();
const atac = await fetchAtacadaoScraperStoresFromOfficial();

console.log(JSON.stringify({
  dia: { static: DIA_SCRAPER_STORES.length, officialSp: dia.length },
  atacadao: { static: ATACADAO_SCRAPER_STORES.length, discoveredSp: atac.length },
}, null, 2));
