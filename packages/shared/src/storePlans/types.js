/**
 * @typedef {'presenca_digital'|'pedidos_diretos'|'estoque_margem'|'gestao_completa'} StorePlanCode
 * @typedef {'trialing'|'active'|'past_due'|'canceled'|'expired'} StoreSubscriptionStatus
 * @typedef {'qr_code'|'public_store_page'|'digital_menu'|'customer_registration'|'direct_orders'|'pickup_orders'|'local_delivery'|'inventory_control'|'receipt_import'|'margin_calculation'|'reports'|'whatsapp_campaigns'|'consumer_app_integration'|'consumer_financial_history'|'price_map'|'manual_support'} StoreFeatureKey
 *
 * @typedef {object} RestaurantPlanInfo
 * @property {string} storeId
 * @property {StorePlanCode|null} planCode
 * @property {string|null} planName
 * @property {StoreSubscriptionStatus|null} status
 * @property {string|null} trialStartedAt
 * @property {string|null} trialEndsAt
 * @property {StoreFeatureKey[]} features
 * @property {boolean} accessActive
 * @property {boolean} gatesEnabled
 * @property {boolean} missingSchema
 */

export {};
