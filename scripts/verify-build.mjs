#!/usr/bin/env node

/**
 * Script de verificação do build standalone do Next.js
 * Verifica se todos os arquivos necessários foram gerados corretamente
 * 
 * Uso:
 *   node scripts/verify-build.mjs
 *   npm run verify-build
 */

import { existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

console.log('🔍 FinMemory - Verificação do Build Standalone\n');

const errors = [];
const warnings = [];
const checks = [];

// Verificar se estamos no diretório correto
const projectRoot = process.cwd();
const nextDir = join(projectRoot, '.next');

checks.push('Verificando estrutura do build...');

// 1. Verificar se .next existe
if (!existsSync(nextDir)) {
  errors.push('❌ Diretório .next não encontrado. Execute "npm run build" primeiro.');
} else {
  console.log('✅ Diretório .next encontrado');
}

// 2. Verificar se .next/standalone existe
const standaloneDir = join(nextDir, 'standalone');
if (!existsSync(standaloneDir)) {
  errors.push('❌ Diretório .next/standalone não encontrado. Certifique-se de que output: "standalone" está configurado no next.config.js');
} else {
  console.log('✅ Diretório .next/standalone encontrado');
  
  // 3. Verificar se server.js existe
  const serverJs = join(standaloneDir, 'server.js');
  if (!existsSync(serverJs)) {
    errors.push('❌ Arquivo server.js não encontrado em .next/standalone/');
  } else {
    console.log('✅ Arquivo server.js encontrado');
    
    // Verificar tamanho do arquivo (deve ter conteúdo)
    const stats = statSync(serverJs);
    if (stats.size < 1000) {
      warnings.push('⚠️  server.js parece muito pequeno (' + stats.size + ' bytes). Pode estar incompleto.');
    }
  }
  
  // 4. Verificar estrutura do standalone
  try {
    const standaloneContents = readdirSync(standaloneDir);
    const hasNextDir = standaloneContents.includes('.next');
    const hasNodeModules = standaloneContents.includes('node_modules');
    
    if (!hasNextDir) {
      warnings.push('⚠️  Diretório .next não encontrado dentro de standalone/');
    } else {
      console.log('✅ Diretório .next encontrado dentro de standalone/');
    }
    
    if (!hasNodeModules) {
      warnings.push('⚠️  Diretório node_modules não encontrado dentro de standalone/');
    } else {
      console.log('✅ Diretório node_modules encontrado dentro de standalone/');
    }
  } catch (err) {
    warnings.push('⚠️  Não foi possível ler o conteúdo de standalone/: ' + err.message);
  }
}

// 5. Verificar se .next/static existe
const staticDir = join(nextDir, 'static');
if (!existsSync(staticDir)) {
  warnings.push('⚠️  Diretório .next/static não encontrado. Arquivos estáticos podem não funcionar.');
} else {
  console.log('✅ Diretório .next/static encontrado');
}

// 6. Verificar se páginas foram buildadas
const standaloneNextDir = join(standaloneDir, '.next');
if (existsSync(standaloneNextDir)) {
  const serverDir = join(standaloneNextDir, 'server');
  if (existsSync(serverDir)) {
    const pagesDir = join(serverDir, 'pages');
    if (existsSync(pagesDir)) {
      try {
        const pages = readdirSync(pagesDir);
        const hasIndex = pages.some(p => p.includes('index') || p.includes('_app'));
        if (!hasIndex) {
          warnings.push('⚠️  Páginas principais (index, _app) não encontradas no build');
        } else {
          console.log('✅ Páginas encontradas no build');
        }
      } catch (err) {
        warnings.push('⚠️  Não foi possível verificar páginas: ' + err.message);
      }
    } else {
      warnings.push('⚠️  Diretório pages não encontrado em standalone/.next/server/');
    }
  }
}

// 7. Verificar se public existe (opcional mas recomendado)
const publicDir = join(projectRoot, 'public');
if (!existsSync(publicDir)) {
  warnings.push('⚠️  Diretório public não encontrado (opcional, mas recomendado)');
} else {
  console.log('✅ Diretório public encontrado');
}

console.log('\n' + '='.repeat(50) + '\n');

// Exibir resultados
if (errors.length > 0) {
  console.error('❌ ERROS ENCONTRADOS:\n');
  errors.forEach(err => console.error('  ' + err));
  console.error('\n');
  process.exit(1);
}

if (warnings.length > 0) {
  console.warn('⚠️  AVISOS:\n');
  warnings.forEach(warn => console.warn('  ' + warn));
  console.warn('\n');
}

if (errors.length === 0 && warnings.length === 0) {
  console.log('🎉 Verificação concluída com sucesso!');
  console.log('✅ Build standalone está pronto para deploy.\n');
  process.exit(0);
} else if (errors.length === 0) {
  console.log('✅ Build standalone está funcional, mas há alguns avisos.\n');
  process.exit(0);
} else {
  process.exit(1);
}
