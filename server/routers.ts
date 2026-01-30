import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { createAnalysisRecord, updateAnalysisRecord, getUserAnalysisRecords, getAnalysisRecordById, getSpecialProductIdsSet, getAllSpecialProductIds, addSpecialProductId, removeSpecialProductId, initializeSpecialProductIds } from "./db";
import { parseExcelFile, processInventoryData, exportToExcel } from "./inventoryCalculator";
import { storagePut } from "./storage";
import { nanoid } from "nanoid";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  inventory: router({
    // 分析庫存檔案
    analyze: protectedProcedure
      .input(z.object({
        fileBase64: z.string(),
        fileName: z.string(),
        minMonths: z.number().min(0).max(12),
        maxMonths: z.number().min(0).max(12),
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          // 驗證範圍
          if (input.minMonths >= input.maxMonths) {
            throw new Error('最小月數必須小於最大月數');
          }

          // 解碼Base64檔案
          const fileBuffer = Buffer.from(input.fileBase64, 'base64');

          // 上傳原始檔案到S3
          const originalFileKey = `inventory-analysis/${ctx.user.id}/${nanoid()}-${input.fileName}`;
          const { url: originalFileUrl } = await storagePut(
            originalFileKey,
            fileBuffer,
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          );

          // 建立分析記錄
          const record = await createAnalysisRecord({
            userId: ctx.user.id,
            originalFileUrl,
            originalFileName: input.fileName,
            minMonths: input.minMonths.toString(),
            maxMonths: input.maxMonths.toString(),
            status: 'processing',
          });

          try {
            // 解析Excel檔案
            const rawData = parseExcelFile(fileBuffer);

            // 取得特殊品號集合
            const specialProductIds = await getSpecialProductIdsSet();

            // 處理庫存數據
            const results = processInventoryData(rawData, {
              minMonths: input.minMonths,
              maxMonths: input.maxMonths,
              specialProductIds,
            });

            // 匯出結果為Excel
            const resultBuffer = exportToExcel(results);

            // 上傳結果檔案到S3
            const resultFileKey = `inventory-analysis/${ctx.user.id}/${nanoid()}-result.xlsx`;
            const { url: resultFileUrl } = await storagePut(
              resultFileKey,
              resultBuffer,
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            );

            // 更新記錄
            await updateAnalysisRecord(record.id, {
              resultFileUrl,
              matchedItemsCount: results.length,
              status: 'completed',
            });

            return {
              success: true,
              recordId: record.id,
              matchedItemsCount: results.length,
              resultFileUrl,
              previewItems: results.slice(0, 5), // 返回前5筆預覽
            };
          } catch (error) {
            // 更新記錄為失敗狀態
            await updateAnalysisRecord(record.id, {
              status: 'failed',
              errorMessage: error instanceof Error ? error.message : '未知錯誤',
            });
            throw error;
          }
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : '分析失敗');
        }
      }),

    // 取得使用者的分析記錄列表
    getRecords: protectedProcedure.query(async ({ ctx }) => {
      return getUserAnalysisRecords(ctx.user.id);
    }),

    // 取得單一分析記錄
    getRecord: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const record = await getAnalysisRecordById(input.id);
        if (!record || record.userId !== ctx.user.id) {
          throw new Error('找不到記錄或無權限存取');
        }
        return record;
      }),
  }),

  specialProducts: router({
    // 取得所有特殊品號
    getAll: protectedProcedure.query(async () => {
      return getAllSpecialProductIds();
    }),

    // 新增特殊品號
    add: protectedProcedure
      .input(z.object({
        productId: z.string().min(1),
        note: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return addSpecialProductId(input.productId, input.note);
      }),

    // 移除特殊品號
    remove: protectedProcedure
      .input(z.object({
        productId: z.string(),
      }))
      .mutation(async ({ input }) => {
        await removeSpecialProductId(input.productId);
        return { success: true };
      }),

    // 初始化特殊品號清單
    initialize: protectedProcedure.mutation(async () => {
      const defaultProductIds = [
        '10455238',
        '12976808',
        '13010719',
        '13101788',
        '13101789',
        '13101790',
        '13916104',
        '14175996',
        '4593020',
        '4680175',
        '5550520',
        '5662916',
        '7613606',
        '7613608',
        '7613610',
        '7852768',
      ];
      await initializeSpecialProductIds(defaultProductIds);
      return { success: true, count: defaultProductIds.length };
    }),
  }),
});

export type AppRouter = typeof appRouter;
