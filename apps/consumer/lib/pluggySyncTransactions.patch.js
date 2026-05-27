/**
 * GUIA DE PATCH — `lib/pluggySyncTransactions.js`
 * (não executes este ficheiro; apenas referência ao que deve existir na versão sincronizada)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 1) Imports no topo do ficheiro:
 *
 *    import { pickConnectorMeta } from './pluggyConnectorMeta';
 *    import {
 *      creditIssuerFromPluggyAccount,
 *      isPluggyCreditCardMovement,
 *    } from './pluggyCreditIssuer';
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 2) `mapPluggyTransactionToRow` — assinatura com conta Pluggy:
 *
 *    export function mapPluggyTransactionToRow(
 *      tx, userId, accountLabel, pluggyAccountId, connectorMeta, pluggyAccount
 *    ) {
 *
 * 3) Dentro do mapper:
 *    - `forma_pagamento` para cartões (despesa): `'Open Finance · cartão de crédito'`
 *    - `institution_*` preenchidos a partir de `pickConnectorMeta` / `connectorMeta`
 *    - Quando `isPluggyCreditCardMovement(pluggyAccount, tx)`:
 *          ...creditIssuerFromPluggyAccount(pluggyAccount, meta)
 *      caso contrário forçar:
 *          credit_institution_name: null, credit_institution_logo_url: null
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 4) `syncTransactionsForItem`:
 *    - Antes do loop das contas: `connectorMeta = pickConnectorMeta(await pluggy.fetchItem(itemId))`
 *    - Ao mapear cada transação passar `acc` (objeto conta) como último argumento:
 *          mapPluggyTransactionToRow(tx, userId, accName, accountId, connectorMeta, acc)
 *
 * Ver implementação atual no repositório: `pluggySyncTransactions.js`
 */

export {};
