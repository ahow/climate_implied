import type { OutputFieldSemantic } from "./outputFieldSemantics";

// These describe the existing estimator, including its unsupported fallbacks;
// they do not promote sampled or allocated counts to observed classifications.
export const newsFieldSpecs: [string,string,string,string][] = [
  ["volume[]","Daily provider count rows; empty when provider aggregation is absent","Object.entries(timeAggr).map(date/count).sort by date","daily rows"],
  ["sentiment[]","Month estimator rows including boundary months","getMonthlyBuckets(dateStart,dateEnd).map(month estimator)","monthly rows"],
  ["topicBreakdown[]","Four title-keyword estimator rows","Object.entries(topicKeywordMap).map(topic estimator)","topic rows"],
  ["recentArticles[]","Date-descending provider sample requested up to 200 articles","articles.results || []; map title, URL, source, date and nullable sentiment","article rows"],
  ["dateRange.start","Requested news window start","now with local month reduced by requested months, then toISOString().split('T')[0]","ISO date"],
  ["dateRange.end","Requested news window end","now.toISOString().split('T')[0]","ISO date"],
  ["volume[].date","Provider daily aggregation date","timeAggr.results[].date, sorted lexically","ISO date"],
  ["volume[].count","Provider count for English climate-keyword news","timeAggr.results[].count where date exists and count is numeric","articles"],
  ["totalArticles","Sum of provider daily counts","sum(volume[].count)","articles"],
  ["sentiment[].date","Calendar month bucket","getMonthlyBuckets(dateStart,dateEnd).label; boundary months clamped to window","YYYY-MM"],
  ["sentiment[].total","Provider monthly article volume","sum(volume.count where volume.date startsWith month label)","articles"],
  ["sentiment[].avgSentiment","Sampled sentiment mean, potentially pooled across entire window","round(100 * mean(non-null recent article sentiments in month if count >= 5, otherwise all non-null recent sentiments)) / 100; empty overall sample defaults to 0","sentiment score"],
  ["sentiment[].positive","Allocated positive count, NOT observed monthly classifications","round(monthlyVolume * count(recent non-null sentiment > 0.1) / count(recent non-null sentiment)); no sentiments defaults ratio to 0.4","estimated articles"],
  ["sentiment[].negative","Allocated negative count, NOT observed monthly classifications","round(monthlyVolume * count(recent non-null sentiment < -0.1) / count(recent non-null sentiment)); no sentiments defaults ratio to 0.15","estimated articles"],
  ["sentiment[].neutral","Allocated neutral count; independent rounding need not sum to total","round(monthlyVolume * (1 - overallPositiveRatio - overallNegativeRatio)); no sentiments gives ratio 0.45","estimated articles"],
  ["topicBreakdown[].topic","Fixed title-keyword topic category; topics can overlap","Policy, Technology, Corporate, Socioeconomic keys mapped to TOPIC_CATEGORIES","label"],
  ["topicBreakdown[].count","Extrapolated topic volume with imposed 5% minimum, NOT observed topic count","round(totalArticles * max(recent title keyword matches / recentArticles.length, 0.05)); empty article sample uses matchRatio=0","estimated articles"],
  ["topicBreakdown[].avgSentiment","Title-matched sample mean, or pooled fallback","round(100 * mean(non-null matched sentiments))/100; no matched sentiments uses rounded overallAvgSentiment, which defaults to 0 for empty sample","sentiment score"],
  ["recentArticles[].title","Provider article title","articles.results[].title","text"],
  ["recentArticles[].url","Provider article URL","articles.results[].url","URL"],
  ["recentArticles[].source","Provider source display name","article.source.title || article.source.uri || 'Unknown'","text"],
  ["recentArticles[].date","Provider article date, not retrieval time","article.date || article.dateTime?.split('T')[0] || ''","ISO date or empty string"],
  ["recentArticles[].sentiment","Provider article sentiment; absence is null","article.sentiment ?? null","sentiment score"],
];
export const newsFieldSemantics: OutputFieldSemantic[] = newsFieldSpecs.map(([field,meaning,formula,unit])=>({
  id:`news.${field}`,meaning,formula,unit,role:"Output",
  dependencies:["Event Registry timeAggr","Event Registry recent articles (requested maximum 200)","CLIMATE_KEYWORDS","TOPIC_CATEGORIES"],
  source:"server/newsApi/newsService.ts; Event Registry /api/v1/article/getArticles; English news with OR climate keywords",
  period:"Requested rolling month window; monthly or daily aggregation as specified",
  geography:"Provider English-language coverage, not representative global population",
  status:"Descriptive news diagnostic; allocated sentiment/topic counts and fallback scores are not observations or calibrated climate signals",
  missingness:"Provider missing result arrays become []; article sentiment remains null. Existing estimator uses 0.4/0.15 positive/negative ratios and zero mean when no sentiment is available; topic allocation has a 5% floor. These are unsupported defaults, not measured data.",
  uncertainty:"No sampling interval or calibrated uncertainty; recent-article sampling, title matching, rounding and provider coverage bias apply",
  scope:"News coverage only; no causal or physical climate inference",
  asOfRule:"Memory/database cache TTL six hours. Response has no fetchedAt or original-vintage archive; dateRange is query window, NOT information availability. Memory cache is shared across requested month windows.",
}));
