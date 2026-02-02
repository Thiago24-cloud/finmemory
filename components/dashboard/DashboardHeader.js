import { LogOut, Bell } from 'lucide-react';
import { cn } from '../../lib/utils';

/**
 * Header do dashboard – avatar, nome do usuário (dados reais da sessão NextAuth), notificações e sair.
 */
export function DashboardHeader({ user, onSignOut, className }) {
  const userName = user?.name || (user?.email && user.email.split('@')[0]) || 'Usuário';
  const avatarUrl = user?.image;
  const initials = userName.slice(0, 2).toUpperCase();

  return (
    <header className={cn('flex items-center justify-between py-4', className)}>
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full border-2 border-accent overflow-hidden bg-muted flex items-center justify-center text-foreground text-sm flex-shrink-0">
          {avatarUrl ? (
            <img src={avatarUrl} alt={userName} className="h-full w-full object-cover" />
          ) : (
            <span>{initials}</span>
          )}
        </div>
        <div>
          <p className="text-muted-foreground text-sm">Olá,</p>
          <p className="text-foreground font-semibold">{userName}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          className="p-2 rounded-full hover:bg-muted transition-colors"
          aria-label="Notificações"
        >
          <Bell className="h-5 w-5 text-muted-foreground" />
        </button>
        <button
          type="button"
          onClick={onSignOut}
          className="p-2 rounded-full hover:bg-muted transition-colors"
          aria-label="Sair"
        >
          <LogOut className="h-5 w-5 text-muted-foreground" />
        </button>
      </div>
    </header>
  );
}
