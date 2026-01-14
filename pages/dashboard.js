import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const loadTransactions = useCallback(async (userId) => {
    if (!userId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('transacoes')
        .select('*, produtos (*)')
        .eq('user_id', userId)
        .order('data', { ascending: false })
        .order('hora', { ascending: false });

      if (error) throw error;
      setTransactions(data || []);
    } catch (error) {
      console.error('Erro ao carregar transações:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSyncEmails = useCallback(async (userId = null, isFirstSync = false) => {
    const targetUserId = userId || user?.id;
    
    if (!targetUserId) {
      alert('Você precisa conectar o Gmail primeiro!');
      return;
    }

    setSyncing(true);

    try {
      const response = await fetch('/api/gmail/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: targetUserId,
          firstSync: isFirstSync
        })
      });

      const data = await response.json();

      if (data.success) {
        if (data.processed > 0) {
          alert(`✅ ${data.processed} nota${data.processed > 1 ? 's' : ''} fiscal${data.processed > 1 ? 'is' : ''} processada${data.processed > 1 ? 's' : ''}!`);
        } else {
          alert('ℹ️ Nenhuma nota fiscal nova encontrada.');
        }
        await loadTransactions(targetUserId);
      } else {
        alert('❌ Erro ao sincronizar');
      }
    } catch (error) {
      console.error('Erro:', error);
      alert('❌ Erro ao sincronizar');
    } finally {
      setSyncing(false);
    }
  }, [user, loadTransactions]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const urlParams = new URLSearchParams(window.location.search);
    const userId = urlParams.get('user_id');
    const success = urlParams.get('success');
    const error = urlParams.get('error');
    
    if (error) {
      alert('❌ Erro na autenticação. Tente novamente.');
    }
    
    if (userId) {
      localStorage.setItem('user_id', userId);
      setUser({ id: userId });
      window.history.replaceState({}, '', '/dashboard');
      loadTransactions(userId);
      
      if (success === 'true') {
        setTimeout(() => {
          handleSyncEmails(userId, true);
        }, 1000);
      }
    } else {
      const savedUserId = localStorage.getItem('user_id');
      if (savedUserId) {
        setUser({ id: savedUserId });
        loadTransactions(savedUserId);
      }
    }
  }, [loadTransactions, handleSyncEmails]);

  const handleConnectGmail = () => {
    if (typeof window !== 'undefined') {
      window.location.href = '/api/auth/google';
    }
  };

  const handleDisconnect = () => {
    if (typeof window === 'undefined') return;
    
    if (confirm('Deseja desconectar?')) {
      localStorage.removeItem('user_id');
      setUser(null);
      setTransactions([]);
      window.location.href = '/dashboard';
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '20px',
      fontFamily: 'system-ui, sans-serif'
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        
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
              Seu histórico financeiro inteligente
            </p>
          </div>
          
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {!user ? (
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
                  onClick={() => handleSyncEmails()}
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

        {!user ? (
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
              Carregando...
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