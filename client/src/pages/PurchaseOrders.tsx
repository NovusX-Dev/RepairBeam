import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useLocalization } from "@/contexts/LocalizationContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, Search, ShoppingCart, Package, DollarSign, X } from "lucide-react";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Supplier {
  id: string;
  name: string;
  phone: string | null;
  cellphone: string | null;
  email: string | null;
}

interface PurchaseOrder {
  id: string;
  tenantId: string;
  supplierId: string;
  status: string;
  orderDate: Date;
  expectedDate: Date | null;
  receivedDate: Date | null;
  totalCost: string;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  supplier?: Supplier;
}

interface POItem {
  id?: string;
  itemName: string;
  orderedQuantity: number;
  receivedQuantity?: number;
  unitCost?: number;
  deviceType?: string | null;
  itemType: string;
  description?: string;
}

interface POItemWithDetails {
  id: string;
  purchaseOrderId: string;
  inventoryItemId: string;
  itemName: string;
  orderedQuantity: number;
  receivedQuantity: number;
  unitCost: string;
  deviceType?: string | null;
  itemType: string;
  description?: string | null;
}

interface ReceiveItemForm {
  inventoryItemId: string;
  itemName: string;
  orderedQuantity: number;
  receivedQuantity: number;
  unitCost: number;
}

export default function PurchaseOrders() {
  const { t, getCurrencySymbol } = useLocalization();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isReceiveDialogOpen, setIsReceiveDialogOpen] = useState(false);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [poToCancel, setPoToCancel] = useState<PurchaseOrder | null>(null);
  const [items, setItems] = useState<POItem[]>([{ itemName: "", orderedQuantity: 1, itemType: "Service", deviceType: null, description: "" }]);
  const [receiveItems, setReceiveItems] = useState<ReceiveItemForm[]>([]);
  const [formData, setFormData] = useState({
    supplierId: "",
    expectedDate: "",
    notes: "",
  });

  // Fetch purchase orders
  const { data: purchaseOrders = [], isLoading } = useQuery<PurchaseOrder[]>({
    queryKey: ["/api/purchase-orders"],
  });

  // Fetch suppliers
  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: ["/api/suppliers"],
  });

  // Filter purchase orders
  const filteredPOs = useMemo(() => {
    return purchaseOrders.filter(po => {
      const supplier = suppliers.find(s => s.id === po.supplierId);
      return supplier?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        po.status.toLowerCase().includes(searchTerm.toLowerCase());
    });
  }, [purchaseOrders, suppliers, searchTerm]);

  // Create PO mutation
  const createPOMutation = useMutation({
    mutationFn: async (data: { supplierId: string; items: POItem[]; expectedDate?: string; notes?: string }) => {
      return await apiRequest("POST", "/api/purchase-orders", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders"] });
      toast({
        title: t("success", "Success"),
        description: t("po_created", "Purchase order created successfully"),
      });
      handleCloseCreateDialog();
    },
    onError: () => {
      toast({
        title: t("error", "Error"),
        description: t("po_create_failed", "Failed to create purchase order"),
        variant: "destructive",
      });
    },
  });

  // Finalize PO mutation (receive items)
  const finalizePOMutation = useMutation({
    mutationFn: async (data: { poId: string; items: { inventoryItemId: string; itemName: string; receivedQuantity: number; unitCost: number }[] }) => {
      return await apiRequest("POST", `/api/purchase-orders/${data.poId}/finalize`, { items: data.items });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
      toast({
        title: t("success", "Success"),
        description: t("po_finalized", "Purchase order finalized and items added to inventory"),
      });
      handleCloseReceiveDialog();
    },
    onError: () => {
      toast({
        title: t("error", "Error"),
        description: t("po_finalize_failed", "Failed to finalize purchase order"),
        variant: "destructive",
      });
    },
  });

  // Cancel PO mutation
  const cancelPOMutation = useMutation({
    mutationFn: async (poId: string) => {
      return await apiRequest("PATCH", `/api/purchase-orders/${poId}/cancel`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders"] });
      toast({
        title: t("success", "Success"),
        description: t("po_cancelled", "Purchase order cancelled successfully"),
      });
      setIsCancelDialogOpen(false);
      setPoToCancel(null);
    },
    onError: () => {
      toast({
        title: t("error", "Error"),
        description: t("po_cancel_failed", "Failed to cancel purchase order"),
        variant: "destructive",
      });
    },
  });

  const handleOpenCreateDialog = () => {
    setFormData({ supplierId: "", expectedDate: "", notes: "" });
    setItems([{ itemName: "", orderedQuantity: 1, itemType: "Service", deviceType: null, description: "" }]);
    setIsCreateDialogOpen(true);
  };

  const handleCloseCreateDialog = () => {
    setIsCreateDialogOpen(false);
    setFormData({ supplierId: "", expectedDate: "", notes: "" });
    setItems([{ itemName: "", orderedQuantity: 1, itemType: "Service", deviceType: null, description: "" }]);
  };

  const handleAddItem = () => {
    setItems([...items, { itemName: "", orderedQuantity: 1, itemType: "Service", deviceType: null, description: "" }]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof POItem, value: string | number | null) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handleCreatePO = () => {
    if (!formData.supplierId) {
      toast({
        title: t("error", "Error"),
        description: t("supplier_required", "Please select a supplier"),
        variant: "destructive",
      });
      return;
    }

    if (items.some(item => !item.itemName || item.orderedQuantity <= 0)) {
      toast({
        title: t("error", "Error"),
        description: t("items_required", "Please fill in all item details"),
        variant: "destructive",
      });
      return;
    }

    createPOMutation.mutate({
      supplierId: formData.supplierId,
      items: items,
      expectedDate: formData.expectedDate || undefined,
      notes: formData.notes || undefined,
    });
  };

  // Fetch PO items for receiving
  const { data: poItems, isLoading: isLoadingPOItems, refetch: refetchPOItems } = useQuery<POItemWithDetails[]>({
    queryKey: ["/api/purchase-orders", selectedPO?.id, "items"],
    enabled: !!selectedPO && isReceiveDialogOpen,
  });

  // Initialize receive items when PO items are fetched
  useEffect(() => {
    if (poItems && poItems.length > 0) {
      setReceiveItems(poItems.map(item => ({
        inventoryItemId: item.inventoryItemId,
        itemName: item.itemName,
        orderedQuantity: item.orderedQuantity,
        receivedQuantity: item.orderedQuantity,
        unitCost: 0,
      })));
    }
  }, [poItems]);

  const handleOpenReceiveDialog = (po: PurchaseOrder) => {
    setSelectedPO(po);
    setIsReceiveDialogOpen(true);
  };

  const handleCloseReceiveDialog = () => {
    setIsReceiveDialogOpen(false);
    setSelectedPO(null);
    setReceiveItems([]);
  };

  const handleReceiveItemChange = (index: number, field: 'receivedQuantity' | 'unitCost', value: number) => {
    const newItems = [...receiveItems];
    newItems[index] = { ...newItems[index], [field]: value };
    setReceiveItems(newItems);
  };

  const totalCost = useMemo(() => {
    return receiveItems.reduce((sum, item) => {
      return sum + (item.receivedQuantity * item.unitCost);
    }, 0);
  }, [receiveItems]);

  const handleFinalizeReceiving = () => {
    if (!selectedPO) return;

    // Validate received quantities
    for (let i = 0; i < receiveItems.length; i++) {
      const item = receiveItems[i];
      if (item.receivedQuantity > item.orderedQuantity) {
        toast({
          title: t("error", "Error"),
          description: t("received_exceeds_ordered", `Received quantity cannot exceed ordered quantity for ${item.itemName}`),
          variant: "destructive",
        });
        return;
      }
      if (item.receivedQuantity <= 0) {
        toast({
          title: t("error", "Error"),
          description: t("received_quantity_required", `Received quantity must be greater than 0 for ${item.itemName}`),
          variant: "destructive",
        });
        return;
      }
      if (item.unitCost <= 0) {
        toast({
          title: t("error", "Error"),
          description: t("unit_cost_required", `Unit cost must be greater than 0 for ${item.itemName}`),
          variant: "destructive",
        });
        return;
      }
    }

    finalizePOMutation.mutate({
      poId: selectedPO.id,
      items: receiveItems.map(item => ({
        inventoryItemId: item.inventoryItemId,
        itemName: item.itemName,
        receivedQuantity: item.receivedQuantity,
        unitCost: item.unitCost,
      })),
    });
  };

  const handleCancelPO = (po: PurchaseOrder) => {
    setPoToCancel(po);
    setIsCancelDialogOpen(true);
  };

  const confirmCancelPO = () => {
    if (poToCancel) {
      cancelPOMutation.mutate(poToCancel.id);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { className: string; label: string }> = {
      pending: { className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", label: t("status_pending", "Pending") },
      ordered: { className: "bg-blue-500/20 text-blue-400 border-blue-500/30", label: t("status_ordered", "Ordered") },
      received: { className: "bg-green-500/20 text-green-400 border-green-500/30", label: t("status_received", "Received") },
      cancelled: { className: "bg-red-500/20 text-red-400 border-red-500/30", label: t("status_cancelled", "Cancelled") },
    };
    const config = statusMap[status] || statusMap.pending;
    return <Badge variant="outline" className={config.className}>{config.label}</Badge>;
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">{t("purchase_orders", "Purchase Orders")}</h1>
          <p className="text-slate-400 mt-1">{t("manage_purchase_orders", "Manage your purchase orders and inventory receiving")}</p>
        </div>
        <Button
          onClick={handleOpenCreateDialog}
          className="bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600"
          data-testid="button-create-po"
        >
          <Plus className="w-4 h-4 mr-2" />
          {t("create_po", "Create Purchase Order")}
        </Button>
      </div>

      {/* Search */}
      <Card className="bg-slate-800/50 border-cyan-500/20">
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
            <Input
              placeholder={t("search_pos", "Search by supplier or status...")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-slate-900/50 border-slate-700 text-white"
              data-testid="input-search-pos"
            />
          </div>
        </CardContent>
      </Card>

      {/* Purchase Orders Table */}
      <Card className="bg-slate-900 border-cyan-500/20">
        <CardHeader className="bg-gradient-to-r from-blue-900/50 to-cyan-900/50 border-b border-cyan-500/20">
          <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-cyan-400" />
            {t("po_list", "Purchase Order List")}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="text-center py-8 text-slate-400">Loading...</div>
          ) : filteredPOs.length === 0 ? (
            <div className="text-center py-8">
              <ShoppingCart className="w-12 h-12 mx-auto text-slate-600 mb-3" />
              <p className="text-slate-400">{t("no_pos_found", "No purchase orders found")}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-700">
                    <TableHead className="text-slate-300">{t("po_number", "PO #")}</TableHead>
                    <TableHead className="text-slate-300">{t("supplier", "Supplier")}</TableHead>
                    <TableHead className="text-slate-300">{t("status", "Status")}</TableHead>
                    <TableHead className="text-slate-300">{t("order_date", "Order Date")}</TableHead>
                    <TableHead className="text-slate-300">{t("actions", "Actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPOs.map((po) => {
                    const supplier = suppliers.find(s => s.id === po.supplierId);
                    return (
                      <TableRow key={po.id} className="border-slate-700" data-testid={`row-po-${po.id}`}>
                        <TableCell className="text-white font-medium">{po.id.slice(0, 8).toUpperCase()}</TableCell>
                        <TableCell className="text-slate-300">{supplier?.name || "-"}</TableCell>
                        <TableCell>{getStatusBadge(po.status)}</TableCell>
                        <TableCell className="text-slate-300">{format(new Date(po.orderDate), "MMM dd, yyyy")}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {po.status === 'pending' && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleOpenReceiveDialog(po)}
                                  className="hover:bg-green-500/20 hover:text-green-400"
                                  data-testid={`button-receive-${po.id}`}
                                >
                                  <Package className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleCancelPO(po)}
                                  className="hover:bg-red-500/20 hover:text-red-400"
                                  data-testid={`button-cancel-${po.id}`}
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create PO Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="bg-slate-900 border-cyan-500/20 text-white max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="bg-gradient-to-r from-blue-900/50 to-cyan-900/50 -m-6 p-6 mb-6 border-b border-cyan-500/20">
            <DialogTitle className="text-xl font-bold text-white">
              {t("create_po", "Create Purchase Order")}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="text-slate-300">{t("supplier", "Supplier")} *</Label>
              <Select value={formData.supplierId} onValueChange={(value) => setFormData({ ...formData, supplierId: value })}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white mt-1" data-testid="select-supplier">
                  <SelectValue placeholder={t("select_supplier", "Select supplier")} />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-slate-300">{t("expected_date", "Expected Delivery Date")}</Label>
              <Input
                type="date"
                value={formData.expectedDate}
                onChange={(e) => setFormData({ ...formData, expectedDate: e.target.value })}
                className="bg-slate-800 border-slate-700 text-white mt-1"
                data-testid="input-expected-date"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-slate-300">{t("items", "Items")} *</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddItem}
                  className="border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/10"
                  data-testid="button-add-item"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  {t("add_item", "Add Item")}
                </Button>
              </div>

              <div className="space-y-3">
                {items.map((item, index) => (
                  <Card key={index} className="bg-slate-800/50 border-slate-700">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex-1 space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label className="text-xs text-slate-400">{t("item_name", "Item Name")}</Label>
                              <Input
                                value={item.itemName}
                                onChange={(e) => handleItemChange(index, "itemName", e.target.value)}
                                className="bg-slate-900 border-slate-600 text-white mt-1"
                                placeholder={t("enter_item_name", "Enter item name")}
                                data-testid={`input-item-name-${index}`}
                              />
                            </div>
                            <div>
                              <Label className="text-xs text-slate-400">{t("quantity", "Quantity")}</Label>
                              <Input
                                type="number"
                                min="1"
                                value={item.orderedQuantity}
                                onChange={(e) => handleItemChange(index, "orderedQuantity", parseInt(e.target.value) || 1)}
                                className="bg-slate-900 border-slate-600 text-white mt-1"
                                data-testid={`input-item-quantity-${index}`}
                              />
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label className="text-xs text-slate-400">{t("device_type", "Device Type")}</Label>
                              <Select 
                                value={item.deviceType || "other"} 
                                onValueChange={(value) => handleItemChange(index, "deviceType", value === "other" ? null : value)}
                              >
                                <SelectTrigger className="bg-slate-900 border-slate-600 text-white mt-1" data-testid={`select-device-type-${index}`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Phone">{t("phone", "Phone")}</SelectItem>
                                  <SelectItem value="Laptop">{t("laptop", "Laptop")}</SelectItem>
                                  <SelectItem value="Desktop">{t("desktop", "Desktop")}</SelectItem>
                                  <SelectItem value="other">{t("other", "Other")}</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-xs text-slate-400">{t("item_type", "Item Type")}</Label>
                              <div className="flex items-center gap-2 mt-1 h-9 px-3 bg-slate-900 border border-slate-600 rounded-md">
                                <span className={`text-sm ${item.itemType === 'Service' ? 'text-cyan-400' : 'text-slate-400'}`}>
                                  {t("service", "Service")}
                                </span>
                                <label className="relative inline-flex items-center cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={item.itemType === 'Sales'}
                                    onChange={(e) => handleItemChange(index, "itemType", e.target.checked ? 'Sales' : 'Service')}
                                    className="sr-only peer"
                                    data-testid={`toggle-item-type-${index}`}
                                  />
                                  <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-600"></div>
                                </label>
                                <span className={`text-sm ${item.itemType === 'Sales' ? 'text-cyan-400' : 'text-slate-400'}`}>
                                  {t("sales", "Sales")}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div>
                            <Label className="text-xs text-slate-400">{t("description", "Description")}</Label>
                            <Textarea
                              value={item.description || ""}
                              onChange={(e) => handleItemChange(index, "description", e.target.value)}
                              className="bg-slate-900 border-slate-600 text-white mt-1 min-h-[60px]"
                              placeholder={t("enter_description", "Enter item description...")}
                              data-testid={`input-description-${index}`}
                            />
                          </div>
                        </div>
                        {items.length > 1 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveItem(index)}
                            className="hover:bg-red-500/20 hover:text-red-400 mt-6"
                            data-testid={`button-remove-item-${index}`}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-slate-300">{t("notes", "Notes")}</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="bg-slate-800 border-slate-700 text-white mt-1"
                placeholder={t("enter_notes", "Enter any additional notes...")}
                data-testid="input-notes"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 mt-6">
            <Button
              variant="outline"
              onClick={handleCloseCreateDialog}
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
              data-testid="button-cancel"
            >
              {t("cancel", "Cancel")}
            </Button>
            <Button
              onClick={handleCreatePO}
              disabled={createPOMutation.isPending}
              className="bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600"
              data-testid="button-save-po"
            >
              {t("create", "Create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receive Items Dialog */}
      <Dialog open={isReceiveDialogOpen} onOpenChange={handleCloseReceiveDialog}>
        <DialogContent className="bg-slate-900 border-cyan-500/20 text-white max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="bg-gradient-to-r from-green-900/50 to-cyan-900/50 -m-6 p-6 mb-6 border-b border-cyan-500/20">
            <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
              <Package className="w-5 h-5 text-green-400" />
              {t("receive_items", "Receive Items")}
            </DialogTitle>
            {selectedPO && (
              <p className="text-sm text-slate-400 mt-1">
                PO #{selectedPO.id.slice(0, 8).toUpperCase()}
              </p>
            )}
          </DialogHeader>

          <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-3 mb-4">
            <p className="text-sm text-cyan-300">
              {t("receive_items_note", "Enter the actual received quantities and cost per unit for each item. The system will generate unique IDs for inventory tracking when you finalize.")}
            </p>
          </div>

          {isLoadingPOItems ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-cyan-500 border-t-transparent"></div>
              <p className="text-slate-400 mt-3">{t("loading", "Loading items...")}</p>
            </div>
          ) : receiveItems.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              {t("no_items_to_receive", "No items to receive")}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-3">
                {receiveItems.map((item, index) => (
                  <Card key={index} className="bg-slate-800/50 border-slate-700">
                    <CardContent className="p-4">
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="md:col-span-2">
                          <Label className="text-xs text-slate-400">{t("item_name", "Item Name")}</Label>
                          <div className="mt-1 text-white font-medium">{item.itemName}</div>
                          {poItems?.[index]?.description && (
                            <p className="text-xs text-slate-400 mt-1">{poItems[index].description}</p>
                          )}
                        </div>
                        <div>
                          <Label className="text-xs text-slate-400">{t("ordered_qty", "Ordered Qty")}</Label>
                          <div className="mt-1 text-white font-medium">{item.orderedQuantity}</div>
                          {poItems?.[index]?.deviceType && (
                            <Badge variant="outline" className="mt-1 text-xs border-cyan-500/30 text-cyan-400">
                              {t(poItems[index].deviceType?.toLowerCase() || "other", poItems[index].deviceType || "Other")}
                            </Badge>
                          )}
                        </div>
                        <div>
                          <Label className="text-xs text-slate-400">{t("item_type", "Item Type")}</Label>
                          <div className="mt-1">
                            <Badge variant={poItems?.[index]?.itemType === 'Sales' ? "default" : "secondary"} className="text-xs">
                              {t(poItems?.[index]?.itemType?.toLowerCase() || 'service', poItems?.[index]?.itemType || 'Service')}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                        <div>
                          <Label className="text-xs text-slate-400">{t("received_qty", "Received Quantity")} *</Label>
                          <Input
                            type="number"
                            min="1"
                            max={item.orderedQuantity}
                            value={item.receivedQuantity}
                            onChange={(e) => handleReceiveItemChange(index, 'receivedQuantity', parseInt(e.target.value) || 0)}
                            className="bg-slate-900 border-slate-600 text-white mt-1 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"
                            data-testid={`input-received-qty-${index}`}
                          />
                          {item.receivedQuantity > item.orderedQuantity && (
                            <p className="text-xs text-red-400 mt-1">
                              {t("exceeds_ordered", "Cannot exceed ordered quantity")}
                            </p>
                          )}
                        </div>
                        <div>
                          <Label className="text-xs text-slate-400">{t("cost_per_unit", "Cost per Unit")} *</Label>
                          <div className="relative mt-1">
                            <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400">{getCurrencySymbol()}</span>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.unitCost}
                              onChange={(e) => handleReceiveItemChange(index, 'unitCost', parseFloat(e.target.value) || 0)}
                              className="bg-slate-900 border-slate-600 text-white pl-12 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"
                              placeholder="0.00"
                              data-testid={`input-unit-cost-${index}`}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 pt-3 border-t border-slate-700">
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-slate-400">{t("item_total", "Item Total")}:</span>
                          <span className="text-white font-semibold">
                            {getCurrencySymbol()} {(item.receivedQuantity * item.unitCost).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Card className="bg-gradient-to-r from-cyan-900/30 to-blue-900/30 border-cyan-500/30">
                <CardContent className="p-4">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-semibold text-cyan-400">{getCurrencySymbol()}</span>
                      <span className="text-lg font-semibold text-white">{t("total_cost", "Total Cost")}:</span>
                    </div>
                    <span className="text-2xl font-bold text-cyan-400" data-testid="text-total-cost">
                      {getCurrencySymbol()} {totalCost.toFixed(2)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <DialogFooter className="gap-2 mt-6">
            <Button
              variant="outline"
              onClick={handleCloseReceiveDialog}
              disabled={finalizePOMutation.isPending}
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
              data-testid="button-cancel-receive"
            >
              {t("cancel", "Cancel")}
            </Button>
            <Button
              onClick={handleFinalizeReceiving}
              disabled={finalizePOMutation.isPending || receiveItems.length === 0}
              className="bg-gradient-to-r from-green-600 to-cyan-500 hover:from-green-700 hover:to-cyan-600"
              data-testid="button-finalize-receive"
            >
              {finalizePOMutation.isPending ? (
                <>
                  <div className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                  {t("finalizing", "Finalizing...")}
                </>
              ) : (
                <>
                  <Package className="w-4 h-4 mr-2" />
                  {t("finalize", "Finalize")}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel PO Confirmation Dialog */}
      <AlertDialog open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
        <AlertDialogContent className="bg-slate-900 border-red-500/30">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl text-white">
              {t("cancel_po_title", "Cancel Purchase Order")}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              {t("cancel_po_message", "Are you sure you want to cancel this purchase order? This action cannot be undone.")}
              {poToCancel && (
                <div className="mt-3 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                  <p className="text-sm text-slate-300">
                    <span className="font-semibold">PO #:</span> {poToCancel.id.slice(0, 8).toUpperCase()}
                  </p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-slate-700 text-slate-300 hover:bg-slate-800">
              {t("keep_po", "Keep Purchase Order")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmCancelPO}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {cancelPOMutation.isPending ? t("cancelling", "Cancelling...") : t("yes_cancel", "Yes, Cancel")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
