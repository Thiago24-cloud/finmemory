/**
 * Critérios configuráveis de validação do trial (30 dias).
 * Override via env (JSON) FINMEMORY_TRIAL_VALIDATION_CRITERIA.
 */

export const DEFAULT_TRIAL_VALIDATION_CRITERIA = {
  min_customers: 30,
  min_direct_orders: 10,
  min_recurring_customers: 3,
  require_willing_to_pay: true,
  /** Comissão marketplace estimada evitada (ex.: 0.20 = 20%). */
  marketplace_fee_rate: 0.2,
  /** Margem bruta estimada default se não houver custo (null = não inventar). */
  default_margin_rate: null,
};

/**
 * @returns {typeof DEFAULT_TRIAL_VALIDATION_CRITERIA}
 */
export function getTrialValidationCriteria() {
  const base = { ...DEFAULT_TRIAL_VALIDATION_CRITERIA };
  const raw = process.env.FINMEMORY_TRIAL_VALIDATION_CRITERIA;
  if (!raw) return base;
  try {
    const parsed = JSON.parse(raw);
    return { ...base, ...parsed };
  } catch {
    return base;
  }
}

/**
 * Avalia critérios → veredicto + recomendação.
 * @param {object} metrics
 * @param {typeof DEFAULT_TRIAL_VALIDATION_CRITERIA} criteria
 * @param {{ willingToPay: boolean|null }} feedback
 */
export function evaluateTrialValidation(metrics, criteria, feedback = {}) {
  const checks = [
    {
      key: 'customers',
      label: `Pelo menos ${criteria.min_customers} clientes cadastrados`,
      ok: Number(metrics.customers_registered || 0) >= criteria.min_customers,
      value: metrics.customers_registered || 0,
      target: criteria.min_customers,
    },
    {
      key: 'orders',
      label: `Pelo menos ${criteria.min_direct_orders} pedidos diretos`,
      ok: Number(metrics.orders_started || 0) >= criteria.min_direct_orders,
      value: metrics.orders_started || 0,
      target: criteria.min_direct_orders,
    },
    {
      key: 'recurring',
      label: `Pelo menos ${criteria.min_recurring_customers} clientes recorrentes`,
      ok: Number(metrics.recurring_customers || 0) >= criteria.min_recurring_customers,
      value: metrics.recurring_customers || 0,
      target: criteria.min_recurring_customers,
    },
    {
      key: 'willing_to_pay',
      label: 'Lojista disposto a pagar após o trial',
      ok: criteria.require_willing_to_pay
        ? feedback.willingToPay === true
        : true,
      value: feedback.willingToPay,
      target: true,
      skipped: !criteria.require_willing_to_pay,
    },
  ];

  const active = checks.filter((c) => !c.skipped);
  const passed = active.filter((c) => c.ok).length;
  const total = active.length;
  const ratio = total ? passed / total : 0;

  let verdict = 'nao_validou';
  let verdict_label = 'Não validou ainda';
  if (ratio >= 1) {
    verdict = 'funcionou_bem';
    verdict_label = 'Funcionou bem';
  } else if (ratio >= 0.5) {
    verdict = 'precisa_melhorar';
    verdict_label = 'Precisa melhorar';
  }

  let recommendation = 'estender_teste';
  let recommendation_label = 'Estender teste';
  if (verdict === 'funcionou_bem') {
    recommendation = 'converter_pago';
    recommendation_label = 'Converter para plano pago';
  } else if (verdict === 'precisa_melhorar') {
    if (Number(metrics.qr_scans || 0) < 10 && Number(metrics.page_views || 0) < 20) {
      recommendation = 'mudar_oferta';
      recommendation_label = 'Mudar oferta / reforçar QR no balcão';
    } else {
      recommendation = 'estender_teste';
      recommendation_label = 'Estender teste';
    }
  } else if (
    Number(metrics.qr_scans || 0) === 0 &&
    Number(metrics.orders_started || 0) === 0 &&
    Number(metrics.customers_registered || 0) === 0
  ) {
    recommendation = 'pausar';
    recommendation_label = 'Pausar';
  }

  return {
    checks,
    passed,
    total,
    ratio,
    verdict,
    verdict_label,
    recommendation,
    recommendation_label,
  };
}
