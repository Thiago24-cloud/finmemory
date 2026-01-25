import { useEffect, useState, useCallback } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import { createClient } from '@supabase/supabase-js';

// Lazy initialization do Supabase - só cria quando realmente necessário (não durante build)
let supabaseInstance = null;

function getSupabase() {
  if (typeof window === 'undefined') {
    // Durante SSR/build, retorna null
    return null;
  }
  
  if (!supabaseInstance) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('⚠️ Variáveis de ambiente do Supabase não configuradas');
      return null;
    }
    
    supabaseInstance = createClient(supabaseUrl, supabaseKey);
  }
  
  return supabaseInstance;
}

export default function Dashboard() {
  const { data: session, status } = useSession();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [userId, setUserId] = useState(null);

  // Get Supabase user ID from session or localStorage
  useEffect(() => {
    if (session?.user?.supabaseId) {
      setUserId(session.user.supabaseId);
      localStorage.setItem('user_id', session.user.supabaseId);
    } else if (session?.user?.email) {
      // Fetch user ID from Supabase if not in session
      const fetchUserId = async () => {
        const supabase = getSupabase();
        if (!supabase) {
          console.error('❌ Supabase não disponível');
          return;
        }
        
        console.log('🔍 Buscando user_id para email:', session.user.email);
        
        const { data, error } = await supabase
          .from('users')
          .select('id')
          .eq('email', session.user.email)
          .single();
        
        if (error) {
          console.error('❌ Erro ao buscar user_id:', error);
          return;
        }
        
        if (data) {
          console.log('✅ User ID encontrado:', data.id);
          setUserId(data.id);
          localStorage.setItem('user_id', data.id);
        } else {
          console.warn('⚠️ Nenhum usuário encontrado para este email');
        }
      };
      fetchUserId();
    }
  }, [session]);

  const loadTransactions = useCallback(async (uid) => {
    if (!uid) {
      console.warn('loadTransactions: userId não fornecido');
      return;
    }
    
    const supabase = getSupabase();
    if (!supabase) {
      console.warn('loadTransactions: Supabase não disponível');
      return;
    }
    
    console.log('📊 Carregando transações para user_id:', uid);
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('transacoes')
        .select('*, produtos (*)')
        .eq('user_id', uid)
        .order('data', { ascending: false })
        .order('hora', { ascending: false });

      if (error) {
        console.error('❌ Erro ao carregar transações:', error);
        throw error;
      }
      
      console.log('✅ Transações carregadas:', data?.length || 0);
      setTransactions(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('❌ Erro ao carregar transações:', error);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSyncEmails = useCallback(async (isFirstSync = false) => {
    if (!userId) {
      alert('⚠️ Você precisa conectar o Gmail primeiro!');
      return;
    }

    if (syncing) {
      console.warn('Sincronização já em andamento');
      return;
    }

    setSyncing(true);

    try {
      const response = await fetch('/api/gmail/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userId,
          firstSync: Boolean(isFirstSync)
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        const processed = parseInt(data.processed) || 0;
        if (processed > 0) {
          alert(`✅ ${processed} nota${processed > 1 ? 's' : ''} fiscal${processed > 1 ? 'is' : ''} processada${processed > 1 ? 's' : ''}!`);
        } else {
          alert('ℹ️ Nenhuma nota fiscal nova encontrada.');
        }
        await loadTransactions(userId);
      } else {
        const errorMsg = data.error || 'Erro desconhecido';
        console.error('Erro ao sincronizar:', errorMsg);
        alert(`❌ Erro ao sincronizar: ${errorMsg}`);
      }
    } catch (error) {
      console.error('Erro na sincronização:', error);
      alert(`❌ Erro ao sincronizar: ${error.message}`);
    } finally {
      setSyncing(false);
    }
  }, [userId, loadTransactions, syncing]);

  // Load transactions when userId changes
  useEffect(() => {
    if (userId) {
      loadTransactions(userId);
    }
  }, [userId, loadTransactions]);

  // Check URL params for first sync
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const urlParams = new URLSearchParams(window.location.search);
    const success = urlParams.get('success');
    const error = urlParams.get('error');
    
    if (error) {
      // Erros de autenticação agora são tratados pela página /auth-error
      // Mas caso chegue aqui diretamente, mostra mensagem genérica
      console.error('Erro de autenticação:', error);
      window.history.replaceState({}, '', '/dashboard');
      return;
    }
    
    if (success === 'true' && userId) {
      window.history.replaceState({}, '', '/dashboard');
      setTimeout(() => {
        handleSyncEmails(true);
      }, 1000);
    }
  }, [userId, handleSyncEmails]);

  const handleConnectGmail = () => {
    signIn('google', { callbackUrl: '/dashboard?success=true' });
  };

  const handleDisconnect = async () => {
    if (confirm('⚠️ Deseja realmente desconectar? Suas transações não serão perdidas.')) {
      try {
        localStorage.removeItem('user_id');
        setUserId(null);
        setTransactions([]);
        await signOut({ callbackUrl: '/dashboard' });
      } catch (error) {
        console.error('Erro ao desconectar:', error);
        alert('❌ Erro ao desconectar. Tente novamente.');
      }
    }
  };

  const isAuthenticated = status === 'authenticated' && session;
  const isLoading = status === 'loading';

  return (
    <div style={{ 
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '20px',
      fontFamily: 'system-ui, sans-serif'
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* Menu superior com links */}
        <nav style={{
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          gap: '24px',
          marginBottom: '12px',
        }}>
          <a href="/privacidade" style={{ color: '#fff', textDecoration: 'none', fontWeight: 'bold', fontSize: '15px' }}>
            Privacidade
          </a>
          <a href="/termos" style={{ color: '#fff', textDecoration: 'none', fontWeight: 'bold', fontSize: '15px' }}>
            Termos de Uso
          </a>
        </nav>

        {/* Header */}
        <div style={{ 
          background: 'white',
          borderRadius: '16px',
          padding: '24px',
          marginBottom: '24px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          <div>
            <h1 style={{ 
              fontSize: '32px', 
              margin: '0 0 8px 0',
              background: 'linear-gradient(135deg, #667eea, #764ba2)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>
              🚀 FinMemory
            </h1>
            <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>
              {isAuthenticated ? `Olá, ${session.user.name || session.user.email}!` : 'Seu histórico financeiro inteligente'}
            </p>
          </div>
          
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {isLoading ? (
              <div style={{ padding: '14px 28px', color: '#666' }}>
                Carregando...
              </div>
            ) : !isAuthenticated ? (
              <button
                onClick={handleConnectGmail}
                style={{
                  padding: '14px 28px',
                  background: 'linear-gradient(135deg, #34A853, #0F9D58)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: 'bold'
                }}
              >
                🔌 Conectar Gmail
              </button>
            ) : (
              <>
                <button
                  onClick={() => handleSyncEmails(false)}
                  disabled={syncing}
                  style={{
                    padding: '14px 28px',
                    background: syncing ? '#ccc' : 'linear-gradient(135deg, #667eea, #764ba2)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    cursor: syncing ? 'not-allowed' : 'pointer',
                    fontSize: '16px',
                    fontWeight: 'bold'
                  }}
                >
                  {syncing ? '⏳ Buscando...' : '🔄 Buscar Notas Fiscais'}
                </button>
                
                <button
                  onClick={handleDisconnect}
                  style={{
                    padding: '14px 20px',
                    background: 'white',
                    color: '#e74c3c',
                    border: '2px solid #e74c3c',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 'bold'
                  }}
                >
                  🚪 Sair
                </button>
              </>
            )}
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '60px',
            textAlign: 'center',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
            <p style={{ fontSize: '18px', color: '#666' }}>
              Carregando sessão...
            </p>
          </div>
        ) : !isAuthenticated ? (
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '60px 40px',
            textAlign: 'center',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
          }}>
            <div style={{ fontSize: '64px', marginBottom: '24px' }}>📧</div>
            <h2 style={{ fontSize: '28px', marginBottom: '16px', color: '#333' }}>
              Conecte seu Gmail
            </h2>
            <p style={{ fontSize: '18px', color: '#666', marginBottom: '32px' }}>
              Busque suas notas fiscais automaticamente!
            </p>
            <button
              onClick={handleConnectGmail}
              style={{
                padding: '16px 40px',
                background: 'linear-gradient(135deg, #34A853, #0F9D58)',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                cursor: 'pointer',
                fontSize: '18px',
                fontWeight: 'bold'
              }}
            >
              🔌 Conectar Gmail Agora
            </button>
          </div>
        ) : loading ? (
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '60px',
            textAlign: 'center',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
            <p style={{ fontSize: '18px', color: '#666' }}>
              Carregando transações...
            </p>
          </div>
        ) : transactions.length === 0 ? (
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '60px 40px',
            textAlign: 'center',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
          }}>
            <div style={{ fontSize: '64px', marginBottom: '24px' }}>📭</div>
            <h2 style={{ fontSize: '24px', marginBottom: '16px', color: '#333' }}>
              Nenhuma nota fiscal encontrada
            </h2>
            <p style={{ fontSize: '16px', color: '#666' }}>
              Clique em "🔄 Buscar Notas Fiscais" acima!
            </p>
          </div>
        ) : (
          <div>
            <div style={{
              background: 'white',
              borderRadius: '16px',
              padding: '24px',
              marginBottom: '16px',
              boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
            }}>
              <h2 style={{ margin: '0 0 8px 0', fontSize: '24px', color: '#333' }}>
                📊 Histórico de Compras
              </h2>
              <p style={{ margin: 0, color: '#666' }}>
                {transactions.length} transação(ões)
              </p>
            </div>

            {transactions.map(transaction => (
              <TransactionCard key={transaction.id} transaction={transaction} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TransactionCard({ transaction }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={{
      background: 'white',
      borderRadius: '16px',
      padding: '24px',
      marginBottom: '16px',
      boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
    }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        marginBottom: '20px',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div style={{ flex: 1, minWidth: '250px' }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '22px', color: '#333' }}>
            🏪 {transaction.estabelecimento}
          </h3>
          {transaction.endereco && (
            <p style={{ margin: '0 0 8px 0', color: '#666', fontSize: '14px' }}>
              📍 {transaction.endereco}
            </p>
          )}
          <p style={{ margin: 0, color: '#999', fontSize: '14px' }}>
            📅 {new Date(transaction.data + 'T00:00:00').toLocaleDateString('pt-BR')}
            {transaction.hora && ` às ${transaction.hora.substring(0, 5)}`}
          </p>
        </div>
        
        <div style={{ textAlign: 'right' }}>
          <p style={{ 
            margin: '0 0 8px 0', 
            fontSize: '32px', 
            fontWeight: 'bold',
            color: '#667eea'
          }}>
            R$ {(parseFloat(transaction.total) || 0).toFixed(2)}
          </p>
        </div>
      </div>

      {transaction.produtos && transaction.produtos.length > 0 && (
        <>
          <button
            onClick={() => setExpanded(!expanded)}
            style={{
              width: '100%',
              padding: '14px',
              background: '#f8f9fa',
              border: '2px solid #e9ecef',
              borderRadius: '10px',
              cursor: 'pointer',
              fontSize: '15px',
              fontWeight: '600',
              color: '#495057'
            }}
          >
            {expanded ? '▲ Ocultar Produtos' : `▼ Ver ${transaction.produtos.length} Produto(s)`}
          </button>

          {expanded && (
            <div style={{ marginTop: '20px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f1f3f5' }}>
                    <th style={{ padding: '14px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>
                      Produto
                    </th>
                    <th style={{ padding: '14px', textAlign: 'center', borderBottom: '2px solid #dee2e6' }}>
                      Qtd
                    </th>
                    <th style={{ padding: '14px', textAlign: 'right', borderBottom: '2px solid #dee2e6' }}>
                      Valor Unit.
                    </th>
                    <th style={{ padding: '14px', textAlign: 'right', borderBottom: '2px solid #dee2e6' }}>
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {transaction.produtos.map((produto, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #e9ecef' }}>
                      <td style={{ padding: '14px' }}>
                        <strong>{produto.descricao}</strong>
                      </td>
                      <td style={{ padding: '14px', textAlign: 'center' }}>
                        {(parseFloat(produto.quantidade) || 0).toFixed(0)} {produto.unidade || 'UN'}
                      </td>
                      <td style={{ padding: '14px', textAlign: 'right' }}>
                        R$ {(parseFloat(produto.valor_unitario) || 0).toFixed(2)}
                      </td>
                      <td style={{ padding: '14px', textAlign: 'right', fontWeight: 'bold' }}>
                        R$ {(parseFloat(produto.valor_total) || 0).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
