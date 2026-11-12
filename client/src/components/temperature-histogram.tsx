import { Card } from "@/components/ui/card";
import { ScientificEvidenceStrands } from "./scientific-evidence-strands";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts";
import type { TemperatureProjection } from "@/lib/types";
import { DownloadDataButton } from "@/components/download-data-button";
import { bindProducerLegacyConsumer } from "@/lib/producer-download";

interface TemperatureHistogramProps {
  pdf: TemperatureProjection[];
  median: number;
  p10: number;
  p90: number;
  isLoading?: boolean;
}

function getBarColor(temp: number): string {
  if (temp <= 1.5) return "hsl(168, 76%, 36%)";
  if (temp <= 2.0) return "hsl(197, 71%, 38%)";
  if (temp <= 2.5) return "hsl(43, 86%, 42%)";
  if (temp <= 3.0) return "hsl(27, 87%, 48%)";
  return "hsl(0, 84%, 35%)";
}

export function TemperatureHistogram({ pdf, median, p10, p90, isLoading }: TemperatureHistogramProps) {
  if (isLoading) {
    return (
      <Card className="p-6">
        <Skeleton className="h-6 w-48 mb-4" />
        <Skeleton className="h-[300px] w-full" />
      </Card>
    );
  }

  if (!Array.isArray(pdf) || pdf.some(point => !point || typeof point !== "object"))
    return <Card className="p-6"><p role="status">Temperature density record collection unavailable. No values or downloads are substituted.</p></Card>;
  if (!pdf.length) return <Card className="p-6"><p role="status">No legacy temperature probability-density observations were returned.</p></Card>;
  const filteredPdf = pdf.filter((d) => d.probability > 0.001);

  const downloadRows = pdf.map((d) => ({
    "Temperature (\u00B0C)": d.temperature,
    "Probability density (1/\u00B0C)": d.probability,
  }));
  bindProducerLegacyConsumer(pdf, "temperature", downloadRows);

  return (
    <Card className="p-6" data-testid="card-temperature-histogram">
      <ScientificEvidenceStrands compact />
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h3 className="text-sm font-medium text-muted-foreground">Temperature Probability Distribution</h3>
          <p className="text-xs text-muted-foreground mt-0.5">10,000 Monte Carlo simulations</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>P10: {typeof p10 === "number" && Number.isFinite(p10) ? `${p10.toFixed(1)}°C` : "Unavailable — P10 not returned"}</span>
            <span className="font-semibold text-foreground">Median: {typeof median === "number" && Number.isFinite(median) ? `${median.toFixed(2)}°C` : "Unavailable — median not returned"}</span>
            <span>P90: {typeof p90 === "number" && Number.isFinite(p90) ? `${p90.toFixed(1)}°C` : "Unavailable — P90 not returned"}</span>
          </div>
          <DownloadDataButton
            kind="legacy"
            filename="temperature-distribution"
            sheetName="Temp Distribution"
            rows={downloadRows}
            jsonCompanion
          fieldBindings={{
            "Temperature (\u00B0C)":{id:"projection.temperatureDistribution.pdf[].temperature",transform:"Identity"},
            "Probability density (1/\u00B0C)":{id:"projection.temperatureDistribution.pdf[].probability",transform:"Identity; density, not point probability"},
          }}
            testId="button-download-temperature"
          />
        </div>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={filteredPdf} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis
            dataKey="temperature"
            stroke="hsl(var(--muted-foreground))"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `${v}\u00B0C`}
          />
          <YAxis
            stroke="hsl(var(--muted-foreground))"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => v.toFixed(2)}
            label={{ value: "Probability Density", angle: -90, position: "insideLeft", style: { fontSize: 11, fill: "hsl(var(--muted-foreground))" } }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "6px",
              fontSize: "12px",
            }}
            formatter={(value: number) => [value.toFixed(4), "Probability"]}
            labelFormatter={(label) => `${label}\u00B0C`}
          />
          <ReferenceLine
            x={1.5}
            stroke="hsl(168, 76%, 36%)"
            strokeDasharray="4 4"
            label={{
              value: "1.5\u00B0C",
              position: "top",
              style: { fontSize: 10, fill: "hsl(168, 76%, 36%)" },
            }}
          />
          <ReferenceLine
            x={2.0}
            stroke="hsl(197, 71%, 38%)"
            strokeDasharray="4 4"
            label={{
              value: "2.0\u00B0C",
              position: "top",
              style: { fontSize: 10, fill: "hsl(197, 71%, 38%)" },
            }}
          />
          <Bar dataKey="probability" radius={[2, 2, 0, 0]}>
            {filteredPdf.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getBarColor(entry.temperature)} fillOpacity={0.8} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}
