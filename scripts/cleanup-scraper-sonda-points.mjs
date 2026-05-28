#!/usr/bin/env node
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });
config();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Supabase env missing');
  process.exit(1);
}

const supabase = createClient(url, key);
const { data, error } = await supabase
  .from('price_points')
  .delete()
  .eq('source', 'scraper_sonda')
  .select('id');

if (error) {
  console.error(error.message);
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, deleted: data?.length ?? 0 }, null, 2));
