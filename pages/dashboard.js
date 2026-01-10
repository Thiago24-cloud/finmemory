import { useEffect, useState } from 'react';
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

  useEffect(() => {
    // Verificar se está autenticado
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
      
      // Limpar URL
      window.history.replaceState({}, '', '/dashboard');
      
      // Carregar transações
      loadTransactions(userId);
      
      if (success === 'true') {
        // Primeira sincronização automática
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
  }, []);

  const loadTransactions = async (userId) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('transacoes')
        .select(`
          *,
          produtos (*)
        `)
        .eq('user_id', userId)
        .order('data', { ascending: false })
        .order('hora', { ascending: false });

      if (error) throw error;
      setTransactions(data || []);
    } catch (error) {
      console.error('Erro ao carregar transações:', error);
      alert('Erro ao carregar transações');
    } finally {
      setLoading(false);
    }
  };

  const handleConnectGmail = () => {
    window.location.href = '/api/auth/google';
  };

  const handleSyncEmails = async (userId = null, isFirstSync = false) => {
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
          alert(`✅ ${data.processed} nota${data.processed > 1 ? 's' : ''} fiscal${data.processed > 1 ? 'is' : ''} encontrada${data.processed > 1 ? 's' : ''} e processada${data.processed > 1 ? 's' : ''}!`);
        } else {
          alert('ℹ️ Nenhuma nota fiscal nova encontrada.');
        }
        await loadTransactions(targetUserId);
      } else {
        alert('❌ Erro ao sincronizar. Detalhes: ' + (data.error || 'Erro desconhecido'));
      }
    } catch (error) {
      console.error('Erro:', error);
      alert('❌ Erro ao sincronizar e-mails');
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = () => {
    if (confirm('Tem certeza que deseja desconectar?')) {
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
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        
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
                  fontWeight: 'bold',
                  boxShadow: '0 4px 6px rgba(52,168,83,0.3)',
                  transition: 'transform 0.2s'
                }}
                onMouseOver={(e) => e.target.style.transform = 'scale(1.05)'}
                onMouseOut={(e) => e.target.style.transform = 'scale(1)'}
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
                    background: syncing 
                      ? '#ccc' 
                      : 'linear-gradient(135deg, #667eea, #764ba2)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    cursor: syncing ? 'not-allowed' : 'pointer',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    boxShadow: syncing ? 'none' : '0 4px 6px rgba(102,126,234,0.3)',
                    transition: 'transform 0.2s'
                  }}
                  onMouseOver={(e) => !syncing && (e.target.style.transform = 'scale(1.05)')}
                  onMouseOut={(e) => e.target.style.transform = 'scale(1)'}
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
                    fontWeight: 'bold',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => {
                    e.target.style.background = '#e74c3c';
                    e.target.style.color = 'white';
                  }}
                  onMouseOut={(e) => {
                    e.target.style.background = 'white';
                    e.target.style.color = '#e74c3c';
                  }}
                >
                  🚪 Sair
                </button>
              </>
            )}
          </div>
        </div>

        {/* Conteúdo */}
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
            <p style={{ fontSize: '18px', color: '#666', marginBottom: '32px', lineHeight: '1.6' }}>
              Vamos buscar suas notas fiscais automaticamente e<br/>
              criar um histórico completo de suas compras!
            </p>
            <ul style={{ 
              textAlign: 'left', 
              display: 'inline-block', 
              color: '#666',
              marginBottom: '32px'
            }}>
              <li style={{ marginBottom: '8px' }}>✅ Histórico completo de compras</li>
              <li style={{ marginBottom: '8px' }}>✅ Produtos detalhados com preços</li>
              <li style={{ marginBottom: '8px' }}>✅ Controle de gastos por categoria</li>
              <li style={{ marginBottom: '8px' }}>✅ 100% seguro e privado</li>
            </ul>
            <br/>
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
                fontWeight: 'bold',
                boxShadow: '0 4px 6px rgba(52,168,83,0.3)',
                transition: 'transform 0.2s'
              }}
              onMouseOver={(e) => e.target.style.transform = 'scale(1.05)'}
              onMouseOut={(e) => e.target.style.transform = 'scale(1)'}
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
              Carregando suas transações...
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
            <p style={{ fontSize: '16px', color: '#666', marginBottom: '32px', lineHeight: '1.6' }}>
              Clique no botão "🔄 Buscar Notas Fiscais" acima para<br/>
              procurar notas fiscais no seu e-mail dos últimos 30 dias!
            </p>
            <div style={{
              background: '#f0f9ff',
              border: '2px solid #0ea5e9',
              borderRadius: '12px',
              padding: '20px',
              marginTop: '24px',
              textAlign: 'left'
            }}>
              <h3 style={{ margin: '0 0 12px 0', color: '#0369a1' }}>
                💡 Dica:
              </h3>
              <p style={{ margin: 0, color: '#0c4a6e', lineHeight: '1.6' }}>
                O sistema busca e-mails com palavras-chave como:<br/>
                • "Nota Fiscal"<br/>
                • "NF-e"<br/>
                • "Cupom Fiscal"<br/>
                • "Comprovante"
              </p>
            </div>
          </div>
        ) : (
          <div>
            {/* Estatísticas */}
            <div style={{
              background: 'white',
              borderRadius: '16px',
              padding: '24px',
              marginBottom: '16px',
              boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '16px'
            }}>
              <div>
                <h2 style={{ margin: '0 0 8px 0', fontSize: '24px', color: '#333' }}>
                  📊 Histórico de Compras
                </h2>
                <p style={{ margin: 0, color: '#666' }}>
                  {transactions.length} transaç{transactions.length === 1 ? 'ão' : 'ões'} encontrada{transactions.length === 1 ? '' : 's'}
                </p>
              </div>
              
              <div style={{ textAlign: 'right' }}>
                <p style={{ margin: '0 0 4px 0', fontSize: '14px', color: '#999' }}>
                  Total Gasto:
                </p>
                <p style={{ 
                  margin: 0, 
                  fontSize: '28px', 
                  fontWeight: 'bold',
                  background: 'linear-gradient(135deg, #667eea, #764ba2)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent'
                }}>
                  R$ {transactions.reduce((sum, t) => sum + parseFloat(t.total || 0), 0).toFixed(2)}
                </p>
              </div>
            </div>

            {/* Lista de Transações */}
            {transactions.map(transaction => (
              <TransactionCard key={transaction.id} transaction={transaction} />
            ))}
          </div>
        )}

        {/* Footer */}
        <div style={{
          marginTop: '40px',
          textAlign: 'center',
          color: 'white',
          opacity: 0.8,
          fontSize: '14px'
        }}>
          <p style={{ margin: '0 0 8px 0' }}>
            © 2025 FinMemory - Inteligência Financeira Automática
          </p>
          <p style={{ margin: 0 }}>
            🔒 Seus dados são criptografados e 100% privados
          </p>
        </div>
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
      boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
      transition: 'transform 0.2s, box-shadow 0.2s'
    }}
    onMouseOver={(e) => {
      e.currentTarget.style.transform = 'translateY(-2px)';
      e.currentTarget.style.boxShadow = '0 6px 12px rgba(0,0,0,0.15)';
    }}
    onMouseOut={(e) => {
      e.currentTarget.style.transform = 'translateY(0)';
      e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
    }}
    >
      {/* Header da transação */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'start',
        marginBottom: '20px',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div style={{ flex: 1, minWidth: '250px' }}>
          <h3 style={{ 
            margin: '0 0 12px 0', 
            fontSize: '22px',
            color: '#333'
          }}>
            🏪 {transaction.estabelecimento}
          </h3>
          {transaction.endereco && (
            <p style={{ margin: '0 0 8px 0', color: '#666', fontSize: '14px' }}>
              📍 {transaction.endereco}
              {transaction.cidade && transaction.estado && ` - ${transaction.cidade}/${transaction.estado}`}
            </p>
          )}
          {transaction.cnpj && (
            <p style={{ margin: '0 0 8px 0', color: '#999', fontSize: '13px' }}>
              CNPJ: {transaction.cnpj}
            </p>
          )}
          <p style={{ margin: 0, color: '#999', fontSize: '14px' }}>
            📅 {new Date(transaction.data + 'T00:00:00').toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: 'long',
              year: 'numeric'
            })}
            {transaction.hora && ` às ${transaction.hora.substring(0, 5)}`}
          </p>
          {transaction.numero_nota && (
            <p style={{ margin: '8px 0 0 0', color: '#999', fontSize: '12px' }}>
              NF-e: {transaction.numero_nota}
            </p>
          )}
        </div>
        
        <div style={{ textAlign: 'right' }}>
          <p style={{ 
            margin: '0 0 8px 0', 
            fontSize: '32px', 
            fontWeight: 'bold',
            background: 'linear-gradient(135deg, #667eea, #764ba2)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            R$ {parseFloat(transaction.total).toFixed(2)}
          </p>
          {transaction.forma_pagamento && (
            <p style={{ 
              margin: 0, 
              fontSize: '14px', 
              color: '#666',
              background: '#f0f0f0',
              padding: '6px 14px',
              borderRadius: '20px',
              display: 'inline-block'
            }}>
              💳 {transaction.forma_pagamento}
            </p>
          )}
        </div>
      </div>

      {/* Botão expandir */}
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
              color: '#495057',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => {
              e.target.style.background = '#e9ecef';
              e.target.style.borderColor = '#dee2e6';
            }}
            onMouseOut={(e) => {
              e.target.style.background = '#f8f9fa';
              e.target.style.borderColor = '#e9ecef';
            }}
          >
            {expanded ? '▲ Ocultar Produtos' : `▼ Ver ${transaction.produtos.length} Produto${transaction.produtos.length > 1 ? 's' : ''}`}
          </button>

          {/* Lista de produtos */}
          {expanded && (
            <div style={{ marginTop: '20px' }}>
              <table style={{ 
                width: '100%', 
                borderCollapse: 'collapse',
                background: '#fafbfc'
              }}>
                <thead>
                  <tr style={{ background: '#f1f3f5' }}>
                    <th style={{ 
                      padding: '14px', 
                      textAlign: 'left',
                      borderBottom: '2px solid #dee2e6',
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#495057'
                    }}>
                      Produto
                    </th>
                    <th style={{ 
                      padding: '14px', 
                      textAlign: 'center',
                      borderBottom: '2px solid #dee2e6',
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#495057'
                    }}>
                      Qtd
                    </th>
                    <th style={{ 
                      padding: '14px', 
                      textAlign: 'right',
                      borderBottom: '2px solid #dee2e6',
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#495057'
                    }}>
                      Valor Unit.
                    </th>
                    <th style={{ 
                      padding: '14px', 
                      textAlign: 'right',
                      borderBottom: '2px solid #dee2e6',
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#495057'
                    }}>
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {transaction.produtos.map((produto, idx) => (
                    <tr key={idx} style={{ 
                      borderBottom: '1px solid #e9ecef'
                    }}>
                      <td style={{ padding: '14px' }}>
                        <div>
                          <strong style={{ color: '#333' }}>
                            {produto.descricao}
                          </strong>
                          {produto.codigo && (
                            <div style={{ 
                              fontSize: '12px', 
                              color: '#999',
                              marginTop: '4px'
                            }}>
                              Cód: {produto.codigo}
                            </div>
                          )}
                        </div>
                      </td>
                      <td style={{ 
                        padding: '14px', 
                        textAlign: 'center',
                        color: '#666'
                      }}>
                        {parseFloat(produto.quantidade).toFixed(produto.unidade === 'KG' ? 3 : 0)} {produto.unidade}
                      </td>
                      <td style={{ 
                        padding: '14px', 
                        textAlign: 'right',
                        color: '#666'
                      }}>
                        R$ {parseFloat(produto.valor_unitario).toFixed(2)}
                      </td>
                      <td style={{ 
                        padding: '14px', 
                        textAlign: 'right',
                        fontWeight: 'bold',
                        color: '#333'
                      }}>
                        R$ {parseFloat(produto.valor_total).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  {transaction.descontos > 0 && (
                    <tr style={{ background: '#fff3cd' }}>
                      <td colSpan="3" style={{ 
                        padding: '12px 14px', 
                        textAlign: 'right',
                        color: '#856404',
                        fontWeight: '600'
                      }}>
                        💰 Descontos:
                      </td>
                      <td style={{ 
                        padding: '12px 14px', 
                        textAlign: 'right',
                        fontWeight: 'bold',
                        color: '#856404'
                      }}>
                        - R$ {parseFloat(transaction.descontos).toFixed(2)}
                      </td>
                    </tr>
                  )}
                  <tr style={{ background: '#f1f3f5' }}>
                    <td colSpan="3" style={{ 
                      padding: '16px 14px', 
                      textAlign: 'right',
                      fontWeight: 'bold',
                      fontSize: '16px',
                      color: '#495057'
                    }}>
                      Total:
                    </td>
                    <td style={{ 
                      padding: '16px 14px', 
                      textAlign: 'right',
                      fontWeight: 'bold',
                      fontSize: '20px',
                      background: 'linear-gradient(135deg, #667eea, #764ba2)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent'
                    }}>
                      R$ {parseFloat(transaction.total).toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
