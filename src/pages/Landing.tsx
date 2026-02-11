import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const features = [
  { icon: "📧", title: "Conecte seu Gmail", desc: "Vincule sua conta do Google e deixe a IA encontrar suas notas fiscais automaticamente." },
  { icon: "🤖", title: "IA processa tudo", desc: "Nossa inteligência artificial lê e organiza cada nota fiscal para você." },
  { icon: "📊", title: "Visualize seus gastos", desc: "Veja relatórios claros e entenda para onde vai seu dinheiro." },
  { icon: "💰", title: "Controle suas finanças", desc: "Tome decisões melhores com dados organizados e acessíveis." },
];

const Landing = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen gradient-primary flex items-center justify-center p-4">
      <div className="w-full max-w-xl animate-fade-in">
        <div className="bg-card rounded-2xl card-shadow-lg p-10 md:p-14 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-3">
            🚀 <span className="gradient-text">FinMemory</span>
          </h1>
          <p className="text-muted-foreground text-lg mb-8 leading-relaxed">
            Seu assistente financeiro inteligente que organiza suas notas fiscais automaticamente do Gmail
          </p>

          <div className="flex flex-col gap-3 mb-10">
            <Button
              size="lg"
              className="w-full bg-accent text-accent-foreground hover:bg-accent/90 text-base font-semibold py-6 rounded-lg gap-2"
              onClick={() => navigate("/dashboard")}
            >
              <GoogleIcon />
              Entrar com Google
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="w-full border-primary text-primary hover:bg-primary/5 text-base font-semibold py-6 rounded-lg"
              onClick={() => navigate("/dashboard")}
            >
              Ver Dashboard
            </Button>
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

        <p className="text-center text-primary-foreground/60 text-xs mt-6">
          © 2025 FinMemory — Seus dados estão seguros
        </p>
      </div>
    </div>
  );
};

const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 48 48">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
  </svg>
);

export default Landing;
