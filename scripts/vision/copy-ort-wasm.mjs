#!/usr/bin/env node
/**
 * Copia artefatos WASM do onnxruntime-web para apps/retailer/public/ort/
 * (evita paths quebrados no bundle Next.js).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../..');

const ORT_FILES = [
  'ort-wasm-simd-threaded.wasm',
  'ort-wasm-simd-threaded.mjs',
  'ort-wasm-simd-threaded.jsep.wasm',
  'ort-wasm-simd-threaded.jsep.mjs',
];

function findOrtDist() {
  const candidates = [
    path.join(root, 'apps/retailer/node_modules/onnxruntime-web/dist'),
    path.join(root, 'node_modules/onnxruntime-web/dist'),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, ORT_FILES[0]))) return dir;
  }
  return null;
}

const srcDir = findOrtDist();
const destDir = path.join(root, 'apps/retailer/public/ort');

if (!srcDir) {
  console.error('onnxruntime-web não encontrado. Rode: npm install -w @finmemory/retailer onnxruntime-web');
  process.exit(1);
}

fs.mkdirSync(destDir, { recursive: true });
for (const file of ORT_FILES) {
  const src = path.join(srcDir, file);
  const dest = path.join(destDir, file);
  if (!fs.existsSync(src)) {
    console.warn('ausente:', file);
    continue;
  }
  fs.copyFileSync(src, dest);
  console.log('copiado:', file);
}
console.log('ORT WASM →', destDir);
