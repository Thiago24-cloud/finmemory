import { useNavigate } from "react-router-dom";

const Privacidade = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <header className="gradient-primary px-4 py-5">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-primary-foreground text-xl">←</button>
          <h1 className="text-lg font-bold text-primary-foreground">Política de Privacidade</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div className="bg-card rounded-2xl card-shadow p-6 md:p-10 space-y-6">
          <div>
            <h1 className="text-2xl font-bold gradient-text inline-block mb-1">Política de Privacidade - FinMemory</h1>
            <p className="text-sm text-muted-foreground">Última atualização: 21/01/2026</p>
          </div>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">1. Introdução</h2>
            <p className="text-muted-foreground leading-relaxed">O FinMemory valoriza a privacidade dos seus usuários e está comprometido em proteger seus dados pessoais. Esta Política de Privacidade explica como coletamos, usamos, armazenamos e protegemos suas informações.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">2. Informações Coletadas</h2>
            <ul className="list-disc pl-5 text-muted-foreground space-y-1 leading-relaxed">
              <li><strong className="text-foreground">Dados de cadastro:</strong> Nome, e-mail, identificador do Google.</li>
              <li><strong className="text-foreground">Dados de acesso:</strong> Tokens de autenticação para integração com o Gmail.</li>
              <li><strong className="text-foreground">Dados financeiros:</strong> Informações de notas fiscais extraídas do Gmail.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">3. Uso das Informações</h2>
            <ul className="list-disc pl-5 text-muted-foreground space-y-1 leading-relaxed">
              <li>Gerenciar sua conta e histórico financeiro.</li>
              <li>Sincronizar e processar notas fiscais do Gmail.</li>
              <li>Melhorar a experiência do usuário e oferecer suporte.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">4. Compartilhamento de Dados</h2>
            <p className="text-muted-foreground leading-relaxed">O FinMemory não compartilha seus dados pessoais com terceiros, exceto quando exigido por lei ou para garantir o funcionamento do serviço.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">5. Segurança</h2>
            <p className="text-muted-foreground leading-relaxed">Adotamos medidas técnicas e organizacionais para proteger seus dados contra acesso não autorizado, alteração ou destruição.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">6. Direitos do Usuário</h2>
            <ul className="list-disc pl-5 text-muted-foreground space-y-1 leading-relaxed">
              <li>Acessar, corrigir ou excluir seus dados pessoais.</li>
              <li>Solicitar informações sobre o tratamento dos seus dados.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">7. Alterações nesta Política</h2>
            <p className="text-muted-foreground leading-relaxed">Esta política pode ser atualizada periodicamente. Recomendamos que você revise regularmente.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">8. Contato</h2>
            <p className="text-muted-foreground leading-relaxed">Em caso de dúvidas, entre em contato pelo e-mail: <a href="mailto:suporte@finmemory.com" className="text-primary hover:underline">suporte@finmemory.com</a></p>
          </section>
        </div>
      </main>
    </div>
  );
};

export default Privacidade;
