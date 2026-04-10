import { useNavigate } from "react-router-dom";

const Privacidade = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <header className="gradient-primary px-4 py-5">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <button type="button" onClick={() => navigate(-1)} className="text-primary-foreground text-xl">
            ←
          </button>
          <h1 className="text-lg font-bold text-primary-foreground">Política de Privacidade</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div className="bg-card rounded-2xl card-shadow p-6 md:p-10 space-y-6">
          <div>
            <h1 className="text-2xl font-bold gradient-text inline-block mb-1">Política de Privacidade - FinMemory</h1>
            <p className="text-sm text-muted-foreground">Última atualização: 03/04/2026</p>
          </div>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">1. Introdução</h2>
            <p className="text-muted-foreground leading-relaxed">
              O FinMemory valoriza a privacidade dos utilizadores e descreve aqui como tratamos dados pessoais. Esta
              política aplica-se ao site, à aplicação móvel (quando disponível) e aos serviços associados à sua conta.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">2. Dados que podemos tratar</h2>
            <ul className="list-disc pl-5 text-muted-foreground space-y-2 leading-relaxed">
              <li>
                <strong className="text-foreground">Dados de conta e autenticação:</strong> nome, e-mail,
                identificador de sessão e identificador de utilizador (por exemplo após login com Google).
              </li>
              <li>
                <strong className="text-foreground">Dados de acesso ao Gmail (se ativar):</strong> tokens e metadados
                necessários para integrar e processar e-mails de notas fiscais, conforme as permissões que conceder.
              </li>
              <li>
                <strong className="text-foreground">Dados financeiros derivados:</strong> informações extraídas de
                notas ou importadas para o seu histórico no FinMemory.
              </li>
              <li>
                <strong className="text-foreground">Open Finance (Pluggy), opcional:</strong> se ligar contas
                bancárias, o tratamento inclui dados que o conector e as instituições disponibilizam para agregar
                movimentos e saldos no FinMemory, nos termos da sua autorização e da política do prestador Pluggy.
              </li>
              <li>
                <strong className="text-foreground">Mapa de preços e conteúdo gerado por utilizadores:</strong> nomes
                de produtos, preços, localização aproximada de lojas ou pontos no mapa, e outros campos que enviar ao
                partilhar preços ou usar o mapa.
              </li>
              <li>
                <strong className="text-foreground">Lista de compras:</strong> itens que adicionar à lista (incluindo
                itens associados a ofertas do mapa, quando aplicável).
              </li>
              <li>
                <strong className="text-foreground">Localização do dispositivo (opcional):</strong> quando utiliza
                funcionalidades que o pedem (por exemplo mapa centrado na sua posição ou alertas de proximidade),
                podemos processar localização precisa ou aproximada para essa finalidade.
              </li>
              <li>
                <strong className="text-foreground">Notificações no dispositivo:</strong> se ativar alertas opcionais
                (por exemplo avisos locais quando está perto de um ponto do mapa alinhado à lista de compras), o
                sistema pode mostrar notificações no telemóvel; esses avisos são configurados na app e respeitam as
                permissões que definir no sistema operativo.
              </li>
              <li>
                <strong className="text-foreground">Dados técnicos:</strong> registos de diagnóstico ou de segurança
                quando necessário para operar o serviço (por exemplo erros ou métricas, se estiverem ativos).
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">3. Finalidades</h2>
            <ul className="list-disc pl-5 text-muted-foreground space-y-1 leading-relaxed">
              <li>Prestar e melhorar o serviço (conta, histórico financeiro, mapa de preços, listas de compras).</li>
              <li>
                Mostrar o mapa e pontos de preço perto de si quando utilizar a localização; não vendemos a sua
                localização a terceiros para publicidade.
              </li>
              <li>
                Funcionalidade opcional &quot;alertas perto da loja&quot;: calcular a distância entre a sua posição e
                pontos do mapa que, segundo os dados disponíveis, correspondem a itens pendentes na sua lista, e
                disparar uma notificação local quando estiver dentro do raio que configurar (por exemplo 300 a 500
                metros). Pode desativar esta opção nas definições da lista de compras na app.
              </li>
              <li>Autenticação, segurança, suporte e cumprimento de obrigações legais.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">4. Base legal e conservação</h2>
            <p className="text-muted-foreground leading-relaxed">
              O tratamento funda-se na execução do serviço, no consentimento quando aplicável (por exemplo permissões
              do telemóvel ou ligação Open Finance), e em interesses legítimos compatíveis com a sua privacidade
              (segurança, melhoria do produto). Conservamos os dados pelo tempo necessário a estas finalidades e
              conforme a lei aplicável.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">5. Encriptação e subcontratantes</h2>
            <p className="text-muted-foreground leading-relaxed">
              Utilizamos ligações encriptadas (HTTPS) entre a app e os servidores quando aplicável. Parte dos dados
              pode ser armazenada ou processada em infraestrutura de confiança, incluindo o backend (por exemplo
              Supabase) e, quando usar Open Finance, o ecossistema Pluggy e instituições financeiras. Não vendemos os
              seus dados pessoais a anunciantes.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">6. Partilha de dados</h2>
            <p className="text-muted-foreground leading-relaxed">
              O FinMemory não vende os seus dados de localização nem de conta a terceiros para fins publicitários. Os
              dados podem ser tratados por prestadores que nos ajudam a operar o serviço (alojamento, base de dados,
              autenticação, Open Finance), sempre contratualmente vinculados, ou quando a lei o exigir.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">7. Segurança</h2>
            <p className="text-muted-foreground leading-relaxed">
              Adotamos medidas técnicas e organizacionais adequadas para proteger os dados contra acesso não
              autorizado, alteração ou destruição, dentro do razoável para o tipo de serviço.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">8. Os seus direitos</h2>
            <p className="text-muted-foreground leading-relaxed">
              Conforme a lei aplicável (incluindo a LGPD no Brasil, quando aplicável), pode solicitar:
            </p>
            <ul className="list-disc pl-5 text-muted-foreground space-y-1 leading-relaxed mt-2">
              <li>
                Acesso, correção, anonimização, bloqueio ou eliminação de dados desnecessários ou tratados em
                desconformidade;
              </li>
              <li>Informações sobre o tratamento e sobre as entidades com as quais partilhamos dados;</li>
              <li>Revogação do consentimento, quando o tratamento se basear nele.</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-2">
              Para exercer direitos, utilize o contacto abaixo. Podemos pedir informação razoável para confirmar a sua
              identidade.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">9. Alterações</h2>
            <p className="text-muted-foreground leading-relaxed">
              Esta política pode ser atualizada periodicamente. A data no topo indica a última revisão. Recomendamos que
              a reveja com regularidade. O uso continuado do serviço após alterações pode significar que tomou
              conhecimento das versões novas, conforme os Termos de Serviço.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">10. Contacto</h2>
            <p className="text-muted-foreground leading-relaxed">
              Em caso de dúvidas sobre privacidade ou pedidos relacionados com dados:{" "}
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

export default Privacidade;
