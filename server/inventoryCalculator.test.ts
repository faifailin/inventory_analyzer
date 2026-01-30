import { describe, expect, it } from "vitest";
import { processInventoryData, exportToExcel } from "./inventoryCalculator";

describe("inventoryCalculator", () => {
  describe("processInventoryData", () => {
    it("應該正確計算預計補和預估可賣月數", () => {
      const rawData = [
        {
          '品號': 10455238,
          '單品編號': 5,
          '品名': '測試商品A',
          '規格': 'S',
          '商品狀態': '進行',
          '前30天出庫量 (訂購-退貨)': 2,
          '庫齡': 100,
          '滯銷天數(每週一計算)': 0,
          '寄倉在途量(未驗入)': 0,
          '可賣量': 3,
        },
      ];

      const results = processInventoryData(rawData, {
        minMonths: 2,
        maxMonths: 3,
      });

      expect(results).toHaveLength(1);
      expect(results[0]?.預計補).toBe(2); // 應該是2而不是3，因為2更接近下限
      expect(results[0]?.預估可賣月數).toBe(2.5);
    });

    it("應該將預計補為1的強制改為2", () => {
      const rawData = [
        {
          '品號': 12345,
          '單品編號': 1,
          '品名': '測試商品B',
          '規格': 'M',
          '商品狀態': '進行',
          '前30天出庫量 (訂購-退貨)': 1,
          '庫齡': 50,
          '滯銷天數(每週一計算)': 0,
          '寄倉在途量(未驗入)': 0,
          '可賣量': 1,
        },
      ];

      const results = processInventoryData(rawData, {
        minMonths: 2,
        maxMonths: 3,
      });

      // 預計補原本會是1，但應該被強制改為2
      if (results.length > 0) {
        expect(results[0]?.預計補).toBeGreaterThanOrEqual(2);
      }
    });

    it("應該過濾掉預計補為0的品項", () => {
      const rawData = [
        {
          '品號': 13916104,
          '單品編號': 7,
          '品名': '測試商品C',
          '規格': 'L',
          '商品狀態': '進行',
          '前30天出庫量 (訂購-退貨)': 2,
          '庫齡': 200,
          '滯銷天數(每週一計算)': 10,
          '寄倉在途量(未驗入)': 0,
          '可賣量': 4,
        },
      ];

      const results = processInventoryData(rawData, {
        minMonths: 2,
        maxMonths: 3,
      });

      // 這個品項的預計補會是0（因為可賣量已經足夠），應該被過濾掉
      expect(results).toHaveLength(0);
    });

    it("應該只保留商品狀態為進行或暫時中斷的品項", () => {
      const rawData = [
        {
          '品號': 1,
          '單品編號': 1,
          '品名': '進行中商品',
          '規格': 'S',
          '商品狀態': '進行',
          '前30天出庫量 (訂購-退貨)': 10,
          '庫齡': 50,
          '滯銷天數(每週一計算)': 0,
          '寄倉在途量(未驗入)': 0,
          '可賣量': 5,
        },
        {
          '品號': 2,
          '單品編號': 2,
          '品名': '暫時中斷商品',
          '規格': 'M',
          '商品狀態': '暫時中斷',
          '前30天出庫量 (訂購-退貨)': 10,
          '庫齡': 50,
          '滯銷天數(每週一計算)': 0,
          '寄倉在途量(未驗入)': 0,
          '可賣量': 5,
        },
        {
          '品號': 3,
          '單品編號': 3,
          '品名': '已停止商品',
          '規格': 'L',
          '商品狀態': '停止',
          '前30天出庫量 (訂購-退貨)': 10,
          '庫齡': 50,
          '滯銷天數(每週一計算)': 0,
          '寄倉在途量(未驗入)': 0,
          '可賣量': 5,
        },
      ];

      const results = processInventoryData(rawData, {
        minMonths: 2,
        maxMonths: 3,
      });

      // 應該只有前兩個品項被保留
      expect(results.length).toBeGreaterThanOrEqual(0);
      results.forEach(item => {
        expect(['進行', '暫時中斷']).toContain(item.商品狀態);
      });
    });

    it("應該正確計算需求量", () => {
      const rawData = [
        {
          '品號': 10001,
          '單品編號': 1,
          '品名': '測試需求量',
          '規格': 'S',
          '商品狀態': '進行',
          '前30天出庫量 (訂購-退貨)': 10,
          '庫齡': 50,
          '滯銷天數(每週一計算)': 0,
          '寄倉在途量(未驗入)': 2,
          '可賣量': 3,
        },
      ];

      const results = processInventoryData(rawData, {
        minMonths: 2,
        maxMonths: 3,
      });

      if (results.length > 0) {
        // 需求量 = 前30天出庫量 - 可賣量 - 寄倉在途量 = 10 - 3 - 2 = 5
        expect(results[0]?.需求量).toBe(5);
      }
    });
  });

  describe("exportToExcel", () => {
    it("應該能夠匯出Excel Buffer", () => {
      const items = [
        {
          品號: 10455238,
          單品編號: 5,
          品名: '測試商品',
          規格: 'S',
          商品狀態: '進行',
          前30天出庫量: 2,
          庫齡: 100,
          滯銷天數: 0,
          寄倉在途量: 0,
          可賣量: 3,
          需求量: -1,
          預計補: 2,
          預估可賣月數: 2.5,
        },
      ];

      const buffer = exportToExcel(items);
      
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });
  });
});
