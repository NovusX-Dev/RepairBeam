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
import { Plus, Edit, Trash2, Search, ShoppingCart, Package, DollarSign, X, ArrowUpDown, ChevronUp, ChevronDown } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
import type { InventoryItem } from "@shared/schema";

interface AutoGenList {
  id: string;
  listType: string;
  category: string;
  brand: string | null;
  items: string[];
}

interface ItemBrandModelFieldsProps {
  item: POItem;
  index: number;
  handleItemChange: (index: number, field: keyof POItem, value: string | number | null) => void;
  isPending: boolean;
}

function ItemBrandModelFields({ item, index, handleItemChange, isPending }: ItemBrandModelFieldsProps) {
  const { t } = useLocalization();
  
  // Fetch brands for the selected device type
  const { data: brandsList } = useQuery<AutoGenList>({
    queryKey: [`/api/auto-gen-lists/${item.deviceType}`],
    enabled: !!item.deviceType && item.deviceType !== "other",
    staleTime: 5 * 60 * 1000,
  });

  // Fetch models for the selected brand and device type
  const { data: modelsList } = useQuery<AutoGenList>({
    queryKey: [`/api/auto-gen-lists/${item.deviceType}/${item.brand}/models`],
    enabled: !!item.deviceType && !!item.brand && item.deviceType !== "other" && item.brand !== "Other",
    staleTime: 5 * 60 * 1000,
  });

  const brands = brandsList?.items || [];
  const models = modelsList?.items || [];

  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <Label className="text-xs text-slate-400">{t("brand", "Brand")}</Label>
        <Select 
          value={item.brand || "Other"} 
          onValueChange={(value) => {
            handleItemChange(index, "brand", value === "Other" ? null : value);
            // Reset model when brand changes
            handleItemChange(index, "model", null);
          }}
          disabled={isPending || !item.deviceType || item.deviceType === "other"}
        >
          <SelectTrigger className="bg-slate-900 border-slate-600 text-white mt-1" data-testid={`select-brand-${index}`}>
            <SelectValue placeholder={t("select_brand", "Select brand")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Other">{t("other", "Other")}</SelectItem>
            {brands.map((brand) => (
              <SelectItem key={brand} value={brand}>{brand}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-xs text-slate-400">{t("model", "Model")}</Label>
        <Select 
          value={item.model || "Other"} 
          onValueChange={(value) => handleItemChange(index, "model", value === "Other" ? null : value)}
          disabled={isPending || !item.brand || item.brand === "Other"}
        >
          <SelectTrigger className="bg-slate-900 border-slate-600 text-white mt-1" data-testid={`select-model-${index}`}>
            <SelectValue placeholder={t("select_model", "Select model")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Other">{t("other", "Other")}</SelectItem>
            {models.map((model) => (
              <SelectItem key={model} value={model}>{model}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

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
  brand?: string | null;
  model?: string | null;
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
  brand?: string | null;
  model?: string | null;
  itemType: string;
  description?: string | null;
}

interface ReceiveItemForm {
  poItemId: string; // PO item ID for matching during finalization
  itemName: string;
  orderedQuantity: number;
  receivedQuantity: number;
  unitCost: number;
  sellingPrice: number;
  // Current inventory data
  currentStock?: number;
  currentCost?: number;
  currentSellingPrice?: number;
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
  const [items, setItems] = useState<POItem[]>([{ itemName: "", orderedQuantity: 1, itemType: "Service", deviceType: null, brand: null, model: null, description: "" }]);
  const [receiveItems, setReceiveItems] = useState<ReceiveItemForm[]>([]);
  const [formData, setFormData] = useState({
    supplierId: "",
    expectedDate: "",
    notes: "",
  });
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [showSuggestions, setShowSuggestions] = useState<number | null>(null); // Track which item input shows suggestions
  const [activeItemIndex, setActiveItemIndex] = useState<number | null>(null);

  // Fetch purchase orders
  const { data: purchaseOrders = [], isLoading } = useQuery<PurchaseOrder[]>({
    queryKey: ["/api/purchase-orders"],
  });

  // Fetch suppliers
  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: ["/api/suppliers"],
  });

  // Fetch inventory items for autocomplete
  const { data: inventoryItems = [], isSuccess: isInventoryLoaded } = useQuery<InventoryItem[]>({
    queryKey: ["/api/inventory"],
  });

  // Handle sorting
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  // Filter and sort purchase orders
  const filteredPOs = useMemo(() => {
    let filtered = purchaseOrders.filter(po => {
      const supplier = suppliers.find(s => s.id === po.supplierId);
      const poNumber = po.id.slice(0, 8).toUpperCase();
      return po.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        poNumber.includes(searchTerm.toUpperCase()) ||
        supplier?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        po.status.toLowerCase().includes(searchTerm.toLowerCase());
    });

    // Apply sorting
    if (sortColumn) {
      filtered = [...filtered].sort((a, b) => {
        let aValue: any;
        let bValue: any;

        switch (sortColumn) {
          case 'po_number':
            aValue = a.id.toLowerCase();
            bValue = b.id.toLowerCase();
            break;
          case 'supplier':
            const supplierA = suppliers.find(s => s.id === a.supplierId);
            const supplierB = suppliers.find(s => s.id === b.supplierId);
            aValue = supplierA?.name.toLowerCase() || '';
            bValue = supplierB?.name.toLowerCase() || '';
            break;
          case 'status':
            const statusOrder = { 'cancelled': 0, 'pending': 1, 'ordered': 2, 'received': 3 };
            aValue = statusOrder[a.status as keyof typeof statusOrder] || 999;
            bValue = statusOrder[b.status as keyof typeof statusOrder] || 999;
            break;
          case 'order_date':
            aValue = new Date(a.orderDate).getTime();
            bValue = new Date(b.orderDate).getTime();
            break;
          default:
            return 0;
        }

        if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [purchaseOrders, suppliers, searchTerm, sortColumn, sortDirection]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredPOs.length / itemsPerPage);
  const paginatedPOs = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredPOs.slice(startIndex, endIndex);
  }, [filteredPOs, currentPage, itemsPerPage]);

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

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
    mutationFn: async (data: { poId: string; items: { poItemId: string; itemName: string; receivedQuantity: number; unitCost: number; sellingPrice: number }[] }) => {
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
    setItems([{ itemName: "", orderedQuantity: 1, itemType: "Service", deviceType: null, brand: null, model: null, description: "" }]);
    setIsCreateDialogOpen(true);
  };

  const handleCloseCreateDialog = () => {
    setIsCreateDialogOpen(false);
    setFormData({ supplierId: "", expectedDate: "", notes: "" });
    setItems([{ itemName: "", orderedQuantity: 1, itemType: "Service", deviceType: null, brand: null, model: null, description: "" }]);
  };

  const handleAddItem = () => {
    setItems([...items, { itemName: "", orderedQuantity: 1, itemType: "Service", deviceType: null, brand: null, model: null, description: "" }]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof POItem, value: string | number | null) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    
    // Reset brand and model when deviceType changes
    if (field === "deviceType") {
      newItems[index].brand = null;
      newItems[index].model = null;
    }
    
    setItems(newItems);

    // Show suggestions when typing item name
    if (field === "itemName" && typeof value === "string") {
      if (value.length > 0) {
        setShowSuggestions(index);
        setActiveItemIndex(index);
      } else {
        setShowSuggestions(null);
        setActiveItemIndex(null);
      }
    }
  };

  // Handle selecting an item from suggestions
  const handleSelectSuggestion = (index: number, inventoryItem: InventoryItem) => {
    const newItems = [...items];
    newItems[index] = {
      ...newItems[index],
      itemName: inventoryItem.name,
      deviceType: inventoryItem.deviceType,
      brand: inventoryItem.brand || null,
      model: inventoryItem.model || null,
      itemType: inventoryItem.itemType || 'Service',
      description: inventoryItem.description || ''
    };
    setItems(newItems);
    setShowSuggestions(null);
    setActiveItemIndex(null);
  };

  // Filter inventory items based on search
  const getSuggestionsForItem = (index: number) => {
    const item = items[index];
    if (!item || !item.itemName) return [];
    
    return inventoryItems
      .filter(invItem => 
        invItem.name.toLowerCase().includes(item.itemName.toLowerCase())
      )
      .slice(0, 5); // Limit to 5 suggestions
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

  // Initialize receive items when PO items are fetched (only on first load with inventory data loaded)
  useEffect(() => {
    // Only initialize if we have PO items, inventory query succeeded, and receive items haven't been set yet
    if (poItems && poItems.length > 0 && isInventoryLoaded && receiveItems.length === 0) {
      // Safely parse numeric values with fallback
      const safeParseFloat = (value: string | null | undefined, fallback: number = 0) => {
        if (!value) return fallback;
        const parsed = parseFloat(value);
        return !isNaN(parsed) ? parsed : fallback;
      };
      
      setReceiveItems(poItems.map(item => {
        // Find matching inventory item by name AND supplier (with backward compatibility for null supplierId)
        // Prioritize items from same supplier, fallback to legacy items without supplierId
        const existingInventoryItem = inventoryItems.find(
          inv => 
            inv.name.toLowerCase() === item.itemName.toLowerCase() &&
            (inv.supplierId === selectedPO?.supplierId || 
             (!inv.supplierId && !inventoryItems.some(other => 
               other.name.toLowerCase() === item.itemName.toLowerCase() && 
               other.supplierId === selectedPO?.supplierId
             )))
        );
        
        return {
          poItemId: item.id, // Use PO item ID for matching during finalization
          itemName: item.itemName,
          orderedQuantity: item.orderedQuantity,
          receivedQuantity: item.orderedQuantity,
          unitCost: existingInventoryItem ? safeParseFloat(existingInventoryItem.cost, 0) : 0,
          sellingPrice: existingInventoryItem ? safeParseFloat(existingInventoryItem.price, 0) : 0,
          currentStock: existingInventoryItem?.quantity,
          currentCost: existingInventoryItem ? safeParseFloat(existingInventoryItem.cost) : undefined,
          currentSellingPrice: existingInventoryItem ? safeParseFloat(existingInventoryItem.price) : undefined,
        };
      }));
    }
  }, [poItems, isInventoryLoaded, inventoryItems, receiveItems.length]);

  const handleOpenReceiveDialog = (po: PurchaseOrder) => {
    setSelectedPO(po);
    setIsReceiveDialogOpen(true);
  };

  const handleCloseReceiveDialog = () => {
    setIsReceiveDialogOpen(false);
    setSelectedPO(null);
    setReceiveItems([]);
  };

  const handleReceiveItemChange = (index: number, field: 'receivedQuantity' | 'unitCost' | 'sellingPrice', value: number) => {
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
      if (item.sellingPrice <= 0) {
        toast({
          title: t("error", "Error"),
          description: t("selling_price_required", `Selling price must be greater than 0 for ${item.itemName}`),
          variant: "destructive",
        });
        return;
      }
    }

    finalizePOMutation.mutate({
      poId: selectedPO.id,
      items: receiveItems.map(item => ({
        poItemId: item.poItemId,
        itemName: item.itemName,
        receivedQuantity: item.receivedQuantity,
        unitCost: item.unitCost,
        sellingPrice: item.sellingPrice,
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
              placeholder={t("search_pos", "Search by PO number, supplier, or status...")}
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
                    <TableHead 
                      className="text-white font-bold text-base cursor-pointer hover:text-cyan-400 transition-colors"
                      onClick={() => handleSort('po_number')}
                    >
                      <div className="flex items-center gap-2">
                        {t("po_number", "PO #")}
                        {sortColumn === 'po_number' ? (
                          sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ArrowUpDown className="w-4 h-4 opacity-40" />
                        )}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="text-white font-bold text-base cursor-pointer hover:text-cyan-400 transition-colors"
                      onClick={() => handleSort('supplier')}
                    >
                      <div className="flex items-center gap-2">
                        {t("supplier", "Supplier")}
                        {sortColumn === 'supplier' ? (
                          sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ArrowUpDown className="w-4 h-4 opacity-40" />
                        )}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="text-white font-bold text-base cursor-pointer hover:text-cyan-400 transition-colors"
                      onClick={() => handleSort('status')}
                    >
                      <div className="flex items-center gap-2">
                        {t("status", "Status")}
                        {sortColumn === 'status' ? (
                          sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ArrowUpDown className="w-4 h-4 opacity-40" />
                        )}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="text-white font-bold text-base cursor-pointer hover:text-cyan-400 transition-colors"
                      onClick={() => handleSort('order_date')}
                    >
                      <div className="flex items-center gap-2">
                        {t("order_date", "Order Date")}
                        {sortColumn === 'order_date' ? (
                          sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ArrowUpDown className="w-4 h-4 opacity-40" />
                        )}
                      </div>
                    </TableHead>
                    <TableHead className="text-white font-bold text-base">
                      {t("actions", "Actions")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedPOs.map((po) => {
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

          {/* Pagination Controls */}
          {!isLoading && filteredPOs.length > 0 && (
            <div className="flex items-center justify-between mt-6 px-2">
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <span>{t("page", "Page")} {currentPage} {t("of", "of")} {totalPages}</span>
                <span className="text-slate-600">•</span>
                <span>{filteredPOs.length} {t("items_per_page", "items total")}</span>
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="border-slate-700"
                  data-testid="button-previous-page"
                >
                  {t("previous", "Previous")}
                </Button>
                
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(page => {
                      // Show first page, last page, current page, and pages around current
                      return page === 1 || 
                             page === totalPages || 
                             Math.abs(page - currentPage) <= 1;
                    })
                    .map((page, index, array) => {
                      // Add ellipsis if there's a gap
                      const showEllipsisBefore = index > 0 && page - array[index - 1] > 1;
                      
                      return (
                        <div key={page} className="flex items-center gap-1">
                          {showEllipsisBefore && (
                            <span className="px-2 text-slate-600">...</span>
                          )}
                          <Button
                            variant={currentPage === page ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCurrentPage(page)}
                            className={currentPage === page 
                              ? "bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500" 
                              : "border-slate-700"
                            }
                            data-testid={`button-page-${page}`}
                          >
                            {page}
                          </Button>
                        </div>
                      );
                    })}
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="border-slate-700"
                  data-testid="button-next-page"
                >
                  {t("next", "Next")}
                </Button>
              </div>
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
              <Select value={formData.supplierId} onValueChange={(value) => setFormData({ ...formData, supplierId: value })} disabled={createPOMutation.isPending}>
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
                disabled={createPOMutation.isPending}
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
                  disabled={createPOMutation.isPending}
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
                            <div className="relative">
                              <Label className="text-xs text-slate-400">{t("item_name", "Item Name")}</Label>
                              <Input
                                value={item.itemName}
                                onChange={(e) => handleItemChange(index, "itemName", e.target.value)}
                                onBlur={() => setTimeout(() => setShowSuggestions(null), 200)} // Delay to allow click on suggestion
                                className="bg-slate-900 border-slate-600 text-white mt-1"
                                placeholder={t("enter_item_name", "Enter item name")}
                                data-testid={`input-item-name-${index}`}
                                disabled={createPOMutation.isPending}
                              />
                              {/* Suggestions Dropdown */}
                              {showSuggestions === index && getSuggestionsForItem(index).length > 0 && (
                                <div className="absolute z-10 w-full mt-1 bg-slate-800 border border-cyan-500/30 rounded-md shadow-lg max-h-48 overflow-auto">
                                  {getSuggestionsForItem(index).map((suggestion) => (
                                    <button
                                      key={suggestion.id}
                                      type="button"
                                      onClick={() => handleSelectSuggestion(index, suggestion)}
                                      className="w-full text-left px-3 py-2 hover:bg-cyan-500/20 text-white text-sm flex items-center justify-between transition-colors"
                                      data-testid={`suggestion-${suggestion.id}`}
                                    >
                                      <span>{suggestion.name}</span>
                                      <div className="flex items-center gap-2 text-xs text-slate-400">
                                        {suggestion.deviceType && (
                                          <span className="bg-slate-700 px-2 py-0.5 rounded">{suggestion.deviceType}</span>
                                        )}
                                        <span className={`px-2 py-0.5 rounded ${suggestion.itemType === 'Service' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'}`}>
                                          {suggestion.itemType}
                                        </span>
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              )}
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
                                disabled={createPOMutation.isPending}
                              />
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label className="text-xs text-slate-400">{t("device_type", "Device Type")}</Label>
                              <Select 
                                value={item.deviceType || "other"} 
                                onValueChange={(value) => handleItemChange(index, "deviceType", value === "other" ? null : value)}
                                disabled={createPOMutation.isPending}
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
                                    disabled={createPOMutation.isPending}
                                  />
                                  <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-600"></div>
                                </label>
                                <span className={`text-sm ${item.itemType === 'Sales' ? 'text-cyan-400' : 'text-slate-400'}`}>
                                  {t("sales", "Sales")}
                                </span>
                              </div>
                            </div>
                          </div>

                          <ItemBrandModelFields 
                            item={item}
                            index={index}
                            handleItemChange={handleItemChange}
                            isPending={createPOMutation.isPending}
                          />

                          <div>
                            <Label className="text-xs text-slate-400">{t("description", "Description")}</Label>
                            <Textarea
                              value={item.description || ""}
                              onChange={(e) => handleItemChange(index, "description", e.target.value)}
                              className="bg-slate-900 border-slate-600 text-white mt-1 min-h-[60px]"
                              placeholder={t("enter_description", "Enter item description...")}
                              data-testid={`input-description-${index}`}
                              disabled={createPOMutation.isPending}
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
                            disabled={createPOMutation.isPending}
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
                disabled={createPOMutation.isPending}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 mt-6">
            <Button
              variant="outline"
              onClick={handleCloseCreateDialog}
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
              data-testid="button-cancel"
              disabled={createPOMutation.isPending}
            >
              {t("cancel", "Cancel")}
            </Button>
            <Button
              onClick={handleCreatePO}
              disabled={createPOMutation.isPending}
              className="bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600"
              data-testid="button-save-po"
            >
              {createPOMutation.isPending ? t("creating", "Creating...") : t("create", "Create")}
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
                      
                      <TooltipProvider>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
                          <Tooltip>
                            <TooltipTrigger asChild>
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
                                {item.currentStock !== undefined && (
                                  <p className="text-xs text-slate-500 mt-1">
                                    {t("available_stock", "Available stock")}: {item.currentStock}
                                  </p>
                                )}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{t("received_qty_tooltip", "Number of units actually received from supplier")}</p>
                            </TooltipContent>
                          </Tooltip>

                          <Tooltip>
                            <TooltipTrigger asChild>
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
                                {item.currentCost !== undefined && item.currentCost > 0 && (
                                  <p className="text-xs text-slate-500 mt-1">
                                    {t("current_cost", "Current cost")}: {getCurrencySymbol()} {item.currentCost.toFixed(2)}
                                  </p>
                                )}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{t("cost_per_unit_tooltip", "Purchase cost per unit from supplier")}</p>
                            </TooltipContent>
                          </Tooltip>

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div>
                                <Label className="text-xs text-slate-400">{t("selling_price", "Selling Price")} *</Label>
                                <div className="relative mt-1">
                                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400">{getCurrencySymbol()}</span>
                                  <Input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={item.sellingPrice}
                                    onChange={(e) => handleReceiveItemChange(index, 'sellingPrice', parseFloat(e.target.value) || 0)}
                                    className="bg-slate-900 border-slate-600 text-white pl-12 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"
                                    placeholder="0.00"
                                    data-testid={`input-selling-price-${index}`}
                                  />
                                </div>
                                {item.currentSellingPrice !== undefined && item.currentSellingPrice > 0 && (
                                  <p className="text-xs text-slate-500 mt-1">
                                    {t("current_selling_price", "Current selling price")}: {getCurrencySymbol()} {item.currentSellingPrice.toFixed(2)}
                                  </p>
                                )}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{t("selling_price_tooltip", "Price to charge customers for this item")}</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </TooltipProvider>

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
