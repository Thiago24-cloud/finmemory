#!/usr/bin/env node

/**
 * Script de validação de variáveis de ambiente
 * Use antes de fazer deploy para garantir que tudo está configurado
 * 
 * Uso:
 *   node scripts/validate-env.mjs
 *   npm run validate-env
 */

import { logValidationReport } from '../lib/env-validator.mjs';
import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';

console.log('🔍 FinMemory - Validação de Ambiente\n');

// Carrega .env locais antes de validar para evitar falso negativo no diagnóstico local.
const cwd = process.cwd();
for (const filename of ['.env', '.env.local', '.env.production']) {
  const filePath = path.join(cwd, filename);
  if (fs.existsSync(filePath)) {
    dotenv.config({ path: filePath, override: false });
  }
}

// Verifica se está em ambiente de build
const isBuild = process.env.npm_lifecycle_event === 'build';

if (isBuild) {
  console.log('⚙️  Executando durante build...\n');
}

// Gera e exibe relatório
const report = logValidationReport();

// Se alguma variável estiver faltando
if (!report.overall.allValid) {
  const missing = report.overall.results
    .filter(r => !r.valid)
    .map(r => r.name);
  
  console.error('\n❌ FALHA NA VALIDAÇÃO!\n');
  console.error('As seguintes variáveis estão faltando:');
  missing.forEach(name => console.error(`  - ${name}`));
  
  console.error('\n📖 Consulte o guia de configuração:');
  console.error('   → CONFIGURAR-VERCEL.md');
  console.error('   → SETUP-ENV.md\n');
  
  // Em build, falha o processo
  if (isBuild) {
    console.error('⚠️  Build cancelado devido a variáveis faltando.\n');
    process.exit(1);
  } else {
    console.warn('⚠️  Aviso: O aplicativo pode não funcionar corretamente.\n');
    process.exit(0);
  }
}

console.log('🎉 Validação concluída com sucesso!\n');
process.exit(0);
