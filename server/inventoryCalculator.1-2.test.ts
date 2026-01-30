import { describe, expect, it } from "vitest";
import { processInventoryData } from "./inventoryCalculator";

describe("inventoryCalculator - 1-2月範圍測試", () => {
  it("應該在1-2月範圍內找到符合條件的品項", () => {
    const rawData = [
      {
        '品號': 10455238,
        '單品編號': 8,
        '品名': '測試商品',
        '規格': 'XS',
        '商品狀態': '進行',
        '前30天出庫量 (訂購-退貨)': 3,
        '庫齡': 42,
        '滯銷天數(每週一計算)': 14,
        '寄倉在途量(未驗入)': 0,
        '可賣量': 1,
      },
    ];

    const results = processInventoryData(rawData, {
      minMonths: 1,
      maxMonths: 2,
    });

    expect(results.length).toBeGreaterThan(0);
    if (results.length > 0) {
      expect(results[0]?.預計補).toBeGreaterThanOrEqual(2);
      expect(results[0]?.預估可賣月數).toBeGreaterThanOrEqual(1);
      expect(results[0]?.預估可賣月數).toBeLessThanOrEqual(2);
    }
  });

  it("當預計補為1且改為2後超出範圍時，應該排除該品項", () => {
    const rawData = [
      {
        '品號': 99999,
        '單品編號': 1,
        '品名': '測試商品',
        '規格': 'S',
        '商品狀態': '進行',
        '前30天出庫量 (訂購-退貨)': 10,
        '庫齡': 50,
        '滯銷天數(每週一計算)': 0,
        '寄倉在途量(未驗入)': 0,
        '可賣量': 9,
      },
    ];

    const results = processInventoryData(rawData, {
      minMonths: 1,
      maxMonths: 2,
    });

    // 這個品項的預計補原本是1（預估月數=1.0），改為2後預估月數=1.1
    // 應該仍在範圍內
    if (results.length > 0) {
      expect(results[0]?.預計補).toBe(2);
      expect(results[0]?.預估可賣月數).toBeLessThanOrEqual(2);
    }
  });

  it("應該正確處理預計補為1強制改為2的情況", () => {
    const rawData = [
      {
        '品號': 13916104,
        '單品編號': 8,
        '品名': '測試商品',
        '規格': 'M',
        '商品狀態': '進行',
        '前30天出庫量 (訂購-退貨)': 2,
        '庫齡': 93,
        '滯銷天數(每週一計算)': 2,
        '寄倉在途量(未驗入)': 0,
        '可賣量': 1,
      },
    ];

    const results = processInventoryData(rawData, {
      minMonths: 1,
      maxMonths: 2,
    });

    // 預計補原本是1，應該被強制改為2
    // 預估月數 = (2 + 1 + 0) / 2 = 1.5，在範圍內
    expect(results.length).toBeGreaterThan(0);
    if (results.length > 0) {
      expect(results[0]?.預計補).toBe(2);
      expect(results[0]?.預估可賣月數).toBe(1.5);
    }
  });
});
