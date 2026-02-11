import { Button } from "@/components/ui/button";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

const features = [
  { icon: "📧", title: "Conecte seu Gmail", desc: "Vincule sua conta do Google e deixe a IA encontrar suas notas fiscais automaticamente." },
  { icon: "🤖", title: "IA processa tudo", desc: "Nossa inteligência artificial lê e organiza cada nota fiscal para você." },
  { icon: "📊", title: "Visualize seus gastos", desc: "Veja relatórios claros e entenda para onde vai seu dinheiro." },
  { icon: "💰", title: "Controle suas finanças", desc: "Tome decisões melhores com dados organizados e acessíveis." },
];

const Landing = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div className="min-h-screen gradient-primary flex items-center justify-center p-4">
      <div className="w-full max-w-xl animate-fade-in">
        <div className="bg-card rounded-2xl card-shadow-lg p-10 md:p-14 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-3">
            🚀 <span className="gradient-text">FinMemory</span>
          </h1>
          <p className="text-muted-foreground text-lg mb-8 leading-relaxed">
            Seu assistente financeiro inteligente que organiza suas notas fiscais automaticamente
          </p>

          <div className="flex flex-col gap-3 mb-10">
            {user ? (
              <Button
                size="lg"
                className="w-full gradient-primary text-primary-foreground text-base font-semibold py-6 rounded-lg"
                onClick={() => navigate("/dashboard")}
              >
                Ir para o Dashboard
              </Button>
            ) : (
              <>
                <Button
                  size="lg"
                  className="w-full bg-accent text-accent-foreground hover:bg-accent/90 text-base font-semibold py-6 rounded-lg"
                  onClick={() => navigate("/auth")}
                >
                  Criar Conta Grátis
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full border-primary text-primary hover:bg-primary/5 text-base font-semibold py-6 rounded-lg"
                  onClick={() => navigate("/auth")}
                >
                  Já tenho conta
                </Button>
              </>
            )}
          </div>

          <div className="text-left space-y-5">
            <h2 className="text-lg font-bold text-foreground text-center mb-4">Como funciona</h2>
            {features.map((f) => (
              <div key={f.title} className="flex gap-4 items-start">
                <span className="text-2xl flex-shrink-0 mt-0.5">{f.icon}</span>
                <div>
                  <h3 className="font-semibold text-foreground">{f.title}</h3>
                  <p className="text-sm text-muted-foreground">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="text-center text-primary-foreground/60 text-xs mt-6 space-y-1">
          <div className="flex justify-center gap-4">
            <Link to="/privacidade" className="hover:text-primary-foreground/80 transition-colors">Privacidade</Link>
            <Link to="/termos" className="hover:text-primary-foreground/80 transition-colors">Termos de Uso</Link>
          </div>
          <p>© 2025 FinMemory — Seus dados estão seguros</p>
        </div>
      </div>
    </div>
  );
};

export default Landing;
