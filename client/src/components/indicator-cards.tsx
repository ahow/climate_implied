import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { LineChart, Line, ResponsiveContainer } from "recharts";
import { Zap, Car, Shield, Building2, Users, Factory, Leaf, Globe, Banknote, Landmark, Wind, Activity, Thermometer, Gauge } from "lucide-react";
import type { HistoricalIndicatorData } from "@/lib/types";
import { DownloadDataButton } from "@/components/download-data-button";
import { certifyFiniteExport,finiteExportBindings,indicatorExportColumn } from "@shared/finiteExportSchemas";
import { indicatorFieldSpecs } from "@shared/indicatorFieldSemantics";

interface IndicatorCardsProps {
  historicalData: HistoricalIndicatorData[];
  isLoading?: boolean;
}

interface IndicatorConfig {
  key: keyof HistoricalIndicatorData;
  label: string;
  unit: string;
  category: string;
  icon: React.ElementType;
  format: (v: number) => string;
  source: string;
  color: string;
  inverted?: boolean;
}

const CARD_CONFIG: IndicatorConfig[] = [
  {
    key:"policyImplementationRate",label:"Target Law/Policy Status",unit:"fraction",category:"Policy",
    icon:Shield,format:(v)=>`${(v*100).toFixed(1)}%`,source:"Climate Action Tracker reference; not measured delivery",color:"hsl(43, 86%, 42%)",
  },
  {
    key:"corporateImplementationRate",label:"Estimated Company Target Progress",unit:"fraction",category:"Corporate",
    icon:Building2,format:(v)=>`${(v*100).toFixed(1)}%`,source:"SBTi retained estimate; not realised emissions reduction",color:"hsl(27, 87%, 48%)",
  },
  {
    key:"sacrificeWillingnessPct",label:"Willingness to Sacrifice",unit:"percent",category:"Socioeconomic",
    icon:Users,format:(v)=>`${v.toFixed(0)}%`,source:"Pew/UN survey references; coverage unverified",color:"hsl(340, 65%, 50%)",
  },
  {
    key:"humanCausationPct",label:"Human Causation Belief",unit:"percent",category:"Socioeconomic",
    icon:Users,format:(v)=>`${v.toFixed(0)}%`,source:"Retained survey reference; coverage unverified",color:"hsl(340, 65%, 50%)",
  },
  {
    key:"fossilDivestmentTrn",label:"Divestment Commitments (AUM)",unit:"USD trillion",category:"Financial Flows",
    icon:Banknote,format:(v)=>`$${v.toFixed(1)}T`,source:"Stand.earth reference; cumulative commitments, not withdrawn capital",color:"hsl(150, 65%, 40%)",
  },
  {
    key:"remainingBudget15C_Gt",label:"Retained 1.5°C Budget Diagnostic",unit:"Gt CO2",category:"Emissions Outcomes",
    icon:Gauge,format:(v)=>`${v.toFixed(0)} Gt CO2`,source:"Retained IPCC-minus-emissions estimate; not a new assessed budget",color:"hsl(350, 60%, 48%)",
  },
  {
    key:"renewableGrowthRate",label:"Renewable Capacity Growth",unit:"fraction/year",category:"Technology",
    icon:Zap,format:(v)=>`${(v*100).toFixed(1)}%/yr`,source:"Derived (IRENA)",color:"hsl(168, 76%, 36%)",
  },
  {
    key:"evGrowthRate",label:"EV Sales-share Growth",unit:"fraction/year",category:"Technology",
    icon:Car,format:(v)=>`${(v*100).toFixed(1)}%/yr`,source:"Derived (IEA)",color:"hsl(197, 71%, 38%)",
  },
  {
    key: "renewableCapacityGW",
    label: "Renewable Capacity",
    unit: "GW",
    category: "Technology",
    icon: Zap,
    format: (v) => `${v.toLocaleString()} GW`,
    source: "IRENA",
    color: "hsl(168, 76%, 36%)",
  },
  {
    key: "evSalesSharePct",
    label: "EV Sales Share",
    unit: "%",
    category: "Technology",
    icon: Car,
    format: (v) => `${v.toFixed(1)}%`,
    source: "IEA",
    color: "hsl(197, 71%, 38%)",
  },
  {
    key: "policyCoveragePct",
    label: "Policy Coverage",
    unit: "%",
    category: "Policy",
    icon: Shield,
    format: (v) => `${v.toFixed(0)}%`,
    source: "Climate Action Tracker",
    color: "hsl(43, 86%, 42%)",
  },
  {
    key: "corporateTargetsPct",
    label: "SBTi Coverage",
    unit: "%",
    category: "Corporate",
    icon: Building2,
    format: (v) => `${v.toFixed(0)}%`,
    source: "SBTi",
    color: "hsl(27, 87%, 48%)",
  },
  {
    key: "carbonIntensityKgPerGDP",
    label: "Carbon Intensity",
    unit: "kg/$GDP",
    category: "Socioeconomic",
    icon: Factory,
    format: (v) => `${v.toFixed(2)} kg/$`,
    source: "World Bank / IEA",
    color: "hsl(280, 65%, 50%)",
    inverted: true,
  },
  {
    key: "climateConcernPct",
    label: "Climate Concern",
    unit: "%",
    category: "Socioeconomic",
    icon: Users,
    format: (v) => `${v.toFixed(0)}%`,
    source: "Gallup",
    color: "hsl(340, 65%, 50%)",
  },
  {
    key: "gdpTrillionUSD",
    label: "Global GDP",
    unit: "T USD",
    category: "Socioeconomic",
    icon: Globe,
    format: (v) => `$${v.toFixed(1)}T`,
    source: "World Bank / IMF",
    color: "hsl(220, 65%, 50%)",
  },
  {
    key: "policySupportPct",
    label: "Policy Support",
    unit: "%",
    category: "Socioeconomic",
    icon: Leaf,
    format: (v) => `${v.toFixed(0)}%`,
    source: "Pew Research",
    color: "hsl(168, 76%, 36%)",
  },
  {
    key: "cleanEnergyInvestmentTrn",
    label: "Clean Energy Investment",
    unit: "T USD",
    category: "Financial Flows",
    icon: Wind,
    format: (v) => `$${v.toFixed(2)}T`,
    source: "IEA World Energy Investment",
    color: "hsl(150, 65%, 40%)",
  },
  {
    key: "greenBondIssuanceBln",
    label: "Green Bond Issuance",
    unit: "B USD",
    category: "Financial Flows",
    icon: Banknote,
    format: (v) => `$${v.toFixed(0)}B`,
    source: "Climate Bonds Initiative",
    color: "hsl(120, 55%, 42%)",
  },
  {
    key: "fossilFuelInvestmentTrn",
    label: "Fossil Fuel Investment",
    unit: "T USD",
    category: "Financial Flows",
    icon: Landmark,
    format: (v) => `$${v.toFixed(2)}T`,
    source: "IEA World Energy Investment",
    color: "hsl(30, 70%, 45%)",
    inverted: true,
  },
  {
    key: "fossilCO2GtPerYear",
    label: "Fossil CO2 Emissions",
    unit: "GtCO2/yr",
    category: "Emissions Outcomes",
    icon: Activity,
    format: (v) => `${v.toFixed(1)} Gt`,
    source: "Global Carbon Project",
    color: "hsl(0, 65%, 50%)",
    inverted: true,
  },
  {
    key: "atmosphericCO2ppm",
    label: "Atmospheric CO2",
    unit: "ppm",
    category: "Emissions Outcomes",
    icon: Thermometer,
    format: (v) => `${v.toFixed(1)} ppm`,
    source: "NOAA Mauna Loa",
    color: "hsl(15, 70%, 50%)",
    inverted: true,
  },
  {
    key: "co2GrowthRatePpm",
    label: "CO2 Growth Rate",
    unit: "ppm/yr",
    category: "Emissions Outcomes",
    icon: Gauge,
    format: (v) => `${v.toFixed(2)} ppm/yr`,
    source: "NOAA / Global Carbon Project",
    color: "hsl(350, 60%, 48%)",
    inverted: true,
  },
];
const INDICATORS:IndicatorConfig[]=indicatorFieldSpecs.map(([key])=>{
  const config=CARD_CONFIG.find(c=>c.key===key);
  if(!config) throw new Error(`Missing registered indicator card configuration: ${key}`);
  return config;
});

function getCategoryColor(category: string): string {
  switch (category) {
    case "Technology":
      return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
    case "Policy":
      return "bg-amber-500/10 text-amber-600 dark:text-amber-400";
    case "Corporate":
      return "bg-orange-500/10 text-orange-600 dark:text-orange-400";
    case "Socioeconomic":
      return "bg-pink-500/10 text-pink-600 dark:text-pink-400";
    case "Financial Flows":
      return "bg-teal-500/10 text-teal-600 dark:text-teal-400";
    case "Emissions Outcomes":
      return "bg-red-500/10 text-red-600 dark:text-red-400";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function IndicatorCards({ historicalData, isLoading }: IndicatorCardsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 16 }).map((_, i) => (
          <Card key={i} className="p-4">
            <Skeleton className="h-4 w-24 mb-2" />
            <Skeleton className="h-8 w-20 mb-2" />
            <Skeleton className="h-12 w-full" />
          </Card>
        ))}
      </div>
    );
  }

  const hasNowcast = historicalData.some((d) => d.isNowcast);
  const firstYear = historicalData[0]?.year ?? 2010;
  const lastObservedYear = historicalData.filter((d) => !d.isNowcast).at(-1)?.year ?? 2024;
  const latestYear = historicalData[historicalData.length - 1]?.year ?? 2024;

  const downloadRows = certifyFiniteExport("indicatorCards",historicalData.map((d) => {
    const row: Record<string, string | number | undefined> = {
      Year: d.year,
      Estimated: d.isNowcast ? "yes" : "no",
    };
    for (const ind of INDICATORS) {
      row[indicatorExportColumn(ind.key)] = d[ind.key] as number | undefined;
    }
    return row;
  }),{keys:INDICATORS.map(ind=>ind.key)});

  return (
    <div data-testid="section-indicator-cards">
      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
        <p className="text-xs text-muted-foreground">
          Latest values with {firstYear}-{lastObservedYear} history{hasNowcast ? `, est. ${latestYear}` : ""}
        </p>
        <DownloadDataButton
          kind="indicators"
          filename="climate-indicators"
          sheetName="Indicators"
          rows={downloadRows}
          fieldBindings={finiteExportBindings("indicatorCards",{keys:INDICATORS.map(ind=>ind.key)})}
          testId="button-download-indicators"
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" data-testid="grid-indicator-cards">
      {INDICATORS.map((indicator) => {
        const sparkData = historicalData.map((d) => ({
          year: d.year,
          value: d.isNowcast ? undefined : (d[indicator.key] as number),
          nowcastValue: d.isNowcast ? (d[indicator.key] as number) : undefined,
        }));

        if (hasNowcast) {
          const lastObsIdx = sparkData.findIndex((d) => d.year === lastObservedYear);
          if (lastObsIdx >= 0) {
            sparkData[lastObsIdx].nowcastValue = sparkData[lastObsIdx].value;
          }
        }

        const latestValue = historicalData[historicalData.length - 1]?.[indicator.key] as number;
        const firstValue = historicalData[0]?.[indicator.key] as number;
        const available=typeof latestValue==="number"&&Number.isFinite(latestValue);
        const relativeChange = available&&typeof firstValue==="number"&&Number.isFinite(firstValue)&&firstValue!==0
          ? ((latestValue-firstValue)/firstValue)*100 : null;
        const change=relativeChange!==null&&Number.isFinite(relativeChange)?relativeChange:null;
        const isPositive = change!==null&&(indicator.inverted ? change < 0 : change > 0);
        const latestIsNowcast = historicalData[historicalData.length - 1]?.isNowcast;

        const Icon = indicator.icon;

        return (
          <Card key={indicator.key} className="p-4 hover-elevate" data-testid={`card-indicator-${indicator.key}`}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">{indicator.label}</span>
              </div>
              <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${getCategoryColor(indicator.category)}`}>
                {indicator.category}
              </Badge>
            </div>

            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-xl font-bold tabular-nums" data-testid={`text-indicator-value-${indicator.key}`}>
                {available ? indicator.format(latestValue) : "Unavailable"}
              </span>
              <span className={`text-xs font-medium ${change===null ? "text-muted-foreground" : isPositive ? "text-emerald-500" : "text-red-500"}`} data-testid={`text-indicator-change-${indicator.key}`}>
                {change===null ? "Change unavailable" : `${change>=0?"+":""}${change.toFixed(1)}%`}
              </span>
              {latestIsNowcast && (
                <span className="text-[10px] text-muted-foreground italic">est.</span>
              )}
            </div>

            <div className="h-10 mt-1">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sparkData}>
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke={indicator.color}
                    strokeWidth={1.5}
                    dot={false}
                    connectNulls={false}
                  />
                  {hasNowcast && (
                    <Line
                      type="monotone"
                      dataKey="nowcastValue"
                      stroke={indicator.color}
                      strokeWidth={1.5}
                      strokeDasharray="4 2"
                      dot={false}
                      connectNulls={false}
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>

            <p className="text-[10px] text-muted-foreground mt-1">
              Source: {indicator.source} ({firstYear}-{lastObservedYear}{hasNowcast ? `, est. ${latestYear}` : ""})
            </p>
          </Card>
        );
      })}
      </div>
    </div>
  );
}
