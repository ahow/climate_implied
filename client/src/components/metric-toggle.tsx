import { Button } from "@/components/ui/button";
import { Thermometer, TrendingDown, Calendar } from "lucide-react";
import type { MetricView } from "@/lib/types";

interface MetricToggleProps {
  activeMetric: MetricView;
  onMetricChange: (metric: MetricView) => void;
}

const METRICS: { value: MetricView; label: string; icon: React.ElementType }[] = [
  { value: "temperature", label: "Temperature", icon: Thermometer },
  { value: "reductionRate", label: "Reduction Rate", icon: TrendingDown },
  { value: "netZero", label: "Net-Zero Year", icon: Calendar },
];

export function MetricToggle({ activeMetric, onMetricChange }: MetricToggleProps) {
  return (
    <div className="flex items-center gap-1 bg-muted rounded-md p-0.5" data-testid="toggle-metric">
      {METRICS.map((metric) => {
        const Icon = metric.icon;
        const isActive = activeMetric === metric.value;
        return (
          <Button
            key={metric.value}
            variant={isActive ? "default" : "ghost"}
            size="sm"
            onClick={() => onMetricChange(metric.value)}
            className="gap-1.5"
            data-testid={`button-metric-${metric.value}`}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{metric.label}</span>
          </Button>
        );
      })}
    </div>
  );
}
