/**
 * @typedef {'pickup'|'delivery'} DirectOrderType
 * @typedef {'qr_code'|'public_page'|'manual'} DirectOrderSource
 * @typedef {'pending'|'accepted'|'preparing'|'ready_for_pickup'|'out_for_delivery'|'delivered'|'canceled'} DirectOrderStatus
 *
 * @typedef {object} DirectOrderItem
 * @property {string|null} product_id
 * @property {string} product_name_snapshot
 * @property {number} unit_price_snapshot
 * @property {number} quantity
 * @property {number} total_price
 *
 * @typedef {object} DirectOrder
 * @property {string} id
 * @property {string} restaurant_id
 * @property {string|null} consumer_id
 * @property {string|null} customer_name
 * @property {string|null} customer_phone
 * @property {DirectOrderType} order_type
 * @property {DirectOrderSource|null} order_source
 * @property {DirectOrderStatus} status
 * @property {number} total_amount
 * @property {string|null} notes
 * @property {string|null} pickup_code
 * @property {DirectOrderItem[]} items
 */

export {};
