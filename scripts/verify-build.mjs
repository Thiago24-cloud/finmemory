#!/usr/bin/env node

/**
 * Verificação do build standalone do Next.js (@finmemory/consumer).
 * Detecta apps/consumer quando executado da raiz do monorepo.
 */

import { existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

console.log('🔍 FinMemory - Verificação do Build Standalone\n');

function resolveConsumerRoot() {
  const cwd = process.cwd();
  const nested = join(cwd, 'apps', 'consumer');
  if (existsSync(join(nested, '.next'))) return nested;
  if (existsSync(join(cwd, '.next'))) return cwd;
  return nested;
}

function resolveStandaloneDir(consumerRoot) {
  const direct = join(consumerRoot, '.next', 'standalone');
  const nested = join(direct, 'apps', 'consumer');
  if (existsSync(join(nested, 'server.js'))) return nested;
  if (existsSync(join(direct, 'server.js'))) return direct;
  return direct;
}

const errors = [];
const warnings = [];

const consumerRoot = resolveConsumerRoot();
const nextDir = join(consumerRoot, '.next');

console.log(`📁 App: ${consumerRoot}\n`);

if (!existsSync(nextDir)) {
  errors.push('❌ Diretório .next não encontrado. Execute "npm run build" primeiro.');
} else {
  console.log('✅ Diretório .next encontrado');
}

const standaloneDir = resolveStandaloneDir(consumerRoot);
if (!existsSync(standaloneDir)) {
  errors.push('❌ .next/standalone não encontrado. Confirme output: "standalone" no next.config.ts');
} else {
  console.log('✅ Diretório .next/standalone encontrado');

  const serverJs = join(standaloneDir, 'server.js');
  if (!existsSync(serverJs)) {
    errors.push('❌ server.js não encontrado em .next/standalone/');
  } else {
    console.log('✅ Arquivo server.js encontrado');
    const stats = statSync(serverJs);
    if (stats.size < 1000) {
      warnings.push(`⚠️  server.js parece muito pequeno (${stats.size} bytes).`);
    }
  }
}

const staticDir = join(nextDir, 'static');
if (!existsSync(staticDir)) {
  warnings.push('⚠️  .next/static não encontrado.');
} else {
  console.log('✅ Diretório .next/static encontrado');
}

const publicDir = join(consumerRoot, 'public');
if (!existsSync(publicDir)) {
  warnings.push('⚠️  Diretório public não encontrado.');
} else {
  console.log('✅ Diretório public encontrado');
}

console.log('\n' + '='.repeat(50) + '\n');

if (errors.length > 0) {
  console.error('❌ ERROS:\n');
  errors.forEach((err) => console.error('  ' + err));
  process.exit(1);
}

if (warnings.length > 0) {
  console.warn('⚠️  AVISOS:\n');
  warnings.forEach((warn) => console.warn('  ' + warn));
}

console.log('🎉 Verificação concluída com sucesso!');
console.log('✅ Build standalone está pronto para deploy.\n');
