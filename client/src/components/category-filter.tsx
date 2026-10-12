import { Button } from "@/components/ui/button";
import { Zap, Shield, Building2, Users, Globe, Banknote, Activity } from "lucide-react";
import type { Category } from "@/lib/types";

interface CategoryFilterProps {
  activeCategory: Category;
  onCategoryChange: (category: Category) => void;
}

const CATEGORIES: { value: Category; label: string; icon: React.ElementType; description: string }[] = [
  { value: "all", label: "All Factors", icon: Globe, description: "Combined impact of all factors" },
  { value: "technology", label: "Technology", icon: Zap, description: "Renewables + EVs only" },
  { value: "policy", label: "Policy", icon: Shield, description: "Government action only" },
  { value: "corporate", label: "Corporate", icon: Building2, description: "SBTi targets only" },
  { value: "socioeconomic", label: "Socioeconomic", icon: Users, description: "Public opinion impact" },
  { value: "financial", label: "Financial", icon: Banknote, description: "Investment flows + divestment" },
  { value: "emissions", label: "Emissions", icon: Activity, description: "Observed emissions validation" },
];

export function CategoryFilter({ activeCategory, onCategoryChange }: CategoryFilterProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap" data-testid="filter-category">
      {CATEGORIES.map((cat) => {
        const Icon = cat.icon;
        const isActive = activeCategory === cat.value;
        return (
          <Button
            key={cat.value}
            variant={isActive ? "default" : "outline"}
            size="sm"
            onClick={() => onCategoryChange(cat.value)}
            className="gap-1.5"
            data-testid={`button-category-${cat.value}`}
          >
            <Icon className="h-3.5 w-3.5" />
            {cat.label}
          </Button>
        );
      })}
    </div>
  );
}
