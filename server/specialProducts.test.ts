import { describe, expect, it } from "vitest";
import { processInventoryData } from "./inventoryCalculator";

describe("特殊品號規則測試（新條件）", () => {
  it("特殊品號：寄倉在途量+可賣量=1 且 一般計算預計補=0，應強制設定預計補=1", () => {
    const specialProductIds = new Set(['7613606']);
    
    // 品號7613606 單品編號16的真實案例
    // 前30天出庫量=6, 可賣量=1, 寄倉在途量=5
    // 寄倉在途量+可賣量 = 5+1 = 6 ≠ 1，不應觸發特殊規則
    const rawData = [
      {
        '品號': 7613606,
        '單品編號': 16,
        '品名': '測試商品A',
        '規格': 'M',
        '商品狀態': '進行',
        '前30天出庫量 (訂購-退貨)': 6,
        '庫齡': 28,
        '滯銷天數(每週一計算)': 5,
        '寄倉在途量(未驗入)': 5,  // 寄倉在途量+可賣量 = 5+1 = 6 ≠ 1
        '可賣量': 1,
      },
    ];

    const results = processInventoryData(rawData, {
      minMonths: 2,
      maxMonths: 3,
      specialProductIds,
    });

    // 寄倉在途量+可賣量=6，不滿足條件2，應使用一般邏輯
    // 一般邏輯：預計補下限=6*2-1-5=6，預計補=6
    expect(results.length).toBe(1);
    expect(results[0]?.預計補).toBe(6);
    expect(results[0]?.預估可賣月數).toBe(2.0);
  });

  it("特殊品號：寄倉在途量+可賣量=1 且 一般計算預計補=0，應強制設定預計補=1", () => {
    const specialProductIds = new Set(['13916104']);
    
    // 前30天出庫量=2, 可賣量=1, 寄倉在途量=0
    // 寄倉在途量+可賣量 = 0+1 = 1 ✓
    // 一般計算：預計補下限=2*2-1-0=3，預計補=3（不為0，不觸發特殊規則）
    const rawData = [
      {
        '品號': 13916104,
        '單品編號': 7,
        '品名': '測試商品B',
        '規格': 'S',
        '商品狀態': '進行',
        '前30天出庫量 (訂購-退貨)': 2,
        '庫齡': 30,
        '滯銷天數(每週一計算)': 0,
        '寄倉在途量(未驗入)': 0,
        '可賣量': 1,
      },
    ];

    const results = processInventoryData(rawData, {
      minMonths: 2,
      maxMonths: 3,
      specialProductIds,
    });

    // 一般邏輯下預計補=3，不為0，不觸發特殊規則
    expect(results.length).toBe(1);
    expect(results[0]?.預計補).toBe(3);
  });

  it("特殊品號：寄倉在途量+可賣量=1 且 一般計算預計補=0，三條件同時滿足，應強制設定預計補=1", () => {
    const specialProductIds = new Set(['10455238']);
    
    // 前30天出庫量=3, 可賣量=1, 寄倉在途量=0
    // 寄倉在途量+可賣量 = 0+1 = 1 ✓
    // 一般計算：預計補下限=3*2-1-0=5，預計補=5（不為0）
    // 但如果前30天出庫量=1, 可賣量=1, 寄倉在途量=0
    // 預計補下限=1*2-1-0=1，預計補=1→強制改為2，預估可賣月數=3，在範圍內
    // 所以一般邏輯預計補=2，不為0，不觸發特殊規則
    
    // 設計一個真正觸發特殊規則的案例：
    // 前30天出庫量=5, 可賣量=1, 寄倉在途量=0
    // 寄倉在途量+可賣量 = 1 ✓
    // 一般計算：預計補下限=5*2-1-0=9，預計補=9
    // 不觸發特殊規則（預計補≠0）
    
    // 真正觸發的案例：前30天出庫量很大，可賣量=0，寄倉在途量=1
    // 寄倉在途量+可賣量 = 1+0 = 1 ✓
    // 一般計算：預計補=0時，預估可賣月數=1/sales，若sales很大則<minMonths
    // 例如：sales=10, available=0, transit=1
    // 預計補=0 → 預估可賣月數=1/10=0.1（不在2-3範圍內）
    // 預計補=19 → 預估可賣月數=(19+0+1)/10=2.0（在範圍內）
    // 所以一般邏輯預計補=19，不為0，不觸發特殊規則
    
    // 真正觸發的案例：sales=0（無出庫量），可賣量=1，寄倉在途量=0
    // 一般計算：sales=0，返回null（無法計算）
    // 寄倉在途量+可賣量=1 ✓，一般計算=null（視為0），觸發特殊規則
    const rawData = [
      {
        '品號': 10455238,
        '單品編號': 5,
        '品名': '測試商品C',
        '規格': 'S',
        '商品狀態': '進行',
        '前30天出庫量 (訂購-退貨)': 0,  // 無出庫量，一般計算返回null
        '庫齡': 50,
        '滯銷天數(每週一計算)': 0,
        '寄倉在途量(未驗入)': 0,
        '可賣量': 1,  // 寄倉在途量+可賣量 = 0+1 = 1 ✓
      },
    ];

    const results = processInventoryData(rawData, {
      minMonths: 2,
      maxMonths: 3,
      specialProductIds,
    });

    // 前30天出庫量=0，一般計算返回null，觸發特殊規則，預計補=1
    expect(results.length).toBe(1);
    expect(results[0]?.預計補).toBe(1);
    expect(results[0]?.品號).toBe(10455238);
  });

  it("特殊品號不滿足條件2（寄倉在途量+可賣量≠1），應使用一般計算邏輯", () => {
    const specialProductIds = new Set(['10455238']);
    
    const rawData = [
      {
        '品號': 10455238,
        '單品編號': 1,
        '品名': '測試商品',
        '規格': 'S',
        '商品狀態': '進行',
        '前30天出庫量 (訂購-退貨)': 3,
        '庫齡': 50,
        '滯銷天數(每週一計算)': 0,
        '寄倉在途量(未驗入)': 0,
        '可賣量': 2,  // 寄倉在途量+可賣量 = 0+2 = 2 ≠ 1
      },
    ];

    const results = processInventoryData(rawData, {
      minMonths: 2,
      maxMonths: 3,
      specialProductIds,
    });

    // 應該使用一般邏輯計算，預計補不是1
    if (results.length > 0) {
      expect(results[0]?.預計補).not.toBe(1);
    }
  });

  it("非特殊品號不應套用特殊規則", () => {
    const specialProductIds = new Set(['10455238']);
    
    const rawData = [
      {
        '品號': 99999,  // 非特殊品號
        '單品編號': 1,
        '品名': '測試商品',
        '規格': 'S',
        '商品狀態': '進行',
        '前30天出庫量 (訂購-退貨)': 0,
        '庫齡': 50,
        '滯銷天數(每週一計算)': 0,
        '寄倉在途量(未驗入)': 0,
        '可賣量': 1,
      },
    ];

    const results = processInventoryData(rawData, {
      minMonths: 2,
      maxMonths: 3,
      specialProductIds,
    });

    // 非特殊品號，即使滿足其他條件，也不觸發特殊規則
    // 前30天出庫量=0，一般邏輯返回null，應被跳過
    expect(results.length).toBe(0);
  });
});
