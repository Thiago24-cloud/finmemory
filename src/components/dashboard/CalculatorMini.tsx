import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Op = "+" | "-" | "*" | "/" | null;

function parseNumber(value: string) {
  const raw = (value || "").toString().trim();
  if (!raw) return null;

  // Regras:
  // - Se tem "," assumimos BR: 1.234,56 => 1234.56
  // - Se NAO tem "," assumimos ponto como decimal (como nosso display): 1.5 => 1.5
  const cleaned = raw.includes(",")
    ? raw.replace(/\./g, "").replace(",", ".")
    : raw.replace(/,/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function formatNumberBR(n: number) {
  if (!Number.isFinite(n)) return "0";
  // Mantem 2 casas quando precisa; caso seja inteiro, nao força trailing zeros
  const isInt = Math.abs(n - Math.round(n)) < 1e-9;
  return isInt ? String(Math.round(n)) : n.toFixed(2).replace(/\.00$/, "");
}

export function CalculatorMini({
  baseValue,
  onBaseValueChange,
}: {
  baseValue: number;
  onBaseValueChange: (value: number) => void;
}) {
  const [baseStr, setBaseStr] = useState<string>(formatNumberBR(baseValue));

  const [display, setDisplay] = useState<string>(formatNumberBR(baseValue));
  const [first, setFirst] = useState<number | null>(null);
  const [op, setOp] = useState<Op>(null);
  const [awaitingSecond, setAwaitingSecond] = useState(false);

  useEffect(() => {
    setBaseStr(formatNumberBR(baseValue));
    // Nao sobrescreve o display enquanto o usuario esta calculando; mas se ele nao iniciou nada, sincroniza.
    if (first === null && op === null && !awaitingSecond) {
      setDisplay(formatNumberBR(baseValue));
    }
  }, [baseValue]); // eslint-disable-line react-hooks/exhaustive-deps

  const currentNumber = useMemo(() => parseNumber(display), [display]);

  const handleDigit = (d: string) => {
    if (awaitingSecond) {
      setDisplay(d === "." ? "0." : d);
      setAwaitingSecond(false);
      return;
    }
    setDisplay((prev) => {
      if (prev === "0" && d !== ".") return d;
      if (prev === "0" && d === ".") return "0.";
      return prev + d;
    });
  };

  const handleDecimal = () => {
    if (awaitingSecond) {
      setDisplay("0.");
      setAwaitingSecond(false);
      return;
    }
    setDisplay((prev) => (prev.includes(".") ? prev : prev + "."));
  };

  const clearAll = () => {
    setDisplay("0");
    setFirst(null);
    setOp(null);
    setAwaitingSecond(false);
  };

  const compute = (a: number, b: number, oper: Exclude<Op, null>) => {
    switch (oper) {
      case "+":
        return a + b;
      case "-":
        return a - b;
      case "*":
        return a * b;
      case "/":
        return b === 0 ? 0 : a / b;
      default:
        return b;
    }
  };

  const handleOperator = (nextOp: Exclude<Op, null>) => {
    const n = currentNumber ?? 0;
    if (first === null) {
      setFirst(n);
      setOp(nextOp);
      setAwaitingSecond(true);
      return;
    }

    if (op && !awaitingSecond) {
      const result = compute(first, n, op);
      setFirst(result);
      setDisplay(formatNumberBR(result));
    }

    setOp(nextOp);
    setAwaitingSecond(true);
  };

  const handleEquals = () => {
    if (op === null || first === null) return;
    const n = currentNumber ?? 0;
    const result = compute(first, n, op);
    setDisplay(formatNumberBR(result));
    setFirst(null);
    setOp(null);
    setAwaitingSecond(true);
  };

  /** % = porcentagem do valor base (ex.: base 1000, visor 12 → 120), não mais "dividir o visor por 100". */
  const handlePercent = () => {
    const n = currentNumber ?? 0;
    const b = Number.isFinite(baseValue) ? baseValue : 0;
    const result = (b * n) / 100;
    setDisplay(formatNumberBR(result));
    setFirst(null);
    setOp(null);
    setAwaitingSecond(false);
  };

  const handleUseBase = () => {
    const parsed = parseNumber(baseStr);
    const value = parsed ?? baseValue;
    setDisplay(formatNumberBR(value));
    setFirst(null);
    setOp(null);
    setAwaitingSecond(false);
  };

  const handleApplyResultToBase = () => {
    const n = parseNumber(display);
    if (n === null) return;
    onBaseValueChange(n);
    setFirst(null);
    setOp(null);
    setAwaitingSecond(false);
  };

  return (
    <div className="bg-card rounded-2xl card-shadow p-4 mb-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <p className="text-sm font-semibold text-foreground">Calculadora</p>
          <p className="text-xs text-muted-foreground">
            % aplica sobre o valor base (ex.: 10% do base)
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3 items-end">
        <div className="col-span-2">
          <p className="text-xs text-muted-foreground mb-1">Valor base</p>
          <Input
            inputMode="decimal"
            value={baseStr}
            onChange={(e) => {
              setBaseStr(e.target.value);
              const n = parseNumber(e.target.value);
              if (n !== null) onBaseValueChange(n);
            }}
            onBlur={() => {
              const n = parseNumber(baseStr);
              if (n === null) {
                setBaseStr(formatNumberBR(baseValue));
              } else {
                setBaseStr(formatNumberBR(n));
              }
            }}
            className="bg-background"
          />
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={handleUseBase}
          className="h-10"
        >
          Usar
        </Button>
      </div>

      <div className="mb-3 bg-background border border-border rounded-xl p-3">
        <div className="text-xs text-muted-foreground mb-1">Display</div>
        <div className="text-right font-bold text-2xl text-foreground break-all">{display}</div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        <Button type="button" variant="secondary" onClick={clearAll} className="h-10">
          AC
        </Button>
        <Button type="button" variant="secondary" onClick={handlePercent} className="h-10">
          %
        </Button>
        <Button type="button" variant="secondary" onClick={() => handleOperator("/")} className="h-10">
          ÷
        </Button>
        <Button type="button" variant="secondary" onClick={() => handleOperator("*")} className="h-10">
          ×
        </Button>

        {["7", "8", "9"].map((d) => (
          <Button key={d} type="button" variant="outline" onClick={() => handleDigit(d)} className="h-10">
            {d}
          </Button>
        ))}
        <Button type="button" variant="secondary" onClick={() => handleOperator("-")} className="h-10">
          −
        </Button>

        {["4", "5", "6"].map((d) => (
          <Button key={d} type="button" variant="outline" onClick={() => handleDigit(d)} className="h-10">
            {d}
          </Button>
        ))}
        <Button type="button" variant="secondary" onClick={() => handleOperator("+")} className="h-10">
          +
        </Button>

        {["1", "2", "3"].map((d) => (
          <Button key={d} type="button" variant="outline" onClick={() => handleDigit(d)} className="h-10">
            {d}
          </Button>
        ))}

        <Button type="button" variant="outline" onClick={() => handleDigit("0")} className="h-10">
          0
        </Button>
        <Button type="button" variant="outline" onClick={handleDecimal} className="h-10">
          .
        </Button>
        <Button type="button" variant="secondary" onClick={handleEquals} className="h-10 col-span-2">
          =
        </Button>
      </div>

      <div className="mt-3 flex gap-2">
        <Button type="button" className="flex-1" onClick={handleApplyResultToBase}>
          Aplicar resultado
        </Button>
      </div>
    </div>
  );
}

