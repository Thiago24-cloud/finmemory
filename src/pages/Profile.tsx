import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { User, Lock, Heart, LogOut, ChevronRight } from "lucide-react";

const Profile = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [savingName, setSavingName] = useState(false);

  // Password change
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("name, email")
        .eq("user_id", user!.id)
        .single();
      if (data) {
        setName(data.name || "");
        setEmail(data.email || user?.email || "");
      }
    };
    loadProfile();
  }, [user]);

  const handleSaveName = async () => {
    setSavingName(true);
    const { error } = await supabase
      .from("profiles")
      .update({ name })
      .eq("user_id", user!.id);
    if (error) {
      toast.error("Erro ao atualizar nome");
    } else {
      toast.success("Nome atualizado!");
    }
    setSavingName(false);
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }
    setSavingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Senha atualizada com sucesso!");
      setNewPassword("");
      setConfirmPassword("");
    }
    setSavingPassword(false);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-md mx-auto px-5 pb-28 pt-5">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-full gradient-primary flex items-center justify-center">
            <User className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Perfil</h1>
            <p className="text-sm text-muted-foreground">{email}</p>
          </div>
        </div>

        {/* Edit Name */}
        <section className="bg-card rounded-2xl card-shadow p-5 mb-4">
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />
            Informações pessoais
          </h2>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Nome</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Seu nome"
                className="rounded-lg"
              />
            </div>
            <Button
              onClick={handleSaveName}
              disabled={savingName}
              className="w-full gradient-primary text-primary-foreground rounded-xl"
            >
              {savingName ? "Salvando..." : "Salvar nome"}
            </Button>
          </div>
        </section>

        {/* Change Password */}
        <section className="bg-card rounded-2xl card-shadow p-5 mb-4">
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Lock className="h-4 w-4 text-primary" />
            Alterar senha
          </h2>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Nova senha</label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                minLength={6}
                className="rounded-lg"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Confirmar senha</label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="rounded-lg"
              />
            </div>
            <Button
              onClick={handleChangePassword}
              disabled={savingPassword}
              variant="outline"
              className="w-full rounded-xl"
            >
              {savingPassword ? "Atualizando..." : "Atualizar senha"}
            </Button>
          </div>
        </section>

        {/* Partnership link */}
        <button
          onClick={() => navigate("/partnership")}
          className="w-full bg-card rounded-2xl card-shadow p-5 mb-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Heart className="h-5 w-5 text-accent" />
            <div className="text-left">
              <p className="text-sm font-semibold text-foreground">Parceria</p>
              <p className="text-xs text-muted-foreground">Gerenciar vínculo com parceiro(a)</p>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>

        {/* Sign out */}
        <button
          onClick={handleSignOut}
          className="w-full bg-card rounded-2xl card-shadow p-5 flex items-center gap-3 text-destructive hover:bg-destructive/5 transition-colors"
        >
          <LogOut className="h-5 w-5" />
          <span className="text-sm font-semibold">Sair da conta</span>
        </button>
      </div>

      <BottomNav />
    </div>
  );
};

export default Profile;
