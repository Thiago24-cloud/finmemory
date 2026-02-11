import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePartnership } from "@/hooks/usePartnership";
import { ArrowLeft, Copy, Heart, UserPlus, X, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";

const Partnership = () => {
  const navigate = useNavigate();
  const { partnership, partnerProfile, loading, createInvite, acceptInvite, cancelPartnership } = usePartnership();
  const [inviteCode, setInviteCode] = useState("");
  const [creating, setCreating] = useState(false);
  const [accepting, setAccepting] = useState(false);

  const handleCreateInvite = async () => {
    setCreating(true);
    try {
      const p = await createInvite();
      if (p) {
        toast.success("Convite criado! Compartilhe o código com seu parceiro(a)");
      }
    } catch {
      toast.error("Erro ao criar convite");
    }
    setCreating(false);
  };

  const handleAcceptInvite = async () => {
    if (!inviteCode.trim()) return;
    setAccepting(true);
    try {
      await acceptInvite(inviteCode.trim());
      toast.success("Parceria ativada! 🎉");
    } catch (err: any) {
      toast.error(err.message || "Erro ao aceitar convite");
    }
    setAccepting(false);
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("Código copiado!");
  };

  const handleCancel = async () => {
    await cancelPartnership();
    toast.info("Parceria encerrada");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-md mx-auto px-5 pb-24 pt-5">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate("/dashboard")} className="p-2 rounded-full hover:bg-muted transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-xl font-bold">Parceria</h1>
          <Heart className="h-5 w-5 text-destructive ml-auto" />
        </div>

        {/* Active partnership */}
        {partnership?.status === "active" && partnerProfile && (
          <div className="space-y-4">
            <div className="bg-card rounded-2xl card-shadow p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <Heart className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-lg font-bold text-foreground">Parceria Ativa</h2>
              <p className="text-muted-foreground mt-1">
                Você está conectado(a) com <span className="font-semibold text-foreground">{partnerProfile.name || partnerProfile.email || "Parceiro(a)"}</span>
              </p>
            </div>

            <div className="bg-card rounded-2xl card-shadow p-4 space-y-3">
              <h3 className="font-semibold text-foreground">O que vocês compartilham:</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-accent" /> Histórico de compras</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-accent" /> Lista de compras compartilhada</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-accent" /> Total de gastos do casal</li>
              </ul>
            </div>

            <button
              onClick={handleCancel}
              className="w-full py-3 rounded-xl border border-destructive text-destructive font-semibold hover:bg-destructive/10 transition-colors"
            >
              Encerrar Parceria
            </button>
          </div>
        )}

        {/* Pending invite (I created) */}
        {partnership?.status === "pending" && !partnership.user_id_2 && (
          <div className="space-y-4">
            <div className="bg-card rounded-2xl card-shadow p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <UserPlus className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-lg font-bold text-foreground">Convite Pendente</h2>
              <p className="text-sm text-muted-foreground mt-2">
                Compartilhe este código com seu parceiro(a):
              </p>
              <div className="mt-4 flex items-center justify-center gap-2">
                <span className="text-2xl font-mono font-bold tracking-widest text-primary">
                  {partnership.invite_code}
                </span>
                <button
                  onClick={() => handleCopyCode(partnership.invite_code)}
                  className="p-2 rounded-lg hover:bg-muted transition-colors"
                >
                  <Copy className="h-5 w-5 text-muted-foreground" />
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-3">O parceiro(a) deve inserir este código no app</p>
            </div>

            <button
              onClick={handleCancel}
              className="w-full py-3 rounded-xl border border-border text-muted-foreground font-semibold hover:bg-muted transition-colors"
            >
              Cancelar Convite
            </button>
          </div>
        )}

        {/* No partnership - show options */}
        {!partnership && (
          <div className="space-y-6">
            <div className="bg-card rounded-2xl card-shadow p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <Heart className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-lg font-bold text-foreground">Compras a Dois</h2>
              <p className="text-sm text-muted-foreground mt-2">
                Conecte-se com seu parceiro(a) para compartilhar compras, evitar duplicatas e economizar juntos!
              </p>
            </div>

            {/* Create invite */}
            <div className="bg-card rounded-2xl card-shadow p-5">
              <h3 className="font-semibold text-foreground mb-2">Criar Convite</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Gere um código e envie para seu parceiro(a)
              </p>
              <button
                onClick={handleCreateInvite}
                disabled={creating}
                className="w-full py-3 rounded-xl gradient-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {creating ? <Loader2 className="h-5 w-5 animate-spin" /> : <UserPlus className="h-5 w-5" />}
                Gerar Código de Convite
              </button>
            </div>

            {/* Accept invite */}
            <div className="bg-card rounded-2xl card-shadow p-5">
              <h3 className="font-semibold text-foreground mb-2">Aceitar Convite</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Insira o código que seu parceiro(a) enviou
              </p>
              <div className="flex gap-2">
                <Input
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  placeholder="Código do convite"
                  className="font-mono text-center tracking-widest"
                  maxLength={8}
                />
                <button
                  onClick={handleAcceptInvite}
                  disabled={accepting || !inviteCode.trim()}
                  className="px-4 rounded-xl gradient-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity disabled:opacity-60"
                >
                  {accepting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Partnership;
