import { useLocation, useNavigate } from "react-router-dom";
import { Map, BarChart3, PlusCircle, User } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { icon: Map, label: "Mapa", path: "/mapa-precos" },
  { icon: BarChart3, label: "Dashboard", path: "/dashboard" },
  { icon: PlusCircle, label: "Adicionar", path: "/add-receipt" },
  { icon: User, label: "Perfil", path: "/partnership" },
];

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border safe-area-bottom">
      <div className="max-w-md mx-auto flex items-center justify-around h-16">
        {tabs.map((tab) => {
          const isActive = location.pathname === tab.path;
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={cn(
                "flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-colors min-w-[64px]",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <tab.icon className={cn("h-5 w-5", isActive && "stroke-[2.5]")} />
              <span className={cn("text-[10px]", isActive ? "font-bold" : "font-medium")}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
