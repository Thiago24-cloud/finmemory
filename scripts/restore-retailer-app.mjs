#!/usr/bin/env node
/**
 * Restaura código lojista do git HEAD em apps/retailer (Fase 4).
 * Uso: node scripts/restore-retailer-app.mjs
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const destRoot = path.join(root, 'apps', 'retailer');

const RETAILER_PATHS = [
  'pages/parceiros.js',
  'pages/parceiros/painel.js',
  'pages/escolher-perfil.js',
  'pages/historico-inventario-varejo.js',
  'pages/api/parceiros/painel/context.js',
  'pages/api/parceiros/painel/pedidos/index.js',
  'pages/api/parceiros/painel/pedidos/[id].js',
  'pages/api/parceiros/painel/products/index.js',
  'pages/api/parceiros/painel/products/[id].js',
  'pages/api/parceiros/painel/products/upload-image.js',
  'pages/api/parceiros/painel/repair-link.js',
  'pages/api/parceiros/painel/stripe/connect.js',
  'pages/api/parceiros/painel/stripe/status.js',
  'pages/api/partners/signup.js',
  'pages/api/partners/complete-store.js',
  'pages/api/merchant/context.js',
  'pages/api/merchant/pedidos/index.js',
  'pages/api/merchant/pedidos/[id].js',
  'pages/api/merchant/products/index.js',
  'pages/api/merchant/products/[id].js',
  'pages/api/merchant/products/upload-image.js',
  'pages/api/merchant/repair-link.js',
  'pages/api/merchant/stripe/connect.js',
  'pages/api/merchant/stripe/status.js',
  'pages/api/varejo/inventario/list.js',
  'pages/api/varejo/inventario/save.js',
  'pages/api/varejo/inventario/[id].js',
  'components/merchant/MerchantPanel.jsx',
  'components/merchant/MerchantOrdersSection.jsx',
  'components/merchant/MerchantProductCard.jsx',
  'components/merchant/MerchantProductForm.jsx',
  'components/merchant/MerchantStripeSection.jsx',
  'components/landing/partners/PartnersBenefitsGrid.jsx',
  'components/landing/partners/PartnersHero.jsx',
  'components/landing/partners/PartnersHowItWorks.jsx',
  'components/landing/partners/PartnersLandingPage.jsx',
  'components/landing/partners/PartnersOnboardingForm.jsx',
  'components/landing/partners/PartnersPickupSection.jsx',
  'components/onboarding/AccountTypeGate.js',
  'components/onboarding/AccountTypeSelectionModal.js',
  'components/onboarding/AccountTypeWelcomeScreen.js',
  'lib/merchant/buildProductImageR2Key.js',
  'lib/merchant/ensureMerchantStoreLink.js',
  'lib/merchant/fetchMerchantStoreRow.js',
  'lib/merchant/mapProdutoRow.js',
  'lib/merchant/merchantApiErrorMessage.js',
  'lib/merchant/painelApiPaths.js',
  'lib/merchant/parseProductImageBase64.js',
  'lib/merchant/publishMerchantProductToMap.js',
  'lib/merchant/requireMerchantApi.js',
  'lib/merchant/resolveMerchantPanelAccess.js',
  'lib/merchant/resolveMerchantStore.js',
  'lib/merchant/syncMerchantStoreBindings.js',
  'lib/merchant/pedidos/computePedidoEta.js',
  'lib/merchant/pedidos/confirmPedidoPayment.js',
  'lib/merchant/pedidos/createPedidoCheckout.js',
  'lib/merchant/pedidos/createPedidoLoja.js',
  'lib/merchant/pedidos/mapPedidoRow.js',
  'lib/merchant/pedidos/pedidoStatus.js',
  'lib/merchant/pedidos/updatePedidoStatus.js',
  'lib/partners/createPartnerStoreForUser.js',
  'lib/partners/documentTaxIdPolicy.js',
  'lib/partners/documentTaxIdReuseResponse.js',
  'lib/partners/landingCopy.js',
  'lib/stripe/connectMerchant.js',
  'lib/push/merchantOrderPush.js',
  'lib/shareRetailInventoryCsv.ts',
];

/** Libs compartilhadas — copiar do consumer se existir, senão HEAD. */
const SHARED_FROM_CONSUMER = [
  'lib/supabase.js',
  'lib/supabaseAdmin.js',
  'lib/userType.js',
  'lib/utils.js',
  'lib/validateTaxId.js',
  'lib/securityPolicy.js',
  'lib/passwordAuth.js',
  'lib/rateLimit.js',
  'lib/privateBetaAllowlist.js',
  'lib/finmemoryLoginErrorCodes.js',
  'lib/access-server.js',
  'lib/restrictedFeatureAccess.js',
  'lib/securityEmail.js',
  'lib/geocode.js',
  'lib/tokens.js',
  'lib/auth/ensureOAuthUser.js',
  'lib/auth/getSocialProviders.js',
  'lib/completeDailyMission.js',
  'lib/marketingRoutes.js',
  'lib/landingConstants.js',
  'lib/brandTokens.js',
  'pages/api/auth/[...nextauth].js',
  'pages/login.js',
  'pages/api/user/account-type.js',
  'styles/globals.css',
  'postcss.config.js',
  'tailwind.config.js',
  'tailwind.config.ts',
  'components.json',
  'public/logo.png',
  'public/favicon.ico',
];

function gitShow(relPath) {
  return execSync(`git show HEAD:${relPath}`, { cwd: root, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
}

function writeFile(relPath, content) {
  const full = path.join(destRoot, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, 'utf8');
  console.log('  +', relPath);
}

function copyBinary(relPath, fromPath) {
  const full = path.join(destRoot, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.copyFileSync(fromPath, full);
  console.log('  +', relPath, '(binary)');
}

console.log('Restaurando apps/retailer...\n');

for (const rel of RETAILER_PATHS) {
  try {
    writeFile(rel, gitShow(rel));
  } catch (e) {
    console.error('  FAIL', rel, e.message);
    process.exitCode = 1;
  }
}

console.log('\nCopiando libs compartilhadas...\n');
for (const rel of SHARED_FROM_CONSUMER) {
  const consumerPath = path.join(root, 'apps', 'consumer', rel);
  const full = path.join(destRoot, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  if (fs.existsSync(consumerPath)) {
    if (rel.endsWith('.png') || rel.endsWith('.ico')) {
      copyBinary(rel, consumerPath);
    } else {
      fs.copyFileSync(consumerPath, full);
      console.log('  ~', rel, '(consumer)');
    }
  } else {
    try {
      writeFile(rel, gitShow(rel));
    } catch {
      console.warn('  skip', rel);
    }
  }
}

console.log('\nDone.');
