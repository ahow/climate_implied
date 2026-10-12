import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, BookOpen, Database, Calculator, BarChart3, Globe, FlaskConical, TrendingUp, DollarSign, Thermometer, ArrowRightLeft, Layers, Activity, GitCompare, LineChart } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { PublicationMethodologyNotes } from "@/components/publication-methodology-notes";

export default function Methodology() {
  return (
    <div className="bg-background">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold tracking-tight" data-testid="text-methodology-title">Methodology</h1>
            <p className="text-sm text-muted-foreground">Global Decarbonization Dashboard & Climate Scenario Analyzer</p>
          </div>
        </div>

        <PublicationMethodologyNotes />
        <div className="prose prose-sm dark:prose-invert max-w-none space-y-8">

          <div className="border-b pb-2 mb-4">
            <h2 className="text-base font-bold m-0 text-muted-foreground uppercase tracking-wider" data-testid="text-part1-heading">Part I: Decarbonization Dashboard</h2>
          </div>

          <section>
            <div className="flex items-center gap-2 mb-3">
              <BookOpen className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold m-0">Overview</h2>
            </div>
            <Card className="p-5">
              <p className="text-sm text-muted-foreground leading-relaxed m-0">
                The Global Decarbonization Dashboard provides probabilistic projections of future global warming
                based on current trends in technology deployment, policy implementation, corporate action,
                public opinion, financial flows, and observed emissions outcomes. The system employs a <strong>sector-specific
                forward projection model</strong> combined with <strong>Monte Carlo uncertainty quantification</strong> (10,000 simulations)
                to generate probability distributions for temperature outcomes by 2100. Financial flows (clean energy
                investment, green bonds, fossil divestment) serve as leading indicators, while observed emissions
                (Global Carbon Project data, atmospheric CO2, remaining carbon budget) provide ground truth validation.
              </p>
            </Card>
          </section>

          <section>
            <div className="flex items-center gap-2 mb-3">
              <Database className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold m-0">Data Sources</h2>
            </div>
            <Card className="p-5">
              <p className="text-sm text-muted-foreground mb-4">
                The dashboard tracks 22 primary indicators across six categories, sourced from publicly available datasets:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { category: "Technology", sources: ["IRENA Renewable Capacity Statistics", "IEA Global EV Outlook"], color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
                  { category: "Policy", sources: ["Climate Action Tracker", "Net Zero Tracker"], color: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
                  { category: "Corporate", sources: ["Science Based Targets initiative (SBTi)"], color: "bg-orange-500/10 text-orange-600 dark:text-orange-400" },
                  { category: "Socioeconomic", sources: ["Gallup Environment Poll", "Pew Research Climate Surveys", "World Bank / IMF WDI"], color: "bg-pink-500/10 text-pink-600 dark:text-pink-400" },
                  { category: "Financial Flows", sources: ["IEA World Energy Investment", "Climate Bonds Initiative", "Stand.earth Divestment Database"], color: "bg-teal-500/10 text-teal-600 dark:text-teal-400" },
                  { category: "Emissions Outcomes", sources: ["Global Carbon Project (GCP)", "NOAA Mauna Loa Observatory", "IPCC AR6 Carbon Budget"], color: "bg-red-500/10 text-red-600 dark:text-red-400" },
                ].map((cat) => (
                  <div key={cat.category}>
                    <Badge variant="secondary" className={`mb-2 ${cat.color}`}>{cat.category}</Badge>
                    <ul className="text-xs text-muted-foreground space-y-1 list-none p-0 m-0">
                      {cat.sources.map((s) => (
                        <li key={s} className="flex items-start gap-1.5">
                          <span className="text-primary mt-0.5">-</span>
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </Card>
          </section>

          <section>
            <div className="flex items-center gap-2 mb-3">
              <Calculator className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold m-0">Sector-Specific Model</h2>
            </div>
            <Card className="p-5">
              <p className="text-sm text-muted-foreground mb-4">
                The model divides global emissions (60.3 GtCO2e baseline from Climate TRACE) into six sectors:
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 font-medium">Sector</th>
                      <th className="text-right py-2 font-medium">Share</th>
                      <th className="text-right py-2 font-medium">Baseline (Gt)</th>
                      <th className="text-left py-2 font-medium pl-4">Reduction Driver</th>
                    </tr>
                  </thead>
                  <tbody className="text-muted-foreground">
                    {[
                      ["Power", "26.9%", "16.2", "Renewable energy displacement"],
                      ["Transport", "14.4%", "8.7", "Electric vehicle adoption"],
                      ["Industry", "24.1%", "14.5", "Electrification, efficiency"],
                      ["Buildings", "9.6%", "5.8", "Heat pumps, insulation"],
                      ["Agriculture", "17.1%", "10.3", "Methane reduction"],
                      ["Other", "8.0%", "4.8", "Waste management, forestry"],
                    ].map(([sector, share, baseline, driver]) => (
                      <tr key={sector} className="border-b border-dashed last:border-0">
                        <td className="py-2 font-medium text-foreground">{sector}</td>
                        <td className="text-right py-2">{share}</td>
                        <td className="text-right py-2">{baseline}</td>
                        <td className="py-2 pl-4">{driver}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </section>

          <section>
            <div className="flex items-center gap-2 mb-3">
              <FlaskConical className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold m-0">Monte Carlo Simulation</h2>
            </div>
            <Card className="p-5">
              <p className="text-sm text-muted-foreground mb-3">
                Rather than providing a single deterministic forecast, the application runs 10,000 simulations,
                sampling uncertain parameters from normal distributions:
              </p>
              <ul className="text-xs text-muted-foreground space-y-2 list-none p-0 m-0">
                {[
                  "Renewable growth rate uncertainty: \u00B115%",
                  "EV adoption uncertainty: \u00B120%",
                  "Policy effectiveness: sampled around implementation rate",
                  "Carbon intensity decline: \u00B112%",
                  "Economic growth: 2.5% \u00B1 0.8%",
                  "Climate sensitivity (ECS): 3.0 \u00B1 0.5\u00B0C",
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-primary font-bold">-</span>
                    {item}
                  </li>
                ))}
              </ul>
            </Card>
          </section>

          <section>
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold m-0">Temperature Conversion</h2>
            </div>
            <Card className="p-5">
              <p className="text-sm text-muted-foreground m-0">
                Temperature outcomes are calculated using the IPCC AR6 Transient Climate Response to Cumulative
                Emissions (TCRE) framework: approximately 0.45&deg;C per 1,000 GtCO2. Combined with 1.1&deg;C of
                already observed warming and climate sensitivity uncertainty (likely range 2.5-4.0&deg;C),
                this produces probability distributions for warming by 2100.
              </p>
            </Card>
          </section>

          <section>
            <div className="flex items-center gap-2 mb-3">
              <Globe className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold m-0">Regional Analysis</h2>
            </div>
            <Card className="p-5">
              <p className="text-sm text-muted-foreground m-0">
                Regional projections show what global warming would be if the entire world followed a specific
                region&apos;s carbon intensity path. Each region (EU, US, China, India) has a different carbon intensity
                (kg CO2 per $ GDP), which is used to scale the baseline emissions in the model. This approach
                highlights the gap between leaders (EU) and emerging economies (India) in decarbonization progress.
              </p>
            </Card>
          </section>

          <div className="border-b pb-2 mb-4 mt-12">
            <h2 className="text-base font-bold m-0 text-muted-foreground uppercase tracking-wider" data-testid="text-part2-heading">Part II: Climate Scenario Analyzer</h2>
          </div>

          <section>
            <div className="flex items-center gap-2 mb-3">
              <BookOpen className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold m-0" data-testid="text-scenario-overview-heading">Scenario Analyzer Overview</h2>
            </div>
            <Card className="p-5">
              <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                The Climate Scenario Analyzer evaluates how financial markets price decarbonization by comparing
                the market valuations (P/E ratios) of companies with ambitious emission reduction targets against
                those with weaker targets. This reveals whether the market assigns a growth premium or discount
                to decarbonization ambition.
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed m-0">
                The system processes company-level data including market capitalisation, net profit, emission targets,
                and carbon emissions to derive four interconvertible climate measures:
                <strong> implied temperature rise</strong>, <strong>rate of emissions reduction</strong>,
                <strong> net zero year</strong>, and <strong>implied carbon price</strong>.
              </p>
            </Card>
          </section>

          <section>
            <div className="flex items-center gap-2 mb-3">
              <ArrowRightLeft className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold m-0" data-testid="text-conversion-chain-heading">Conversion Chain</h2>
            </div>
            <Card className="p-5">
              <p className="text-sm text-muted-foreground mb-4">
                The four climate measures are derived from a single underlying signal &mdash; the P/E differential
                between ambitious and non-ambitious companies &mdash; and can be converted between each other:
              </p>
              <div className="bg-muted/50 rounded-md p-4 mb-4">
                <div className="flex flex-wrap items-center justify-center gap-2 text-xs font-medium text-center">
                  <Badge variant="outline">P/E Differential</Badge>
                  <span className="text-muted-foreground">&rarr;</span>
                  <Badge variant="outline">Implied Growth Premium</Badge>
                  <span className="text-muted-foreground">&rarr;</span>
                  <Badge variant="secondary">Rate of Emissions Reduction</Badge>
                  <span className="text-muted-foreground">&rarr;</span>
                  <Badge variant="outline">Implied Carbon Price</Badge>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2 text-xs font-medium text-center mt-2">
                  <Badge variant="secondary">Rate of Emissions Reduction</Badge>
                  <span className="text-muted-foreground">&rarr;</span>
                  <Badge variant="outline">Implied Temperature</Badge>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2 text-xs font-medium text-center mt-2">
                  <Badge variant="secondary">Rate of Emissions Reduction</Badge>
                  <span className="text-muted-foreground">&rarr;</span>
                  <Badge variant="outline">Net Zero Year</Badge>
                </div>
              </div>
              <p className="text-xs text-muted-foreground m-0">
                The <strong>rate of emissions reduction</strong> (annual % decline) is the central measure from which
                all others are derived. Each conversion is described in detail below.
              </p>
            </Card>
          </section>

          <section>
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold m-0" data-testid="text-gordon-heading">Step 1: Gordon Growth Model &mdash; P/E to Implied Decarb Rate</h2>
            </div>
            <Card className="p-5">
              <p className="text-sm text-muted-foreground mb-3">
                The Gordon Growth Model relates a company&apos;s P/E ratio to its implied long-term earnings growth rate:
              </p>
              <div className="bg-muted/50 rounded-md p-3 mb-3 font-mono text-xs">
                <div>g = r - (1 / PE)</div>
                <div className="mt-1 text-muted-foreground">
                  where g = implied growth, r = cost of equity (default 8%), PE = price-to-earnings ratio
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                Companies are classified into terciles by their announced emission reduction targets
                (absolute or relative to sector/sub-sector/industry peers). For each date, aggregate P/E ratios
                are computed for the best (most ambitious) and worst (least ambitious) terciles:
              </p>
              <div className="bg-muted/50 rounded-md p-3 mb-3 font-mono text-xs">
                <div>g_best = r - (1 / PE_best)</div>
                <div>g_worst = r - (1 / PE_worst)</div>
                <div className="mt-1">growth premium = g_best - g_worst</div>
                <div className="mt-1 font-bold">implied decarb rate (%/yr) = growth premium &times; 100</div>
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                The growth premium represents how much additional long-term growth the market attributes to
                companies with ambitious decarbonization targets. This differential is interpreted as the
                market&apos;s implied rate of decarbonization.
              </p>
              <p className="text-sm text-muted-foreground m-0">
                <strong>Negative values are meaningful:</strong> When the growth premium is negative, the market is
                assigning lower valuations to ambitious decarbonizers, implying that the market currently
                views decarbonization ambition as value-destructive. This flows through to negative implied
                carbon prices and higher implied temperatures.
              </p>
            </Card>
          </section>

          <section>
            <div className="flex items-center gap-2 mb-3">
              <DollarSign className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold m-0" data-testid="text-carbon-price-heading">Step 2: Implied Carbon Price</h2>
            </div>
            <Card className="p-5">
              <p className="text-sm text-muted-foreground mb-3">
                The implied annual decarbonization rate is converted to a carbon price using an evidence-based
                framework synthesising three independent approaches:
              </p>
              <ul className="text-xs text-muted-foreground space-y-2 list-none p-0 m-0 mb-4">
                {[
                  "Empirical semi-elasticity: ex-post evaluation of 39 countries' carbon pricing policies (Rafaty, Dolphin & Pretis 2025; Doebbeling-Hildebrandt et al. 2024)",
                  "IAM shadow prices: IPCC AR6 integrated assessment model carbon prices consistent with 1.5-2\u00B0C pathways",
                  "Marginal abatement cost curves (MACCs): bottom-up engineering analysis of techno-economic abatement potential at each price level (McKinsey, EDF)"
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-primary font-bold">{i + 1}.</span>
                    {item}
                  </li>
                ))}
              </ul>
              <p className="text-sm text-muted-foreground mb-3">
                The conversion proceeds in two stages:
              </p>
              <div className="bg-muted/50 rounded-md p-3 mb-3 font-mono text-xs">
                <div className="font-bold mb-1">Stage A: Annual rate &rarr; cumulative reduction</div>
                <div>R_cumulative = (1 - (1 - r)^T) &times; 100%</div>
                <div className="mt-1 text-muted-foreground">where r = annual rate (decimal), T = 6 years (horizon to ~2030)</div>
                <div className="font-bold mb-1 mt-3">Stage B: Cumulative reduction &rarr; carbon price (lookup table)</div>
                <div className="text-muted-foreground">Piecewise linear interpolation on the integrated evidence table</div>
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                The lookup table maps cumulative emission reductions to carbon prices ($/tCO2). The annual decarb rate
                is compounded over a 6-year horizon (2024&ndash;2030) to derive the cumulative reduction, which is then
                mapped to a carbon price via piecewise interpolation on the table below (central estimates):
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b">
                      <th className="text-right py-2 font-medium">Price ($/tCO2)</th>
                      <th className="text-right py-2 font-medium">Central Reduction (%)</th>
                      <th className="text-left py-2 font-medium pl-4">Signal Strength</th>
                    </tr>
                  </thead>
                  <tbody className="text-muted-foreground">
                    {[
                      ["$10", "4%", "Marginal"],
                      ["$25", "8%", "Low"],
                      ["$50", "16%", "Moderate"],
                      ["$75", "23%", "Substantial"],
                      ["$100", "29%", "Strong"],
                      ["$150", "38%", "Very strong"],
                      ["$200", "45%", "1.5\u00B0C-aligned"],
                      ["$300", "55%", "Very high"],
                      ["$500", "65%", "Near-complete fossil exit"],
                    ].map(([price, reduction, signal]) => (
                      <tr key={price} className="border-b border-dashed last:border-0">
                        <td className="text-right py-1.5 font-medium text-foreground">{price}</td>
                        <td className="text-right py-1.5">{reduction}</td>
                        <td className="py-1.5 pl-4">{signal}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground mt-3 m-0">
                For negative implied decarb rates (market penalises decarbonization), the price is extrapolated
                below zero using the slope of the first lookup segment ($2.50 per 1% reduction), yielding
                negative carbon prices. This reflects a market where decarbonization ambition is priced as a cost rather than a benefit.
              </p>
            </Card>
          </section>

          <section>
            <div className="flex items-center gap-2 mb-3">
              <Thermometer className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold m-0" data-testid="text-temp-conversion-heading">Step 3: Implied Temperature Rise</h2>
            </div>
            <Card className="p-5">
              <p className="text-sm text-muted-foreground mb-3">
                The implied annual decarbonization rate is projected forward to calculate cumulative CO2 emissions
                from 2024 to 2100, then converted to warming using the TCRE framework:
              </p>
              <div className="bg-muted/50 rounded-md p-3 mb-3 font-mono text-xs">
                <div className="font-bold mb-1">Emission trajectory</div>
                <div>E(y) = 60.3 &times; (1 - r)^y GtCO2/yr</div>
                <div className="mt-1 text-muted-foreground">where y = years from 2024, r = annual decarb rate (decimal)</div>
                <div className="font-bold mb-1 mt-3">Cumulative emissions</div>
                <div>C = &Sigma; max(0, E(y)) for y = 0 to 76</div>
                <div className="font-bold mb-1 mt-3">Temperature</div>
                <div>T = 1.1&deg;C + C &times; 0.00045 &deg;C/GtCO2</div>
                <div className="mt-1 text-muted-foreground">TCRE = 0.45&deg;C per 1,000 GtCO2 (IPCC AR6), baseline warming = 1.1&deg;C</div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b">
                      <th className="text-right py-2 font-medium">Annual Decarb Rate</th>
                      <th className="text-right py-2 font-medium">Cumulative Emissions (Gt)</th>
                      <th className="text-right py-2 font-medium">Implied Warming</th>
                      <th className="text-left py-2 font-medium pl-4">Pathway</th>
                    </tr>
                  </thead>
                  <tbody className="text-muted-foreground">
                    {[
                      ["0%/yr", "4,643", "3.19\u00B0C", "No action (flat emissions)"],
                      ["2%/yr", "2,379", "2.17\u00B0C", "Moderate decline"],
                      ["5%/yr", "1,183", "1.63\u00B0C", "Ambitious (near 2\u00B0C)"],
                      ["7%/yr", "858", "1.49\u00B0C", "1.5\u00B0C-consistent"],
                      ["10%/yr", "603", "1.37\u00B0C", "Aggressive decarbonization"],
                      ["-1%/yr", "6,944", "4.22\u00B0C", "Rising emissions"],
                    ].map(([rate, emissions, temp, pathway]) => (
                      <tr key={rate} className="border-b border-dashed last:border-0">
                        <td className="text-right py-1.5 font-medium text-foreground">{rate}</td>
                        <td className="text-right py-1.5">{emissions}</td>
                        <td className="text-right py-1.5">{temp}</td>
                        <td className="py-1.5 pl-4">{pathway}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </section>

          <section>
            <div className="flex items-center gap-2 mb-3">
              <Calculator className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold m-0" data-testid="text-netzero-heading">Step 4: Net Zero Year</h2>
            </div>
            <Card className="p-5">
              <p className="text-sm text-muted-foreground mb-3">
                The net zero year is the year when cumulative emission reductions reach 95% of the baseline,
                derived from the annual decarbonization rate:
              </p>
              <div className="bg-muted/50 rounded-md p-3 mb-3 font-mono text-xs">
                <div>Net zero year = 2024 + ln(0.05) / ln(1 - r)</div>
                <div className="mt-1 text-muted-foreground">where r = annual decarb rate (decimal), 0.05 = 5% residual threshold</div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b">
                      <th className="text-right py-2 font-medium">Annual Decarb Rate</th>
                      <th className="text-right py-2 font-medium">Net Zero Year</th>
                    </tr>
                  </thead>
                  <tbody className="text-muted-foreground">
                    {[
                      ["2%/yr", "~2172"],
                      ["3%/yr", "~2122"],
                      ["5%/yr", "~2082"],
                      ["7%/yr", "~2065"],
                      ["10%/yr", "~2052"],
                      ["15%/yr", "~2042"],
                    ].map(([rate, year]) => (
                      <tr key={rate} className="border-b border-dashed last:border-0">
                        <td className="text-right py-1.5 font-medium text-foreground">{rate}</td>
                        <td className="text-right py-1.5">{year}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground mt-3 m-0">
                For negative or zero decarb rates, net zero is undefined (emissions never decline to near zero).
              </p>
            </Card>
          </section>

          <section>
            <div className="flex items-center gap-2 mb-3">
              <Layers className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold m-0" data-testid="text-tercile-heading">Tercile Classification Methods</h2>
            </div>
            <Card className="p-5">
              <p className="text-sm text-muted-foreground mb-3">
                Companies are ranked by their announced 2050 emission reduction targets and divided into terciles
                (best, middle, worst). The classification can be performed four ways:
              </p>
              <ul className="text-xs text-muted-foreground space-y-3 list-none p-0 m-0">
                {[
                  { method: "Absolute", desc: "All companies ranked globally by target ambition. The top third are 'best' and bottom third are 'worst'." },
                  { method: "Sector Relative", desc: "Companies ranked within their sector (e.g., Industrials, Financials). This controls for sectors where high decarbonization targets are structurally harder to achieve." },
                  { method: "Sub-Sector Relative", desc: "Companies ranked within their sub-sector (e.g., Ind. Goods & Services, Banks). Provides finer-grained comparison among closer peers." },
                  { method: "Industry Relative", desc: "Companies ranked within their industry (e.g., Ind. Transportation, Retail Banking). The most granular level, comparing companies with very similar emission profiles." },
                ].map((item) => (
                  <li key={item.method} className="flex items-start gap-2">
                    <Badge variant="secondary" className="shrink-0 mt-0.5">{item.method}</Badge>
                    <span>{item.desc}</span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground mt-3 m-0">
                Annual decarbonization rates are derived from 2050 emission targets using: r = 1 - (1 - target)^(1/years),
                where target is the cumulative % reduction and years = 26 (2024 to 2050).
                Targets of 100% are capped at 99% before annualising to avoid mathematical singularity.
              </p>
            </Card>
          </section>

          <div className="border-b pb-2 mb-4 mt-12">
            <h2 className="text-base font-bold m-0 text-muted-foreground uppercase tracking-wider" data-testid="text-part3-heading">Part III: Decarb Gap Signal</h2>
          </div>

          <section>
            <div className="flex items-center gap-2 mb-3">
              <BookOpen className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold m-0" data-testid="text-decarb-gap-overview-heading">Decarb Gap Overview</h2>
            </div>
            <Card className="p-5">
              <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                The Decarb Gap Signal identifies companies whose market valuations imply a decarbonization rate
                that differs from the globally projected rate. By comparing each company&apos;s <strong>market-implied
                decarbonization rate</strong> (derived from its P/E ratio relative to peers) against the
                <strong> projected global decarbonization rate</strong> (from the dashboard&apos;s historical trend analysis),
                the signal highlights potential mispricings in how the market values the energy transition.
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed m-0">
                A <strong>positive gap</strong> (projected rate exceeds the company&apos;s implied rate) suggests
                the market underestimates the pace of decarbonization for that company &mdash; a potential
                buy signal. A <strong>negative gap</strong> suggests the market may be overpricing transition expectations.
              </p>
            </Card>
          </section>

          <section>
            <div className="flex items-center gap-2 mb-3">
              <Activity className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold m-0" data-testid="text-per-company-implied-heading">Per-Company Implied Decarbonization Rate</h2>
            </div>
            <Card className="p-5">
              <p className="text-sm text-muted-foreground mb-3">
                Each company&apos;s implied decarbonization rate measures how much the market values that company&apos;s
                transition prospects <em>relative to its peers</em>. The calculation proceeds in three steps:
              </p>
              <div className="bg-muted/50 rounded-md p-3 mb-3 font-mono text-xs">
                <div className="font-bold mb-1">Step 1: Implied growth from P/E</div>
                <div>g_company = r - (1 / PE_company)</div>
                <div className="mt-1 text-muted-foreground">where r = cost of equity (default 8%), PE = price-to-earnings ratio</div>
                <div className="font-bold mb-1 mt-3">Step 2: Peer median growth</div>
                <div>g_peer_median = median(g) across all companies in the same peer group</div>
                <div className="mt-1 text-muted-foreground">Peer group is determined by the selected classification method</div>
                <div className="font-bold mb-1 mt-3">Step 3: Implied decarb rate</div>
                <div>implied_decarb_rate = (g_company - g_peer_median) &times; 100 %/yr</div>
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                Companies whose P/E ratios imply growth rates above their peer group median are interpreted as
                having positive market-implied decarbonization rates &mdash; the market assigns them a
                &ldquo;transition premium.&rdquo; Companies below the median receive negative implied rates.
              </p>
              <p className="text-sm text-muted-foreground m-0">
                The peer group classification follows the same four methods described in the Tercile Classification
                section: <strong>Absolute</strong> (all companies together), <strong>Sector Relative</strong>,
                <strong> Sub-Sector Relative</strong>, and <strong>Industry Relative</strong>. Finer groupings
                control for structural differences in valuation levels across industries.
              </p>
            </Card>
          </section>

          <section>
            <div className="flex items-center gap-2 mb-3">
              <GitCompare className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold m-0" data-testid="text-gap-signal-heading">Gap Signal Construction</h2>
            </div>
            <Card className="p-5">
              <p className="text-sm text-muted-foreground mb-3">
                The gap for each company is the difference between the projected global decarbonization rate
                and the company&apos;s market-implied rate:
              </p>
              <div className="bg-muted/50 rounded-md p-3 mb-3 font-mono text-xs">
                <div>gap = projected_rate - implied_decarb_rate</div>
                <div className="mt-2 font-bold mb-1">Signal scoring (peer-relative rank)</div>
                <div>1. Sort companies by gap within each peer group</div>
                <div>2. Assign percentile rank: pctile = rank / (N - 1)</div>
                <div>3. Convert to score: score = (pctile - 0.5) &times; 2</div>
                <div className="mt-1 text-muted-foreground">Score range: -1 (most overpriced) to +1 (most underpriced)</div>
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                The scoring uses continuous rank-based percentiles rather than discrete terciles. This preserves
                the full ordering of companies and avoids cliff effects at tercile boundaries. The score is
                centred at zero (median company) and ranges symmetrically from -1 to +1.
              </p>
              <p className="text-sm text-muted-foreground m-0">
                The <strong>projected rate</strong> comes from the dashboard&apos;s historical trend analysis, which
                back-calculates a decarbonization rate for each year (2015&ndash;2025) based on the Monte Carlo model
                applied to historical indicator values. This rate evolves over time as real-world policy, technology,
                and investment data change.
              </p>
            </Card>
          </section>

          <section>
            <div className="flex items-center gap-2 mb-3">
              <LineChart className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold m-0" data-testid="text-backtest-heading">Signal Backtest</h2>
            </div>
            <Card className="p-5">
              <p className="text-sm text-muted-foreground mb-3">
                The backtest evaluates signal performance by constructing a tilted portfolio against a
                market-cap-weighted benchmark, using monthly Total Return Index (RI) data to calculate returns.
              </p>
              <div className="bg-muted/50 rounded-md p-3 mb-3 font-mono text-xs">
                <div className="font-bold mb-1">Benchmark</div>
                <div>r_bench = &Sigma; (w_i &times; r_i), where w_i = MV_i / &Sigma;MV</div>
                <div className="mt-1 text-muted-foreground">Market-cap-weighted return across all companies with valid RI data</div>
                <div className="font-bold mb-1 mt-3">Portfolio weight tilting</div>
                <div>w_portfolio_i = w_bench_i + (score_i &times; tiltScale &times; w_bench_i)</div>
                <div className="mt-1 text-muted-foreground">Positive scores overweight; negative scores underweight. Weights floored at zero.</div>
                <div className="font-bold mb-1 mt-3">Tracking error constraint</div>
                <div>tiltScale calibrated via binary search so that annualised TE &asymp; target</div>
                <div className="mt-1 text-muted-foreground">TE = &sigma;(active returns) &times; &radic;12, target default = 2%</div>
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                The tilt scale is calibrated using binary search (up to 20 iterations) to match the target
                tracking error within 2% relative tolerance on the full sample. This is ex-post calibration,
                not an ex-ante risk guarantee; check the returned realised TE and calibration status.
              </p>
              <p className="text-sm text-muted-foreground m-0">
                Monthly returns with absolute value exceeding 50% are excluded as outliers to prevent
                data quality issues from distorting results.
              </p>
            </Card>
          </section>

          <section>
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold m-0" data-testid="text-dual-strategy-heading">Signal Comparison and Limitations</h2>
            </div>
            <Card className="p-5">
              <p className="text-sm text-muted-foreground mb-3">
                The page compares a selected signal with Decarb Gap, not two implementations of the same strategy.
                When Decarb Gap is selected, the duplicate line is hidden.
              </p>
              <ul className="text-xs text-muted-foreground space-y-3 list-none p-0 m-0 mb-4">
                {[
                  { strategy: "Selected signal", desc: "Carbon intensity, SDG and ambition use fixed company scores ranked across the filtered universe. They are retrospective comparisons, not point-in-time investable backtests. Peer-relative methods are not supported for these backtests." },
                  { strategy: "Decarb Gap", desc: "Formerly labelled Valuation-Aware. Requested with signal=decarb_gap; no separate strategy parameter exists. Ranks projected rate minus company implied rate within the selected peer groups. Lower P/E means lower implied growth, not higher growth." },
                ].map((item) => (
                  <li key={item.strategy} className="flex items-start gap-2">
                    <Badge variant="secondary" className="shrink-0 mt-0.5">{item.strategy}</Badge>
                    <span>{item.desc}</span>
                  </li>
                ))}
              </ul>
              <div className="bg-muted/50 rounded-md p-3 mb-3 font-mono text-xs">
                <div className="font-bold mb-1">Time-varying signal (decarb gap)</div>
                <div>Recomputed quarterly using records dated through the prior quarter-end:</div>
                <div className="mt-1">1. P/E ratios &rarr; implied growth rates (publication dates not verified)</div>
                <div>2. Projected rate from a retrospective reconstruction using current methodology</div>
                <div>3. Gap scores ranked within peer groups</div>
                <div className="mt-2 text-muted-foreground">Quarter-lagging does not establish point-in-time availability. Subtracting the same global rate from every company's implied rate does not change within-peer rankings.</div>
              </div>
              <p className="text-sm text-muted-foreground m-0">
                All signals use full-sample, ex-post tilt calibration. The default target is 2% annualised TE,
                not a demonstrated ex-ante risk budget. Returns exclude trading costs. The displayed TE series
                uses an expanding window; full-period realised TE and the calibrated tilt are reported separately.
              </p>
            </Card>
          </section>

          <section>
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold m-0" data-testid="text-references-heading">References</h2>
            </div>
            <Card className="p-5">
              <ul className="text-xs text-muted-foreground space-y-2 list-none p-0 m-0">
                {[
                  "IPCC AR6 WG3 (2022). Climate Change 2022: Mitigation of Climate Change. Chapter 3, Figure 3.34.",
                  "IPCC SR1.5 (2018). Global Warming of 1.5\u00B0C. Chapter 2, Figure 2.26.",
                  "Rafaty, R., Dolphin, G. & Pretis, F. (2025). Carbon pricing and the elasticity of CO2 emissions. Energy Economics, 144.",
                  "Doebbeling-Hildebrandt, N. et al. (2024). Systematic review and meta-analysis of ex-post evaluations on the effectiveness of carbon pricing. Nature Communications, 15, 4147.",
                  "Parry, I. et al. (2021). Proposal for an International Carbon Price Floor Among Large Emitters. IMF Staff Climate Note 2021/001.",
                  "Naucler, T. & Enkvist, P.-A. (2009). Pathways to a Low-Carbon Economy. McKinsey Global GHG Abatement Cost Curve v2.",
                  "Gordon, M.J. (1959). Dividends, Earnings, and Stock Prices. Review of Economics and Statistics, 41(2).",
                ].map((ref, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-primary font-bold shrink-0">[{i + 1}]</span>
                    {ref}
                  </li>
                ))}
              </ul>
            </Card>
          </section>

        </div>

        <div className="mt-8 text-center">
          <Link href="/">
            <Button variant="outline" data-testid="button-back-to-dashboard">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
