import { Link, useNavigate } from "react-router-dom";

const Termos = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <header className="gradient-primary px-4 py-5">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <button type="button" onClick={() => navigate(-1)} className="text-primary-foreground text-xl">
            ←
          </button>
          <h1 className="text-lg font-bold text-primary-foreground">Termos de Serviço</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div className="bg-card rounded-2xl card-shadow p-6 md:p-10 space-y-6">
          <div>
            <h1 className="text-2xl font-bold gradient-text inline-block mb-1">Termos de Serviço - FinMemory</h1>
            <p className="text-sm text-muted-foreground">Última atualização: 03/04/2026</p>
          </div>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">1. Aceitação dos Termos</h2>
            <p className="text-muted-foreground leading-relaxed">
              Ao acessar ou utilizar o FinMemory, você concorda com estes Termos de Serviço. Caso não concorde, não
              utilize o serviço.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">2. Descrição do Serviço</h2>
            <p className="text-muted-foreground leading-relaxed">
              O FinMemory oferece uma plataforma para organização do seu histórico financeiro, incluindo sincronização
              e processamento de notas fiscais a partir do Gmail (quando ativado), integração opcional com Open Finance
              (Pluggy) para agregar contas e movimentos, mapa de preços comunitário, lista de compras e funcionalidades
              opcionais baseadas em localização (por exemplo alertas quando se aproxima de uma loja no mapa, conforme as
              permissões e definições que escolher na app).
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">3. Cadastro e Segurança</h2>
            <ul className="list-disc pl-5 text-muted-foreground space-y-1 leading-relaxed">
              <li>Você deve fornecer informações verdadeiras e manter seus dados atualizados.</li>
              <li>O acesso ao serviço é realizado via autenticação segura.</li>
              <li>Você é responsável por manter a confidencialidade das suas credenciais.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">4. Uso Permitido</h2>
            <ul className="list-disc pl-5 text-muted-foreground space-y-1 leading-relaxed">
              <li>Não utilize o FinMemory para atividades ilícitas ou que violem direitos de terceiros.</li>
              <li>O serviço é destinado ao uso pessoal e não comercial.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">5. Mapa de preços e conteúdo de terceiros</h2>
            <p className="text-muted-foreground leading-relaxed">
              Informações de preços no mapa podem ser enviadas por utilizadores ou provenientes de fontes automáticas. O
              FinMemory não garante a exatidão, atualidade ou disponibilidade de qualquer oferta; os preços são
              indicativos e devem ser confirmados na loja. Ao publicar um preço, declara que tem informação razoável
              para o fazer e não utiliza o serviço para conteúdo fraudulento ou enganoso.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">6. Privacidade</h2>
            <p className="text-muted-foreground leading-relaxed">
              O tratamento dos dados segue a{" "}
              <Link to="/privacidade" className="text-primary hover:underline">
                Política de Privacidade
              </Link>{" "}
              do FinMemory, incluindo localização, notificações opcionais e Open Finance quando utilizar essas
              funcionalidades.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">7. Limitação de Responsabilidade</h2>
            <p className="text-muted-foreground leading-relaxed">
              O FinMemory não se responsabiliza por danos decorrentes do uso ou da impossibilidade de uso do serviço,
              incluindo falhas técnicas ou indisponibilidade.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">8. Modificações nos Termos</h2>
            <p className="text-muted-foreground leading-relaxed">
              Estes termos podem ser alterados a qualquer momento. O uso contínuo do serviço após alterações implica
              aceitação das novas condições.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">9. Contato</h2>
            <p className="text-muted-foreground leading-relaxed">
              Para dúvidas ou solicitações, entre em contato pelo e-mail:{" "}
              <a href="mailto:suporte@finmemory.com" className="text-primary hover:underline">
                suporte@finmemory.com
              </a>
            </p>
          </section>
        </div>
      </main>
    </div>
  );
};

export default Termos;
