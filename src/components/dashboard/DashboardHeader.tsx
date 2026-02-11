import { LogOut, Bell } from "lucide-react";
import { cn } from "@/lib/utils";

interface DashboardHeaderProps {
  userName: string;
  avatarUrl?: string | null;
  onSignOut: () => void;
  className?: string;
}

export function DashboardHeader({ userName, avatarUrl, onSignOut, className }: DashboardHeaderProps) {
  const initials = userName.slice(0, 2).toUpperCase();

  return (
    <header className={cn("bg-card rounded-b-2xl px-5 py-5 card-shadow flex items-center justify-between", className)}>
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-full border-2 border-primary overflow-hidden bg-muted flex items-center justify-center text-foreground text-sm flex-shrink-0">
          {avatarUrl ? (
            <img src={avatarUrl} alt={userName} className="h-full w-full object-cover" />
          ) : (
            <span>{initials}</span>
          )}
        </div>
        <div>
          <p className="text-muted-foreground text-sm">Olá,</p>
          <p className="text-foreground font-bold text-lg">{userName}</p>
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
