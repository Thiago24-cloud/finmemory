import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "sonner";
import { CalendarDays, CheckCircle2, PlusCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type Recorrencia = "mensal" | "unica";

type Cobranca = {
  id: string;
  titulo: string;
  valor: number;
  recorrencia: Recorrencia;
  dia_vencimento: number | null;
  competencia: string | null;
  categoria: string;
  ativa: boolean;
};

type CobrancaPagamento = {
  id: string;
  cobranca_id: string;
  competencia: string;
  data_pagamento: string;
  forma_pagamento: string | null;
  obs: string | null;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toLocalISODate(d: Date) {
  // Evita shift de data por timezone (usamos YYYY-MM-DD local)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function formatDateBR(isoDate: string) {
  try {
    const [y, m, d] = isoDate.split("-").map(Number);
    const dt = new Date(y, (m || 1) - 1, d || 1);
    return dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  } catch {
    return isoDate;
  }
}

function computeDueDateMensal(diaVencimento: number, year: number, monthIndex: number) {
  // monthIndex: 0-11
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  const day = Math.min(Math.max(1, diaVencimento), lastDay);
  return toLocalISODate(new Date(year, monthIndex, day));
}

export function CobrancasMiniCard({
  selectedMonth,
  onAfterPayment,
  onUnpaidTotalChange,
}: {
  selectedMonth: string; // YYYY-MM
  onAfterPayment?: () => Promise<void> | void;
  onUnpaidTotalChange?: (total: number) => void;
}) {
  const { user } = useAuth();

  const [cobrancas, setCobrancas] = useState<Cobranca[]>([]);
  const [pagamentos, setPagamentos] = useState<CobrancaPagamento[]>([]);
  const [loading, setLoading] = useState(true);

  const [addOpen, setAddOpen] = useState(false);
  const [formTitulo, setFormTitulo] = useState("");
  const [formValor, setFormValor] = useState("");
  const [formRecorrencia, setFormRecorrencia] = useState<Recorrencia>("mensal");
  const [formDia, setFormDia] = useState("2");
  const [formCompetencia, setFormCompetencia] = useState(() => toLocalISODate(new Date()));
  const [formCategoria, setFormCategoria] = useState("Servicos");

  const [checkinOpen, setCheckinOpen] = useState(false);
  const [selectedCobranca, setSelectedCobranca] = useState<Cobranca | null>(null);
  const [selectedCompetencia, setSelectedCompetencia] = useState<string>("");
  const [formaPagamento, setFormaPagamento] = useState("Pix");
  const [obs, setObs] = useState("");
  const [saving, setSaving] = useState(false);

  const monthInfo = useMemo(() => {
    const [y, m] = selectedMonth.split("-").map(Number);
    return { year: y, monthIndex: (m || 1) - 1 };
  }, [selectedMonth]);

  const monthStart = useMemo(() => {
    return `${selectedMonth}-01`;
  }, [selectedMonth]);

  const monthEnd = useMemo(() => {
    const { year, monthIndex } = monthInfo;
    const lastDay = new Date(year, monthIndex + 1, 0).getDate();
    return toLocalISODate(new Date(year, monthIndex, lastDay));
  }, [monthInfo, selectedMonth]);

  const paidMap = useMemo(() => {
    const map = new Map<string, CobrancaPagamento>();
    for (const p of pagamentos) {
      map.set(`${p.cobranca_id}_${p.competencia}`, p);
    }
    return map;
  }, [pagamentos]);

  const dueItems = useMemo(() => {
    // Cada cobranca gera apenas 1 item para o mes selecionado (mensal => diaX; unica => se cair no mes)
    const items: Array<{
      cobranca: Cobranca;
      competencia: string;
      pago: boolean;
      pagamento?: CobrancaPagamento;
    }> = [];

    for (const c of cobrancas) {
      if (!c.ativa) continue;

      if (c.recorrencia === "mensal") {
        const dia = c.dia_vencimento ?? 1;
        const competencia = computeDueDateMensal(dia, monthInfo.year, monthInfo.monthIndex);
        const key = `${c.id}_${competencia}`;
        const pagamento = paidMap.get(key);
        items.push({ cobranca: c, competencia, pago: !!pagamento, pagamento });
        continue;
      }

      // unica
      if (!c.competencia) continue;
      if (!c.competencia.startsWith(selectedMonth)) continue;
      const competencia = c.competencia;
      const key = `${c.id}_${competencia}`;
      const pagamento = paidMap.get(key);
      items.push({ cobranca: c, competencia, pago: !!pagamento, pagamento });
    }

    // ordenar por data e titulo
    items.sort((a, b) => (a.competencia < b.competencia ? -1 : a.competencia > b.competencia ? 1 : 0));
    return items;
  }, [cobrancas, monthInfo, paidMap, selectedMonth]);

  const unpaidTotal = useMemo(() => {
    return dueItems.reduce((sum, it) => sum + (it.pago ? 0 : Number(it.cobranca.valor) || 0), 0);
  }, [dueItems]);

  useEffect(() => {
    onUnpaidTotalChange?.(unpaidTotal);
  }, [unpaidTotal, onUnpaidTotalChange]);

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { data: cobrancasData, error: cobrancasErr } = await supabase
        .from("cobrancas")
        .select("id, titulo, valor, recorrencia, dia_vencimento, competencia, categoria, ativa")
        .eq("user_id", user.id)
        .eq("ativa", true)
        .order("created_at", { ascending: false });

      if (cobrancasErr) throw cobrancasErr;
      const list = (cobrancasData || []) as Cobranca[];
      setCobrancas(list);

      const { data: pagamentosData, error: pagamentosErr } = await supabase
        .from("cobrancas_pagamentos")
        .select("id, cobranca_id, competencia, data_pagamento, forma_pagamento, obs")
        .eq("user_id", user.id)
        .gte("competencia", monthStart)
        .lte("competencia", monthEnd);

      if (pagamentosErr) throw pagamentosErr;
      setPagamentos((pagamentosData || []) as CobrancaPagamento[]);
    } catch (e: any) {
      console.error("Erro ao carregar cobrancas:", e);
      toast.error("Erro ao carregar cobranças");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, selectedMonth]);

  const openCheckin = (c: Cobranca, competencia: string) => {
    setSelectedCobranca(c);
    setSelectedCompetencia(competencia);
    setFormaPagamento("Pix");
    setObs("");
    setCheckinOpen(true);
  };

  const todayISO = useMemo(() => toLocalISODate(new Date()), []);

  const handleSaveCheckin = async () => {
    if (!user?.id || !selectedCobranca) return;
    setSaving(true);
    try {
      const cobrancaId = selectedCobranca.id;
      const competencia = selectedCompetencia;
      const valor = Number(selectedCobranca.valor) || 0;

      const payloadPayment = {
        user_id: user.id,
        cobranca_id: cobrancaId,
        competencia,
        data_pagamento: todayISO, // check-in => hoje (foi o que voce pediu)
        forma_pagamento: formaPagamento,
        obs: obs || null,
      };

      const { error: paymentErr } = await supabase
        .from("cobrancas_pagamentos")
        .upsert(payloadPayment, {
          onConflict: "cobranca_id,competencia",
        });

      if (paymentErr) throw paymentErr;

      // Cria um lançamento em "Gastos" / transacoes
      const payloadTx = {
        user_id: user.id,
        estabelecimento: selectedCobranca.titulo,
        data: todayISO,
        total: valor,
        categoria: selectedCobranca.categoria || "Servicos",
        forma_pagamento: formaPagamento || null,
        source: "cobranca",
        items: [],
      };

      const { error: txErr } = await supabase.from("transacoes").insert(payloadTx);
      if (txErr) throw txErr;

      toast.success("Pagamento registrado!");
      setCheckinOpen(false);
      setSelectedCobranca(null);
      await onAfterPayment?.();
      await load();
    } catch (e: any) {
      console.error("Erro no check-in:", e);
      toast.error(e?.message || "Erro ao registrar pagamento");
    } finally {
      setSaving(false);
    }
  };

  const handleAddCobranca = async () => {
    if (!user?.id) return;
    const titulo = formTitulo.trim();
    const valor = Number(formValor.replace(",", ".")) || 0;
    if (!titulo) return toast.error("Informe o titulo");
    if (!valor || valor <= 0) return toast.error("Informe o valor");

    const payload = {
      user_id: user.id,
      titulo,
      valor,
      recorrencia: formRecorrencia,
      dia_vencimento: formRecorrencia === "mensal" ? Number(formDia) : null,
      competencia: formRecorrencia === "unica" ? formCompetencia : null,
      categoria: formCategoria.trim() || "Servicos",
      ativa: true,
    };

    const { error } = await supabase.from("cobrancas").insert(payload);
    if (error) {
      toast.error(error.message || "Erro ao adicionar cobranca");
      return;
    }

    setAddOpen(false);
    setFormTitulo("");
    setFormValor("");
    setFormRecorrencia("mensal");
    setFormDia("2");
    setFormCompetencia(toLocalISODate(new Date()));
    setFormCategoria("Servicos");
    await load();
    toast.success("Cobrança adicionada");
  };

  return (
    <div className="bg-card rounded-2xl card-shadow p-4 mb-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="text-sm font-semibold text-foreground flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            Cobranças
          </p>
          <p className="text-xs text-muted-foreground">Agendadas e check-in quando pagar</p>
        </div>

        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setAddOpen(true)}
          className="shrink-0"
        >
          <PlusCircle className="h-4 w-4" />
          Adicionar
        </Button>
      </div>

      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="text-xs text-muted-foreground">
          Não pagas
        </div>
        <div className="text-sm font-bold text-foreground">
          {unpaidTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
        </div>
      </div>

      {loading ? (
        <div className="text-xs text-muted-foreground">Carregando...</div>
      ) : dueItems.length === 0 ? (
        <div className="text-xs text-muted-foreground">
          Nenhuma cobrança para este mes. Toque em “Adicionar”.
        </div>
      ) : (
        <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
          {dueItems.map((it) => {
            const { cobranca, competencia } = it;
            const pago = it.pago;
            return (
              <div
                key={`${cobranca.id}_${competencia}`}
                className="flex items-start justify-between gap-3 p-3 rounded-xl border border-border bg-background"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-muted-foreground shrink-0">
                      {formatDateBR(competencia)}
                    </span>
                    {pago ? (
                      <span className="text-xs inline-flex items-center gap-1 text-primary">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Pago
                      </span>
                    ) : (
                      <span className="text-xs inline-flex items-center gap-1 text-muted-foreground">Agendado</span>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-foreground truncate">{cobranca.titulo}</p>
                  <p className="text-xs text-muted-foreground">
                    {cobranca.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    {pago && it.pagamento?.forma_pagamento
                      ? ` · ${it.pagamento.forma_pagamento}`
                      : ""}
                  </p>
                  {pago && it.pagamento?.obs ? (
                    <p className="text-xs text-muted-foreground truncate">{it.pagamento.obs}</p>
                  ) : null}
                </div>

                {!pago ? (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => openCheckin(cobranca, competencia)}
                    className={cn("shrink-0 bg-emerald-500 hover:bg-emerald-600 text-white")}
                  >
                    Paguei
                  </Button>
                ) : (
                  <div className="shrink-0 w-20" />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Sheet: adicionar cobranca */}
      <Sheet open={addOpen} onOpenChange={setAddOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl px-5 pb-10 pt-4 max-h-[85vh] overflow-y-auto">
          <SheetHeader className="mb-4">
            <SheetTitle className="text-lg font-bold text-center">Nova cobranca</SheetTitle>
            <p className="text-xs text-muted-foreground text-center">Mensal (dia X) ou unica (data unica)</p>
          </SheetHeader>

          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-foreground mb-1">Titulo</p>
              <Input value={formTitulo} onChange={(e) => setFormTitulo(e.target.value)} placeholder="Ex: Streaming" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-sm font-medium text-foreground mb-1">Valor (R$)</p>
                <Input
                  inputMode="decimal"
                  value={formValor}
                  onChange={(e) => setFormValor(e.target.value)}
                  placeholder="Ex: 39,90"
                />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground mb-1">Categoria</p>
                <Input value={formCategoria} onChange={(e) => setFormCategoria(e.target.value)} placeholder="Servicos" />
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-foreground mb-1">Recorrencia</p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={formRecorrencia === "mensal" ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => setFormRecorrencia("mensal")}
                >
                  Mensal
                </Button>
                <Button
                  type="button"
                  variant={formRecorrencia === "unica" ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => setFormRecorrencia("unica")}
                >
                  Unica
                </Button>
              </div>
            </div>

            {formRecorrencia === "mensal" ? (
              <div>
                <p className="text-sm font-medium text-foreground mb-1">Dia do vencimento (dia X)</p>
                <Input inputMode="numeric" value={formDia} onChange={(e) => setFormDia(e.target.value)} />
              </div>
            ) : (
              <div>
                <p className="text-sm font-medium text-foreground mb-1">Data da cobranca</p>
                <Input type="date" value={formCompetencia} onChange={(e) => setFormCompetencia(e.target.value)} />
              </div>
            )}

            <Button type="button" onClick={handleAddCobranca} className="w-full h-12 text-base font-semibold">
              Salvar cobranca
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Sheet: registrar pagamento */}
      <Sheet open={checkinOpen} onOpenChange={setCheckinOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl px-5 pb-10 pt-4 max-h-[85vh] overflow-y-auto">
          <SheetHeader className="mb-4">
            <SheetTitle className="text-lg font-bold text-center">Registrar pagamento</SheetTitle>
            {selectedCobranca ? (
              <p className="text-xs text-muted-foreground text-center">
                {selectedCobranca.titulo} · competencia {formatDateBR(selectedCompetencia)}
              </p>
            ) : null}
          </SheetHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-sm font-medium text-foreground mb-1">Valor</p>
                <Input value={(selectedCobranca?.valor || 0).toString()} disabled />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground mb-1">Pago em</p>
                <Input value={todayISO} disabled />
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-foreground mb-1">Forma de pagamento</p>
              <div className="flex gap-2">
                {["Pix", "Cartao", "Dinheiro", "Boleto"].map((v) => (
                  <Button
                    key={v}
                    type="button"
                    variant={formaPagamento === v ? "default" : "outline"}
                    className="flex-1"
                    onClick={() => setFormaPagamento(v)}
                  >
                    {v}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-foreground mb-1">Obs (opcional)</p>
              <Input value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex: desconto, parcela, etc." />
            </div>

            <Button
              type="button"
              disabled={saving}
              onClick={handleSaveCheckin}
              className="w-full h-12 text-base font-semibold"
            >
              {saving ? "Salvando..." : "Confirmar pagamento"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

