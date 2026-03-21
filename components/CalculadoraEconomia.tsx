"use client";

import { useMemo, useState } from "react";
import { Calculator } from "lucide-react";

const PRIMARY = "#22c55e";

function parseMoney(value: string): number | null {
  const raw = (value || "").toString().trim();
  if (!raw) return null;
  const cleaned = raw.includes(",")
    ? raw.replace(/\./g, "").replace(",", ".")
    : raw.replace(/,/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function parseFrequency(value: string): number | null {
  const raw = (value || "").toString().trim();
  if (!raw) return null;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return null;
  return n;
}

function formatBRL(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatPct(n: number) {
  return n.toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

export function CalculadoraEconomia() {
  const [nomeProduto, setNomeProduto] = useState("");
  const [precoAtualStr, setPrecoAtualStr] = useState("");
  const [precoOutroStr, setPrecoOutroStr] = useState("");
  const [freqStr, setFreqStr] = useState("");

  const parsed = useMemo(() => {
    const atual = parseMoney(precoAtualStr);
    const outro = parseMoney(precoOutroStr);
    const freq = parseFrequency(freqStr);
    return { atual, outro, freq };
  }, [precoAtualStr, precoOutroStr, freqStr]);

  const completo =
    parsed.atual != null &&
    parsed.atual > 0 &&
    parsed.outro != null &&
    parsed.outro > 0 &&
    parsed.freq != null;

  const precoValido = completo && parsed.outro! < parsed.atual!;

  const metricas = useMemo(() => {
    if (!completo || !precoValido || parsed.atual == null || parsed.outro == null || parsed.freq == null) {
      return null;
    }
    const porCompra = parsed.atual - parsed.outro;
    const porMes = porCompra * parsed.freq;
    const porAno = porMes * 12;
    const pct = parsed.atual > 0 ? (porCompra / parsed.atual) * 100 : 0;
    return { porCompra, porMes, porAno, pct };
  }, [completo, precoValido, parsed]);

  const labelProduto = nomeProduto.trim() || "este produto";

  const inputClass =
    "w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-gray-900 text-base shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#22c55e]/40 focus:border-[#22c55e]";

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="flex flex-col items-center mb-6">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-md mb-3"
          style={{ backgroundColor: `${PRIMARY}18`, color: PRIMARY }}
        >
          <Calculator className="h-7 w-7" strokeWidth={2} />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 text-center">Calculadora de economia</h2>
        <p className="text-sm text-gray-500 text-center mt-1 px-1">
          Veja quanto você pode economizar trocando de lugar para comprar
        </p>
      </div>

      <div className="space-y-4">
        <div className="rounded-2xl bg-white border border-gray-100 p-4 shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
          <label htmlFor="ce-nome" className="block text-sm font-medium text-gray-700 mb-1.5">
            Nome do produto
          </label>
          <input
            id="ce-nome"
            type="text"
            autoComplete="off"
            placeholder="Ex.: café em grãos 500g"
            value={nomeProduto}
            onChange={(e) => setNomeProduto(e.target.value)}
            className={inputClass}
          />
        </div>

        <div className="rounded-2xl bg-white border border-gray-100 p-4 shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
          <label htmlFor="ce-atual" className="block text-sm font-medium text-gray-700 mb-1.5">
            Preço atual (R$)
          </label>
          <input
            id="ce-atual"
            inputMode="decimal"
            type="text"
            placeholder="0,00"
            value={precoAtualStr}
            onChange={(e) => setPrecoAtualStr(e.target.value)}
            className={inputClass}
          />
        </div>

        <div className="rounded-2xl bg-white border border-gray-100 p-4 shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
          <label htmlFor="ce-outro" className="block text-sm font-medium text-gray-700 mb-1.5">
            Preço no outro lugar (R$)
          </label>
          <input
            id="ce-outro"
            inputMode="decimal"
            type="text"
            placeholder="0,00"
            value={precoOutroStr}
            onChange={(e) => setPrecoOutroStr(e.target.value)}
            className={inputClass}
          />
        </div>

        <div className="rounded-2xl bg-white border border-gray-100 p-4 shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
          <label htmlFor="ce-freq" className="block text-sm font-medium text-gray-700 mb-1.5">
            Compras por mês
          </label>
          <input
            id="ce-freq"
            inputMode="numeric"
            type="text"
            placeholder="1"
            value={freqStr}
            onChange={(e) => setFreqStr(e.target.value.replace(/\D/g, ""))}
            className={inputClass}
          />
        </div>
      </div>

      {completo && !precoValido && (
        <div
          className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-sm"
          role="alert"
        >
          O novo preço precisa ser menor que o atual
        </div>
      )}

      {metricas && (
        <div
          className="mt-6 rounded-2xl border border-gray-100 bg-white p-5 shadow-[0_4px_20px_rgba(34,197,94,0.12)]"
          style={{ borderColor: `${PRIMARY}33` }}
        >
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500 mb-4">Sua economia</p>
          <ul className="space-y-3 text-sm">
            <li className="flex justify-between gap-3">
              <span className="text-gray-600">Por compra</span>
              <span className="font-semibold" style={{ color: PRIMARY }}>
                {formatBRL(metricas.porCompra)}
              </span>
            </li>
            <li className="flex justify-between gap-3">
              <span className="text-gray-600">Por mês</span>
              <span className="font-semibold" style={{ color: PRIMARY }}>
                {formatBRL(metricas.porMes)}
              </span>
            </li>
            <li className="flex justify-between gap-3">
              <span className="text-gray-600">Por ano</span>
              <span className="font-semibold" style={{ color: PRIMARY }}>
                {formatBRL(metricas.porAno)}
              </span>
            </li>
            <li className="flex justify-between gap-3 pt-2 border-t border-gray-100">
              <span className="text-gray-600">Economia em %</span>
              <span className="font-semibold" style={{ color: PRIMARY }}>
                {formatPct(metricas.pct)}%
              </span>
            </li>
          </ul>

          <p
            className="mt-5 text-sm leading-relaxed rounded-xl px-3 py-3 bg-[#f0fdf4] text-gray-800 border border-[#bbf7d0]"
            style={{ color: "#166534" }}
          >
            Comprando <span className="font-semibold">{labelProduto}</span> no lugar mais barato, você economiza{" "}
            <span className="font-bold" style={{ color: PRIMARY }}>
              {formatBRL(metricas.porMes)}
            </span>{" "}
            por mês e{" "}
            <span className="font-bold" style={{ color: PRIMARY }}>
              {formatBRL(metricas.porAno)}
            </span>{" "}
            por ano.
          </p>
        </div>
      )}
    </div>
  );
}

export default CalculadoraEconomia;
