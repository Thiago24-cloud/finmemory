import { useEffect, useState, useCallback, useMemo } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import { createClient } from '@supabase/supabase-js';
import { Loader2, Mail, Camera } from 'lucide-react';
import { Nav } from '../components/Nav';
import { DashboardHeader } from '../components/dashboard/DashboardHeader';
import { BalanceCard } from '../components/dashboard/BalanceCard';
import { QuickActions } from '../components/dashboard/QuickActions';
import { TransactionList } from '../components/dashboard/TransactionList';

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
  const [syncLogs, setSyncLogs] = useState([]);
  const [lastSyncResult, setLastSyncResult] = useState(null);
  const [showLogs, setShowLogs] = useState(false);
  const [debugInfo, setDebugInfo] = useState(null);

  // Debug: Log quando transactions mudar
  useEffect(() => {
    console.log('🔄 Estado transactions atualizado:', {
      count: transactions.length,
      transactions: transactions.length > 0 ? transactions.map(t => ({
        id: t.id,
        estabelecimento: t.estabelecimento,
        total: t.total
      })) : []
    });
  }, [transactions]);

  // Get Supabase user ID from session or localStorage
  useEffect(() => {
    // Se já temos userId e ele corresponde à sessão, não precisa fazer nada
    if (userId && session?.user?.supabaseId && userId === session.user.supabaseId) {
      return;
    }

    // Primeiro, tenta usar o localStorage como fallback rápido
    if (typeof window !== 'undefined' && !userId) {
      const storedUserId = localStorage.getItem('user_id');
      if (storedUserId) {
        console.log('📦 User ID encontrado no localStorage:', storedUserId);
        // Só usa o localStorage se não temos sessão ou se a sessão não tem supabaseId
        if (!session || !session.user?.supabaseId) {
          setUserId(storedUserId);
          return;
        }
      }
    }

    if (session?.user?.supabaseId) {
      // Só atualiza se for diferente do atual
      if (userId !== session.user.supabaseId) {
        console.log('✅ User ID da sessão:', session.user.supabaseId);
        setUserId(session.user.supabaseId);
        localStorage.setItem('user_id', session.user.supabaseId);
      }
    } else if (session?.user?.email && !userId) {
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
          .select('id, email, name')
          .eq('email', session.user.email)
          .single();
        
        if (error) {
          console.error('❌ Erro ao buscar user_id:', error);
          console.error('   Código:', error.code);
          console.error('   Mensagem:', error.message);
          console.error('   Detalhes:', error.details);
          
          // Se for erro de RLS, informa
          if (error.code === 'PGRST116' || error.message?.includes('permission denied')) {
            console.error('⚠️ Possível problema de RLS (Row Level Security) ao buscar usuário');
            console.error('   Verifique as políticas RLS na tabela "users" no Supabase');
          }
          return;
        }
        
        if (data) {
          console.log('✅ User ID encontrado:', data.id);
          console.log('   Email:', data.email);
          console.log('   Nome:', data.name);
          setUserId(data.id);
          localStorage.setItem('user_id', data.id);
        } else {
          console.warn('⚠️ Nenhum usuário encontrado para este email');
          console.warn('   Isso pode acontecer se o usuário ainda não fez login pela primeira vez');
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
    console.log('🔍 Verificando configuração do Supabase...');
    console.log('   URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ Configurada' : '❌ Não configurada');
    console.log('   Key:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✅ Configurada' : '❌ Não configurada');
    
    setLoading(true);
    try {
      // Primeiro, tenta buscar sem o join para verificar se há transações
      const { data: simpleData, error: simpleError } = await supabase
        .from('transacoes')
        .select('id, user_id, estabelecimento, total, data')
        .eq('user_id', uid)
        .limit(5);

      if (simpleError) {
        console.error('❌ Erro ao buscar transações (query simples):', simpleError);
        console.error('   Código:', simpleError.code);
        console.error('   Mensagem:', simpleError.message);
        console.error('   Detalhes:', simpleError.details);
        console.error('   Hint:', simpleError.hint);
        
        // Se for erro de RLS, informa o usuário
        if (simpleError.code === 'PGRST116' || simpleError.message?.includes('permission denied')) {
          console.error('⚠️ Possível problema de RLS (Row Level Security) no Supabase');
          console.error('   Verifique se as políticas RLS permitem leitura para usuários autenticados');
        }
        
        throw simpleError;
      }

      console.log('📋 Transações encontradas (query simples):', simpleData?.length || 0);
      if (simpleData && simpleData.length > 0) {
        console.log('   Primeira transação:', simpleData[0]);
      } else {
        console.log('   ⚠️ Nenhuma transação encontrada para este user_id');
        console.log('   Verificando se há transações com outros user_ids...');
        
        // Verifica se há transações no banco (de qualquer usuário) para debug
        const { data: anyTransactions, error: anyError } = await supabase
          .from('transacoes')
          .select('id, user_id, estabelecimento')
          .limit(5);
        
        if (!anyError && anyTransactions && anyTransactions.length > 0) {
          console.log(`   ℹ️ Existem ${anyTransactions.length} transação(ões) no banco (de outros usuários)`);
          console.log('   Primeira transação encontrada:', {
            id: anyTransactions[0].id,
            user_id: anyTransactions[0].user_id,
            estabelecimento: anyTransactions[0].estabelecimento
          });
          console.log(`   ⚠️ Seu user_id (${uid}) não corresponde ao user_id das transações existentes`);
        } else {
          console.log('   ℹ️ Não há transações no banco de dados ainda');
          console.log('   💡 Execute a sincronização clicando em "Buscar Notas Fiscais"');
        }
      }

      // Agora busca com o join completo
      const { data, error } = await supabase
        .from('transacoes')
        .select('*, produtos (*)')
        .eq('user_id', uid)
        .order('data', { ascending: false })
        .order('hora', { ascending: false });

      if (error) {
        console.error('❌ Erro ao carregar transações (query completa):', error);
        console.error('   Código:', error.code);
        console.error('   Mensagem:', error.message);
        console.error('   Detalhes:', error.details);
        
        // Se a query simples funcionou mas a completa falhou, pode ser problema com a tabela produtos
        if (simpleData && simpleData.length > 0) {
          console.warn('⚠️ Transações existem, mas falha ao buscar produtos. Carregando sem produtos...');
          // Tenta buscar sem produtos
          const { data: dataWithoutProducts, error: errorWithoutProducts } = await supabase
            .from('transacoes')
            .select('*')
            .eq('user_id', uid)
            .order('data', { ascending: false })
            .order('hora', { ascending: false });
          
          if (!errorWithoutProducts) {
            console.log('✅ Transações carregadas sem produtos:', dataWithoutProducts?.length || 0);
            setTransactions(Array.isArray(dataWithoutProducts) ? dataWithoutProducts : []);
            return;
          }
        }
        
        throw error;
      }
      
      console.log('✅ Transações carregadas:', data?.length || 0);
      if (data && data.length > 0) {
        console.log('   Primeira transação completa:', {
          id: data[0].id,
          estabelecimento: data[0].estabelecimento,
          total: data[0].total,
          produtos_count: data[0].produtos?.length || 0
        });
        console.log('   Todas as transações:', data);
      } else {
        console.log('   ⚠️ Nenhuma transação retornada da query');
      }
      
      const transactionsArray = Array.isArray(data) ? data : [];
      console.log('   Definindo transações no estado:', transactionsArray.length, 'transação(ões)');
      setTransactions(transactionsArray);
      
      // Verifica se o estado foi atualizado
      setTimeout(() => {
        console.log('   Estado atualizado - transactions.length:', transactionsArray.length);
      }, 100);
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
    setSyncLogs([{ type: 'info', message: '🔄 Iniciando sincronização...', timestamp: new Date() }]);
    setShowLogs(true);

    try {
      setSyncLogs(prev => [...prev, { type: 'info', message: '📧 Buscando e-mails no Gmail...', timestamp: new Date() }]);
      
      const response = await fetch('/api/gmail/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userId,
          firstSync: Boolean(isFirstSync)
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData.error || `HTTP error! status: ${response.status}`;
        const errorDetails = errorData.details || '';
        
        // Se o erro indicar que precisa reautenticar
        if (errorData.requiresReauth) {
          setSyncLogs(prev => [...prev, { 
            type: 'error', 
            message: `❌ ${errorMsg}`, 
            timestamp: new Date() 
          }]);
          
          let reauthMessage = `❌ ${errorMsg}`;
          if (errorData.errorCode === 'INSUFFICIENT_PERMISSIONS') {
            reauthMessage += '\n\n🔧 Solução:\n';
            reauthMessage += '1. Acesse: https://myaccount.google.com/permissions\n';
            reauthMessage += '2. Revogue o acesso do FinMemory\n';
            reauthMessage += '3. Clique em "Sair" aqui no app\n';
            reauthMessage += '4. Faça login novamente e autorize o acesso aos e-mails';
          } else {
            reauthMessage += '\n\nPor favor, desconecte e conecte o Gmail novamente.';
          }
          
          alert(reauthMessage);
          return;
        }
        
        throw new Error(`${errorMsg}${errorDetails ? `: ${errorDetails}` : ''}`);
      }

      const data = await response.json();

      if (data.success) {
        const processed = parseInt(data.processed) || 0;
        const skipped = parseInt(data.skipped) || 0;
        const errors = parseInt(data.errors) || 0;
        const total = parseInt(data.total) || 0;
        const transactionsInDb = parseInt(data.transactionsInDb) || 0;
        
        const result = {
          processed,
          skipped,
          errors,
          total,
          transactionsInDb,
          timestamp: new Date()
        };
        
        setLastSyncResult(result);
        
        setSyncLogs(prev => [
          ...prev,
          { type: 'success', message: `✅ Sincronização concluída!`, timestamp: new Date() },
          { type: 'info', message: `📧 E-mails encontrados: ${total}`, timestamp: new Date() },
          { type: processed > 0 ? 'success' : 'info', message: `📄 Notas processadas: ${processed}`, timestamp: new Date() },
          ...(skipped > 0 ? [{ type: 'info', message: `⏭️ Ignorados (GPT sem dados): ${skipped}`, timestamp: new Date() }] : []),
          ...(errors > 0 ? [{ type: 'warning', message: `⚠️ Erros: ${errors}`, timestamp: new Date() }] : []),
          { type: 'info', message: `💾 Total de transações no banco: ${transactionsInDb}`, timestamp: new Date() }
        ]);
        
        console.log('📊 Resultado da sincronização:', result);

        let message = '';
        if (processed > 0) {
          message = `✅ ${processed} nota${processed > 1 ? 's' : ''} fiscal${processed > 1 ? 'is' : ''} processada${processed > 1 ? 's' : ''}!`;
          if (skipped > 0) {
            message += `\n⏭️ ${skipped} ignorado${skipped > 1 ? 's' : ''} (GPT não conseguiu extrair dados).`;
          }
          if (errors > 0) {
            message += `\n⚠️ ${errors} erro${errors > 1 ? 's' : ''} durante o processamento.`;
          }
          if (transactionsInDb > 0) {
            message += `\n📊 Total de transações no banco: ${transactionsInDb}`;
          }
        } else if (total > 0) {
          message = `ℹ️ ${total} e-mail${total > 1 ? 's' : ''} encontrado${total > 1 ? 's' : ''}, mas nenhuma nota fiscal nova foi processada.`;
          if (skipped > 0) {
            message += `\n⏭️ ${skipped} ignorado${skipped > 1 ? 's' : ''} (GPT não conseguiu extrair dados).`;
          }
          if (errors > 0) {
            message += `\n⚠️ ${errors} erro${errors > 1 ? 's' : ''} durante o processamento.`;
          }
        } else {
          message = 'ℹ️ Nenhum e-mail com nota fiscal encontrado.';
        }
        
        alert(message);
        
        // Recarrega as transações após um pequeno delay para garantir que foram salvas
        setTimeout(async () => {
          setSyncLogs(prev => [...prev, { type: 'info', message: '🔄 Recarregando transações...', timestamp: new Date() }]);
          await loadTransactions(userId);
          setSyncLogs(prev => [...prev, { type: 'success', message: '✅ Transações recarregadas!', timestamp: new Date() }]);
        }, 1000);
      } else {
        const errorMsg = data.error || 'Erro desconhecido';
        const errorDetails = data.details || '';
        const requiresReauth = data.requiresReauth || false;
        
        console.error('Erro ao sincronizar:', errorMsg, errorDetails);
        setSyncLogs(prev => [...prev, { 
          type: 'error', 
          message: `❌ Erro: ${errorMsg}${errorDetails ? ` (${errorDetails})` : ''}`, 
          timestamp: new Date() 
        }]);
        
        let alertMessage = `❌ Erro ao sincronizar: ${errorMsg}`;
        if (errorDetails) {
          alertMessage += `\n\nDetalhes: ${errorDetails}`;
        }
        if (requiresReauth) {
          alertMessage += `\n\n⚠️ Solução: Desconecte e conecte o Gmail novamente.`;
        }
        
        alert(alertMessage);
      }
    } catch (error) {
      console.error('Erro na sincronização:', error);
      
      let errorMessage = error.message || 'Erro desconhecido';
      if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
        errorMessage = 'Erro de conexão. Verifique sua internet e tente novamente.';
      } else if (error.message?.includes('500')) {
        errorMessage = 'Erro no servidor. Tente novamente em alguns instantes.';
      }
      
      setSyncLogs(prev => [...prev, { 
        type: 'error', 
        message: `❌ Erro: ${errorMessage}`, 
        timestamp: new Date() 
      }]);
      alert(`❌ Erro ao sincronizar: ${errorMessage}`);
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

  const handleDebugConnection = async () => {
    console.log('🔍 Iniciando diagnóstico de conexão...');
    const supabase = getSupabase();
    
    if (!supabase) {
      alert('❌ Supabase não está disponível. Verifique as variáveis de ambiente.');
      return;
    }

    const debug = {
      supabaseConfigured: !!supabase,
      userId: userId,
      timestamp: new Date().toISOString(),
      tests: []
    };

    // Teste 1: Verificar se consegue acessar a tabela transacoes
    try {
      const { data, error, count } = await supabase
        .from('transacoes')
        .select('*', { count: 'exact', head: true });
      
      debug.tests.push({
        name: 'Acesso à tabela transacoes',
        success: !error,
        error: error?.message,
        count: count
      });
    } catch (e) {
      debug.tests.push({
        name: 'Acesso à tabela transacoes',
        success: false,
        error: e.message
      });
    }

    // Teste 2: Buscar transações do usuário atual
    if (userId) {
      try {
        const { data, error } = await supabase
          .from('transacoes')
          .select('id, user_id, estabelecimento, total')
          .eq('user_id', userId)
          .limit(5);
        
        debug.tests.push({
          name: `Buscar transações do user_id: ${userId}`,
          success: !error,
          error: error?.message,
          found: data?.length || 0,
          data: data
        });
      } catch (e) {
        debug.tests.push({
          name: `Buscar transações do user_id: ${userId}`,
          success: false,
          error: e.message
        });
      }
    }

    // Teste 3: Buscar todas as transações (sem filtro)
    try {
      const { data, error } = await supabase
        .from('transacoes')
        .select('id, user_id, estabelecimento')
        .limit(5);
      
      debug.tests.push({
        name: 'Buscar todas as transações (sem filtro)',
        success: !error,
        error: error?.message,
        found: data?.length || 0,
        sampleUserIds: data?.map(t => t.user_id) || []
      });
    } catch (e) {
      debug.tests.push({
        name: 'Buscar todas as transações (sem filtro)',
        success: false,
        error: e.message
      });
    }

    setDebugInfo(debug);
    console.log('📊 Resultado do diagnóstico:', debug);
    
    const successCount = debug.tests.filter(t => t.success).length;
    const totalTests = debug.tests.length;
    
    alert(`🔍 Diagnóstico concluído!\n\nTestes passados: ${successCount}/${totalTests}\n\nVerifique o console para mais detalhes.`);
  };

  const isAuthenticated = status === 'authenticated' && session;
  const isLoading = status === 'loading';

  const totalBalance = useMemo(() => {
    return (transactions || []).reduce((sum, t) => sum + (Number(t.total) || 0), 0);
  }, [transactions]);

  return (
    <div className="min-h-screen bg-background text-foreground dark">
      <div className="max-w-md mx-auto px-5 pb-24 pt-5">
        <Nav className="text-muted-foreground" />

        {isLoading ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-accent" />
            <p className="text-muted-foreground">Carregando sessão...</p>
          </div>
        ) : !isAuthenticated ? (
          <div className="flex flex-col items-center justify-center min-h-[70vh] gap-6 text-center px-4">
            <div className="w-20 h-20 rounded-full bg-accent/20 flex items-center justify-center">
              <Mail className="h-10 w-10 text-accent" />
            </div>
            <div>
              <h1 className="text-2xl font-bold mb-2">FinMemory</h1>
              <p className="text-muted-foreground">
                Conecte seu Gmail para buscar suas notas fiscais automaticamente
              </p>
            </div>
            <button
              type="button"
              onClick={handleConnectGmail}
              className="px-6 py-3 bg-accent hover:bg-accent/90 text-accent-foreground rounded-xl font-semibold inline-flex items-center gap-2"
            >
              <Mail className="h-5 w-5" />
              Conectar Gmail
            </button>
          </div>
        ) : (
          <>
            <DashboardHeader user={session.user} onSignOut={handleDisconnect} />
            <BalanceCard balance={totalBalance} className="mb-6" />
            <QuickActions onSync={() => handleSyncEmails(false)} syncing={syncing} className="mb-8" />

            {loading ? (
              <div className="space-y-4">
                <div className="bg-card rounded-[24px] p-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-4 py-4">
                      <div className="h-10 w-10 rounded-full bg-muted animate-pulse" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-3/4 bg-muted rounded animate-pulse" />
                        <div className="h-3 w-1/2 bg-muted rounded animate-pulse" />
                      </div>
                      <div className="h-4 w-20 bg-muted rounded animate-pulse" />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <TransactionList transactions={transactions} />
            )}

            {syncLogs.length > 0 && !showLogs && (
              <button
                type="button"
                onClick={() => setShowLogs(true)}
                className="mt-4 px-4 py-2 bg-muted text-foreground border border-border rounded-xl text-sm font-medium"
              >
                📋 Ver Logs
              </button>
            )}
            <button
              type="button"
              onClick={handleDebugConnection}
              className="mt-2 px-4 py-2 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 border border-yellow-300 dark:border-yellow-700 rounded-xl text-sm font-medium"
              title="Testar conexão com Supabase e diagnóstico"
            >
              🔍 Debug
            </button>
          </>
        )}

        {isAuthenticated && (
          <>
        {/* Debug Info Panel */}
        {debugInfo && (
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '20px',
            marginBottom: '24px',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px'
            }}>
              <h3 style={{ margin: 0, fontSize: '20px', color: '#333' }}>
                🔍 Diagnóstico de Conexão
              </h3>
              <button
                onClick={() => setDebugInfo(null)}
                style={{
                  background: '#f0f0f0',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px 16px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  color: '#666'
                }}
              >
                ✕ Fechar
              </button>
            </div>
            
            <div style={{
              background: '#f8f9fa',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '16px',
              fontSize: '14px'
            }}>
              <div><strong>User ID:</strong> {debugInfo.userId || 'Não definido'}</div>
              <div><strong>Supabase Configurado:</strong> {debugInfo.supabaseConfigured ? '✅ Sim' : '❌ Não'}</div>
              <div><strong>Timestamp:</strong> {new Date(debugInfo.timestamp).toLocaleString('pt-BR')}</div>
            </div>

            <div>
              <h4 style={{ margin: '0 0 12px 0', fontSize: '16px', color: '#333' }}>
                Resultados dos Testes:
              </h4>
              {debugInfo.tests.map((test, index) => (
                <div
                  key={index}
                  style={{
                    background: test.success ? '#d4edda' : '#f8d7da',
                    borderLeft: `4px solid ${test.success ? '#28a745' : '#dc3545'}`,
                    padding: '12px',
                    marginBottom: '8px',
                    borderRadius: '4px',
                    fontSize: '13px'
                  }}
                >
                  <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                    {test.success ? '✅' : '❌'} {test.name}
                  </div>
                  {test.error && (
                    <div style={{ color: '#721c24', fontSize: '12px', marginTop: '4px' }}>
                      Erro: {test.error}
                    </div>
                  )}
                  {test.found !== undefined && (
                    <div style={{ color: '#155724', fontSize: '12px', marginTop: '4px' }}>
                      Encontrado: {test.found} registro(s)
                    </div>
                  )}
                  {test.sampleUserIds && test.sampleUserIds.length > 0 && (
                    <div style={{ color: '#155724', fontSize: '12px', marginTop: '4px' }}>
                      User IDs encontrados: {test.sampleUserIds.join(', ')}
                    </div>
                  )}
                  {test.data && test.data.length > 0 && (
                    <details style={{ marginTop: '8px' }}>
                      <summary style={{ cursor: 'pointer', fontSize: '12px' }}>Ver dados</summary>
                      <pre style={{
                        background: '#fff',
                        padding: '8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        overflow: 'auto',
                        maxHeight: '200px',
                        marginTop: '8px'
                      }}>
                        {JSON.stringify(test.data, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sync Logs Panel */}
        {(showLogs && syncLogs.length > 0) && (
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '20px',
            marginBottom: '24px',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
            maxHeight: '400px',
            overflowY: 'auto'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px'
            }}>
              <h3 style={{ margin: 0, fontSize: '20px', color: '#333' }}>
                📋 Logs da Sincronização
              </h3>
              <button
                onClick={() => setShowLogs(false)}
                style={{
                  background: '#f0f0f0',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px 16px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  color: '#666'
                }}
              >
                ✕ Fechar
              </button>
            </div>
            
            {lastSyncResult && (
              <div style={{
                background: '#f8f9fa',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '16px',
                border: '2px solid #e9ecef'
              }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '16px', color: '#333' }}>
                  📊 Resumo da Última Sincronização
                </h4>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                  gap: '12px',
                  fontSize: '14px'
                }}>
                  <div>
                    <strong style={{ color: '#666' }}>E-mails encontrados:</strong>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#667eea' }}>
                      {lastSyncResult.total}
                    </div>
                  </div>
                  <div>
                    <strong style={{ color: '#666' }}>Notas processadas:</strong>
                    <div style={{ 
                      fontSize: '18px', 
                      fontWeight: 'bold', 
                      color: lastSyncResult.processed > 0 ? '#28a745' : '#666' 
                    }}>
                      {lastSyncResult.processed}
                    </div>
                  </div>
                  {lastSyncResult.skipped > 0 && (
                    <div>
                      <strong style={{ color: '#666' }}>Ignorados (sem dados):</strong>
                      <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#6c757d' }}>
                        {lastSyncResult.skipped}
                      </div>
                    </div>
                  )}
                  {lastSyncResult.errors > 0 && (
                    <div>
                      <strong style={{ color: '#666' }}>Erros:</strong>
                      <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#dc3545' }}>
                        {lastSyncResult.errors}
                      </div>
                    </div>
                  )}
                  <div>
                    <strong style={{ color: '#666' }}>Total no banco:</strong>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#667eea' }}>
                      {lastSyncResult.transactionsInDb}
                    </div>
                  </div>
                </div>
                <div style={{
                  marginTop: '12px',
                  fontSize: '12px',
                  color: '#999'
                }}>
                  {lastSyncResult.timestamp.toLocaleString('pt-BR')}
                </div>
              </div>
            )}

            <div style={{
              fontFamily: 'monospace',
              fontSize: '13px',
              lineHeight: '1.6'
            }}>
              {syncLogs.map((log, index) => {
                const colors = {
                  info: { bg: '#e7f3ff', border: '#b3d9ff', text: '#0066cc' },
                  success: { bg: '#d4edda', border: '#c3e6cb', text: '#155724' },
                  warning: { bg: '#fff3cd', border: '#ffeaa7', text: '#856404' },
                  error: { bg: '#f8d7da', border: '#f5c6cb', text: '#721c24' }
                };
                const color = colors[log.type] || colors.info;
                
                return (
                  <div
                    key={index}
                    style={{
                      background: color.bg,
                      borderLeft: `4px solid ${color.border}`,
                      padding: '10px 14px',
                      marginBottom: '8px',
                      borderRadius: '4px',
                      color: color.text,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <span>{log.message}</span>
                    <span style={{
                      fontSize: '11px',
                      color: '#999',
                      marginLeft: '12px'
                    }}>
                      {log.timestamp.toLocaleTimeString('pt-BR')}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
          </>
        )}
      </div>

      {/* Botão Flutuante - Escanear Nota Fiscal */}
      {isAuthenticated && !isLoading && (
        <a
          href="/add-receipt"
          className="fixed bottom-6 right-6 w-14 h-14 bg-accent hover:bg-accent/90 rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform text-accent-foreground z-10"
          title="Escanear Nota Fiscal"
        >
          <Camera className="h-6 w-6" />
        </a>
      )}
    </div>
  );
}
