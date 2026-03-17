import { eq, desc, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, analysisRecords, InsertAnalysisRecord, AnalysisRecord, specialProductIds, InsertSpecialProductId, SpecialProductId, dailyExportCounter } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// 庫存分析記錄相關查詢

export async function createAnalysisRecord(record: InsertAnalysisRecord): Promise<AnalysisRecord> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const result = await db.insert(analysisRecords).values(record);
  const insertId = Number(result[0].insertId);
  
  const created = await db.select().from(analysisRecords).where(eq(analysisRecords.id, insertId)).limit(1);
  return created[0]!;
}

export async function updateAnalysisRecord(id: number, updates: Partial<InsertAnalysisRecord>): Promise<void> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  await db.update(analysisRecords).set(updates).where(eq(analysisRecords.id, id));
}

export async function getUserAnalysisRecords(userId: number): Promise<AnalysisRecord[]> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  return db.select().from(analysisRecords).where(eq(analysisRecords.userId, userId)).orderBy(desc(analysisRecords.createdAt));
}

export async function getAnalysisRecordById(id: number): Promise<AnalysisRecord | undefined> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const result = await db.select().from(analysisRecords).where(eq(analysisRecords.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// 特殊品號相關查詢

export async function getAllSpecialProductIds(): Promise<SpecialProductId[]> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  return db.select().from(specialProductIds).orderBy(specialProductIds.productId);
}

export async function getSpecialProductIdsSet(): Promise<Set<string>> {
  const products = await getAllSpecialProductIds();
  return new Set(products.map(p => p.productId));
}

export async function addSpecialProductId(productId: string, note?: string): Promise<SpecialProductId> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const result = await db.insert(specialProductIds).values({ productId, note: note || null });
  const insertId = Number(result[0].insertId);
  
  const created = await db.select().from(specialProductIds).where(eq(specialProductIds.id, insertId)).limit(1);
  return created[0]!;
}

export async function removeSpecialProductId(productId: string): Promise<void> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  await db.delete(specialProductIds).where(eq(specialProductIds.productId, productId));
}

// 每日匯出計數器相關查詢

/**
 * 取得並遞增當日匯出序號，返回格式如 "01", "02", ...
 * 使用 UPSERT 確保並發安全
 */
export async function getNextDailyExportSequence(dateKey: string): Promise<string> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  // Upsert：若當日記錄不存在則插入count=1，否則count+1
  await db
    .insert(dailyExportCounter)
    .values({ dateKey, count: 1 })
    .onDuplicateKeyUpdate({ set: { count: sql`count + 1` } });

  // 讀取更新後的count
  const result = await db
    .select()
    .from(dailyExportCounter)
    .where(eq(dailyExportCounter.dateKey, dateKey))
    .limit(1);

  const count = result[0]?.count ?? 1;
  return String(count).padStart(2, '0');
}

export async function initializeSpecialProductIds(productIds: string[]): Promise<void> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  // 檢查是否已經有資料
  const existing = await db.select().from(specialProductIds).limit(1);
  if (existing.length > 0) {
    console.log("[Database] Special product IDs already initialized");
    return;
  }

  // 批次插入
  const values = productIds.map(id => ({ productId: id, note: null }));
  await db.insert(specialProductIds).values(values);
  console.log(`[Database] Initialized ${productIds.length} special product IDs`);
}
