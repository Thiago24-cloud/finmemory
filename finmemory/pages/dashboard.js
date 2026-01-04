
        import React, { useState } from 'react';
import Head from 'next/head';
// Import Link do Next se for navegar entre páginas
// import Link from 'next/link'; 

export default function Dashboard() {
  const [transacoes, setTransacoes] = useState([]);

  // Função para lidar com o login (Exemplo do que virá a seguir)
  const handleConnectGmail = () => {
    // Em produção, isso levaria para o fluxo de OAuth do Google
    window.location.href = '/api/auth/google';
  };

  return (
    <div style={{ 
      fontFamily: 'system-ui, -apple-system, sans-serif', 
      backgroundColor: '#f0f2f5', 
      minHeight: '100vh',
      color: '#1c1e21'
    }}>
      <Head>
        <title>FinMemory | Meu Financeiro Inteligente</title>
      </Head>

      <nav style={styles.nav}>
        <h2 style={{ margin: 0, color: '#007bff' }}>🚀 FinMemory</h2>
        <button style={styles.btnSair}>Sair</button>
      </nav>

      <main style={styles.container}>
        
        <section style={styles.welcomeCard}>
          <h1 style={{ fontSize: '24px', marginBottom: '10px' }}>Bem-vindo ao seu Financeiro</h1>
          <p style={{ color: '#65676b', marginBottom: '25px' }}>
            Nossa IA está pronta para ler seus e-mails e organizar seus gastos.
          </p>
          
          <button 
            onClick={handleConnectGmail}
            style={styles.btnConnect}
          >
            🔌 Conectar Gmail agora
          </button>
        </section>

        <section>
          <h3 style={{ marginBottom: '15px' }}>Últimas Atividades</h3>
          {transacoes.length === 0 ? (
            <div style={styles.emptyState}>
              <p style={{ color: '#8d949e' }}>
                Nenhuma transação encontrada. <br/>
                <strong>Conecte seu e-mail</strong> para começar a automação!
              </p>
            </div>
          ) : (
            <div style={styles.listCard}>
              {/* Mapeamento futuro: transacoes.map(...) */}
            </div>
          )}
        </section>
      </main>

      <footer style={styles.footer}>
        &copy; 2025 FinMemory - Inteligência Financeira Automática
      </footer>
    </div>
  );
}

// Organizar os estilos fora do JSX ajuda a ler melhor o código
const styles = {
  nav: { 
    backgroundColor: '#fff', padding: '15px 30px', 
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)', display: 'flex',
    justifyContent: 'space-between', alignItems: 'center' 
  },
  btnSair: {
    backgroundColor: '#f0f2f5', color: '#1c1e21', border: 'none',
    padding: '8px 16px', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer'
  },
  container: { maxWidth: '800px', margin: '40px auto', padding: '0 20px' },
  welcomeCard: { 
    backgroundColor: '#fff', padding: '30px', borderRadius: '12px', 
    boxShadow: '0 4px 12px rgba(0,0,0,0.05)', textAlign: 'center', marginBottom: '30px' 
  },
  btnConnect: {
    backgroundColor: '#34a853', color: 'white', border: 'none',
    padding: '15px 30px', borderRadius: '8px', fontSize: '18px',
    fontWeight: 'bold', cursor: 'pointer'
  },
  emptyState: { 
    backgroundColor: '#fff', padding: '40px', borderRadius: '12px', 
    textAlign: 'center', border: '2px dashed #ccd0d5' 
  },
  footer: { textAlign: 'center', marginTop: '50px', paddingBottom: '30px', color: '#8d949e', fontSize: '14px' }
};
       
          
              
