import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface MapFiltersProps {
  period: "current" | "past";
  onPeriodChange: (v: "current" | "past") => void;
  categories: string[];
  selectedCategory: string;
  onCategoryChange: (cat: string) => void;
  mapStyles: { label: string }[];
  styleIdx: number;
  onStyleChange: (idx: number) => void;
}

const MapFilters = ({
  period,
  onPeriodChange,
  categories,
  selectedCategory,
  onCategoryChange,
  mapStyles,
  styleIdx,
  onStyleChange,
}: MapFiltersProps) => {
  return (
    <>
      {/* Period tabs */}
      <div className="absolute top-3 left-3 z-10">
        <Tabs value={period} onValueChange={(v) => onPeriodChange(v as "current" | "past")}>
          <TabsList className="bg-card/90 backdrop-blur shadow-md">
            <TabsTrigger value="current" className="text-xs data-[state=active]:bg-accent data-[state=active]:text-accent-foreground">
              🟢 Este Mês
            </TabsTrigger>
            <TabsTrigger value="past" className="text-xs data-[state=active]:bg-muted-foreground data-[state=active]:text-card">
              🔘 Anteriores
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Style selector */}
      <div className="absolute top-14 left-3 flex gap-1 bg-card/90 backdrop-blur rounded-lg p-1 shadow-md z-10">
        {mapStyles.map((s, i) => (
          <button
            key={s.label}
            onClick={() => onStyleChange(i)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              i === styleIdx
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Category filter */}
      <div className="absolute top-[6.5rem] left-3 flex flex-wrap gap-1 bg-card/90 backdrop-blur rounded-lg p-1 shadow-md z-10 max-w-[220px]">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => onCategoryChange(cat)}
            className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${
              cat === selectedCategory
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>
    </>
  );
};

export default MapFilters;
