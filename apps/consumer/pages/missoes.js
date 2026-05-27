import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { getServerSession } from 'next-auth/next';
import Head from 'next/head';
import { toast } from 'sonner';
import { useMissionsToday } from '../components/missions/MissionsTodayContext';
import { completeDailyMission } from '../lib/completeDailyMission';
import { shareAppInviteLink } from '../lib/shareAppInvite';
import { authOptions } from './api/auth/[...nextauth]';
import { canAccessForSession } from '../lib/access-server';
import { canUseRestrictedFeatures } from '../lib/restrictedFeatureAccess';
import { cn } from '../lib/utils';

export async function getServerSideProps(ctx) {
  try {
    const session = await getServerSession(ctx.req, ctx.res, authOptions);
    if (!session?.user?.email) {
      return { redirect: { destination: '/login?callbackUrl=/missoes', permanent: false } };
    }
    const allowed = await canAccessForSession(session);
    if (!allowed) {
      return { redirect: { destination: '/?msg=nao-cadastrado', permanent: false } };
    }
    if (!canUseRestrictedFeatures(session.user.email)) {
      return { redirect: { destination: '/em-breve', permanent: false } };
    }
    return { props: {} };
  } catch {
    return { redirect: { destination: '/login?callbackUrl=/missoes', permanent: false } };
  }
}

function useCountdown(secondsUntilReset) {
  const [seconds, setSeconds] = useState(secondsUntilReset);
  useEffect(() => {
    setSeconds(secondsUntilReset);
    if (!secondsUntilReset) return;
    const interval = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(interval);
  }, [secondsUntilReset]);

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}min ${String(s).padStart(2, '0')}s`;
}

function missionActionHref(id) {
  switch (id) {
    case 'scan_3':
      return '/scan-product';
    case 'log_expense':
      return '/add-receipt';
    case 'find_cheaper':
      return '/mapa';
    case 'invite_friend':
      return '/partnership';
    default:
      return '/dashboard';
  }
}

function MissionCard({ mission, onNavigate, refreshMissions }) {
  const pct = mission.total_steps > 1 ? Math.round((mission.steps_done / mission.total_steps) * 100) : 0;
  const [inviteBusy, setInviteBusy] = useState(false);

  const handleFazer = async () => {
    if (mission.completed) return;

    if (mission.id === 'invite_friend') {
      setInviteBusy(true);
      try {
        const outcome = await shareAppInviteLink();
        if (outcome === 'cancelled') return;

        const res = await completeDailyMission('invite_friend');
        let data = {};
        try {
          data = await res.json();
        } catch {
          /* ignore */
        }
        if (!res.ok) {
          toast.error(data?.error || 'Não foi possível registrar o XP. Tente de novo.');
          return;
        }
        await refreshMissions({ silent: true });
        if (data.already_completed) {
          toast.message('Você já concluiu esta missão hoje.');
          return;
        }
        if (data.xp_awarded > 0) {
          toast.success(`+${data.xp_awarded} XP — obrigado por divulgar o FinMemory!`);
        }
      } catch {
        toast.error('Algo deu errado ao compartilhar.');
      } finally {
        setInviteBusy(false);
      }
      return;
    }

    onNavigate(missionActionHref(mission.id));
  };

  return (
    <div
      className={cn(
        'rounded-2xl border p-4 transition-all',
        mission.completed
          ? 'border-primary/30 bg-primary/5 opacity-80'
          : 'border-border bg-card shadow-sm'
      )}
    >
      <div className="flex items-center gap-3">
        <span className="text-3xl flex-shrink-0">{mission.icon}</span>

        <div className="flex-1 min-w-0">
          <p className="font-bold text-[14px] leading-tight">{mission.title}</p>
          <p className="text-[12px] text-amber-600 font-semibold mt-0.5">+{mission.xp_reward} XP</p>

          {!mission.completed && mission.total_steps > 1 && (
            <div className="mt-2">
              <div className="h-1.5 bg-gray-100 dark:bg-[#1E2A3A] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#2ECC49] rounded-full transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                {mission.steps_done}/{mission.total_steps}
              </p>
            </div>
          )}
        </div>

        {mission.completed ? (
          <div className="w-8 h-8 rounded-full bg-[#2ECC49] flex items-center justify-center flex-shrink-0">
            <span className="text-white font-black text-[15px]">✓</span>
          </div>
        ) : (
          <button
            type="button"
            disabled={inviteBusy}
            onClick={handleFazer}
            className="flex-shrink-0 px-3 py-2 rounded-xl bg-gradient-to-br from-[#2ECC49] to-[#16a34a] text-white font-bold text-[12px] shadow-sm active:scale-95 transition-transform disabled:opacity-60 disabled:pointer-events-none"
          >
            {inviteBusy ? '…' : 'Fazer'}
          </button>
        )}
      </div>
    </div>
  );
}

export default function MissoesPage() {
  const { status } = useSession();
  const router = useRouter();
  const { missions, loading, secondsUntilReset, refresh } = useMissionsToday();

  const countdown = useCountdown(secondsUntilReset);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
  }, [status, router]);

  /** Ao voltar de scanner / mapa / recibo, atualiza progresso sem depender só do cache do provider. */
  useEffect(() => {
    void refresh({ silent: true });
  }, [refresh]);

  const handleNavigate = (href) => {
    router.push(href);
  };

  const totalXP = missions.reduce((s, m) => s + m.xp_reward, 0);
  const completedCount = missions.filter((m) => m.completed).length;

  return (
    <>
      <Head>
        <title>Missões Diárias – FinMemory</title>
      </Head>

      <div className="min-h-screen bg-background pb-24">
        {/* Header */}
        <div className="bg-card border-b border-border px-5 pt-5 pb-4 sticky top-0 z-10">
          <h1 className="font-black text-[20px] tracking-tight">Missões Diárias</h1>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            Resetam em {countdown}
          </p>
        </div>

        <div className="max-w-lg mx-auto px-5 py-5 flex flex-col gap-4">
          {/* XP disponível */}
          <div className="rounded-2xl bg-gradient-to-br from-amber-950/60 to-yellow-950/40 dark:border-amber-500/20 border border-amber-200 p-4">
            <p className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">XP disponível hoje</p>
            <div className="flex justify-between items-center mt-1">
              <p className="font-black text-[28px] text-amber-600">+{totalXP} XP</p>
              <p className="text-[12px] text-muted-foreground">{completedCount} de {missions.length} completa{completedCount !== 1 ? 's' : ''}</p>
            </div>
          </div>

          {/* Missões */}
          {loading ? (
            <div className="flex justify-center py-10">
              <div className="w-6 h-6 border-2 border-[#2ECC49] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : missions.length === 0 ? (
            <p className="text-center text-muted-foreground py-10">Nenhuma missão disponível hoje.</p>
          ) : (
            missions.map((m) => (
              <MissionCard key={m.id} mission={m} onNavigate={handleNavigate} refreshMissions={refresh} />
            ))
          )}
        </div>
      </div>

    </>
  );
}
