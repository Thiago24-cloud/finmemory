import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

const MONTHS = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

export interface MonthPickerProps {
  /** Selected year */
  year: number;
  /** Selected month (0-11) */
  month: number;
  /** Callback when month/year changes */
  onChange: (year: number, month: number) => void;
  /** Additional class names */
  className?: string;
}

/**
 * MonthPicker – Month/year selector with navigation arrows.
 */
const MonthPicker = ({ year, month, onChange, className }: MonthPickerProps) => {
  const handlePrev = () => {
    if (month === 0) {
      onChange(year - 1, 11);
    } else {
      onChange(year, month - 1);
    }
  };

  const handleNext = () => {
    if (month === 11) {
      onChange(year + 1, 0);
    } else {
      onChange(year, month + 1);
    }
  };

  return (
    <div className={cn("flex items-center justify-center gap-3", className)}>
      <Button variant="ghost" size="icon" onClick={handlePrev} aria-label="Mês anterior">
        <ChevronLeft className="h-5 w-5" />
      </Button>
      <span className="text-base font-semibold text-foreground min-w-[120px] text-center">
        {MONTHS[month]} {year}
      </span>
      <Button variant="ghost" size="icon" onClick={handleNext} aria-label="Próximo mês">
        <ChevronRight className="h-5 w-5" />
      </Button>
    </div>
  );
};

export default MonthPicker;
