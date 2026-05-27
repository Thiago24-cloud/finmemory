import React from 'react';
import Head from 'next/head';
import Link from 'next/link';

const section = { marginBottom: '1.5rem' };
const h2 = { fontSize: '1.125rem', marginBottom: '0.5rem' };
const h3 = { fontSize: '1rem', marginBottom: '0.5rem', marginTop: '0.75rem', fontWeight: 600 };
const ul = { paddingLeft: '1.25rem', margin: 0 };

const warningBox = {
  borderLeft: '4px solid #f59e0b',
  background: '#fffbeb',
  padding: '1rem',
  borderRadius: '0.5rem',
  marginBottom: '0.75rem',
};

export default function Privacidade() {
  return (
    <>
      <Head>
        <title>Política de Privacidade - FinMemory</title>
        <meta
          name="description"
          content="Política de Privacidade do FinMemory — LGPD, localização, Open Finance, exclusão de conta."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <main
        style={{
          padding: '2rem',
          maxWidth: 800,
          margin: '0 auto',
          fontFamily: 'system-ui, sans-serif',
          lineHeight: 1.6,
        }}
      >
        <h1 style={{ color: '#2ECC49', marginBottom: '0.25rem' }}>Política de Privacidade — FinMemory</h1>
        <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '2rem' }}>Última atualização: 24/04/2026</p>

        <section style={section}>
          <h2 style={h2}>1. Introdução</h2>
          <p>
            O FinMemory valoriza a privacidade dos usuários. Ao criar uma conta ou utilizar o FinMemory, você confirma
            que leu e concorda com esta Política de Privacidade e com os nossos{' '}
            <Link href="/termos" style={{ color: '#2ECC49', textDecoration: 'underline' }}>
              Termos de Uso
            </Link>{' '}
            (finmemory.com.br/termos).
          </p>
        </section>

        <section style={section}>
          <h2 style={h2}>2. Dados que podemos tratar</h2>
          <ul style={ul}>
            <li>
              <strong>Dados de conta e autenticação:</strong> nome, e-mail, identificador de sessão (ex: login com
              Google).
            </li>
            <li>
              <strong>Dados financeiros derivados:</strong> informações extraídas de notas fiscais (NF-e via QR Code
              SEFAZ) ou importadas via Open Finance.
            </li>
            <li>
              <strong>Open Finance (Pluggy), opcional:</strong> dados bancários para agregar movimentos e saldos,
              mediante autorização.
            </li>
            <li>
              <strong>Mapa de preços:</strong> nomes de produtos, preços, localização aproximada de lojas.
            </li>
            <li>
              <strong>Lista de compras:</strong> itens adicionados à lista.
            </li>
            <li>
              <strong>Localização do dispositivo (opcional):</strong> quando o usuário ativa o mapa ou alertas de
              proximidade.
            </li>
            <li>
              <strong>Dados técnicos:</strong> registos de diagnóstico para operar o serviço.
            </li>
          </ul>
        </section>

        <section style={section}>
          <h2 style={h2}>3. Localização em background — AVISO IMPORTANTE</h2>
          <div style={warningBox}>
            <p style={{ margin: 0, fontWeight: 600 }}>
              ⚠️ O FinMemory pode acessar sua localização mesmo quando o aplicativo está em segundo plano ou com a
              tela desligada.
            </p>
          </div>
          <p>
            Esta funcionalidade é utilizada EXCLUSIVAMENTE para o recurso de Alertas de Proximidade: quando ativado
            pelo usuário em Ajustes, o app monitora a sua posição em background para enviar uma notificação
            local quando você se aproximar de um estabelecimento com produtos da sua lista de compras.
          </p>
          <ul style={ul}>
            <li>A localização em background é utilizada APENAS para os Alertas de Proximidade.</li>
            <li>É opt-in: só é ativada se o usuário conceder explicitamente a permissão.</li>
            <li>Pode desativar a qualquer momento em Ajustes &gt; Alertas de Proximidade.</li>
            <li>Não é partilhada com terceiros para fins publicitários.</li>
          </ul>
        </section>

        <section style={section}>
          <h2 style={h2}>4. Finalidades</h2>
          <ul style={ul}>
            <li>Prestar e melhorar o serviço.</li>
            <li>Mostrar mapa e preços perto do usuário; não vendemos localização a terceiros.</li>
            <li>Alertas de proximidade com produtos da lista de compras.</li>
            <li>Autenticação, segurança, suporte e obrigações legais.</li>
          </ul>
        </section>

        <section style={section}>
          <h2 style={h2}>5. Base legal e conservação</h2>
          <p>
            Tratamento baseado em execução do serviço, consentimento (permissões do dispositivo, Open Finance,
            localização em background) e interesses legítimos. Conservamos dados conforme a LGPD (Lei 13.709/2018).
          </p>
        </section>

        <section style={section}>
          <h2 style={h2}>6. Encriptação e subcontratantes</h2>
          <p>
            Utilizamos HTTPS. Dados podem ser processados por: Supabase (banco de dados), Pluggy (Open Finance), Stripe
            (pagamentos), Google Cloud Run (servidor). Não vendemos dados a anunciantes.
          </p>
        </section>

        <section style={section}>
          <h2 style={h2}>7. Partilha de dados</h2>
          <p>
            Não vendemos dados de localização, financeiros ou de conta a terceiros para fins publicitários. Dados
            compartilhados apenas com prestadores operacionais ou por exigência legal.
          </p>
        </section>

        <section style={section}>
          <h2 style={h2}>8. Segurança</h2>
          <p>Adotamos medidas técnicas e organizacionais adequadas para proteger os dados.</p>
        </section>

        <section style={section}>
          <h2 style={h2}>9. Os seus direitos — incluindo exclusão de conta</h2>
          <p>
            Conforme a LGPD, você pode solicitar: acesso, correção, anonimização, bloqueio, eliminação, portabilidade e
            revogação do consentimento.
          </p>
          <h3 style={h3}>9.1 Exclusão de conta e dados</h3>
          <p>Você tem o direito de excluir a sua conta e TODOS os dados associados a qualquer momento.</p>
          <p style={{ marginBottom: '0.5rem' }}>
            <strong>Como solicitar:</strong>
          </p>
          <ul style={ul}>
            <li>
              Dentro do app: Ajustes &gt; Conta &gt; Excluir conta.
            </li>
            <li>
              Por e-mail:{' '}
              <a href="mailto:finmemory.oficial@gmail.com" style={{ color: '#2ECC49' }}>
                finmemory.oficial@gmail.com
              </a>{' '}
              com assunto &quot;Excluir minha conta&quot;.
            </li>
          </ul>
          <p>
            <strong>Prazo:</strong> excluímos permanentemente todos os dados em até 30 dias corridos após confirmação,
            incluindo histórico de transações, dados bancários importados, lista de compras e dados de perfil.
            Exceções: dados exigidos por lei serão mantidos apenas pelo período legal.
          </p>
        </section>

        <section style={section}>
          <h2 style={h2}>10. Alterações</h2>
          <p>Política pode ser atualizada periodicamente. A data no topo indica a última revisão.</p>
        </section>

        <section style={section}>
          <h2 style={h2}>11. Contato</h2>
          <ul style={ul}>
            <li>
              E-mail:{' '}
              <a href="mailto:finmemory.oficial@gmail.com" style={{ color: '#2ECC49' }}>
                finmemory.oficial@gmail.com
              </a>
            </li>
            <li>Assunto recomendado: &quot;Pedido LGPD — [seu nome]&quot;</li>
            <li>
              Site:{' '}
              <a href="https://finmemory.com.br/privacidade" style={{ color: '#2ECC49' }}>
                finmemory.com.br/privacidade
              </a>
            </li>
          </ul>
        </section>
      </main>
    </>
  );
}
