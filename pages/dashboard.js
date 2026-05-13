import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/router';
import { getServerSession } from 'next-auth/next';
import { createClient } from '@supabase/supabase-js';
import { Loader2, Mail, X, Trash2, RotateCcw, Search } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { DashboardHeader } from '../components/dashboard/DashboardHeader';
import { BalanceCard } from '../components/dashboard/BalanceCard';
import { DashboardQuickAccess } from '../components/dashboard/DashboardQuickAccess';
import { DashboardMissionsProgress } from '../components/dashboard/DashboardMissionsStrip';
import { useMissionsToday } from '../components/missions/MissionsTodayContext';
import { DashboardMonthCarousel } from '../components/dashboard/DashboardMonthCarousel';
import { UnifiedHistoryList } from '../components/dashboard/UnifiedHistoryList';
import { OpenFinanceBankCarousel } from '../components/dashboard/OpenFinanceBankCarousel';
import { FeaturedScanReceiptCTA } from '../components/dashboard/FeaturedScanReceiptCTA';
import { CalculatorDockProvider, useCalculatorDock } from '../components/dashboard/CalculatorDockContext';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../components/ui/Sheet';
import { authOptions } from './api/auth/[...nextauth]';
import { canAccess } from '../lib/access-server';
import CobrancasDoMes from '../components/dashboard/CobrancasDoMes';
import { DashboardOnboardingTour } from '../components/onboarding/DashboardOnboardingTour';
import { DASHBOARD } from '../lib/appMicrocopy';
import {
  isDashboardOnboardingDoneLocal,
  setDashboardOnboardingDoneLocal,
} from '../lib/dashboardOnboardingStorage';
import { useOpenFinanceSummary } from '../hooks/useOpenFinance';
import { usePlan } from '../hooks/usePlan';
import { normalizePluggyMoney } from '../lib/pluggyMoney';

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

function dedupePluggyTransactions(rows) {
  if (!Array.isArray(rows) || rows.length < 2) return Array.isArray(rows) ? rows : [];

  const normalizeMerchant = (value) =>
    String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const sourceScore = (row) => {
    const source = String(row?.source || '').toLowerCase();
    if (source === 'pluggy') return 4;
    if (Array.isArray(row?.produtos) && row.produtos.length > 0) return 3;
    if (source === 'ocr' || source === 'gmail') return 2;
    return 1;
  };

  const withMeta = rows
    .map((row) => {
      const source = String(row?.source || '').toLowerCase();
      const totalRaw = Number(row?.total) || 0;
      const total = source === 'pluggy' ? normalizePluggyMoney(totalRaw) : totalRaw;
      const date = String(row?.data || '').slice(0, 10);
      const hora = String(row?.hora || '').slice(0, 8);
      const hasTime = /^\d{2}:\d{2}:\d{2}$/.test(hora);
      const dateTime = new Date(`${date}T${hasTime ? hora : '12:00:00'}`);
      const ts = Number.isNaN(dateTime.getTime()) ? 0 : dateTime.getTime();
      const merchant = normalizeMerchant(row?.estabelecimento);
      const pluggyId = row?.pluggy_transaction_id != null ? String(row.pluggy_transaction_id) : '';
      return { row: { ...row, total }, source, total, date, hora, hasTime, ts, merchant, pluggyId };
    })
    .sort((a, b) => {
      const ds = sourceScore(b.row) - sourceScore(a.row);
      if (ds !== 0) return ds;
      return b.ts - a.ts;
    });

  const kept = [];
  for (const cand of withMeta) {
    const duplicate = kept.some((k) => {
      if (cand.pluggyId && k.pluggyId && cand.pluggyId === k.pluggyId) return true;
      if (!cand.date || cand.date !== k.date) return false;
      if (Math.abs(Math.abs(cand.total) - Math.abs(k.total)) > 0.03) return false;
      if (cand.merchant && k.merchant && cand.merchant !== k.merchant) return false;
      if (cand.hasTime && k.hasTime) {
        const diffMs = Math.abs(cand.ts - k.ts);
        if (diffMs > 1000 * 60 * 120) return false;
      }
      return true;
    });
    if (!duplicate) kept.push(cand);
  }

  return kept
    .map((x) => x.row)
    .sort((a, b) => {
      const ad = new Date(`${String(a?.data || '').slice(0, 10)}T${String(a?.hora || '').slice(0, 8) || '12:00:00'}`);
      const bd = new Date(`${String(b?.data || '').slice(0, 10)}T${String(b?.hora || '').slice(0, 8) || '12:00:00'}`);
      return bd.getTime() - ad.getTime();
    });
}

function getTransactionTotalForDashboard(row) {
  const raw = Number(row?.total) || 0;
  if (String(row?.source || '').toLowerCase() === 'pluggy') {
    return normalizePluggyMoney(raw);
  }
  return raw;
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

function DashboardCalculadoraLayout({ children }) {
  const { desktopOpen } = useCalculatorDock();
  return (
    <div
      className={
        desktopOpen
          ? 'w-full transition-[padding] duration-300 ease-out lg:pr-[min(300px,28vw)]'
          : 'w-full transition-[padding] duration-300 ease-out'
      }
    >
      {children}
    </div>
  );
}

export default function Dashboard() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const [stripeSuccessBanner, setStripeSuccessBanner] = useState(false);
  const [stripeSyncState, setStripeSyncState] = useState({ loading: false, plan: 'free', active: false, error: '' });
  const [openFinanceAccountId, setOpenFinanceAccountId] = useState(null);
  const openFinance = useOpenFinanceSummary({
    enabled: status === 'authenticated',
    accountId: openFinanceAccountId,
  });
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
  const { can: canPlanFeature, loading: planLoading } = usePlan();
  const canOpenFinance = !planLoading && canPlanFeature('open_finance');
  const [recentPrices, setRecentPrices] = useState([]);
  const [statesData, setStatesData] = useState(null);
  const historyRef = useRef(null);

  // Após retorno do Stripe Checkout: atualiza sessão para refletir novo plano sem re-login
  useEffect(() => {
    if (router.query.stripe !== 'success') return;
    let cancelled = false;
    async function syncPaidPlan() {
      setStripeSuccessBanner(true);
      setStripeSyncState({ loading: true, plan: 'free', active: false, error: '' });
      for (let attempt = 0; attempt < 4; attempt += 1) {
        try {
          const res = await fetch('/api/stripe/sync-plan-status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          });
          const json = await res.json().catch(() => ({}));
          if (!cancelled && res.ok && json?.plano_ativo && json?.plano && json.plano !== 'free') {
            await update();
            setStripeSyncState({
              loading: false,
              plan: String(json.plano),
              active: true,
              error: '',
            });
            break;
          }
        } catch (_) {
          // retry curto
        }
        if (attempt < 3) await new Promise((r) => setTimeout(r, 1200));
      }
      if (!cancelled) {
        setStripeSyncState((prev) =>
          prev.active ? prev : { loading: false, plan: 'free', active: false, error: 'Pagamento recebido. Finalizando ativação do plano...' }
        );
      }
      const url = new URL(window.location.href);
      url.searchParams.delete('stripe');
      window.history.replaceState({}, '', url.toString());
    }
    void syncPaidPlan();
    return () => {
      cancelled = true;
    };
  }, [router.query.stripe, update]);

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
    if (status !== 'authenticated') {
      setOpenFinanceAccountId(null);
    }
  }, [status]);

  useEffect(() => {
    const list = openFinance.data?.accounts;
    if (!openFinanceAccountId || !Array.isArray(list)) return;
    if (!list.some((a) => a.id === openFinanceAccountId)) {
      setOpenFinanceAccountId(null);
    }
  }, [openFinance.data?.accounts, openFinanceAccountId]);

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
            setTransactions(dedupePluggyTransactions(Array.isArray(dataWithoutProducts) ? dataWithoutProducts : []));
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
      
      const transactionsArray = dedupePluggyTransactions(Array.isArray(data) ? data : []);
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
          try {
            await fetch('/api/transactions/auto-link-pluggy', { method: 'POST' });
          } catch (_) {}
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

  // Pareamento após o resumo Open Finance terminar de carregar (inclui mudança de conta / refresh implícito do hook)
  useEffect(() => {
    if (!userId || status !== 'authenticated' || openFinance.loading) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('/api/transactions/auto-link-pluggy', { method: 'POST' });
        const j = await r.json().catch(() => ({}));
        if (cancelled || !j?.ok) return;
        if (Number(j.linked) > 0) await loadTransactions(userId);
      } catch (e) {
        console.warn('[dashboard] auto-link-pluggy (pós Open Finance):', e?.message || e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, status, openFinance.loading, loadTransactions]);

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

  // Fetch states progress for map unlock banner
  useEffect(() => {
    if (status !== 'authenticated') return;
    let cancelled = false;
    fetch('/api/map/states-progress')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (cancelled || !d) return;
        const next = (d.states || []).find((s) => !s.unlocked);
        if (next) setStatesData({ next, total: d.total_users });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [status]);

  // Fetch recent price_points for "Economize agora"
  useEffect(() => {
    if (status !== 'authenticated') return;
    const supabase = getSupabase();
    if (!supabase) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from('price_points')
          .select('id, nome_produto, preco, estabelecimento, created_at')
          .order('created_at', { ascending: false })
          .limit(4);
        if (!cancelled && Array.isArray(data)) setRecentPrices(data);
      } catch (_) {}
    })();
    return () => { cancelled = true; };
  }, [status]);

  const isAuthenticated = status === 'authenticated' && session;
  const isLoading = status === 'loading';
  const { missions: missionsToday } = useMissionsToday();

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

  /** Total por mês (NF-e / OCR) para chips do carrossel */
  const monthTotals = useMemo(() => {
    const map = {};
    (transactions || []).forEach((t) => {
      const ym = getYearMonthKey(t.data);
      if (!ym) return;
      map[ym] = (map[ym] || 0) + getTransactionTotalForDashboard(t);
    });
    return map;
  }, [transactions]);

  // UX estilo app bancário: abrir já no mês mais recente (evita mostrar acumulado histórico gigante).
  useEffect(() => {
    if (selectedMonth) return;
    if (!availableMonths.length) return;
    setSelectedMonth(availableMonths[0]);
  }, [availableMonths, selectedMonth]);

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

  const openFinanceTransactionsForMonth = useMemo(() => {
    const list = openFinance.data?.recentTransactions || [];
    if (!selectedMonth) return list;
    return list.filter((t) => getYearMonthKey(t.date) === selectedMonth);
  }, [openFinance.data?.recentTransactions, selectedMonth]);

  const searchFilteredOpenFinance = useMemo(() => {
    if (!searchQuery.trim()) return openFinanceTransactionsForMonth;
    const q = searchQuery.trim().toLowerCase();
    return (openFinanceTransactionsForMonth || []).filter((t) => {
      if ((t.description || '').toLowerCase().includes(q)) return true;
      if ((t.category || '').toLowerCase().includes(q)) return true;
      if ((t.account_name || '').toLowerCase().includes(q)) return true;
      return false;
    });
  }, [openFinanceTransactionsForMonth, searchQuery]);

  const showHistorySearch =
    (filteredTransactions || []).length > 0 || openFinanceTransactionsForMonth.length > 0;

  const totalBalance = useMemo(() => {
    return (filteredTransactions || []).reduce((sum, t) => sum + getTransactionTotalForDashboard(t), 0);
  }, [filteredTransactions]);
  const balanceLoading = loading && (transactions || []).length === 0;

  const missionsSlotForCard = useMemo(() => {
    if (!missionsToday?.length) return null;
    const completed = missionsToday.filter((m) => m.completed).length;
    return (
      <DashboardMissionsProgress completed={completed} total={missionsToday.length} />
    );
  }, [missionsToday]);

  const transactionCount = (transactions || []).length;
  const userLevel = transactionCount < 10 ? 'Iniciante' : transactionCount < 50 ? 'Regular' : 'Expert';

  return (
    <div className="min-h-screen bg-background text-foreground">
      <h1 className="sr-only">FinMemory - Dashboard</h1>
      {isAuthenticated ? (
        <CalculatorDockProvider>
          <DashboardCalculadoraLayout>
            <div className="max-w-md mx-auto pb-[calc(10.5rem+env(safe-area-inset-bottom))] lg:pb-32">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
                  <p className="text-muted-foreground">Carregando sessão...</p>
                </div>
              ) : (
                <>
            {/* Stripe Success Banner */}
            {stripeSuccessBanner && (
              <div className="mx-5 mt-4 flex items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm bg-primary/10 border border-primary/30 text-primary">
                <span>
                  {stripeSyncState.loading
                    ? 'Confirmando pagamento...'
                    : stripeSyncState.active
                      ? `Plano ${String(stripeSyncState.plan || '').toUpperCase()} ativo!`
                      : stripeSyncState.error || 'Pagamento confirmado.'}
                </span>
                <button type="button" onClick={() => setStripeSuccessBanner(false)} className="shrink-0 rounded p-0.5" aria-label="Fechar">
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Header */}
            <DashboardHeader user={session.user} onSignOut={handleDisconnect} />

            {/* Saldo + missões do dia + carrossel de meses */}
            <div className="px-5 mt-4 space-y-2">
              <BalanceCard
                compact
                balance={totalBalance}
                loading={balanceLoading}
                income={openFinance.data?.month?.incomeTotal || 0}
                label={selectedMonth ? 'Gastos do Mês' : 'Total de Gastos'}
                missionsSlot={missionsSlotForCard}
              />
              {availableMonths.length > 0 && (
                <DashboardMonthCarousel
                  months={availableMonths}
                  selectedMonth={selectedMonth}
                  onMonthChange={setSelectedMonth}
                  monthTotals={monthTotals}
                  loading={loading}
                />
              )}
            </div>

            {/* Atalhos 4×2 + Parceria/Categorias */}
            <DashboardQuickAccess
              className="mt-3"
              onExtrato={() => historyRef.current?.scrollIntoView({ behavior: 'smooth' })}
            />

            <div className="px-5 mt-2">
              <FeaturedScanReceiptCTA variant="compact" />
            </div>

            {/* Map Unlock Banner */}
            {statesData?.next && (
              <div className="mx-5 mt-3 rounded-xl bg-amber-950/40 border border-amber-500/30 p-3">
                <div className="flex justify-between items-center gap-2 mb-1.5">
                  <p className="text-[10px] font-bold text-amber-500 uppercase tracking-wider m-0">🔒 Próximo estado</p>
                  <p className="text-[11px] font-bold text-amber-400 tabular-nums m-0 shrink-0">
                    {statesData.total} / {statesData.next.needed}
                  </p>
                </div>
                <p className="font-black text-sm text-foreground m-0 mb-1.5">{statesData.next.name}</p>
                <div className="h-1 bg-amber-950/60 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${statesData.next.progress_pct}%`,
                      background: 'linear-gradient(90deg, #f59e0b, #d97706)',
                    }}
                  />
                </div>
                <p className="text-[10px] text-amber-600/80 mt-1.5 m-0 leading-snug">
                  Convide amigos para desbloquear {statesData.next.name}.
                </p>
              </div>
            )}

            {/* Economize Agora */}
            {recentPrices.length > 0 && (
              <div className="px-5 mt-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-[15px] font-black text-foreground">Economize agora 💸</h2>
                  <Link href="/mapa" className="text-[12px] text-primary font-semibold">Ver mapa →</Link>
                </div>
                <div className="space-y-2">
                  {recentPrices.slice(0, 3).map((p) => (
                    <div key={p.id} className="flex items-center justify-between bg-card border border-[#1E2A3A] rounded-xl px-4 py-3">
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-foreground truncate">{p.nome_produto || 'Produto'}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{p.estabelecimento}</p>
                      </div>
                      {p.preco != null && (
                        <p className="text-primary font-black text-[15px] ml-4 shrink-0">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(p.preco)}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Open Finance bank carousel */}
            <div className="px-5 mt-4">
              <OpenFinanceBankCarousel
                accounts={openFinance.data?.accounts}
                loading={openFinance.loading}
                selectedAccountId={openFinanceAccountId}
                onSelectAccount={setOpenFinanceAccountId}
              />
            </div>

            {/* Open Finance section */}
            {canOpenFinance && (
              <section className="mx-5 mt-4 mb-2 rounded-2xl border border-[#1E2A3A] bg-card p-4" aria-label="Open Finance">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">Open Finance</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">Contas e movimentos do banco.</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button type="button" onClick={() => openFinance.refresh()} disabled={openFinance.loading}
                      className="text-xs font-semibold text-primary whitespace-nowrap hover:underline disabled:opacity-50">
                      Atualizar
                    </button>
                    <Link href="/settings" className="text-xs font-semibold text-primary whitespace-nowrap hover:underline">
                      Configurar
                    </Link>
                  </div>
                </div>
                {openFinance.error && <p className="text-xs text-red-400 mb-3">{openFinance.error?.message || 'Erro ao carregar.'}</p>}
                {openFinance.data?.syncing && (
                  <p className="text-xs text-amber-400 bg-amber-950/30 border border-amber-500/20 rounded-xl px-3 py-2 mb-3">
                    Sincronizando com a instituição…
                  </p>
                )}
                {openFinanceAccountId && (openFinance.data?.accounts || []).length > 0 && (
                  <p className="text-xs font-medium text-primary bg-primary/10 border border-primary/20 rounded-xl px-3 py-2 mb-3">
                    Mostrando:{' '}
                    {(openFinance.data.accounts || []).find((a) => a.id === openFinanceAccountId)?.display_name ||
                      (openFinance.data.accounts || []).find((a) => a.id === openFinanceAccountId)?.name ||
                      'esta conta'}
                  </p>
                )}
                {!openFinance.loading && openFinance.data?.month && (
                  <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                    <div className="rounded-xl bg-primary/10 border border-primary/20 px-3 py-2">
                      <p className="text-muted-foreground mb-0.5">Receitas (mês)</p>
                      <p className="text-primary font-semibold">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(openFinance.data.month.incomeTotal || 0)}
                      </p>
                    </div>
                    <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-3 py-2">
                      <p className="text-muted-foreground mb-0.5">Despesas (mês)</p>
                      <p className="text-red-400 font-semibold">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(openFinance.data.month.expenseTotal || 0)}
                      </p>
                    </div>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Movimentos aparecem juntos em <strong className="text-foreground">Histórico</strong> abaixo.
                </p>
              </section>
            )}

            {/* Cobranças do mês */}
            <div className="px-5 mt-4">
              <CobrancasDoMes userId={userId} selectedMonth={selectedMonth} onAfterPayment={() => loadTransactions(userId)} />
            </div>

            {/* Lixeira */}
            <button type="button"
              onClick={() => { setShowTrashSheet(true); loadDeletedTransactions(userId); }}
              className="flex items-center gap-3 mx-5 w-[calc(100%-2.5rem)] p-4 rounded-xl bg-card border border-[#1E2A3A] mb-6 hover:bg-[#1E2A3A]/50 transition-colors text-left">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-400 shrink-0">
                <Trash2 className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-foreground">Lixeira</p>
                <p className="text-xs text-muted-foreground">{DASHBOARD.trashSubtitle}</p>
              </div>
              <span className="text-muted-foreground text-sm shrink-0">Abrir</span>
            </button>

            {/* Histórico */}
            <div ref={historyRef} className="px-5" id="extrato">
              {showHistorySearch && (
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" aria-hidden />
                  <input
                    type="search"
                    placeholder={DASHBOARD.historySearchPlaceholder}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-[#1E2A3A] bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                    aria-label={DASHBOARD.historySearchAria}
                  />
                </div>
              )}
              <UnifiedHistoryList
                openFinanceTransactions={searchFilteredOpenFinance}
                finMemoryTransactions={searchFilteredTransactions}
                openFinanceAccounts={openFinance.data?.accounts || []}
                openFinanceLoading={openFinance.loading}
                finMemoryLoading={loading}
                userId={userId}
                onDeleted={() => loadTransactions(userId)}
                onRenamed={() => loadTransactions(userId)}
                emptyState={
                  searchQuery.trim() && searchFilteredTransactions.length === 0 && searchFilteredOpenFinance.length === 0
                    ? 'search' : 'default'
                }
              />
            </div>

            {/* Lixeira Sheet */}
            <Sheet open={showTrashSheet} onOpenChange={setShowTrashSheet}>
              <SheetContent side="bottom" className="rounded-t-3xl px-5 pb-10 pt-4 max-h-[85vh] overflow-y-auto">
                <SheetHeader className="mb-4">
                  <SheetTitle className="text-lg font-bold text-center flex items-center justify-center gap-2">
                    <Trash2 className="h-5 w-5 text-red-400" /> Lixeira
                  </SheetTitle>
                  <p className="text-sm text-muted-foreground text-center">
                    Toque em &quot;Restaurar&quot; para voltar ao histórico.
                  </p>
                </SheetHeader>
                {trashLoading ? (
                  <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Carregando...</span>
                  </div>
                ) : deletedTransactions.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">Nenhuma nota na lixeira.</div>
                ) : (
                  <div className="space-y-2">
                    {deletedTransactions.map((t) => {
                      const total = Number(t.total) || 0;
                      const displayValue = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Math.abs(total));
                      const dataStr = t.data ? new Date(t.data).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
                      const isRestoring = restoringId === t.id;
                      return (
                        <div key={t.id} className="flex items-center justify-between gap-3 p-4 rounded-xl bg-card border border-[#1E2A3A]">
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-foreground truncate">{t.estabelecimento || 'Sem nome'}</p>
                            <p className="text-sm text-muted-foreground">{dataStr} · {displayValue}</p>
                          </div>
                          <button type="button" onClick={() => handleRestore(t.id)} disabled={isRestoring}
                            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-[#0A0E1A] text-sm font-bold hover:bg-primary/90 disabled:opacity-50">
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

            {/* Sync logs (collapsed by default) */}
            {syncLogs.length > 0 && !showLogs && (
              <button type="button" onClick={() => setShowLogs(true)}
                className="mx-5 mt-2 px-4 py-2 bg-card border border-[#1E2A3A] text-muted-foreground rounded-xl text-sm">
                📋 Ver Logs
              </button>
            )}
            {showLogs && syncLogs.length > 0 && (
              <div className="mx-5 mt-2 bg-card rounded-2xl p-4 mb-4 border border-[#1E2A3A] max-h-80 overflow-y-auto">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm font-semibold text-foreground">Logs de Sincronização</span>
                  <button type="button" onClick={() => setShowLogs(false)} className="text-muted-foreground text-xs hover:text-foreground">✕ Fechar</button>
                </div>
                <div className="space-y-1 font-mono text-[12px]">
                  {syncLogs.map((log, i) => (
                    <div key={i} className={`px-3 py-1.5 rounded border-l-2 ${
                      log.type === 'success' ? 'bg-primary/10 border-primary text-primary' :
                      log.type === 'error' ? 'bg-red-500/10 border-red-500 text-red-400' :
                      log.type === 'warning' ? 'bg-amber-500/10 border-amber-500 text-amber-400' :
                      'bg-blue-500/10 border-blue-500 text-blue-400'
                    }`}>{log.message}</div>
                  ))}
                </div>
              </div>
            )}

            {/* Debug tool (dev only, always visible for diagnostics) */}
            <div className="mx-5 mt-2 mb-2">
              <button type="button" onClick={handleDebugConnection}
                className="text-[11px] text-muted-foreground/50 hover:text-muted-foreground transition-colors">
                🔍 diagnóstico
              </button>
              {debugInfo && (
                <div className="mt-2 bg-card rounded-xl p-4 border border-[#1E2A3A] text-xs">
                  <div className="flex justify-between mb-2">
                    <span className="font-semibold text-foreground">Diagnóstico</span>
                    <button type="button" onClick={() => setDebugInfo(null)} className="text-muted-foreground">✕</button>
                  </div>
                  <div className="text-muted-foreground mb-2">User: {debugInfo.userId || 'N/A'}</div>
                  {debugInfo.tests.map((test, i) => (
                    <div key={i} className={`mb-1 ${test.success ? 'text-primary' : 'text-red-400'}`}>
                      {test.success ? '✅' : '❌'} {test.name}{test.error ? `: ${test.error}` : ''}
                    </div>
                  ))}
                </div>
              )}
            </div>
            </>
              )}
            </div>
          </DashboardCalculadoraLayout>
        </CalculatorDockProvider>
      ) : (
        <div className="max-w-md mx-auto px-5 pt-5 pb-32">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-muted-foreground">Carregando...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center min-h-[70vh] gap-6 text-center px-4">
              <Image src="/logo.png" alt="FinMemory" width={80} height={80} className="object-contain" />
              <div className="w-20 h-20 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Mail className="h-10 w-10 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold mb-2 text-foreground">FinMemory</h1>
                <p className="text-muted-foreground">Entre com email e senha para acessar seu painel.</p>
              </div>
              <button
                type="button"
                onClick={handleConnectGmail}
                className="px-6 py-3 bg-primary text-[#0A0E1A] rounded-xl font-bold inline-flex items-center gap-2 hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                aria-label="Entrar"
              >
                <Mail className="h-5 w-5" aria-hidden />
                Entrar
              </button>
            </div>
          )}
        </div>
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
