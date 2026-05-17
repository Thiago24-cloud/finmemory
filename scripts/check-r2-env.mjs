#!/usr/bin/env node
import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { HeadBucketCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

const cwd = process.cwd();
for (const filename of ['.env', '.env.local']) {
  const filePath = path.join(cwd, filename);
  if (fs.existsSync(filePath)) dotenv.config({ path: filePath, override: false });
}

const endpoint = process.env.CLOUDFLARE_R2_ENDPOINT;
const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
const bucket =
  process.env.CLOUDFLARE_R2_BUCKET ||
  process.env.CLOUDFLARE_R2_BUCKET_NAME ||
  '';
const publicBase =
  process.env.CLOUDFLARE_R2_PUBLIC_BASE_URL ||
  process.env.CLOUDFLARE_R2_PUBLIC_URL ||
  '';

console.log('Variáveis R2:', {
  CLOUDFLARE_R2_ENDPOINT: Boolean(endpoint),
  CLOUDFLARE_R2_ACCESS_KEY_ID: Boolean(accessKeyId),
  CLOUDFLARE_R2_SECRET_ACCESS_KEY: Boolean(secretAccessKey),
  bucket: bucket || '(vazio)',
  publicBase: publicBase || '(vazio)',
});

if (!endpoint || !accessKeyId || !secretAccessKey) {
  console.error('\n❌ Faltam credenciais R2 no .env.local');
  process.exit(1);
}

if (!bucket) {
  console.error('\n❌ Defina CLOUDFLARE_R2_BUCKET (slug técnico, sem espaços).');
  process.exit(1);
}

if (/\s/.test(bucket)) {
  console.error(
    `\n❌ Bucket "${bucket}" contém espaços. No painel R2 use o slug (ex.: finmemory-storage), não o nome de exibição.`
  );
  process.exit(1);
}

const client = new S3Client({
  region: 'auto',
  endpoint,
  credentials: { accessKeyId, secretAccessKey },
});

try {
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
    console.log(`\n✅ Bucket "${bucket}" existe e é acessível.`);
  } catch (e) {
    console.warn(`\n⚠️  HeadBucket: ${e?.message || e}. Tentando upload mesmo assim…`);
  }

  const testKey = `_healthcheck/${Date.now()}.txt`;
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: testKey,
      Body: Buffer.from('ok'),
      ContentType: 'text/plain',
    })
  );
  console.log(`✅ Upload de teste OK (${testKey})`);
  if (publicBase) {
    console.log(`   URL pública: ${publicBase.replace(/\/+$/, '')}/${testKey}`);
  }
  console.log('\n🎉 R2 pronto para /api/ocr/process-receipt');
} catch (e) {
  console.error('\n❌ Erro R2:', e?.name || e?.Code || 'Error', e?.message || String(e));
  process.exit(1);
}
