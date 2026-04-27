import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type RouteDecision = "economy" | "convenience";

export type FinancialSummary = {
  monthlySpent: number;
  monthlyLimit: number;
};

type ShoppingContextValue = {
  shoppingList: string[];
  addShoppingItem: (raw: string) => void;
  removeShoppingItem: (item: string) => void;
  quickItem: string;
  setQuickItem: (value: string) => void;
  quickListOpen: boolean;
  setQuickListOpen: (open: boolean) => void;
  selectedDecision: RouteDecision;
  setSelectedDecision: (decision: RouteDecision) => void;
  scannerInsightOpen: boolean;
  setScannerInsightOpen: (open: boolean) => void;
  financialSummary: FinancialSummary;
  setFinancialSummary: (patch: Partial<FinancialSummary>) => void;
  /** Ordered [lng, lat] vertices — user → stops; replace with Directions API geometry later */
  routeCoordinates: [number, number][];
  setRouteCoordinates: (coords: [number, number][]) => void;
};

const defaultFinancial: FinancialSummary = {
  monthlySpent: 0,
  monthlyLimit: 1200,
};

const ShoppingContext = createContext<ShoppingContextValue | null>(null);

export function ShoppingProvider({ children }: { children: ReactNode }) {
  const [shoppingList, setShoppingList] = useState<string[]>([]);
  const [quickItem, setQuickItem] = useState("");
  const [quickListOpen, setQuickListOpen] = useState(false);
  const [selectedDecision, setSelectedDecision] = useState<RouteDecision>("economy");
  const [scannerInsightOpen, setScannerInsightOpen] = useState(false);
  const [financialSummary, setFinancialState] = useState<FinancialSummary>(defaultFinancial);
  const [routeCoordinates, setRouteCoordinates] = useState<[number, number][]>([]);

  const addShoppingItem = useCallback((raw: string) => {
    const normalized = raw.trim();
    if (!normalized) return;
    setShoppingList((prev) => {
      if (prev.some((item) => item.toLowerCase() === normalized.toLowerCase())) return prev;
      return [...prev, normalized];
    });
    setQuickItem("");
    setSelectedDecision("economy");
  }, []);

  const removeShoppingItem = useCallback((item: string) => {
    setShoppingList((prev) => prev.filter((entry) => entry !== item));
  }, []);

  const setFinancialSummary = useCallback((patch: Partial<FinancialSummary>) => {
    setFinancialState((prev) => ({ ...prev, ...patch }));
  }, []);

  const value = useMemo<ShoppingContextValue>(
    () => ({
      shoppingList,
      addShoppingItem,
      removeShoppingItem,
      quickItem,
      setQuickItem,
      quickListOpen,
      setQuickListOpen,
      selectedDecision,
      setSelectedDecision,
      scannerInsightOpen,
      setScannerInsightOpen,
      financialSummary,
      setFinancialSummary,
      routeCoordinates,
      setRouteCoordinates,
    }),
    [
      shoppingList,
      addShoppingItem,
      removeShoppingItem,
      quickItem,
      quickListOpen,
      selectedDecision,
      scannerInsightOpen,
      financialSummary,
      setFinancialSummary,
      routeCoordinates,
    ]
  );

  return <ShoppingContext.Provider value={value}>{children}</ShoppingContext.Provider>;
}

export function useShopping() {
  const ctx = useContext(ShoppingContext);
  if (!ctx) {
    throw new Error("useShopping must be used within ShoppingProvider");
  }
  return ctx;
}
