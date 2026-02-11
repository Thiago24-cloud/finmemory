import { useNavigate } from "react-router-dom";
import { RefreshCw, BarChart3, Tags, Camera, Settings, FileText, MapPin, PenLine, Heart, ShoppingCart } from "lucide-react";
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
      icon: <PenLine className="h-6 w-6" />,
      label: "Manual",
      onClick: () => navigate("/manual-entry"),
      isPositive: true,
    },
    {
      icon: <Heart className="h-6 w-6" />,
      label: "Parceria",
      onClick: () => navigate("/partnership"),
      isPositive: true,
    },
    {
      icon: <ShoppingCart className="h-6 w-6" />,
      label: "Lista",
      onClick: () => navigate("/shopping-list"),
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
    <div className={cn("", className)}>
      <div className="grid grid-cols-5 gap-3">
        {actions.map((action, index) => (
          <button
            key={index}
            type="button"
            onClick={action.disabled ? undefined : action.onClick}
            disabled={action.disabled}
            className="flex flex-col items-center gap-1.5 hover:-translate-y-0.5 transition-transform disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
          >
            <div
              className={cn(
                "w-12 h-12 rounded-2xl flex items-center justify-center transition-all card-shadow",
                action.isPositive
                  ? "bg-accent/10 text-accent hover:bg-accent/20"
                  : "bg-card text-muted-foreground hover:bg-muted border border-border"
              )}
            >
              {action.icon}
            </div>
            <span className="text-[11px] text-muted-foreground whitespace-nowrap leading-tight">
              {action.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
