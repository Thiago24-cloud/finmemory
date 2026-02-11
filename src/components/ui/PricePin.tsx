import * as React from "react";
import { cn } from "@/lib/utils";

export interface PricePinProps {
  /** Price to display (e.g. "R$ 45,90") */
  price: string;
  /** Label below the price */
  label?: string;
  /** Click handler */
  onClick?: () => void;
  /** Additional class names */
  className?: string;
}

/**
 * PricePin – Pin marker with price badge, for map or visual indicators.
 * Uses the FinMemory purple gradient.
 */
const PricePin = ({ price, label, onClick, className }: PricePinProps) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex flex-col items-center group cursor-pointer",
        className
      )}
    >
      <div className="gradient-primary text-primary-foreground text-xs font-bold px-2.5 py-1 rounded-lg shadow-md group-hover:scale-105 transition-transform whitespace-nowrap">
        {price}
      </div>
      <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-primary" />
      {label && (
        <span className="text-[10px] text-muted-foreground mt-0.5 max-w-[80px] truncate text-center">
          {label}
        </span>
      )}
    </button>
  );
};

export default PricePin;
