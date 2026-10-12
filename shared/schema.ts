import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, real, timestamp, jsonb, boolean, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const projectionCache = pgTable("projection_cache", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  cacheKey: text("cache_key").notNull().unique(),
  projectionYear: integer("projection_year").notNull(),
  category: text("category"),
  region: text("region"),
  resultData: jsonb("result_data").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const indicatorSnapshots = pgTable("indicator_snapshots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  year: integer("year").notNull(),
  renewableCapacityGW: real("renewable_capacity_gw").notNull(),
  renewableGrowthRate: real("renewable_growth_rate").notNull(),
  evSalesSharePct: real("ev_sales_share_pct").notNull(),
  evGrowthRate: real("ev_growth_rate").notNull(),
  policyCoveragePct: real("policy_coverage_pct").notNull(),
  policyImplementationRate: real("policy_implementation_rate").notNull(),
  gdpTrillionUSD: real("gdp_trillion_usd").notNull(),
  carbonIntensityKgPerGDP: real("carbon_intensity_kg_per_gdp").notNull(),
  corporateTargetsPct: real("corporate_targets_pct").notNull(),
  corporateImplementationRate: real("corporate_implementation_rate").notNull(),
  climateConcernPct: real("climate_concern_pct").notNull(),
  policySupportPct: real("policy_support_pct").notNull(),
  sacrificeWillingnessPct: real("sacrifice_willingness_pct").notNull(),
  humanCausationPct: real("human_causation_pct").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertProjectionCacheSchema = createInsertSchema(projectionCache).omit({
  id: true,
  createdAt: true,
});

export const insertIndicatorSnapshotSchema = createInsertSchema(indicatorSnapshots).omit({
  id: true,
  createdAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type ProjectionCache = typeof projectionCache.$inferSelect;
export type InsertProjectionCache = z.infer<typeof insertProjectionCacheSchema>;
export type IndicatorSnapshot = typeof indicatorSnapshots.$inferSelect;
export type InsertIndicatorSnapshot = z.infer<typeof insertIndicatorSnapshotSchema>;

export const cvCompanies = pgTable("cv_companies", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  isin: varchar("isin", { length: 12 }).notNull().unique(),
  name: text("name").notNull(),
  geography: varchar("geography", { length: 100 }),
  sector: varchar("sector", { length: 100 }),
  subSector: varchar("sub_sector", { length: 100 }),
  industry: varchar("industry", { length: 100 }),
  sdgAlignmentScore: real("sdg_alignment_score"),
  emissionTarget2050: real("emission_target_2050"),
});

export const cvTimeSeries = pgTable("cv_time_series", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  companyId: integer("company_id").notNull(),
  date: timestamp("date").notNull(),
  totalReturnIndex: real("total_return_index"),
  marketCap: real("market_cap"),
  priceEarnings: real("price_earnings"),
  scope1Emissions: real("scope1_emissions"),
  scope2Emissions: real("scope2_emissions"),
  scope3Emissions: real("scope3_emissions"),
  netProfit: real("net_profit"),
}, (table) => [
  uniqueIndex("cv_time_series_company_date_idx").on(table.companyId, table.date),
]);

export const cvDataUploads = pgTable("cv_data_uploads", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  filename: varchar("filename", { length: 255 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("processing"),
  companiesCount: integer("companies_count"),
  timePeriodsCount: integer("time_periods_count"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export const cvCompanyTerciles = pgTable("cv_company_terciles", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  uploadId: integer("upload_id").notNull(),
  companyId: integer("company_id").notNull(),
  date: timestamp("date").notNull(),
  method: varchar("method", { length: 50 }).notNull(),
  includeScope3: boolean("include_scope3").notNull(),
  carbonIntensity: real("carbon_intensity"),
  tercileAssignment: varchar("tercile_assignment", { length: 10 }),
});

export const cvCarbonPriceCache = pgTable("cv_carbon_price_cache", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  uploadId: integer("upload_id").notNull(),
  date: timestamp("date").notNull(),
  method: varchar("method", { length: 50 }).notNull(),
  includeScope3: boolean("include_scope3").notNull(),
  winsorize: boolean("winsorize").notNull(),
  winsorizePercentile: integer("winsorize_percentile"),
  topTercileEmissions: real("top_tercile_emissions"),
  topTercileProfit: real("top_tercile_profit"),
  topTercileMarketCap: real("top_tercile_market_cap"),
  topTercilePeRatio: real("top_tercile_pe_ratio"),
  topTercileCompanyCount: integer("top_tercile_company_count"),
  bottomTercileEmissions: real("bottom_tercile_emissions"),
  bottomTercileProfit: real("bottom_tercile_profit"),
  bottomTercileMarketCap: real("bottom_tercile_market_cap"),
  bottomTercilePeRatio: real("bottom_tercile_pe_ratio"),
  bottomTercileCompanyCount: integer("bottom_tercile_company_count"),
  impliedCarbonPrice: real("implied_carbon_price"),
});

export const newsCache = pgTable("news_cache", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  cacheKey: varchar("cache_key", { length: 100 }).notNull().unique(),
  resultData: jsonb("result_data").notNull(),
  fetchedAt: timestamp("fetched_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertNewsCacheSchema = createInsertSchema(newsCache).omit({ id: true, createdAt: true });
export type NewsCache = typeof newsCache.$inferSelect;
export type InsertNewsCache = z.infer<typeof insertNewsCacheSchema>;

export const insertCvCompanySchema = createInsertSchema(cvCompanies).omit({ id: true });
export const insertCvTimeSeriesSchema = createInsertSchema(cvTimeSeries).omit({ id: true });
export const insertCvDataUploadSchema = createInsertSchema(cvDataUploads).omit({ id: true, createdAt: true, completedAt: true });
export const insertCvCompanyTercileSchema = createInsertSchema(cvCompanyTerciles).omit({ id: true });
export const insertCvCarbonPriceCacheSchema = createInsertSchema(cvCarbonPriceCache).omit({ id: true });

export type CvCompany = typeof cvCompanies.$inferSelect;
export type InsertCvCompany = z.infer<typeof insertCvCompanySchema>;
export type CvTimeSeries = typeof cvTimeSeries.$inferSelect;
export type InsertCvTimeSeries = z.infer<typeof insertCvTimeSeriesSchema>;
export type CvDataUpload = typeof cvDataUploads.$inferSelect;
export type InsertCvDataUpload = z.infer<typeof insertCvDataUploadSchema>;
export type CvCompanyTercile = typeof cvCompanyTerciles.$inferSelect;
export type InsertCvCompanyTercile = z.infer<typeof insertCvCompanyTercileSchema>;
export type CvCarbonPriceCache = typeof cvCarbonPriceCache.$inferSelect;
export type InsertCvCarbonPriceCache = z.infer<typeof insertCvCarbonPriceCacheSchema>;

// Live indicator data pipeline: long-format per-(indicator, year) values with
// provenance and an approval status. Only `approved` rows feed the model; the
// curated static baseline is always the fallback.
export const indicatorValues = pgTable("indicator_values", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  indicatorKey: text("indicator_key").notNull(),
  year: integer("year").notNull(),
  value: real("value").notNull(),
  source: text("source").notNull(),
  sourceUrl: text("source_url"),
  asOfDate: text("as_of_date"),
  method: text("method").notNull(), // api | websearch | manual | curated
  status: text("status").notNull().default("pending"), // pending | approved | rejected | superseded
  rawContext: text("raw_context"),
  note: text("note"),
  runId: varchar("run_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  decidedAt: timestamp("decided_at"),
}, (table) => [
  uniqueIndex("indicator_values_key_year_status_idx")
    .on(table.indicatorKey, table.year, table.status)
    .where(sql`status = 'approved'`),
]);

export const indicatorFetchRuns = pgTable("indicator_fetch_runs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  trigger: text("trigger").notNull(), // manual | scheduled
  status: text("status").notNull().default("running"), // running | completed | failed
  startedAt: timestamp("started_at").defaultNow().notNull(),
  finishedAt: timestamp("finished_at"),
  proposalsCreated: integer("proposals_created").default(0).notNull(),
  adaptersSucceeded: integer("adapters_succeeded").default(0).notNull(),
  adaptersFailed: integer("adapters_failed").default(0).notNull(),
  summary: jsonb("summary"),
});

export const insertIndicatorValueSchema = createInsertSchema(indicatorValues).omit({
  id: true,
  createdAt: true,
  decidedAt: true,
});
export const insertIndicatorFetchRunSchema = createInsertSchema(indicatorFetchRuns).omit({
  id: true,
  startedAt: true,
});

export type IndicatorValue = typeof indicatorValues.$inferSelect;
export type InsertIndicatorValue = z.infer<typeof insertIndicatorValueSchema>;
export type IndicatorFetchRun = typeof indicatorFetchRuns.$inferSelect;
export type InsertIndicatorFetchRun = z.infer<typeof insertIndicatorFetchRunSchema>;
