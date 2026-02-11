import { useNavigate } from "react-router-dom";
import { RefreshCw, BarChart3, Tags, Camera, Settings, FileText, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuickActionsProps {
  onSync: () => void;
  syncing: boolean;
  className?: string;
}

export function QuickActions({ onSync, syncing, className }: QuickActionsProps) {
  const navigate = useNavigate();

  const actions = [
    {
      icon: <RefreshCw className={cn("h-6 w-6", syncing && "animate-spin")} />,
      label: "Sincronizar",
      onClick: onSync,
      isPositive: true,
      disabled: syncing,
    },
    {
      icon: <Camera className="h-6 w-6" />,
      label: "Escanear",
      onClick: () => navigate("/add-receipt"),
      isPositive: true,
    },
    {
      icon: <BarChart3 className="h-6 w-6" />,
      label: "Relatórios",
      onClick: () => {},
    },
    {
      icon: <Tags className="h-6 w-6" />,
      label: "Categorias",
      onClick: () => {},
    },
    {
      icon: <MapPin className="h-6 w-6" />,
      label: "Mapa Preços",
      onClick: () => navigate("/mapa-precos"),
      isPositive: true,
    },
    {
      icon: <FileText className="h-6 w-6" />,
      label: "Extratos",
      onClick: () => {},
    },
    {
      icon: <Settings className="h-6 w-6" />,
      label: "Ajustes",
      onClick: () => {},
    },
  ];

  return (
    <div className={cn("overflow-x-auto scrollbar-hide -mx-5 px-5", className)}>
      <div className="flex gap-4 pb-2 overflow-x-auto snap-x snap-mandatory scrollbar-hide">
        {actions.map((action, index) => (
          <button
            key={index}
            type="button"
            onClick={action.disabled ? undefined : action.onClick}
            disabled={action.disabled}
            className="flex flex-col items-center gap-2 min-w-[72px] snap-start hover:-translate-y-0.5 transition-transform disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
          >
            <div
              className={cn(
                "w-14 h-14 rounded-2xl flex items-center justify-center transition-all card-shadow",
                action.isPositive
                  ? "bg-accent/10 text-accent hover:bg-accent/20"
                  : "bg-card text-muted-foreground hover:bg-muted border border-border"
              )}
            >
              {action.icon}
            </div>
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {action.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
