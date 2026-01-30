import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * 庫存分析記錄表
 * 儲存每次分析的結果和參數
 */
export const analysisRecords = mysqlTable("analysis_records", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  /** 原始檔案在S3的URL */
  originalFileUrl: text("originalFileUrl").notNull(),
  /** 原始檔案名稱 */
  originalFileName: varchar("originalFileName", { length: 255 }).notNull(),
  /** 結果檔案在S3的URL */
  resultFileUrl: text("resultFileUrl"),
  /** 預估可賣月數範圍最小值 */
  minMonths: decimal("minMonths", { precision: 5, scale: 2 }).notNull(),
  /** 預估可賣月數範圍最大值 */
  maxMonths: decimal("maxMonths", { precision: 5, scale: 2 }).notNull(),
  /** 符合條件的品項數量 */
  matchedItemsCount: int("matchedItemsCount"),
  /** 分析狀態 */
  status: mysqlEnum("status", ["processing", "completed", "failed"]).default("processing").notNull(),
  /** 錯誤訊息（如果失敗） */
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AnalysisRecord = typeof analysisRecords.$inferSelect;
export type InsertAnalysisRecord = typeof analysisRecords.$inferInsert;

/**
 * 特殊品號表
 * 儲存需要特殊處理的品號清單
 * 當這些品號滿足「可賣量=1」且「需求量=0」時，強制設定「預計補=1」
 */
export const specialProductIds = mysqlTable("special_product_ids", {
  id: int("id").autoincrement().primaryKey(),
  /** 品號 */
  productId: varchar("productId", { length: 50 }).notNull().unique(),
  /** 備註 */
  note: text("note"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SpecialProductId = typeof specialProductIds.$inferSelect;
export type InsertSpecialProductId = typeof specialProductIds.$inferInsert;
