import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle2, Loader2, Settings, PauseCircle } from "lucide-react";
import { Link } from "wouter";
import { useState, useRef } from "react";
import { toast } from "sonner";

export default function Home() {
  const { user, loading: authLoading } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [minMonths, setMinMonths] = useState<string>("2");
  const [maxMonths, setMaxMonths] = useState<string>("3");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const analyzeMutation = trpc.inventory.analyze.useMutation({
    onSuccess: (data) => {
      toast.success(`分析完成！找到 ${data.matchedItemsCount} 個符合條件的品項`);
    },
    onError: (error) => {
      toast.error(`分析失敗：${error.message}`);
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      validateAndSetFile(selectedFile);
    }
  };

  const validateAndSetFile = (selectedFile: File) => {
    const validTypes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];
    
    if (!validTypes.includes(selectedFile.type) && 
        !selectedFile.name.endsWith('.xls') && 
        !selectedFile.name.endsWith('.xlsx')) {
      toast.error('請上傳 .xls 或 .xlsx 格式的檔案');
      return;
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      toast.error('檔案大小不能超過 10MB');
      return;
    }

    setFile(selectedFile);
    toast.success('檔案已選擇');
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      validateAndSetFile(droppedFile);
    }
  };

  const handleAnalyze = async () => {
    if (!file) {
      toast.error('請先選擇檔案');
      return;
    }

    const minMonthsNum = parseFloat(minMonths);
    const maxMonthsNum = parseFloat(maxMonths);

    if (isNaN(minMonthsNum) || isNaN(maxMonthsNum)) {
      toast.error('請輸入有效的月數');
      return;
    }

    if (minMonthsNum >= maxMonthsNum) {
      toast.error('最小月數必須小於最大月數');
      return;
    }

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target?.result as string;
        const base64Data = base64.split(',')[1];
        
        await analyzeMutation.mutateAsync({
          fileBase64: base64Data,
          fileName: file.name,
          minMonths: minMonthsNum,
          maxMonths: maxMonthsNum,
        });
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('分析錯誤:', error);
    }
  };

  const handleDownload = async () => {
    if (analyzeMutation.data?.resultFileUrl) {
      try {
        // 使用 fetch 下載並指定檔名
        const response = await fetch(analyzeMutation.data.resultFileUrl);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = analyzeMutation.data.exportFileName ?? 'momo預計補計算.xlsx';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch {
        // 如果 fetch 失敗，回退用 window.open
        window.open(analyzeMutation.data.resultFileUrl, '_blank');
      }
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">庫存補貨計算工具</CardTitle>
            <CardDescription>請先登入以使用此工具</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => window.location.href = getLoginUrl()}>
              登入
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* 標題 */}
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center gap-4">
              <h1 className="text-4xl font-bold text-gray-900">庫存補貨計算工具</h1>
              <Link href="/special-products">
                <Button variant="outline" size="sm">
                  <Settings className="mr-2 h-4 w-4" />
                  特殊品號管理
                </Button>
              </Link>
            </div>
            <p className="text-gray-600">上傳Excel檔案，自動計算商品補貨需求</p>
          </div>

          {/* 主要操作卡片 */}
          <Card>
            <CardHeader>
              <CardTitle>檔案上傳與設定</CardTitle>
              <CardDescription>
                支援 .xls 和 .xlsx 格式，檔案需包含「by規格」工作表
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* 檔案上傳區域 */}
              <div>
                <Label>上傳庫存檔案</Label>
                <div
                  className={`mt-2 border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                    isDragging
                      ? 'border-primary bg-primary/5'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xls,.xlsx"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <FileSpreadsheet className="mx-auto h-12 w-12 text-gray-400" />
                  <p className="mt-2 text-sm text-gray-600">
                    {file ? (
                      <span className="font-medium text-primary">{file.name}</span>
                    ) : (
                      <>
                        拖放檔案至此，或 <span className="text-primary font-medium">點擊選擇檔案</span>
                      </>
                    )}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">支援 .xls 和 .xlsx 格式，最大 10MB</p>
                </div>
              </div>

              {/* 預估可賣月數範圍設定 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="minMonths">最小月數</Label>
                  <Input
                    id="minMonths"
                    type="number"
                    min="0"
                    max="12"
                    step="0.1"
                    value={minMonths}
                    onChange={(e) => setMinMonths(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="maxMonths">最大月數</Label>
                  <Input
                    id="maxMonths"
                    type="number"
                    min="0"
                    max="12"
                    step="0.1"
                    value={maxMonths}
                    onChange={(e) => setMaxMonths(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>

              {/* 分析按鈕 */}
              <Button
                onClick={handleAnalyze}
                disabled={!file || analyzeMutation.isPending}
                className="w-full"
                size="lg"
              >
                {analyzeMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    分析中...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    開始分析
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* 分析結果 */}
          {analyzeMutation.isSuccess && analyzeMutation.data && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  分析完成
                </CardTitle>
                <CardDescription>
                  找到 {analyzeMutation.data.matchedItemsCount} 個符合條件的品項
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 下載按鈕 */}
                <Button onClick={handleDownload} className="w-full" variant="outline">
                  <Download className="mr-2 h-4 w-4" />
                  下載完整結果 (Excel)
                </Button>

                {/* 預覽表格 */}
                {analyzeMutation.data.previewItems && analyzeMutation.data.previewItems.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium mb-2">前 5 筆預覽</h3>
                    <div className="border rounded-lg overflow-hidden">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>品號</TableHead>
                              <TableHead>品名</TableHead>
                              <TableHead>規格</TableHead>
                              <TableHead>可賣量</TableHead>
                              <TableHead>預計補</TableHead>
                              <TableHead>預估可賣月數</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {analyzeMutation.data.previewItems.map((item, index) => (
                              <TableRow key={index}>
                                <TableCell>{item.品號}</TableCell>
                                <TableCell className="max-w-xs truncate">{item.品名}</TableCell>
                                <TableCell>{item.規格}</TableCell>
                                <TableCell>{item.可賣量}</TableCell>
                                <TableCell className="font-medium text-primary">{item.預計補}</TableCell>
                                <TableCell>{item.預估可賣月數}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* 暫時中斷且有庫存品項 */}
          {analyzeMutation.isSuccess && analyzeMutation.data && analyzeMutation.data.suspendedItems && analyzeMutation.data.suspendedItems.length > 0 && (
            <Card className="border-amber-200">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-amber-700">
                  <PauseCircle className="h-5 w-5" />
                  暫時中斷且有庫存品項
                </CardTitle>
                <CardDescription>
                  共 {analyzeMutation.data.suspendedItems.length} 個品項屬「暫時中斷」且寄倉在途量+可賣量 &gt; 0
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="border border-amber-200 rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-amber-50">
                          <TableHead>商品原廠編號</TableHead>
                          <TableHead>品號</TableHead>
                          <TableHead>單品編號</TableHead>
                          <TableHead>品名</TableHead>
                          <TableHead>規格</TableHead>
                          <TableHead>前30天出庫量</TableHead>
                          <TableHead>庫齡</TableHead>
                          <TableHead>滯銷天數</TableHead>
                          <TableHead>寄倉在途量</TableHead>
                          <TableHead>可賣量</TableHead>
                          <TableHead className="font-semibold text-amber-700">庫存合計</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {analyzeMutation.data.suspendedItems.map((item, index) => (
                          <TableRow key={index} className="hover:bg-amber-50/50">
                            <TableCell>{item.商品原廠編號 || '-'}</TableCell>
                            <TableCell>{item.品號}</TableCell>
                            <TableCell>{String(item.單品編號).padStart(3, '0')}</TableCell>
                            <TableCell className="max-w-xs truncate">{item.品名}</TableCell>
                            <TableCell>{item.規格}</TableCell>
                            <TableCell>{item.前30天出庫量}</TableCell>
                            <TableCell>{item.庫齡}</TableCell>
                            <TableCell>{item.滯銷天數}</TableCell>
                            <TableCell>{item.寄倉在途量}</TableCell>
                            <TableCell>{item.可賣量}</TableCell>
                            <TableCell className="font-semibold text-amber-700">{item.庫存合計}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 錯誤訊息 */}
          {analyzeMutation.isError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {analyzeMutation.error.message}
              </AlertDescription>
            </Alert>
          )}

          {/* 使用說明 */}
          <Card>
            <CardHeader>
              <CardTitle>使用說明</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-gray-600">
              <p><strong>1. 上傳檔案：</strong>選擇包含「by規格」工作表的 Excel 檔案</p>
              <p><strong>2. 設定範圍：</strong>輸入預估可賣月數的目標範圍（預設 2-3 個月）</p>
              <p><strong>3. 開始分析：</strong>系統會自動計算符合條件的品項</p>
              <p><strong>4. 下載結果：</strong>取得包含所有計算欄位的 Excel 檔案</p>
              <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                <p className="text-blue-900"><strong>計算規則：</strong></p>
                <ul className="list-disc list-inside mt-1 space-y-1 text-blue-800">
                  <li>只顯示商品狀態為「進行」或「暫時中斷」的品項</li>
                  <li>需求量 = 前30天出庫量 - 可賣量 - 寄倉在途量</li>
                  <li>預計補會選擇最接近範圍下限的值</li>
                  <li>預計補為 1 時會自動調整為 2</li>
                  <li>只顯示預計補大於 0 的品項</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
