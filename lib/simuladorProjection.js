/**
 * Projeção dia a dia para o Simulador (liquidez prevista).
 * Valores em reais; confiabilidade 0–1 pesa entradas incertas.
 */

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

/**
 * @param {object} input
 * @param {number} [input.year]
 * @param {number} [input.month] 1-12
 * @param {number} [input.startingBalance]
 * @param {number} [input.dailyBurn] gasto médio/dia (alimentação, transporte)
 * @param {number|null} [input.salaryDay]
 * @param {number} [input.salaryAmount]
 * @param {Array<{day:number,amount:number,reliability:number}>} [input.supportInflows]
 * @param {Array<{day:number,amount:number,reliability:number}>} [input.extraInflows]
 * @param {Array<{day:number,amount:number,label?:string}>} [input.scheduledOutflows]
 * @param {boolean} [input.stressMode] remove entradas com reliability < 0.85
 */
export function projectSimuladorMonth(input) {
  const year = input.year ?? new Date().getFullYear();
  const month = input.month ?? new Date().getMonth() + 1;
  const daysInMonth = new Date(year, month, 0).getDate();

  const dailyBurn = Math.max(0, Number(input.dailyBurn) || 0);
  const salaryDay = input.salaryDay == null ? null : clamp(Number(input.salaryDay), 1, daysInMonth);
  const salaryAmount = Math.max(0, Number(input.salaryAmount) || 0);

  const supportInflows = Array.isArray(input.supportInflows) ? input.supportInflows : [];
  const extraInflows = Array.isArray(input.extraInflows) ? input.extraInflows : [];
  const scheduledOutflows = Array.isArray(input.scheduledOutflows) ? input.scheduledOutflows : [];

  const stressMode = Boolean(input.stressMode);
  const variableIncomeShockPct = clamp(Number(input.variableIncomeShockPct) || 0, 0, 100);
  const variableIncomeMultiplier = 1 - variableIncomeShockPct / 100;

  function inflowFor(entry) {
    const day = clamp(Number(entry.day) || 1, 1, daysInMonth);
    const amount = Math.max(0, Number(entry.amount) || 0);
    const rel = clamp(Number(entry.reliability) ?? 1, 0, 1);
    if (stressMode && rel < 0.85) return { day, amount: 0 };
    return { day, amount: round2(amount * rel * variableIncomeMultiplier) };
  }

  const points = [];
  let balance = round2(Number(input.startingBalance) || 0);

  let minBalance = balance;
  let minDay = 1;
  let firstNegativeDay = null;
  const eventsByDay = {};

  function addEvent(day, ev) {
    if (!eventsByDay[day]) eventsByDay[day] = [];
    eventsByDay[day].push(ev);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    balance = round2(balance - dailyBurn);
    addEvent(d, { type: 'burn', label: 'Gasto médio diário', value: -dailyBurn });

    for (const out of scheduledOutflows) {
      const od = clamp(Number(out.day) || 1, 1, daysInMonth);
      if (od === d) {
        const amt = Math.max(0, Number(out.amount) || 0);
        balance = round2(balance - amt);
        addEvent(d, { type: 'out', label: out.label || 'Conta agendada', value: -amt });
      }
    }

    if (salaryDay != null && salaryDay === d && salaryAmount > 0) {
      balance = round2(balance + salaryAmount);
      addEvent(d, { type: 'in', label: 'Salário / receita principal', value: salaryAmount });
    }

    for (const raw of supportInflows) {
      const { day, amount } = inflowFor(raw);
      if (day === d && amount > 0) {
        balance = round2(balance + amount);
        addEvent(d, {
          type: 'in',
          label: `Rede de apoio${raw.name ? `: ${raw.name}` : ''}`,
          value: amount,
        });
      }
    }

    for (const raw of extraInflows) {
      const { day, amount } = inflowFor(raw);
      if (day === d && amount > 0) {
        balance = round2(balance + amount);
        addEvent(d, { type: 'in', label: raw.label || 'Entrada extra', value: amount });
      }
    }

    if (balance < minBalance) {
      minBalance = balance;
      minDay = d;
    }
    if (firstNegativeDay == null && balance < 0) {
      firstNegativeDay = d;
    }

    points.push({
      day: d,
      balance,
      events: eventsByDay[d] ? [...eventsByDay[d]] : [],
    });
  }

  const dangerThreshold = 0;
  const gaps = [];
  let gapStart = null;
  for (let i = 0; i < points.length; i++) {
    const low = points[i].balance < dangerThreshold + 50;
    if (low && gapStart == null) gapStart = points[i].day;
    if (!low && gapStart != null) {
      gaps.push({ from: gapStart, to: points[i - 1].day });
      gapStart = null;
    }
  }
  if (gapStart != null) gaps.push({ from: gapStart, to: points[points.length - 1].day });

  return {
    year,
    month,
    daysInMonth,
    points,
    minBalance: round2(minBalance),
    minDay,
    finalBalance: round2(points[points.length - 1]?.balance ?? 0),
    gaps,
    firstNegativeDay,
  };
}

export function reliabilityLabel(pct) {
  if (pct >= 90) return 'Certo';
  if (pct >= 60) return 'Provável';
  return 'Incerto';
}

/**
 * Parte da "conta pesada" no dia do pagamento à vista e parte no vencimento do cartão (simulação).
 * @param {{ heavyBillAmount: number; heavyBillDay: number; creditDueDay: number; deferralPct: number; daysInMonth: number }} p
 */
export function buildHeavyBillScheduledOutflows(p) {
  const daysInMonth = clamp(Number(p.daysInMonth) || 31, 1, 31);
  const heavy = Math.max(0, Number(p.heavyBillAmount) || 0);
  if (heavy < 0.005) return [];

  const hDay = clamp(Number(p.heavyBillDay) || 1, 1, daysInMonth);
  const due = clamp(Number(p.creditDueDay) || hDay, 1, daysInMonth);
  const deferral = clamp((Number(p.deferralPct) || 0) / 100, 0, 1);

  if (deferral < 0.001 || due === hDay) {
    return [{ day: hDay, amount: round2(heavy), label: 'Conta pesada (ex.: aluguel)' }];
  }

  const nowPart = heavy * (1 - deferral);
  const laterPart = heavy * deferral;
  const out = [];
  if (nowPart >= 0.01) {
    out.push({
      day: hDay,
      amount: round2(nowPart),
      label: 'Conta pesada (à vista / débito)',
    });
  }
  if (laterPart >= 0.01) {
    out.push({
      day: due,
      amount: round2(laterPart),
      label: 'Conta pesada (fatura — vencimento)',
    });
  }
  return out.length ? out : [{ day: hDay, amount: round2(heavy), label: 'Conta pesada' }];
}
