import { useEffect, useState, useCallback, useMemo } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { getServerSession } from 'next-auth/next';
import { createClient } from '@supabase/supabase-js';
import { Loader2, Mail, Camera, MapPin, X, Trash2, RotateCcw, Search, Calculator } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { BottomNav } from '../components/BottomNav';
import { DashboardHeader } from '../components/dashboard/DashboardHeader';
import { BalanceCard } from '../components/dashboard/BalanceCard';
import { QuickActions } from '../components/dashboard/QuickActions';
import { TransactionList } from '../components/dashboard/TransactionList';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../components/ui/Sheet';
import { authOptions } from './api/auth/[...nextauth]';
import { canAccess } from '../lib/access-server';
import CobrancasDoMes from '../components/dashboard/CobrancasDoMes';
import { DashboardOnboardingTour } from '../components/onboarding/DashboardOnboardingTour';
import {
  isDashboardOnboardingDoneLocal,
  setDashboardOnboardingDoneLocal,
} from '../lib/dashboardOnboardingStorage';
import { useOpenFinanceSummary } from '../hooks/useOpenFinance';
import OpenFinanceTransactionList from '../components/OpenFinance/TransactionList';

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

function getYearMonthKey(value) {
  if (!value) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}`;
    const brMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (brMatch) return `${brMatch[3]}-${brMatch[2]}`;
  }
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function getLatestYear(monthKeys) {
  let latest = null;
  monthKeys.forEach((ym) => {
    const year = parseInt(ym.split('-')[0], 10);
    if (!Number.isNaN(year)) {
      latest = latest === null ? year : Math.max(latest, year);
    }
  });
  return latest;
}

export async function getServerSideProps(ctx) {
  try {
    const session = await getServerSession(ctx.req, ctx.res, authOptions);
    if (!session?.user?.email) {
      return { redirect: { destination: '/login?callbackUrl=/dashboard', permanent: false } };
    }
    const allowed = await canAccess(session.user.email);
    if (!allowed) {
      return { redirect: { destination: '/?msg=nao-cadastrado', permanent: false } };
    }
    return { props: {} };
  } catch (err) {
    console.error('[dashboard getServerSideProps]', err);
    return { redirect: { destination: '/login?callbackUrl=/dashboard', permanent: false } };
  }
}

export default function Dashboard() {
  const { data: session, status } = useSession();
  const openFinance = useOpenFinanceSummary({ enabled: status === 'authenticated' });
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [userId, setUserId] = useState(null);
  const [syncLogs, setSyncLogs] = useState([]);
  const [lastSyncResult, setLastSyncResult] = useState(null);
  const [showLogs, setShowLogs] = useState(false);
  const [debugInfo, setDebugInfo] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(null); // 'YYYY-MM' ou null = todos
  const [tipGmailDismissed, setTipGmailDismissed] = useState(true);
  const [tipMapDismissed, setTipMapDismissed] = useState(true);
  const [showTrashSheet, setShowTrashSheet] = useState(false);
  const [deletedTransactions, setDeletedTransactions] = useState([]);
  const [trashLoading, setTrashLoading] = useState(false);
  const [restoringId, setRestoringId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [onboardingTourOpen, setOnboardingTourOpen] = useState(false);

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
        if (typeof window !== 'undefined') localStorage.setItem('user_id', session.user.supabaseId);
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
          if (typeof window !== 'undefined') localStorage.setItem('user_id', data.id);
        } else {
          console.warn('⚠️ Nenhum usuário encontrado para este email');
          console.warn('   Isso pode acontecer se o usuário ainda não fez login pela primeira vez');
        }
      };
      fetchUserId().catch((err) => console.warn('fetchUserId:', err?.message || err));
    }
  }, [session]);

  useEffect(() => {
    if (status !== 'authenticated' || !userId) return undefined;
    if (typeof window !== 'undefined' && isDashboardOnboardingDoneLocal(userId)) {
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('/api/user/onboarding', { credentials: 'include' });
        if (r.ok) {
          const j = await r.json();
          if (!cancelled && j.showTour === true) setOnboardingTourOpen(true);
          return;
        }
        if (r.status === 401) return;
      } catch (_) {
        /* rede */
      }
      // Fallback: erro de servidor ou rede — uma vez por browser (ex.: coluna ainda não no PostgREST)
      if (!cancelled && typeof window !== 'undefined' && !isDashboardOnboardingDoneLocal(userId)) {
        setOnboardingTourOpen(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, status]);

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
        .is('deleted_at', null)
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
        .is('deleted_at', null)
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
            .is('deleted_at', null)
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

  const loadDeletedTransactions = useCallback(async (uid) => {
    if (!uid) return;
    const supabase = getSupabase();
    if (!supabase) return;
    setTrashLoading(true);
    try {
      const { data, error } = await supabase
        .from('transacoes')
        .select('id, estabelecimento, total, data, deleted_at')
        .eq('user_id', uid)
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false });
      if (error) throw error;
      setDeletedTransactions(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Erro ao carregar lixeira:', e);
      setDeletedTransactions([]);
    } finally {
      setTrashLoading(false);
    }
  }, []);

  const handleRestore = useCallback(async (id) => {
    if (!userId) return;
    setRestoringId(id);
    try {
      const res = await fetch(`/api/transactions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, restore: true })
      });
      const json = await res.json();
      if (json.success) {
        loadDeletedTransactions(userId);
        loadTransactions(userId);
      }
    } catch (e) {
      console.error('Erro ao restaurar:', e);
    } finally {
      setRestoringId(null);
    }
  }, [userId, loadDeletedTransactions, loadTransactions]);

  const handleSyncEmails = useCallback(async (isFirstSync = false) => {
    if (!userId) {
      if (session?.user) {
        alert(
          '⏳ Sua conta ainda não está vinculada ao servidor.\n\n' +
          'Isso costuma acontecer quando as variáveis do Supabase não estão configuradas no Cloud Run.\n\n' +
          '• Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no serviço Cloud Run (Variáveis e segredos).\n' +
          '• Depois, faça logout e login de novo, e tente sincronizar outra vez.\n\n' +
          'Veja o arquivo DEPLOY-CLOUD-RUN.md no projeto.'
        );
      } else {
        alert('⚠️ Você precisa entrar primeiro.\n\nUse email e senha para acessar a sua conta.');
      }
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
  }, [userId, session?.user, loadTransactions, syncing]);

  // Load transactions when userId changes
  useEffect(() => {
    if (userId) {
      loadTransactions(userId);
    }
  }, [userId, loadTransactions]);

  // Onboarding: mostrar dicas uma vez (localStorage)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!localStorage.getItem('finmemory_tip_gmail')) setTipGmailDismissed(false);
    if (!localStorage.getItem('finmemory_tip_map')) setTipMapDismissed(false);
  }, []);

  // Check URL params for first sync (só no browser)
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return;
      const urlParams = new URLSearchParams(window.location.search);
      const success = urlParams.get('success');
      const error = urlParams.get('error');
      if (error) {
        console.error('Erro de autenticação:', error);
        window.history.replaceState({}, '', '/dashboard');
        return;
      }
      if (success === 'true' && userId) {
        window.history.replaceState({}, '', '/dashboard');
        setTimeout(() => handleSyncEmails(true), 1000);
      }
    } catch (e) {
      console.warn('[dashboard] URL params check:', e?.message || e);
    }
  }, [userId, handleSyncEmails]);

  const handleConnectGmail = () => {
    if (typeof window !== 'undefined') window.location.href = '/login?callbackUrl=/mapa';
  };

  const handleDisconnect = async () => {
    if (typeof window !== 'undefined' && confirm('⚠️ Deseja realmente desconectar? Suas transações não serão perdidas.')) {
      try {
        if (typeof window !== 'undefined') localStorage.removeItem('user_id');
        setUserId(null);
        setTransactions([]);
        await signOut({ callbackUrl: '/' });
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
    
    if (typeof window !== 'undefined') alert(`🔍 Diagnóstico concluído!\n\nTestes passados: ${successCount}/${totalTests}\n\nVerifique o console para mais detalhes.`);
  };

  const isAuthenticated = status === 'authenticated' && session;
  const isLoading = status === 'loading';

  // Meses únicos das transações apenas do ano mais recente (evita lista com anos antigos)
  const availableMonths = useMemo(() => {
    const set = new Set();
    (transactions || []).forEach((t) => {
      const ym = getYearMonthKey(t.data);
      if (ym) set.add(ym);
    });
    const allMonths = Array.from(set);
    const latestYear = getLatestYear(allMonths);
    const filtered = latestYear ? allMonths.filter((ym) => ym.startsWith(`${latestYear}-`)) : allMonths;
    return filtered.sort((a, b) => b.localeCompare(a));
  }, [transactions]);

  // Transações filtradas pelo mês selecionado
  const filteredTransactions = useMemo(() => {
    if (!selectedMonth) return transactions || [];
    return (transactions || []).filter((t) => {
      const ym = getYearMonthKey(t.data);
      return ym === selectedMonth;
    });
  }, [transactions, selectedMonth]);

  // Filtro por busca (estabelecimento, categoria ou nome do produto)
  const searchFilteredTransactions = useMemo(() => {
    if (!searchQuery.trim()) return filteredTransactions;
    const q = searchQuery.trim().toLowerCase();
    return (filteredTransactions || []).filter((t) => {
      if ((t.estabelecimento || '').toLowerCase().includes(q)) return true;
      if ((t.categoria || '').toLowerCase().includes(q)) return true;
      const produtos = Array.isArray(t.produtos) ? t.produtos : [];
      return produtos.some(
        (p) => (p?.descricao || p?.nome || '').toLowerCase().includes(q)
      );
    });
  }, [filteredTransactions, searchQuery]);

  const totalBalance = useMemo(() => {
    return (filteredTransactions || []).reduce((sum, t) => sum + (Number(t.total) || 0), 0);
  }, [filteredTransactions]);

  const transactionCount = (transactions || []).length;
  const userLevel = transactionCount < 10 ? 'Iniciante' : transactionCount < 50 ? 'Regular' : 'Expert';

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-md mx-auto px-5 pb-24 pt-5">
        <h1 className="sr-only">FinMemory - Dashboard</h1>
        <BottomNav />

        {isLoading ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-[#2ECC49]" />
            <p className="text-[#666]">Carregando sessão...</p>
          </div>
        ) : !isAuthenticated ? (
          <div className="flex flex-col items-center justify-center min-h-[70vh] gap-6 text-center px-4">
            <Image src="/logo.png" alt="FinMemory" width={80} height={80} className="object-contain" />
            <div className="w-20 h-20 rounded-full bg-[#e8f5e9] flex items-center justify-center">
              <Mail className="h-10 w-10 text-[#28a745]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold mb-2 text-[#333]">FinMemory</h1>
              <p className="text-[#666]">Entre com email e senha para acessar seu painel.</p>
            </div>
            <button
              type="button"
              onClick={handleConnectGmail}
              className="px-6 py-3 bg-gradient-google text-white hover:opacity-90 rounded-xl font-semibold inline-flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#28a745] focus-visible:ring-offset-2 focus-visible:ring-offset-[#f8f9fa]"
              aria-label="Entrar com email e senha"
            >
              <Mail className="h-5 w-5" aria-hidden />
              Entrar
            </button>
          </div>
        ) : (
          <>
            <DashboardHeader user={session.user} onSignOut={handleDisconnect} />
            {/* Nível (gamificação leve) */}
            {transactionCount >= 0 && (
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-[#666]">
                  {transactionCount} transação{transactionCount !== 1 ? 'ões' : ''}
                </span>
                <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-[#2ECC49]/15 text-[#2ECC49]" title="Quanto mais você sincroniza, mais sobe de nível">
                  Nível {userLevel}
                </span>
              </div>
            )}
            {/* Dicas contextuais (onboarding) – aparecem uma vez */}
            {!tipGmailDismissed && (
              <div className="mb-4 p-4 rounded-xl bg-[#e8f5e9] border border-[#c8e6c9] text-[#2e7d32] text-sm relative">
                <button type="button" onClick={() => { localStorage.setItem('finmemory_tip_gmail', '1'); setTipGmailDismissed(true); }} className="absolute top-2 right-2 p-1 rounded-full hover:bg-[#c8e6c9] text-[#2e7d32]" aria-label="Fechar">
                  <X className="h-4 w-4" />
                </button>
                <p className="font-medium mb-1">Conecte o Gmail</p>
                <p className="text-xs opacity-90">Sincronize suas notas fiscais automaticamente pelos e-mails. Seus dados ficam seguros.</p>
                <button type="button" onClick={() => { localStorage.setItem('finmemory_tip_gmail', '1'); setTipGmailDismissed(true); }} className="mt-2 text-xs font-semibold underline">Entendi</button>
              </div>
            )}
            {!tipMapDismissed && (
              <div className="mb-4 p-4 rounded-xl bg-[#e3f2fd] border border-[#bbdefb] text-[#1565c0] text-sm relative">
                <button type="button" onClick={() => { localStorage.setItem('finmemory_tip_map', '1'); setTipMapDismissed(true); }} className="absolute top-2 right-2 p-1 rounded-full hover:bg-[#bbdefb] text-[#1565c0]" aria-label="Fechar">
                  <X className="h-4 w-4" />
                </button>
                <p className="font-medium mb-1">Mapa de preços</p>
                <p className="text-xs opacity-90">Veja onde está mais barato e pergunte à comunidade em tempo real.</p>
                <Link href="/mapa" onClick={() => { localStorage.setItem('finmemory_tip_map', '1'); setTipMapDismissed(true); }} className="inline-block mt-2 text-xs font-semibold underline">Ver mapa</Link>
              </div>
            )}
            <div className="mb-4">
              <BalanceCard
                balance={totalBalance}
                className="mb-0"
                label={selectedMonth ? 'Gasto do mês' : undefined}
              />
            </div>

            <section
              className="mb-6 rounded-2xl border border-[#e5e7eb] bg-white p-4 shadow-[0_8px_24px_rgba(0,0,0,0.06)]"
              aria-label="Open Finance"
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <h2 className="text-sm font-semibold text-[#333] m-0">Open Finance</h2>
                  <p className="text-xs text-[#666] mt-0.5 m-0">Contas e movimentos do banco (Pluggy).</p>
                </div>
                <Link
                  href="/settings"
                  className="text-xs font-semibold text-[#2ECC49] whitespace-nowrap shrink-0 hover:underline"
                >
                  Configurar
                </Link>
              </div>
              {openFinance.error && (
                <p className="text-xs text-red-600 mb-3">
                  {openFinance.error?.message || 'Erro ao carregar Open Finance.'}
                </p>
              )}
              {openFinance.data?.syncing && (
                <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 mb-3">
                  A sincronizar dados com a instituição… os valores podem atualizar em instantes.
                </p>
              )}
              {!openFinance.loading && (openFinance.data?.accounts || []).length > 0 && (
                <ul className="space-y-2 mb-4">
                  {(openFinance.data.accounts || []).map((a) => {
                    const bal =
                      a.balance != null && Number.isFinite(Number(a.balance))
                        ? new Intl.NumberFormat('pt-BR', {
                            style: 'currency',
                            currency: a.currency_code || 'BRL',
                          }).format(Number(a.balance))
                        : '—';
                    return (
                      <li
                        key={a.id}
                        className="flex items-center justify-between gap-2 text-sm py-2 border-b border-[#f0f0f0] last:border-0"
                      >
                        <span className="text-[#333] font-medium truncate">{a.name || 'Conta'}</span>
                        <span className="text-[#333] tabular-nums shrink-0">{bal}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
              {!openFinance.loading && openFinance.data?.month && (
                <div className="grid grid-cols-2 gap-2 mb-4 text-xs">
                  <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2">
                    <p className="text-emerald-800 font-medium m-0 mb-0.5">Receitas (mês)</p>
                    <p className="text-emerald-900 font-semibold m-0">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                        openFinance.data.month.incomeTotal || 0
                      )}
                    </p>
                  </div>
                  <div className="rounded-xl bg-red-50 border border-red-100 px-3 py-2">
                    <p className="text-red-800 font-medium m-0 mb-0.5">Despesas (mês)</p>
                    <p className="text-red-900 font-semibold m-0">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                        openFinance.data.month.expenseTotal || 0
                      )}
                    </p>
                  </div>
                </div>
              )}
              <OpenFinanceTransactionList
                transactions={openFinance.data?.recentTransactions}
                loading={openFinance.loading}
              />
            </section>

            <Link
              href="/calculadora"
              className="flex items-center justify-center gap-2 w-full py-3 mb-4 rounded-2xl border border-[#28a745]/40 bg-[#0b1220] text-white font-semibold text-sm shadow-[0_8px_24px_rgba(0,0,0,0.15)] hover:bg-[#0f172a] transition-colors"
            >
              <Calculator className="h-5 w-5 text-[#28a745]" aria-hidden />
              Calculadora de economia
            </Link>

            {/* Cobranças do mês */}
            <CobrancasDoMes
              userId={userId}
              selectedMonth={selectedMonth}
              onAfterPayment={() => loadTransactions(userId)}
            />

            {/* (removido) Acesso rápido ao mapa: agora foco em Cobranças do mês */}
            {/* Filtro por mês */}
            {availableMonths.length > 0 && (
              <div className="mb-4">
                <label htmlFor="month-filter" className="block text-sm font-medium text-[#333] mb-2">
                  Ver gastos por mês
                </label>
                <select
                  id="month-filter"
                  value={selectedMonth || ''}
                  onChange={(e) => setSelectedMonth(e.target.value || null)}
                  className="w-full px-4 py-2.5 rounded-xl border border-[#e5e7eb] bg-white text-[#333] text-sm focus:outline-none focus:ring-2 focus:ring-[#2ECC49] focus:border-transparent"
                >
                  <option value="">Todos os meses</option>
                  {availableMonths.map((ym) => {
                    const [y, m] = ym.split('-');
                    const date = new Date(parseInt(y, 10), parseInt(m, 10) - 1);
                    const label = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
                    return (
                      <option key={ym} value={ym}>
                        {label.charAt(0).toUpperCase() + label.slice(1)}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}
            <p className="text-sm font-semibold text-neutral-800 tracking-tight mb-3">Ações rápidas</p>
            <QuickActions className="mb-4" />

            {/* Lixeira: notas excluídas – restaurar por engano */}
            <button
              type="button"
              onClick={() => { setShowTrashSheet(true); loadDeletedTransactions(userId); }}
              className="flex items-center gap-3 w-full p-4 rounded-xl bg-white border border-[#e5e7eb] shadow-card-lovable mb-8 hover:bg-[#f8f9fa] transition-colors text-left"
            >
              <div className="w-12 h-12 rounded-xl bg-[#fef2f2] flex items-center justify-center text-[#dc2626] shrink-0">
                <Trash2 className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-[#333]">Lixeira</p>
                <p className="text-xs text-[#666]">Excluiu uma nota sem querer? Restaure daqui.</p>
              </div>
              <span className="text-[#666] text-sm shrink-0">Abrir</span>
            </button>

            {isAuthenticated && !userId && (
              <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-sm">
                <p className="font-semibold mb-1">📧 Gmail não consegue sincronizar</p>
                <p className="mb-2">Sua conta ainda não está vinculada no servidor. Para o app ler o Gmail, configure as variáveis do Supabase no Cloud Run:</p>
                <ul className="list-disc list-inside text-xs space-y-0.5 mb-2">
                  <li>NEXT_PUBLIC_SUPABASE_URL</li>
                  <li>SUPABASE_SERVICE_ROLE_KEY</li>
                </ul>
                <p className="text-xs">Cloud Run → finmemory → Editar e implantar nova revisão → Variáveis e segredos. Depois faça logout e login de novo.</p>
              </div>
            )}

            {loading ? (
              <div className="space-y-4" aria-live="polite" aria-busy="true">
                <div className="card-lovable p-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-4 py-4">
                      <div className="h-10 w-10 rounded-full bg-[#e5e7eb] animate-pulse shrink-0" />
                      <div className="flex-1 space-y-2 min-w-0">
                        <div className="h-4 max-w-[75%] bg-[#e5e7eb] rounded animate-pulse" />
                        <div className="h-3 max-w-[50%] bg-[#e5e7eb] rounded animate-pulse" />
                      </div>
                      <div className="h-4 w-20 bg-[#e5e7eb] rounded animate-pulse shrink-0" />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {filteredTransactions.length > 0 && (
                  <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#999] pointer-events-none" aria-hidden />
                    <input
                      type="search"
                      placeholder="Buscar por estabelecimento, categoria ou produto..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-[#e5e7eb] bg-white text-[#333] placeholder:text-[#999] focus:outline-none focus:ring-2 focus:ring-[#2ECC49]/50 focus:border-[#2ECC49]"
                      aria-label="Buscar transações por estabelecimento, categoria ou produto"
                    />
                  </div>
                )}
                <TransactionList
                  transactions={searchFilteredTransactions}
                  userId={userId}
                  onDeleted={() => loadTransactions(userId)}
                  emptyState={searchQuery.trim() && searchFilteredTransactions.length === 0 ? 'search' : 'default'}
                />
              </>
            )}

            {/* Sheet: Lixeira – listar excluídas e restaurar */}
            <Sheet open={showTrashSheet} onOpenChange={setShowTrashSheet}>
              <SheetContent side="bottom" className="rounded-t-3xl px-5 pb-10 pt-4 max-h-[85vh] overflow-y-auto">
                <SheetHeader className="mb-4">
                  <SheetTitle className="text-lg font-bold text-center flex items-center justify-center gap-2">
                    <Trash2 className="h-5 w-5 text-[#dc2626]" />
                    Lixeira
                  </SheetTitle>
                  <p className="text-sm text-[#666] text-center">
                    Notas excluídas. Toque em &quot;Restaurar&quot; para voltar ao histórico.
                  </p>
                </SheetHeader>
                {trashLoading ? (
                  <div className="flex items-center justify-center py-8 gap-2 text-[#666]">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Carregando...</span>
                  </div>
                ) : deletedTransactions.length === 0 ? (
                  <div className="text-center py-8 text-[#666] text-sm">
                    Nenhuma nota na lixeira.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {deletedTransactions.map((t) => {
                      const total = Number(t.total) || 0;
                      const displayValue = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Math.abs(total));
                      const dataStr = t.data ? new Date(t.data).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
                      const isRestoring = restoringId === t.id;
                      return (
                        <div key={t.id} className="flex items-center justify-between gap-3 p-4 rounded-xl bg-[#f8f9fa] border border-[#e5e7eb]">
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-[#333] truncate">{t.estabelecimento || 'Sem nome'}</p>
                            <p className="text-sm text-[#666]">{dataStr} · {displayValue}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRestore(t.id)}
                            disabled={isRestoring}
                            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#2ECC49] text-white text-sm font-medium hover:bg-[#22a83a] disabled:opacity-50"
                          >
                            {isRestoring ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                            Restaurar
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </SheetContent>
            </Sheet>

            {syncLogs.length > 0 && !showLogs && (
              <button
                type="button"
                onClick={() => setShowLogs(true)}
                className="mt-4 px-4 py-2 bg-[#f8f9fa] text-[#333] border border-[#e5e7eb] rounded-xl text-sm font-medium"
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
          <div className="card-lovable mb-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-[#333] m-0">
                🔍 Diagnóstico de Conexão
              </h3>
              <button
                type="button"
                onClick={() => setDebugInfo(null)}
                className="py-2 px-4 bg-[#f8f9fa] hover:bg-[#e5e7eb] text-[#333] rounded-lg text-sm font-semibold transition-colors"
              >
                ✕ Fechar
              </button>
            </div>
            <div className="bg-[#f8f9fa] rounded-xl p-4 mb-4 text-sm text-[#333]">
              <div><strong>User ID:</strong> {debugInfo.userId || 'Não definido'}</div>
              <div><strong>Supabase Configurado:</strong> {debugInfo.supabaseConfigured ? '✅ Sim' : '❌ Não'}</div>
              <div><strong>Timestamp:</strong> {new Date(debugInfo.timestamp).toLocaleString('pt-BR')}</div>
            </div>
            <div>
              <h4 className="text-base font-semibold text-[#333] mb-3">
                Resultados dos Testes:
              </h4>
              {debugInfo.tests.map((test, index) => (
                <div
                  key={index}
                  className={`p-3 mb-2 rounded-lg text-sm border-l-4 ${test.success ? 'bg-[#d4edda] border-[#28a745] text-[#333]' : 'bg-[#f8d7da] border-[#dc3545] text-[#333]'}`}
                >
                  <div className="font-bold mb-1">
                    {test.success ? '✅' : '❌'} {test.name}
                  </div>
                  {test.error && (
                    <div className="text-[#666] text-xs mt-1">Erro: {test.error}</div>
                  )}
                  {test.found !== undefined && (
                    <div className="text-xs mt-1">Encontrado: {test.found} registro(s)</div>
                  )}
                  {test.sampleUserIds && test.sampleUserIds.length > 0 && (
                    <div className="text-xs mt-1">User IDs: {test.sampleUserIds.join(', ')}</div>
                  )}
                  {test.data && test.data.length > 0 && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs">Ver dados</summary>
                      <pre className="bg-[#f8f9fa] p-2 rounded text-xs overflow-auto max-h-[200px] mt-2">
                        {JSON.stringify(test.data, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sync Logs Panel – Lovable: card branco, bordas #e5e7eb */}
        {(showLogs && syncLogs.length > 0) && (
          <div className="bg-white rounded-2xl p-5 mb-6 shadow-card-lovable max-h-[400px] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="m-0 text-xl text-[#333]">
                📋 Logs da Sincronização
              </h3>
              <button
                type="button"
                onClick={() => setShowLogs(false)}
                className="bg-[#f0f0f0] border-none rounded-lg py-2 px-4 cursor-pointer text-sm font-bold text-[#666] hover:bg-[#e5e7eb] transition-colors"
              >
                ✕ Fechar
              </button>
            </div>

            {lastSyncResult && (
              <div className="bg-[#f8f9fa] rounded-xl p-4 mb-4 border-2 border-[#e9ecef]">
                <h4 className="m-0 mb-3 text-base text-[#333]">
                  📊 Resumo da Última Sincronização
                </h4>
                <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3 text-sm">
                  <div>
                    <strong className="text-[#666]">E-mails encontrados:</strong>
                    <div className="text-lg font-bold text-[#2ECC49]">
                      {lastSyncResult.total}
                    </div>
                  </div>
                  <div>
                    <strong className="text-[#666]">Notas processadas:</strong>
                    <div className={`text-lg font-bold ${lastSyncResult.processed > 0 ? 'text-[#28a745]' : 'text-[#666]'}`}>
                      {lastSyncResult.processed}
                    </div>
                  </div>
                  {lastSyncResult.skipped > 0 && (
                    <div>
                      <strong className="text-[#666]">Ignorados (sem dados):</strong>
                      <div className="text-lg font-bold text-[#6c757d]">
                        {lastSyncResult.skipped}
                      </div>
                    </div>
                  )}
                  {lastSyncResult.errors > 0 && (
                    <div>
                      <strong className="text-[#666]">Erros:</strong>
                      <div className="text-lg font-bold text-[#dc3545]">
                        {lastSyncResult.errors}
                      </div>
                    </div>
                  )}
                  <div>
                    <strong className="text-[#666]">Total no banco:</strong>
                    <div className="text-lg font-bold text-[#2ECC49]">
                      {lastSyncResult.transactionsInDb}
                    </div>
                  </div>
                </div>
                <div className="mt-3 text-xs text-[#999]">
                  {lastSyncResult.timestamp.toLocaleString('pt-BR')}
                </div>
              </div>
            )}

            <div className="font-mono text-[13px] leading-relaxed">
              {syncLogs.map((log, index) => {
                const typeStyles = {
                  info: 'bg-[#e7f3ff] border-l-[#b3d9ff] text-[#0066cc]',
                  success: 'bg-[#d4edda] border-l-[#c3e6cb] text-[#155724]',
                  warning: 'bg-[#fff3cd] border-l-[#ffeaa7] text-[#856404]',
                  error: 'bg-[#f8d7da] border-l-[#f5c6cb] text-[#721c24]'
                };
                const style = typeStyles[log.type] || typeStyles.info;
                return (
                  <div
                    key={index}
                    className={`${style} border-l-4 py-2.5 px-3.5 mb-2 rounded overflow-hidden flex justify-between items-center`}
                  >
                    <span>{log.message}</span>
                    <span className="text-[11px] text-[#999] ml-3">
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

      {/* FAB – Lovable: círculo 60px, gradiente roxo, canto inferior direito */}
      {isAuthenticated && !isLoading && (
        <a
          href="/add-receipt"
          className="fixed bottom-6 right-5 w-16 h-16 rounded-full flex items-center justify-center shadow-fab hover:scale-110 active:scale-95 transition-transform z-10 bg-gradient-primary text-white"
          title="Escanear Nota Fiscal"
        >
          <Camera className="h-7 w-7" />
        </a>
      )}

      {onboardingTourOpen && (
        <DashboardOnboardingTour
          userId={userId}
          onComplete={() => {
            if (userId) setDashboardOnboardingDoneLocal(userId);
            setOnboardingTourOpen(false);
          }}
        />
      )}
    </div>
  );
}
