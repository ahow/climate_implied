export type NewsAccess = "cached-only" | "operator-cli";
export function requireNewsRefreshAccess(access: NewsAccess) {
 if(access!=="operator-cli")throw new Error("operator-news-refresh-required");
}
export function matchingNewsCache(cache:{cacheKey:string;fetchedAt:number}|null,key:string,now:number,ttl:number){
 return cache!==null && cache.cacheKey===key && now>=cache.fetchedAt && now-cache.fetchedAt<ttl;
}
