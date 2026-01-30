import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function SpecialProducts() {
  const [newProductId, setNewProductId] = useState("");
  const [newNote, setNewNote] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  const utils = trpc.useUtils();
  const { data: specialProducts, isLoading } = trpc.specialProducts.getAll.useQuery();
  
  const addMutation = trpc.specialProducts.add.useMutation({
    onSuccess: () => {
      toast.success("已新增特殊品號");
      utils.specialProducts.getAll.invalidate();
      setNewProductId("");
      setNewNote("");
      setIsAddDialogOpen(false);
    },
    onError: (error) => {
      toast.error(`新增失敗：${error.message}`);
    },
  });

  const removeMutation = trpc.specialProducts.remove.useMutation({
    onSuccess: () => {
      toast.success("已移除特殊品號");
      utils.specialProducts.getAll.invalidate();
    },
    onError: (error) => {
      toast.error(`移除失敗：${error.message}`);
    },
  });

  const initializeMutation = trpc.specialProducts.initialize.useMutation({
    onSuccess: (data) => {
      toast.success(`已初始化 ${data.count} 個特殊品號`);
      utils.specialProducts.getAll.invalidate();
    },
    onError: (error) => {
      toast.error(`初始化失敗：${error.message}`);
    },
  });

  const handleAdd = () => {
    if (!newProductId.trim()) {
      toast.error("請輸入品號");
      return;
    }
    addMutation.mutate({ productId: newProductId.trim(), note: newNote.trim() || undefined });
  };

  const handleRemove = (productId: string) => {
    if (confirm(`確定要移除品號 ${productId} 嗎？`)) {
      removeMutation.mutate({ productId });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 py-8">
      <div className="container max-w-5xl">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl">特殊品號管理</CardTitle>
                <CardDescription className="mt-2">
                  管理需要特殊處理的品號清單。當這些品號同時滿足「可賣量=1」且「需求量=0」時，系統會強制設定「預計補=1」並納入分析結果。
                </CardDescription>
              </div>
              <div className="flex gap-2">
                {(!specialProducts || specialProducts.length === 0) && (
                  <Button
                    variant="outline"
                    onClick={() => initializeMutation.mutate()}
                    disabled={initializeMutation.isPending}
                  >
                    {initializeMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    初始化預設清單
                  </Button>
                )}
                <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      新增品號
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>新增特殊品號</DialogTitle>
                      <DialogDescription>
                        輸入品號和備註（選填）
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label htmlFor="productId">品號</Label>
                        <Input
                          id="productId"
                          value={newProductId}
                          onChange={(e) => setNewProductId(e.target.value)}
                          placeholder="例如：10455238"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="note">備註（選填）</Label>
                        <Textarea
                          id="note"
                          value={newNote}
                          onChange={(e) => setNewNote(e.target.value)}
                          placeholder="輸入備註說明"
                          rows={3}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => setIsAddDialogOpen(false)}
                      >
                        取消
                      </Button>
                      <Button
                        onClick={handleAdd}
                        disabled={addMutation.isPending}
                      >
                        {addMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        新增
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : !specialProducts || specialProducts.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground mb-4">尚未設定任何特殊品號</p>
                <Button
                  onClick={() => initializeMutation.mutate()}
                  disabled={initializeMutation.isPending}
                >
                  {initializeMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  初始化預設清單
                </Button>
              </div>
            ) : (
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[150px]">品號</TableHead>
                      <TableHead>備註</TableHead>
                      <TableHead className="w-[180px]">建立時間</TableHead>
                      <TableHead className="w-[100px] text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {specialProducts.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell className="font-mono">{product.productId}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {product.note || "-"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(product.createdAt).toLocaleString("zh-TW")}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemove(product.productId)}
                            disabled={removeMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-lg">規則說明</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>• 特殊品號會在庫存分析時套用特殊規則</p>
            <p>• 當特殊品號同時滿足以下條件時：</p>
            <p className="pl-6">- 可賣量 = 1</p>
            <p className="pl-6">- 需求量 = 0（前30天出庫量 - 可賣量 - 寄倉在途量 = 0）</p>
            <p>• 系統會強制設定「預計補 = 1」並將該品項納入分析結果</p>
            <p>• 不符合上述條件的特殊品號，會依照一般規則進行計算</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
