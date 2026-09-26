/**
 * Teste básico dos critérios de validação.
 * node apps/retailer/lib/merchant/trialValidation/criteria.test.cjs
 */

function evaluate(metrics, criteria, feedback) {
  const checks = [
    {
      key: 'customers',
      ok: metrics.customers_registered >= criteria.min_customers,
    },
    {
      key: 'orders',
      ok: metrics.orders_started >= criteria.min_direct_orders,
    },
    {
      key: 'recurring',
      ok: metrics.recurring_customers >= criteria.min_recurring_customers,
    },
    {
      key: 'willing_to_pay',
      ok: !criteria.require_willing_to_pay || feedback.willingToPay === true,
      skipped: !criteria.require_willing_to_pay,
    },
  ];
  const active = checks.filter((c) => !c.skipped);
  const passed = active.filter((c) => c.ok).length;
  const ratio = passed / active.length;
  let verdict = 'nao_validou';
  if (ratio >= 1) verdict = 'funcionou_bem';
  else if (ratio >= 0.5) verdict = 'precisa_melhorar';
  return { verdict, passed, total: active.length };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'fail');
}

const criteria = {
  min_customers: 30,
  min_direct_orders: 10,
  min_recurring_customers: 3,
  require_willing_to_pay: true,
};

assert(
  evaluate(
    { customers_registered: 32, orders_started: 14, recurring_customers: 4 },
    criteria,
    { willingToPay: true }
  ).verdict === 'funcionou_bem'
);

assert(
  evaluate(
    { customers_registered: 32, orders_started: 14, recurring_customers: 1 },
    criteria,
    { willingToPay: true }
  ).verdict === 'precisa_melhorar'
);

assert(
  evaluate(
    { customers_registered: 2, orders_started: 1, recurring_customers: 0 },
    criteria,
    { willingToPay: false }
  ).verdict === 'nao_validou'
);

console.log('criteria.test.cjs: ok');
