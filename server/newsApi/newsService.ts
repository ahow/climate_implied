import { db } from "../db";
import { newsCache } from "@shared/schema";
import { eq } from "drizzle-orm";

const NEWS_API_BASE = "https://eventregistry.org/api/v1";

const CLIMATE_KEYWORDS = [
  "decarbonization", "decarbonisation", "net zero", "carbon emissions",
  "climate policy", "Paris Agreement", "renewable energy", "carbon tax",
  "green transition", "climate targets", "emissions reduction",
  "carbon neutrality", "climate action", "clean energy transition",
];

const TOPIC_CATEGORIES: Record<string, string[]> = {
  policy: [
    "climate policy", "Paris Agreement", "carbon tax", "emissions regulation",
    "NDC", "climate legislation", "carbon pricing", "climate law",
  ],
  technology: [
    "renewable energy", "solar power", "wind energy", "electric vehicles",
    "battery storage", "green hydrogen", "carbon capture", "clean technology",
  ],
  corporate: [
    "net zero target", "science based targets", "ESG", "corporate emissions",
    "sustainable finance", "green bonds", "climate disclosure", "TCFD",
  ],
  socioeconomic: [
    "climate protest", "climate justice", "just transition", "climate anxiety",
    "climate migration", "green jobs", "energy poverty", "climate adaptation",
  ],
};

interface NewsApiArticle {
  uri: string;
  title: string;
  body?: string;
  url: string;
  source: { uri: string; title: string };
  dateTime: string;
  date: string;
  sentiment: number | null;
  lang: string;
  image?: string;
}

export interface NewsVolumePoint {
  date: string;
  count: number;
}

export interface NewsSentimentPoint {
  date: string;
  avgSentiment: number;
  positive: number;
  negative: number;
  neutral: number;
  total: number;
}

export interface TopicBreakdown {
  topic: string;
  count: number;
  avgSentiment: number;
}

export interface NewsArticleSummary {
  title: string;
  url: string;
  source: string;
  date: string;
  sentiment: number | null;
}

export interface ClimateNewsResult {
  volume: NewsVolumePoint[];
  sentiment: NewsSentimentPoint[];
  topicBreakdown: TopicBreakdown[];
  recentArticles: NewsArticleSummary[];
  totalArticles: number;
  dateRange: { start: string; end: string };
}

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

let memoryCache: { data: ClimateNewsResult; fetchedAt: number } | null = null;

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3): Promise<Response> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const resp = await fetch(url, options);
    if (resp.status === 429 && attempt < maxRetries - 1) {
      const waitMs = Math.pow(2, attempt + 1) * 1000;
      console.log(`[NewsAPI] Rate limited (429), waiting ${waitMs}ms before retry ${attempt + 2}/${maxRetries}...`);
      await delay(waitMs);
      continue;
    }
    return resp;
  }
  throw new Error("Max retries exceeded");
}

function getApiKey(): string {
  const key = process.env.NEWSAPI_KEY;
  if (!key) throw new Error("NEWSAPI_KEY environment variable is not set");
  return key;
}

async function getFromDbCache(cacheKey: string): Promise<ClimateNewsResult | null> {
  try {
    const rows = await db.select().from(newsCache).where(eq(newsCache.cacheKey, cacheKey)).limit(1);
    if (rows.length === 0) return null;

    const row = rows[0];
    const fetchedAt = new Date(row.fetchedAt).getTime();
    if (Date.now() - fetchedAt > CACHE_TTL_MS) {
      return null;
    }

    memoryCache = { data: row.resultData as ClimateNewsResult, fetchedAt };
    console.log(`[NewsAPI] Loaded from database cache (fetched ${Math.round((Date.now() - fetchedAt) / 60000)}m ago)`);
    return row.resultData as ClimateNewsResult;
  } catch (e) {
    console.error("[NewsAPI] DB cache read error:", e);
    return null;
  }
}

async function saveToDbCache(cacheKey: string, data: ClimateNewsResult): Promise<void> {
  try {
    const existing = await db.select({ id: newsCache.id }).from(newsCache).where(eq(newsCache.cacheKey, cacheKey)).limit(1);
    if (existing.length > 0) {
      await db.update(newsCache)
        .set({ resultData: data, fetchedAt: new Date() })
        .where(eq(newsCache.cacheKey, cacheKey));
    } else {
      await db.insert(newsCache).values({
        cacheKey,
        resultData: data,
        fetchedAt: new Date(),
      });
    }
    console.log(`[NewsAPI] Saved to database cache`);
  } catch (e) {
    console.error("[NewsAPI] DB cache write error:", e);
  }
}

async function fetchArticleTimeAggr(
  keywords: string[],
  dateStart: string,
  dateEnd: string,
): Promise<Record<string, number>> {
  const apiKey = getApiKey();
  const body = {
    apiKey,
    keyword: keywords,
    keywordOper: "or",
    lang: "eng",
    dateStart,
    dateEnd,
    resultType: "timeAggr",
    dataType: ["news"],
  };

  const resp = await fetchWithRetry(`${NEWS_API_BASE}/article/getArticles`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`NewsAPI timeAggr failed: ${resp.status} ${text}`);
  }

  const data = await resp.json();
  const results: Record<string, number> = {};
  const entries = data?.timeAggr?.results || [];
  for (const entry of entries) {
    if (entry.date && typeof entry.count === "number") {
      results[entry.date] = entry.count;
    }
  }
  return results;
}


async function fetchRecentArticles(
  keywords: string[],
  dateStart: string,
  dateEnd: string,
  count: number = 20,
): Promise<NewsArticleSummary[]> {
  const apiKey = getApiKey();
  const body = {
    apiKey,
    keyword: keywords,
    keywordOper: "or",
    lang: "eng",
    dateStart,
    dateEnd,
    resultType: "articles",
    articlesSortBy: "date",
    articlesCount: count,
    articleBodyLen: 0,
    dataType: ["news"],
    includeArticleSentiment: true,
  };

  const resp = await fetchWithRetry(`${NEWS_API_BASE}/article/getArticles`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`NewsAPI articles failed: ${resp.status} ${text}`);
  }

  const data = await resp.json();
  const articles: NewsApiArticle[] = data?.articles?.results || [];
  return articles.map((a) => ({
    title: a.title,
    url: a.url,
    source: a.source?.title || a.source?.uri || "Unknown",
    date: a.date || a.dateTime?.split("T")[0] || "",
    sentiment: a.sentiment ?? null,
  }));
}


function getMonthlyBuckets(dateStart: string, dateEnd: string): { start: string; end: string; label: string }[] {
  const buckets: { start: string; end: string; label: string }[] = [];
  const start = new Date(dateStart);
  const end = new Date(dateEnd);

  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  while (cursor <= end) {
    const monthStart = new Date(cursor);
    const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    const clampedStart = monthStart < start ? start : monthStart;
    const clampedEnd = monthEnd > end ? end : monthEnd;

    buckets.push({
      start: clampedStart.toISOString().split("T")[0],
      end: clampedEnd.toISOString().split("T")[0],
      label: `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`,
    });

    cursor.setMonth(cursor.getMonth() + 1);
  }
  return buckets;
}

export async function getClimateNewsAnalysis(
  months: number = 12,
): Promise<ClimateNewsResult> {
  const cacheKey = `climate_news_${months}m`;

  if (memoryCache && Date.now() - memoryCache.fetchedAt < CACHE_TTL_MS) {
    console.log(`[NewsAPI] Serving from memory cache`);
    return memoryCache.data;
  }

  const dbCached = await getFromDbCache(cacheKey);
  if (dbCached) {
    return dbCached;
  }

  const now = new Date();
  const dateEnd = now.toISOString().split("T")[0];
  const startDate = new Date(now);
  startDate.setMonth(startDate.getMonth() - months);
  const dateStart = startDate.toISOString().split("T")[0];

  console.log(`[NewsAPI] Fetching climate news analysis from ${dateStart} to ${dateEnd}...`);

  const timeAggr = await fetchArticleTimeAggr(CLIMATE_KEYWORDS, dateStart, dateEnd);
  await delay(500);
  const recentArticles = await fetchRecentArticles(CLIMATE_KEYWORDS, dateStart, dateEnd, 200);

  const volume: NewsVolumePoint[] = Object.entries(timeAggr)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const allWithSentiment = recentArticles.filter(a => a.sentiment !== null);
  const overallPositiveRatio = allWithSentiment.length > 0
    ? allWithSentiment.filter(a => (a.sentiment ?? 0) > 0.1).length / allWithSentiment.length : 0.4;
  const overallNegativeRatio = allWithSentiment.length > 0
    ? allWithSentiment.filter(a => (a.sentiment ?? 0) < -0.1).length / allWithSentiment.length : 0.15;
  const overallNeutralRatio = 1 - overallPositiveRatio - overallNegativeRatio;
  const overallAvgSentiment = allWithSentiment.length > 0
    ? allWithSentiment.reduce((s, a) => s + (a.sentiment ?? 0), 0) / allWithSentiment.length : 0;

  const monthlyBuckets = getMonthlyBuckets(dateStart, dateEnd);
  const sentiment: NewsSentimentPoint[] = monthlyBuckets.map(bucket => {
    const bucketVolume = volume
      .filter(v => v.date.startsWith(bucket.label))
      .reduce((sum, v) => sum + v.count, 0);

    const bucketArticles = recentArticles.filter(a => a.date.substring(0, 7) === bucket.label);
    const bucketWithSentiment = bucketArticles.filter(a => a.sentiment !== null);

    const avgSentiment = bucketWithSentiment.length >= 5
      ? Math.round((bucketWithSentiment.reduce((s, a) => s + (a.sentiment ?? 0), 0) / bucketWithSentiment.length) * 100) / 100
      : Math.round(overallAvgSentiment * 100) / 100;

    return {
      date: bucket.label,
      avgSentiment,
      positive: Math.round(bucketVolume * overallPositiveRatio),
      negative: Math.round(bucketVolume * overallNegativeRatio),
      neutral: Math.round(bucketVolume * overallNeutralRatio),
      total: bucketVolume,
    };
  });

  const topicKeywordMap: Record<string, string[]> = {
    Policy: TOPIC_CATEGORIES.policy,
    Technology: TOPIC_CATEGORIES.technology,
    Corporate: TOPIC_CATEGORIES.corporate,
    Socioeconomic: TOPIC_CATEGORIES.socioeconomic,
  };

  const totalVol = volume.reduce((sum, v) => sum + v.count, 0);
  const topicBreakdown: TopicBreakdown[] = Object.entries(topicKeywordMap).map(([topic, keywords]) => {
    const matched = recentArticles.filter(a => {
      const titleLower = a.title.toLowerCase();
      return keywords.some(kw => titleLower.includes(kw.toLowerCase()));
    });
    const matchRatio = recentArticles.length > 0 ? matched.length / recentArticles.length : 0;
    const estimatedCount = Math.round(totalVol * Math.max(matchRatio, 0.05));
    const withSentiment = matched.filter(a => a.sentiment !== null);
    const avgSentiment = withSentiment.length > 0
      ? Math.round((withSentiment.reduce((s, a) => s + (a.sentiment ?? 0), 0) / withSentiment.length) * 100) / 100
      : Math.round(overallAvgSentiment * 100) / 100;
    return { topic, count: estimatedCount, avgSentiment };
  });

  const totalArticles = volume.reduce((sum, v) => sum + v.count, 0);

  const result: ClimateNewsResult = {
    volume,
    sentiment,
    topicBreakdown,
    recentArticles,
    totalArticles,
    dateRange: { start: dateStart, end: dateEnd },
  };

  memoryCache = { data: result, fetchedAt: Date.now() };
  await saveToDbCache(cacheKey, result);

  console.log(`[NewsAPI] Analysis complete: ${totalArticles} articles, ${sentiment.length} monthly sentiment points`);

  return result;
}
