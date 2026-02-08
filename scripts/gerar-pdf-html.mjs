#!/usr/bin/env node
/**
 * Gera HTML para impressão em PDF com todos os arquivos do projeto Lovable
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const files = [
  { path: 'LOVABLE-LAYOUT-RESUMO.md', title: 'Resumo para Lovable' },
  { path: 'pages/_app.js', title: 'pages/_app.js' },
  { path: 'pages/index.js', title: 'pages/index.js' },
  { path: 'pages/dashboard.js', title: 'pages/dashboard.js' },
  { path: 'pages/add-receipt.js', title: 'pages/add-receipt.js' },
];

let html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>FinMemory - Arquivos para Lovable</title>
  <style>
    body { font-family: -apple-system, sans-serif; line-height: 1.5; color: #333; max-width: 900px; margin: 0 auto; padding: 40px; font-size: 13px; }
    h1 { font-size: 24px; color: #667eea; border-bottom: 2px solid #667eea; padding-bottom: 8px; }
    h2 { font-size: 18px; color: #764ba2; margin-top: 36px; page-break-before: always; }
    h2:first-of-type { page-break-before: avoid; margin-top: 24px; }
    .file-path { background: #e7f3ff; padding: 8px 12px; border-radius: 6px; font-family: monospace; margin: 12px 0; }
    pre { background: #f8f9fa; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; overflow-x: auto; font-size: 11px; line-height: 1.4; white-space: pre-wrap; }
    @media print { h2 { page-break-before: always; } h2:first-of-type { page-break-before: avoid; } }
  </style>
</head>
<body>
  <h1>FinMemory - Arquivos para Lovable (React/Vite)</h1>
  <p><strong>Projeto:</strong> Assistente financeiro - notas fiscais via Gmail + OCR por foto</p>
  <p><strong>Stack:</strong> Next.js 14, React, Supabase, NextAuth, OpenAI GPT-4 Vision</p>
`;

for (const file of files) {
  const fullPath = path.join(rootDir, file.path);
  let content = '';
  try {
    content = fs.readFileSync(fullPath, 'utf-8');
  } catch (e) {
    content = `[Arquivo não encontrado: ${file.path}]`;
  }
  
  if (file.path.endsWith('.md')) {
    content = content
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/&/g, '&amp;');
  } else {
    content = escapeHtml(content);
  }
  
  html += `
  <h2>${file.title}</h2>
  <div class="file-path">${file.path}</div>
  <pre><code>${content}</code></pre>
`;
}

html += `
  <div style="margin-top: 48px; padding: 24px; background: #f8f9fa; border-radius: 12px;">
    <h3>Como gerar o PDF</h3>
    <ol>
      <li>Abra este arquivo HTML no navegador (Chrome, Edge, etc.)</li>
      <li>Ctrl+P (ou Cmd+P no Mac)</li>
      <li>Destino: <strong>Salvar como PDF</strong></li>
      <li>Clique em Salvar</li>
    </ol>
  </div>
</body>
</html>`;

const outPath = path.join(rootDir, 'FinMemory-Lovable-Arquivos-Completo.html');
fs.writeFileSync(outPath, html);
console.log('✅ Arquivo gerado:', outPath);
