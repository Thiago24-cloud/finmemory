/**
 * Padrão copiável — qualquer listagem (Home, Extrato, Busca, pré-exportação)
 *
 * Imports:
 * - Next.js: `from '@/lib/resolveInstitutionAsset'` e `from '@/components/InstitutionAvatar'`
 * - Vite (Capacitor): caminhos relativos, ex. `from '../lib/resolveInstitutionAsset.js'`
 *
 * ```tsx
 * import {
 *   resolveInstitutionAsset,
 *   resolveAccountAsset,
 * } from '@/lib/resolveInstitutionAsset';
 * import { InstitutionAvatar } from '@/components/InstitutionAvatar';
 *
 * function TransactionRow({ tx }) {
 *   const asset = resolveInstitutionAsset(tx);
 *   return (
 *     <div className="flex items-center gap-3">
 *       <InstitutionAvatar
 *         asset={asset}
 *         size={40}
 *         label={tx.institution_name ?? tx.estabelecimento}
 *       />
 *       <div className="min-w-0 flex-1">
 *         <p className="truncate">{tx.estabelecimento}</p>
 *         <p className="text-muted-foreground tabular-nums">{tx.total}</p>
 *       </div>
 *     </div>
 *   );
 * }
 *
 * function AccountRow({ account }) {
 *   const asset = resolveAccountAsset(account);
 *   return (
 *     <div className="flex items-center gap-3">
 *       <InstitutionAvatar
 *         asset={asset}
 *         size={40}
 *         label={account.connector_name ?? account.name ?? account.display_name}
 *       />
 *       <p>{account.display_name ?? account.name}</p>
 *     </div>
 *   );
 * }
 * ```
 *
 * --- Query Supabase (`transacoes`) — campos usados pelo resolver ---
 *
 * ```js
 * .select(
 *   `
 *     id,
 *     estabelecimento,
 *     data,
 *     hora,
 *     total,
 *     categoria,
 *     forma_pagamento,
 *     source,
 *     institution_name,
 *     institution_logo_url,
 *     institution_connector_id,
 *     credit_institution_name,
 *     credit_institution_logo_url,
 *     custom_icon_url
 *   `
 * )
 * ```
 *
 * Contas vindas de `GET /api/open-finance/summary` já incluem `connector_name`,
 * `connector_image_url`, `connector_id` — `resolveAccountAsset` mapeia isso automaticamente.
 */

export {};
