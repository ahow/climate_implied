import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Newspaper, TrendingUp, TrendingDown, BarChart3, ExternalLink } from "lucide-react";
import { DownloadDataButton } from "@/components/download-data-button";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts";

interface NewsVolumePoint {
  date: string;
  count: number;
}

interface NewsSentimentPoint {
  date: string;
  avgSentiment: number;
  positive: number;
  negative: number;
  neutral: number;
  total: number;
}

interface TopicBreakdown {
  topic: string;
  count: number;
  avgSentiment: number;
}

interface NewsArticleSummary {
  title: string;
  url: string;
  source: string;
  date: string;
  sentiment: number | null;
}

interface ClimateNewsResult {
  volume: NewsVolumePoint[];
  sentiment: NewsSentimentPoint[];
  topicBreakdown: TopicBreakdown[];
  recentArticles: NewsArticleSummary[];
  totalArticles: number;
  dateRange: { start: string; end: string };
}

const SENTIMENT_COLORS = {
  positive: "hsl(142, 71%, 45%)",
  neutral: "hsl(215, 14%, 55%)",
  negative: "hsl(0, 72%, 51%)",
};

function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toLocaleString();
}

function sentimentLabel(s: number | null): { text: string; className: string } {
  if (s === null) return { text: "N/A", className: "text-muted-foreground" };
  if (s > 0.1) return { text: "Positive", className: "text-green-600 dark:text-green-400" };
  if (s < -0.1) return { text: "Negative", className: "text-red-600 dark:text-red-400" };
  return { text: "Neutral", className: "text-muted-foreground" };
}

function aggregateVolumeWeekly(daily: NewsVolumePoint[]): { date: string; count: number }[] {
  const weekMap = new Map<string, number>();
  for (const pt of daily) {
    const d = new Date(pt.date);
    const dayOfWeek = d.getDay();
    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - dayOfWeek);
    const key = weekStart.toISOString().split("T")[0];
    weekMap.set(key, (weekMap.get(key) || 0) + pt.count);
  }
  return Array.from(weekMap.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export default function NewsSentiment() {
  const [months, setMonths] = useState("12");

  const { data, isLoading, error } = useQuery<ClimateNewsResult>({
    queryKey: ["/api/news/climate", months],
    queryFn: async () => {
      const resp = await fetch(`/api/news/climate?months=${months}`);
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({ error: "Unknown error" }));
        const err = new Error(body.error || "Failed to fetch news data");
        (err as any).status = resp.status;
        throw err;
      }
      return resp.json();
    },
    staleTime: 6 * 60 * 60 * 1000,
    retry: 1,
  });

  const weeklyVolume = useMemo(() => {
    if (!data?.volume) return [];
    return aggregateVolumeWeekly(data.volume);
  }, [data?.volume]);

  const sentimentTrend = useMemo(() => {
    if (!data?.sentiment) return [];
    return data.sentiment.map((s) => ({
      ...s,
      positiveShare: s.total > 0 ? Math.round((s.positive / s.total) * 100) : 0,
      negativeShare: s.total > 0 ? Math.round((s.negative / s.total) * 100) : 0,
      neutralShare: s.total > 0 ? Math.round((s.neutral / s.total) * 100) : 0,
    }));
  }, [data?.sentiment]);

  const overallSentiment = useMemo(() => {
    if (!data?.sentiment?.length) return null;
    const totalPos = data.sentiment.reduce((s, p) => s + p.positive, 0);
    const totalNeg = data.sentiment.reduce((s, p) => s + p.negative, 0);
    const totalNeu = data.sentiment.reduce((s, p) => s + p.neutral, 0);
    const total = totalPos + totalNeg + totalNeu;
    return {
      avgSentiment: total > 0 ? (totalPos - totalNeg) / total : 0,
      positiveShare: total > 0 ? Math.round((totalPos / total) * 100) : 0,
      negativeShare: total > 0 ? Math.round((totalNeg / total) * 100) : 0,
    };
  }, [data?.sentiment]);

  const recentSentimentTrend = useMemo(() => {
    if (!data?.sentiment || data.sentiment.length < 3) return null;
    const recent = data.sentiment.slice(-3);
    const older = data.sentiment.slice(-6, -3);
    if (older.length === 0) return null;
    const recentAvg = recent.reduce((s, p) => s + p.avgSentiment, 0) / recent.length;
    const olderAvg = older.reduce((s, p) => s + p.avgSentiment, 0) / older.length;
    return recentAvg - olderAvg;
  }, [data?.sentiment]);

  const volumeRows = weeklyVolume.map((w) => ({
    "Week Of": w.date,
    "Article Count": w.count,
  }));

  const sentimentTrendRows = sentimentTrend.map((s) => ({
    Month: s.date,
    "Avg Sentiment": s.avgSentiment,
    "Positive Articles": s.positive,
    "Neutral Articles": s.neutral,
    "Negative Articles": s.negative,
    "Total Articles": s.total,
  }));

  const sentimentBreakdownRows = sentimentTrend.map((s) => ({
    Month: s.date,
    "Positive (%)": s.positiveShare,
    "Neutral (%)": s.neutralShare,
    "Negative (%)": s.negativeShare,
  }));

  const topicRows = (data?.topicBreakdown ?? []).map((t) => ({
    Topic: t.topic,
    "Article Count": t.count,
    "Avg Sentiment": t.avgSentiment,
  }));

  if (error) {
    const isKeyMissing = (error as any).status === 503 || (error as Error).message.includes("not configured");
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <Card className="p-8 text-center">
          <Newspaper className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-lg font-semibold mb-2" data-testid="text-news-error-title">
            {isKeyMissing ? "News API Not Configured" : "Unable to Load News Data"}
          </h2>
          <p className="text-sm text-muted-foreground" data-testid="text-news-error-message">
            {isKeyMissing
              ? "A NewsAPI.ai API key is required. Add NEWSAPI_KEY to your environment secrets."
              : "There was a problem fetching climate news data. Please try again later."}
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-news-title">Climate News Sentiment</h1>
          <p className="text-sm text-muted-foreground mt-1" data-testid="text-news-subtitle">
            Volume and sentiment analysis of global climate & decarbonization news coverage
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Period:</span>
          <Select value={months} onValueChange={setMonths}>
            <SelectTrigger className="w-[130px]" data-testid="select-months-trigger">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3" data-testid="select-months-3">3 months</SelectItem>
              <SelectItem value="6" data-testid="select-months-6">6 months</SelectItem>
              <SelectItem value="12" data-testid="select-months-12">12 months</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="p-4">
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-8 w-16" />
            </Card>
          ))}
        </div>
      ) : data ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-4" data-testid="card-total-articles">
              <p className="text-xs text-muted-foreground mb-1">Total Articles</p>
              <p className="text-2xl font-bold">{formatNumber(data.totalArticles)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {data.dateRange.start} to {data.dateRange.end}
              </p>
            </Card>
            <Card className="p-4" data-testid="card-overall-sentiment">
              <p className="text-xs text-muted-foreground mb-1">Overall Sentiment</p>
              <p className={`text-2xl font-bold ${sentimentLabel(overallSentiment?.avgSentiment ?? 0).className}`}>
                {overallSentiment ? (overallSentiment.avgSentiment > 0 ? "+" : "") + overallSentiment.avgSentiment.toFixed(2) : "N/A"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {overallSentiment ? `${overallSentiment.positiveShare}% positive / ${overallSentiment.negativeShare}% negative` : ""}
              </p>
            </Card>
            <Card className="p-4" data-testid="card-sentiment-trend">
              <p className="text-xs text-muted-foreground mb-1">Sentiment Trend</p>
              <div className="flex items-center gap-1">
                {recentSentimentTrend !== null ? (
                  <>
                    {recentSentimentTrend > 0 ? (
                      <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
                    ) : (
                      <TrendingDown className="h-5 w-5 text-red-600 dark:text-red-400" />
                    )}
                    <span className={`text-2xl font-bold ${recentSentimentTrend > 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                      {recentSentimentTrend > 0 ? "+" : ""}{recentSentimentTrend.toFixed(2)}
                    </span>
                  </>
                ) : (
                  <span className="text-2xl font-bold text-muted-foreground">--</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">vs. prior 3 months</p>
            </Card>
            <Card className="p-4" data-testid="card-weekly-avg">
              <p className="text-xs text-muted-foreground mb-1">Weekly Avg Volume</p>
              <p className="text-2xl font-bold">
                {weeklyVolume.length > 0
                  ? formatNumber(Math.round(weeklyVolume.reduce((s, w) => s + w.count, 0) / weeklyVolume.length))
                  : "0"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">articles/week</p>
            </Card>
          </div>

          <Card className="p-4" data-testid="card-volume-chart">
            <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
              <h3 className="text-sm font-semibold">Weekly News Volume</h3>
              <DownloadDataButton
                filename="weekly-news-volume"
                sheetName="News Volume"
                rows={volumeRows}
                testId="button-download-volume"
              />
            </div>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={weeklyVolume} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <defs>
                    <linearGradient id="volumeGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(168, 76%, 42%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(168, 76%, 42%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) => {
                      const d = new Date(v);
                      return `${d.toLocaleString("default", { month: "short" })} ${d.getDate()}`;
                    }}
                    interval={Math.max(0, Math.floor(weeklyVolume.length / 10))}
                  />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={formatNumber} />
                  <Tooltip
                    formatter={(value: number) => [formatNumber(value), "Articles"]}
                    labelFormatter={(label) => `Week of ${label}`}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="hsl(168, 76%, 42%)"
                    fill="url(#volumeGradient)"
                    strokeWidth={2}
                    name="Articles"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="p-4" data-testid="card-sentiment-trend-chart">
              <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
                <h3 className="text-sm font-semibold">Monthly Sentiment Trend</h3>
                <DownloadDataButton
                  filename="monthly-sentiment-trend"
                  sheetName="Sentiment Trend"
                  rows={sentimentTrendRows}
                  testId="button-download-sentiment-trend"
                />
              </div>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={sentimentTrend} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v) => {
                        const [y, m] = v.split("-");
                        return `${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][parseInt(m) - 1]} ${y.slice(2)}`;
                      }}
                    />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      domain={[-1, 1]}
                      tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                    />
                    <Tooltip
                      formatter={(value: number, name: string) => {
                        if (name === "Avg Sentiment") return [(value * 100).toFixed(1) + "%", name];
                        return [value + "%", name];
                      }}
                    />
                    <Legend />
                    <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" opacity={0.5} />
                    <Line
                      type="monotone"
                      dataKey="avgSentiment"
                      stroke="hsl(168, 76%, 42%)"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      name="Avg Sentiment"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="p-4" data-testid="card-sentiment-breakdown-chart">
              <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
                <h3 className="text-sm font-semibold">Monthly Sentiment Breakdown</h3>
                <DownloadDataButton
                  filename="monthly-sentiment-breakdown"
                  sheetName="Sentiment Breakdown"
                  rows={sentimentBreakdownRows}
                  testId="button-download-sentiment-breakdown"
                />
              </div>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sentimentTrend} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v) => {
                        const [y, m] = v.split("-");
                        return `${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][parseInt(m) - 1]}`;
                      }}
                    />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
                    <Tooltip formatter={(value: number, name: string) => [`${value}%`, name]} />
                    <Legend />
                    <Bar dataKey="positiveShare" stackId="a" fill={SENTIMENT_COLORS.positive} name="Positive" />
                    <Bar dataKey="neutralShare" stackId="a" fill={SENTIMENT_COLORS.neutral} name="Neutral" />
                    <Bar dataKey="negativeShare" stackId="a" fill={SENTIMENT_COLORS.negative} name="Negative" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="p-4" data-testid="card-topic-breakdown">
              <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
                <h3 className="text-sm font-semibold">Coverage by Topic</h3>
                <DownloadDataButton
                  filename="coverage-by-topic"
                  sheetName="Topic Coverage"
                  rows={topicRows}
                  testId="button-download-topic"
                />
              </div>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data.topicBreakdown}
                    layout="vertical"
                    margin={{ top: 5, right: 20, left: 50, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                    <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={formatNumber} />
                    <YAxis type="category" dataKey="topic" tick={{ fontSize: 12 }} width={90} />
                    <Tooltip
                      formatter={(value: number, name: string) => [formatNumber(value), name]}
                    />
                    <Bar dataKey="count" name="Articles" radius={[0, 4, 4, 0]}>
                      {data.topicBreakdown.map((entry, index) => (
                        <Cell
                          key={index}
                          fill={
                            entry.avgSentiment > 0.05
                              ? SENTIMENT_COLORS.positive
                              : entry.avgSentiment < -0.05
                              ? SENTIMENT_COLORS.negative
                              : SENTIMENT_COLORS.neutral
                          }
                          fillOpacity={0.8}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: SENTIMENT_COLORS.positive }} />
                  Positive sentiment
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: SENTIMENT_COLORS.neutral }} />
                  Neutral
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: SENTIMENT_COLORS.negative }} />
                  Negative
                </span>
              </div>
            </Card>

            <Card className="p-4" data-testid="card-recent-articles">
              <h3 className="text-sm font-semibold mb-4">Recent Articles</h3>
              <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
                {data.recentArticles.map((article, i) => {
                  const sl = sentimentLabel(article.sentiment);
                  return (
                    <div
                      key={i}
                      className="flex flex-col gap-1 p-2 rounded-md border"
                      data-testid={`card-article-${i}`}
                    >
                      <a
                        href={article.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium hover:underline flex items-start gap-1"
                        data-testid={`link-article-${i}`}
                      >
                        <span className="line-clamp-2">{article.title}</span>
                        <ExternalLink className="h-3 w-3 flex-shrink-0 mt-0.5" />
                      </a>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>{article.source}</span>
                        <span>{article.date}</span>
                        <Badge variant="secondary" className={`text-[10px] ${sl.className}`}>
                          {article.sentiment !== null ? `${article.sentiment > 0 ? "+" : ""}${article.sentiment.toFixed(2)}` : "N/A"}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
                {data.recentArticles.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">No articles found</p>
                )}
              </div>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}
