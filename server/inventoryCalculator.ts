import * as XLSX from 'xlsx';

export interface InventoryItem {
  品號: number;
  單品編號: number;
  品名: string;
  規格: string;
  商品狀態: string;
  前30天出庫量: number;
  庫齡: number;
  滯銷天數: number;
  寄倉在途量: number;
  可賣量: number;
  需求量: number;
  目前可賣月數: number;
  預計補: number;
  預估可賣月數: number;
}

export interface CalculationOptions {
  minMonths: number;
  maxMonths: number;
  specialProductIds?: Set<string>;
}

/**
 * 從Buffer解析Excel檔案
 */
export function parseExcelFile(buffer: Buffer): any[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  
  // 檢查是否有"by規格"工作表
  if (!workbook.SheetNames.includes('by規格')) {
    throw new Error('找不到"by規格"工作表');
  }
  
  const worksheet = workbook.Sheets['by規格'];
  const rawData = XLSX.utils.sheet_to_json(worksheet);
  
  // 清理欄位名稱中的換行符號
  const data = rawData.map((row: any) => {
    const cleanedRow: any = {};
    for (const [key, value] of Object.entries(row as Record<string, any>)) {
      const cleanKey = key.replace(/\n/g, '').replace(/\r/g, '');
      cleanedRow[cleanKey] = value;
    }
    return cleanedRow;
  });
  
  return data;
}

/**
 * 計算預計補數量
 * 在預估可賣月數範圍內，選擇最接近minMonths的預計補值
 * 如果預計補為1，強制改為2
 */
function calculateOptimalReplenishment(
  monthlySale: number,
  available: number,
  inTransit: number,
  minMonths: number,
  maxMonths: number
): number | null {
  if (monthlySale <= 0) {
    return null;
  }

  let bestReplenishment: number | null = null;
  let bestDistance = Infinity;

  // 搜索範圍：從0到足夠大的數字
  const searchEnd = Math.ceil(monthlySale * maxMonths + 100);

  for (let testReplenishment = 0; testReplenishment <= searchEnd; testReplenishment++) {
    const estimatedMonths = (testReplenishment + available + inTransit) / monthlySale;

    // 檢查是否在範圍內
    if (estimatedMonths >= minMonths && estimatedMonths <= maxMonths) {
      const distance = Math.abs(estimatedMonths - minMonths);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestReplenishment = testReplenishment;
      }
    }
  }

  // 如果預計補為1，強制改為2，保留該品項並顯示調整後的預估可賣月數
  if (bestReplenishment === 1) {
    bestReplenishment = 2;
  }

  return bestReplenishment;
}

/**
 * 處理庫存數據並計算補貨需求
 */
export function processInventoryData(
  rawData: any[],
  options: CalculationOptions
): InventoryItem[] {
  const { minMonths, maxMonths, specialProductIds } = options;
  const results: InventoryItem[] = [];

  for (const row of rawData) {
    // 篩選商品狀態為"進行"或"暫時中斷"
    const status = row['商品狀態'];
    if (status !== '進行' && status !== '暫時中斷') {
      continue;
    }

    const productId = String(row['品號'] || '');
    const monthlySale = Number(row['前30天出庫量 (訂購-退貨)']) || 0;
    const available = Number(row['可賣量']) || 0;
    const inTransit = Number(row['寄倉在途量(未驗入)']) || 0;

    // 計算需求量
    const demand = monthlySale - available - inTransit;

    // 一般品項的計算邏輯
    const isSpecialProduct = specialProductIds?.has(productId);
    let optimalReplenishment: number | null = calculateOptimalReplenishment(
      monthlySale,
      available,
      inTransit,
      minMonths,
      maxMonths
    );

    // 特殊品號處理：
    // 條件1: 特殊品號清單中的品號
    // 條件2: 寄倉在途量(未驗入) + 可賣量 = 1
    // 條件3: 在設定的月份條件下，預計補 = 0
    // 三個條件同時滿足時，強制設定預計補 = 1
    if (
      isSpecialProduct &&
      (available + inTransit) === 1 &&
      (optimalReplenishment === 0 || optimalReplenishment === null)
    ) {
      optimalReplenishment = 1;
    } else {
      // 如果沒有找到合適的預計補值，跳過
      if (optimalReplenishment === null) {
        continue;
      }

      // 只保留預計補大於0的品項
      if (optimalReplenishment <= 0) {
        continue;
      }
    }

    // 計算預估可賣月數
    const estimatedMonths = monthlySale > 0
      ? (optimalReplenishment + available + inTransit) / monthlySale
      : 0;

    results.push({
      品號: Number(row['品號']) || 0,
      單品編號: Number(row['單品編號']) || 0,
      品名: String(row['品名'] || ''),
      規格: String(row['規格'] || ''),
      商品狀態: status,
      前30天出庫量: monthlySale,
      庫齡: Number(row['庫齡']) || 0,
      滯銷天數: Number(row['滯銷天數(每週一計算)']) || 0,
      寄倉在途量: inTransit,
      可賣量: available,
      需求量: demand,
      目前可賣月數: monthlySale > 0 ? Math.round((available + inTransit) / monthlySale * 100) / 100 : 0,
      預計補: optimalReplenishment,
      預估可賣月數: Math.round(estimatedMonths * 100) / 100, // 保留兩位小數
    });
  }

  return results;
}

/**
 * 將結果匯出為Excel Buffer
 */
export function exportToExcel(items: InventoryItem[]): Buffer {
  // 轉換為適合Excel的格式
  const excelData = items.map(item => ({
    '品號': item.品號,
    '單品編號': item.單品編號,
    '品名': item.品名,
    '規格': item.規格,
    '商品狀態': item.商品狀態,
    '前30天出庫量(訂購-取消-退貨)': item.前30天出庫量,
    '庫齡': item.庫齡,
    '滯銷天數(每週一計算)': item.滯銷天數,
    '寄倉在途量(未驗入)': item.寄倉在途量,
    '可賣量': item.可賣量,
    '需求量': item.需求量,
    '目前可賣月數': item.目前可賣月數,
    '預計補': item.預計補,
    '預估可賣月數': item.預估可賣月數,
  }));

  const worksheet = XLSX.utils.json_to_sheet(excelData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, '符合條件的品項');

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}
