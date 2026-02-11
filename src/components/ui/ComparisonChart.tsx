import * as React from "react";
import { cn } from "@/lib/utils";

export interface ComparisonChartProps {
  /** Chart title */
  title?: string;
  /** Primary data bars */
  data: { label: string; value: number }[];
  /** Optional comparison data bars */
  compareData?: { label: string; value: number }[];
  /** Additional class names */
  className?: string;
}

/**
 * ComparisonChart – Simple horizontal bar chart with optional comparison.
 * Uses the FinMemory gradient for primary bars and muted for comparison.
 */
const ComparisonChart = ({ title, data, compareData, className }: ComparisonChartProps) => {
  const allValues = [
    ...data.map((d) => d.value),
    ...(compareData?.map((d) => d.value) ?? []),
  ];
  const maxValue = Math.max(...allValues, 1);

  return (
    <div className={cn("bg-card text-card-foreground rounded-2xl card-shadow p-6", className)}>
      {title && (
        <h3 className="text-sm font-semibold text-foreground mb-4">{title}</h3>
      )}
      <div className="space-y-3">
        {data.map((item, i) => {
          const compare = compareData?.[i];
          return (
            <div key={item.label} className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{item.label}</span>
                <span className="font-medium text-foreground">
                  R$ {item.value.toFixed(2).replace(".", ",")}
                </span>
              </div>
              <div className="h-3 bg-muted rounded-full overflow-hidden relative">
                {compare && (
                  <div
                    className="absolute inset-y-0 left-0 bg-muted-foreground/20 rounded-full"
                    style={{ width: `${(compare.value / maxValue) * 100}%` }}
                  />
                )}
                <div
                  className="absolute inset-y-0 left-0 gradient-primary rounded-full transition-all duration-500"
                  style={{ width: `${(item.value / maxValue) * 100}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
      {compareData && (
        <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm gradient-primary" /> Atual
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm bg-muted-foreground/20" /> Anterior
          </span>
        </div>
      )}
    </div>
  );
};

export default ComparisonChart;
