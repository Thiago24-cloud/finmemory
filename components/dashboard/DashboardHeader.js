import Link from 'next/link';
import Image from 'next/image';
import { LogOut, Bell } from 'lucide-react';
import { cn } from '../../lib/utils';

/**
 * Header do dashboard – logo, avatar, nome do usuário (dados reais da sessão NextAuth), lembretes/notificações e sair.
 */
export function DashboardHeader({ user, onSignOut, className }) {
  const userName = user?.name || (user?.email && user.email.split('@')[0]) || 'Usuário';
  const avatarUrl = user?.image;
  const initials = userName.slice(0, 2).toUpperCase();

  return (
    <header className={cn('bg-white rounded-b-2xl px-5 py-5 shadow-card-lovable flex items-center justify-between', className)}>
      <div className="flex items-center gap-3">
        <Link href="/mapa" className="shrink-0" aria-label="FinMemory - Mapa">
          <Image src="/logo.png" alt="" width={40} height={40} className="object-contain rounded-lg" />
        </Link>
        <div className="h-12 w-12 rounded-full border-2 border-[#2ECC49] overflow-hidden bg-[#f8f9fa] flex items-center justify-center text-[#333] text-sm flex-shrink-0">
          {avatarUrl ? (
            <img src={avatarUrl} alt={userName} className="h-full w-full object-cover" />
          ) : (
            <span>{initials}</span>
          )}
        </div>
        <div>
          <p className="text-[#666] text-sm">Olá,</p>
          <p className="text-[#333] font-bold text-lg">{userName}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Link
          href="/notifications"
          className="p-2 rounded-full hover:bg-[#f8f9fa] transition-colors"
          aria-label="Lembretes e notificações"
        >
          <Bell className="h-5 w-5 text-[#666]" />
        </Link>
        <button
          type="button"
          onClick={onSignOut}
          className="p-2 rounded-full hover:bg-[#f8f9fa] transition-colors"
          aria-label="Sair"
        >
          <LogOut className="h-5 w-5 text-[#666]" />
        </button>
      </div>
    </header>
  );
}
