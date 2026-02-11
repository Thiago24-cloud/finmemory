import * as React from "react";
import { cn } from "@/lib/utils";

export interface DashboardCardProps {
  /** Card title (e.g. "Total de gastos") */
  title: string;
  /** Main value (e.g. "R$ 1.234,56") */
  value: string;
  /** Optional subtitle text */
  subtitle?: string;
  /** Optional emoji or icon element */
  icon?: React.ReactNode;
  /** Additional class names */
  className?: string;
}

/**
 * DashboardCard – Metric card for the dashboard.
 * Uses the FinMemory design system: white card, rounded-2xl, card-shadow.
 */
const DashboardCard = ({ title, value, subtitle, icon, className }: DashboardCardProps) => {
  return (
    <div
      className={cn(
        "bg-card text-card-foreground rounded-2xl card-shadow p-6 animate-fade-in",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted-foreground mb-1">{title}</p>
          <p className="text-3xl font-bold text-foreground truncate">{value}</p>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
          )}
        </div>
        {icon && (
          <span className="text-2xl flex-shrink-0">{icon}</span>
        )}
      </div>
    </div>
  );
};

export default DashboardCard;
