import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {matchingNewsCache,requireNewsRefreshAccess} from "../server/newsApi/providerAccess";
test("public cache misses cannot authorize provider refresh",()=>{
 assert.throws(()=>requireNewsRefreshAccess("cached-only"),/operator-news-refresh-required/);
 assert.doesNotThrow(()=>requireNewsRefreshAccess("operator-cli"));
 const source=readFileSync("server/newsApi/newsService.ts","utf8");
 assert.ok(source.indexOf("requireNewsRefreshAccess(access)")<source.indexOf("const timeAggr = await"));
 assert.match(source,/access: NewsAccess = "cached-only"/);
});
test("news memory cache respects selection, expiry and future time",()=>{
 const c={cacheKey:"climate_news_12m",fetchedAt:100};
 assert.equal(matchingNewsCache(c,c.cacheKey,150,60),true);
 assert.equal(matchingNewsCache(c,"climate_news_3m",150,60),false);
 assert.equal(matchingNewsCache(c,c.cacheKey,160,60),false);
 assert.equal(matchingNewsCache(c,c.cacheKey,99,60),false);
});
