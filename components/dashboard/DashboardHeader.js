import Link from 'next/link';
import { LogOut, Bell } from 'lucide-react';
import { cn } from '../../lib/utils';
import { XPBar } from '../gamification/XPBar';
import { useGamification } from '../../hooks/useGamification';

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

export function DashboardHeader({ user, onSignOut, className }) {
  const userName = user?.name || 'Usuário';
  const firstName = userName.split(' ')[0];
  const avatarUrl = user?.image;
  const initials = userName.slice(0, 2).toUpperCase();
  const { xp_points, level, streak_current, loading } = useGamification();

  return (
    <header className={cn('bg-card border-b border-border px-5 pt-5 pb-4', className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-full border-2 border-primary overflow-hidden bg-muted flex items-center justify-center text-foreground text-sm flex-shrink-0">
            {avatarUrl ? (
              <img src={avatarUrl} alt={userName} className="h-full w-full object-cover" />
            ) : (
              <span>{initials}</span>
            )}
          </div>
          <div>
            <p className="text-muted-foreground text-[11px] uppercase tracking-wider font-semibold">{getGreeting()},</p>
            <p className="text-foreground font-black text-[18px] leading-tight">{firstName}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/notifications"
            className="p-2 rounded-full hover:bg-muted transition-colors"
            aria-label="Lembretes e notificações"
          >
            <Bell className="h-5 w-5 text-muted-foreground" />
          </Link>
          <button
            type="button"
            onClick={onSignOut}
            className="p-2 rounded-full hover:bg-muted transition-colors"
            aria-label="Sair"
          >
            <LogOut className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>
      </div>

      {!loading && (
        <XPBar
          xp={xp_points}
          level={level}
          streak={streak_current}
          className="mt-4"
        />
      )}
    </header>
  );
}
