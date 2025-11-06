import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocalization } from "@/contexts/LocalizationContext";
import { apiRequest } from "@/lib/queryClient";
import type { InventoryCategory } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { 
  Package, 
  Plus, 
  Search, 
  TrendingUp, 
  AlertTriangle, 
  Edit, 
  Trash2, 
  DollarSign,
  PackageCheck,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  QrCode
} from "lucide-react";
import QRCodePrintSheet from "@/components/QRCodePrintSheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

interface InventoryItem {
  id: string;
  tenantId: string;
  supplierId?: string;
  name: string;
  description?: string;
  sku?: string;
  category?: string;
  quantity: number;
  minQuantity: number;
  cost?: string;
  price?: string;
  supplier?: string;
  deviceType?: string | null;
  brand?: string | null;
  model?: string | null;
  itemType?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface Supplier {
  id: string;
  name: string;
}

interface InventoryFormData {
  name: string;
  description: string;
  sku: string;
  category: string | null;
  quantity: string;
  minQuantity: string;
  cost: string;
  price: string;
  supplier: string;
}

export default function Inventory() {
  const { t, formatCurrency } = useLocalization();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState("");
  const [filterSupplier, setFilterSupplier] = useState<string>("all");
  const [filterBrand, setFilterBrand] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showConfirmUpdateDialog, setShowConfirmUpdateDialog] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [alertsExpanded, setAlertsExpanded] = useState(false);
  const [printQRItemId, setPrintQRItemId] = useState<string | null>(null);
  const [showPrintSheet, setShowPrintSheet] = useState(false);
  
  const [formData, setFormData] = useState<InventoryFormData>({
    name: "",
    description: "",
    sku: "",
    category: null,
    quantity: "0",
    minQuantity: "0",
    cost: "0",
    price: "0",
    supplier: "",
  });

  // Fetch inventory items
  const { data: items = [], isLoading } = useQuery<InventoryItem[]>({
    queryKey: ["/api/inventory"],
  });

  // Fetch suppliers for display
  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: ["/api/suppliers"],
  });

  // Fetch inventory categories
  const { data: categories = [] } = useQuery<InventoryCategory[]>({
    queryKey: ['/api/inventory-categories'],
  });

  // Fetch inventory units for QR code printing
  const { data: inventoryUnits = [] } = useQuery<any[]>({
    queryKey: [`/api/inventory/${printQRItemId}/units`],
    enabled: !!printQRItemId && showPrintSheet,
  });

  // Calculate KPIs
  const kpis = useMemo(() => {
    const totalValue = items.reduce((sum, item) => {
      const itemValue = parseFloat(item.price || "0") * item.quantity;
      return sum + itemValue;
    }, 0);

    const lowStockCount = items.filter(item => item.quantity <= item.minQuantity).length;
    const totalItems = items.length;
    const inStockItems = items.filter(item => item.quantity > 0).length;

    return {
      totalValue,
      lowStockCount,
      totalItems,
      inStockItems,
    };
  }, [items]);

  // Handle sorting
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
    setCurrentPage(1); // Reset to first page when sorting changes
  };

  // Filter and sort items
  const filteredItems = useMemo(() => {
    let filtered = items.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          item.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          item.deviceType?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          item.brand?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          item.model?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          item.itemType?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesSupplier = filterSupplier === "all" || item.supplierId === filterSupplier;
      const matchesBrand = filterBrand === "all" || item.brand === filterBrand;
      
      let matchesStatus = true;
      if (filterStatus === "in_stock") {
        matchesStatus = item.quantity > item.minQuantity;
      } else if (filterStatus === "low_stock") {
        matchesStatus = item.quantity <= item.minQuantity && item.quantity > 0;
      } else if (filterStatus === "out_of_stock") {
        matchesStatus = item.quantity === 0;
      }

      return matchesSearch && matchesSupplier && matchesBrand && matchesStatus;
    });

    // Apply sorting
    if (sortColumn) {
      filtered = [...filtered].sort((a, b) => {
        let aValue: any;
        let bValue: any;

        switch (sortColumn) {
          case 'name':
            aValue = a.name.toLowerCase();
            bValue = b.name.toLowerCase();
            break;
          case 'category':
            aValue = a.itemType || '';
            bValue = b.itemType || '';
            break;
          case 'available':
            aValue = a.quantity;
            bValue = b.quantity;
            break;
          case 'status':
            const statusOrder = { 'out_of_stock': 0, 'low_stock': 1, 'in_stock': 2 };
            const getStatus = (item: InventoryItem) => {
              if (item.quantity === 0) return 'out_of_stock';
              if (item.quantity <= item.minQuantity) return 'low_stock';
              return 'in_stock';
            };
            aValue = statusOrder[getStatus(a) as keyof typeof statusOrder];
            bValue = statusOrder[getStatus(b) as keyof typeof statusOrder];
            break;
          case 'cost':
            aValue = parseFloat(a.cost || "0");
            bValue = parseFloat(b.cost || "0");
            break;
          case 'price':
            aValue = parseFloat(a.price || "0");
            bValue = parseFloat(b.price || "0");
            break;
          case 'value':
            aValue = parseFloat(a.price || "0") * a.quantity;
            bValue = parseFloat(b.price || "0") * b.quantity;
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
  }, [items, searchTerm, filterSupplier, filterBrand, filterStatus, sortColumn, sortDirection]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredItems.slice(startIndex, endIndex);
  }, [filteredItems, currentPage, itemsPerPage]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterSupplier, filterBrand, filterStatus]);

  // Low stock items for alerts (includes out of stock items)
  const lowStockItems = useMemo(() => {
    return items.filter(item => item.quantity <= item.minQuantity);
  }, [items]);

  // Get unique brands for filter dropdown
  const uniqueBrands = useMemo(() => {
    const brands = items
      .map(item => item.brand)
      .filter((brand): brand is string => brand !== null && brand !== undefined);
    return Array.from(new Set(brands)).sort();
  }, [items]);

  // Items now come from finalized purchase orders only

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InventoryItem> }) => {
      const response = await fetch(`/api/inventory/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to update item");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
      toast({
        title: t("item_updated_success", "Item updated successfully"),
      });
      setShowEditDialog(false);
      setSelectedItem(null);
      resetForm();
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/inventory/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete item");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
      toast({
        title: t("item_deleted_success", "Item deleted successfully"),
      });
      setShowDeleteDialog(false);
      setSelectedItem(null);
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      sku: "",
      category: null,
      quantity: "0",
      minQuantity: "0",
      cost: "0",
      price: "0",
      supplier: "",
    });
  };


  const handleEdit = (item: InventoryItem) => {
    setSelectedItem(item);
    setFormData({
      name: item.name,
      description: item.description || "",
      sku: item.sku || "",
      category: item.category || null,
      quantity: item.quantity.toString(),
      minQuantity: item.minQuantity.toString(),
      cost: item.cost || "0",
      price: item.price || "0",
      supplier: item.supplier || "",
    });
    setShowEditDialog(true);
  };

  const handlePrintQR = (item: InventoryItem) => {
    setPrintQRItemId(item.id);
    setShowPrintSheet(true);
  };

  const handleClosePrintSheet = (open: boolean) => {
    setShowPrintSheet(open);
    if (!open) {
      setPrintQRItemId(null);
    }
  };

  const handleUpdate = () => {
    if (!selectedItem) return;
    // Show confirmation dialog instead of updating directly
    setShowConfirmUpdateDialog(true);
  };

  const handleConfirmUpdate = () => {
    if (!selectedItem) return;
    
    updateMutation.mutate({
      id: selectedItem.id,
      data: {
        description: formData.description,
        category: formData.category || undefined,
        quantity: parseInt(formData.quantity) || 0,
        minQuantity: parseInt(formData.minQuantity) || 0,
        cost: formData.cost,
        price: formData.price,
      },
    });
    setShowConfirmUpdateDialog(false);
  };

  const handleDelete = () => {
    if (!selectedItem) return;
    deleteMutation.mutate(selectedItem.id);
  };

  const getStockStatus = (item: InventoryItem) => {
    if (item.quantity === 0) {
      return { status: "out_of_stock", color: "destructive" as const };
    } else if (item.quantity <= item.minQuantity) {
      return { status: "low_stock", color: "outline" as const };
    }
    return { status: "in_stock", color: "default" as const };
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-6 rounded-lg border border-cyan-500/20">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
              {t("inventory_dashboard", "Inventory Dashboard")}
            </h1>
            <p className="text-slate-400 mt-1">
              {t("inventory_from_pos", "Items are added through Purchase Orders")}
            </p>
          </div>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-slate-800/50 border-cyan-500/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-400 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-green-400" />
              {t("total_inventory_value", "Total Inventory Value")}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <div className="text-2xl font-bold text-green-400" data-testid="text-total-value">
              {formatCurrency(kpis.totalValue)}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-cyan-500/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-400 flex items-center gap-2">
              <PackageCheck className="w-4 h-4 text-blue-400" />
              {t("items_in_stock", "Items in Stock")}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <div className="text-2xl font-bold text-blue-400" data-testid="text-items-in-stock">
              {kpis.inStockItems} / {kpis.totalItems}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-cyan-500/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-400" />
              {t("low_stock_alerts", "Low Stock Alerts")}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <div className="text-2xl font-bold text-orange-400" data-testid="text-low-stock-count">
              {kpis.lowStockCount}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-cyan-500/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-400 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-cyan-400" />
              {t("inventory_turnover", "Inventory Turnover")}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <div className="text-2xl font-bold text-slate-400" data-testid="text-inventory-turnover">
              -
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {t("requires_sales_data", "Requires sales data")}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Critical Alerts Section */}
      {lowStockItems.length > 0 && (
        <Card className="bg-orange-500/10 border-orange-500/30">
          <CardHeader 
            className="cursor-pointer hover:bg-orange-500/5 transition-colors"
            onClick={() => setAlertsExpanded(!alertsExpanded)}
          >
            <CardTitle className="text-lg text-orange-400 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                {t("critical_stock_alerts", "Critical Alerts")}
              </div>
              <div className="flex items-center gap-2">
                {alertsExpanded && (
                  <span className="text-sm font-normal">
                    {lowStockItems.length} {t("items_running_low", "Items Running Low")}
                  </span>
                )}
                {alertsExpanded ? (
                  <ChevronUp className="w-5 h-5" />
                ) : (
                  <ChevronDown className="w-5 h-5" />
                )}
              </div>
            </CardTitle>
          </CardHeader>
          {alertsExpanded && (
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {lowStockItems.map((item) => (
                  <div 
                    key={item.id}
                    className="bg-slate-800/50 border border-orange-500/30 rounded-lg p-3"
                    data-testid={`alert-item-${item.id}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-semibold text-white mb-2">{item.name}</p>
                        <div className="flex items-center gap-2">
                          {item.itemType && (
                            <Badge 
                              variant={item.itemType === 'Sales' ? "default" : "outline"} 
                              className={item.itemType === 'Sales' ? "text-xs" : "text-xs border-purple-500/40 text-purple-400 bg-purple-500/10"}
                            >
                              {item.itemType}
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-xs border-orange-500/30 text-orange-400">
                            {item.quantity} {t("available", "Available")}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Search and Filter */}
      <Card className="bg-slate-800/50 border-cyan-500/20">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <Label className="text-slate-300 text-sm mb-2 block">{t("search", "Search")}</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  placeholder={t("search_items", "Search items...")}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 bg-slate-900/50 border-slate-700"
                  data-testid="input-search"
                />
              </div>
            </div>
            <div className="w-full md:w-[200px]">
              <Label className="text-slate-300 text-sm mb-2 block">{t("supplier", "Supplier")}</Label>
              <Select value={filterSupplier} onValueChange={setFilterSupplier}>
                <SelectTrigger className="bg-slate-900/50 border-slate-700" data-testid="select-filter-supplier">
                  <SelectValue placeholder={t("all_suppliers", "All Suppliers")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("all_suppliers", "All Suppliers")}</SelectItem>
                  {suppliers.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>{supplier.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-full md:w-[200px]">
              <Label className="text-slate-300 text-sm mb-2 block">{t("brand", "Brand")}</Label>
              <Select value={filterBrand} onValueChange={setFilterBrand}>
                <SelectTrigger className="bg-slate-900/50 border-slate-700" data-testid="select-filter-brand">
                  <SelectValue placeholder={t("all_brands", "All Brands")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("all_brands", "All Brands")}</SelectItem>
                  {uniqueBrands.map((brand) => (
                    <SelectItem key={brand} value={brand}>{brand}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-full md:w-[200px]">
              <Label className="text-slate-300 text-sm mb-2 block">{t("stock_status", "Stock Status")}</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="bg-slate-900/50 border-slate-700" data-testid="select-filter-status">
                  <SelectValue placeholder={t("all_items", "All Items")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("all_items", "All Items")}</SelectItem>
                  <SelectItem value="in_stock">{t("in_stock", "In Stock")}</SelectItem>
                  <SelectItem value="low_stock">{t("low_stock", "Low Stock")}</SelectItem>
                  <SelectItem value="out_of_stock">{t("out_of_stock", "Out of Stock")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Inventory Table */}
      <Card className="bg-slate-800/50 border-cyan-500/20">
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="text-center py-8 text-slate-400">Loading...</div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-8">
              <Package className="w-12 h-12 mx-auto text-slate-600 mb-3" />
              <p className="text-slate-400">{t("no_items_found", "No items found")}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-700">
                    <TableHead 
                      className="text-white font-bold text-base cursor-pointer hover:text-cyan-400 transition-colors"
                      onClick={() => handleSort('name')}
                    >
                      <div className="flex items-center gap-2">
                        {t("item", "Item")}
                        {sortColumn === 'name' ? (
                          sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ArrowUpDown className="w-4 h-4 opacity-40" />
                        )}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="text-white font-bold text-base cursor-pointer hover:text-cyan-400 transition-colors"
                      onClick={() => handleSort('category')}
                    >
                      <div className="flex items-center gap-2">
                        {t("category", "Category")}
                        {sortColumn === 'category' ? (
                          sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ArrowUpDown className="w-4 h-4 opacity-40" />
                        )}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="text-white font-bold text-base cursor-pointer hover:text-cyan-400 transition-colors"
                      onClick={() => handleSort('available')}
                    >
                      <div className="flex items-center gap-2">
                        {t("available", "Available")}
                        {sortColumn === 'available' ? (
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
                      onClick={() => handleSort('cost')}
                    >
                      <div className="flex items-center gap-2">
                        {t("cost_price", "Cost Price")}
                        {sortColumn === 'cost' ? (
                          sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ArrowUpDown className="w-4 h-4 opacity-40" />
                        )}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="text-white font-bold text-base cursor-pointer hover:text-cyan-400 transition-colors"
                      onClick={() => handleSort('price')}
                    >
                      <div className="flex items-center gap-2">
                        {t("selling_price", "Selling Price")}
                        {sortColumn === 'price' ? (
                          sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ArrowUpDown className="w-4 h-4 opacity-40" />
                        )}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="text-white font-bold text-base cursor-pointer hover:text-cyan-400 transition-colors"
                      onClick={() => handleSort('value')}
                    >
                      <div className="flex items-center gap-2">
                        {t("selling_value", "Selling Value")}
                        {sortColumn === 'value' ? (
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
                  {paginatedItems.map((item) => {
                    const stockStatus = getStockStatus(item);
                    const itemValue = parseFloat(item.price || "0") * item.quantity;
                    
                    return (
                      <TableRow key={item.id} className="border-slate-700" data-testid={`row-item-${item.id}`}>
                        <TableCell>
                          <div>
                            <div className="font-medium text-white">{item.name}</div>
                            {item.supplierId && suppliers.find(s => s.id === item.supplierId) && (
                              <div className="text-sm text-slate-400">
                                {suppliers.find(s => s.id === item.supplierId)?.name}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {item.itemType && (
                            <Badge 
                              variant={item.itemType === 'Sales' ? "default" : "outline"}
                              className={item.itemType === 'Sales' ? "" : "border-purple-500/40 text-purple-400 bg-purple-500/10"}
                            >
                              {item.itemType}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-slate-300">
                          {item.quantity}
                        </TableCell>
                        <TableCell>
                          <Badge variant={stockStatus.color}>
                            {t(stockStatus.status, stockStatus.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-slate-300">{formatCurrency(item.cost || "0")}</TableCell>
                        <TableCell className="text-slate-300">{formatCurrency(item.price || "0")}</TableCell>
                        <TableCell className="text-green-400 font-medium">{formatCurrency(itemValue)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handlePrintQR(item)}
                                    className="hover:bg-cyan-500/20 hover:text-cyan-400"
                                    data-testid={`button-print-qr-${item.id}`}
                                  >
                                    <QrCode className="w-4 h-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{t("print_qr_codes", "Print QR Codes")}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(item)}
                              className="hover:bg-blue-500/20 hover:text-blue-400"
                              data-testid={`button-edit-${item.id}`}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedItem(item);
                                setShowDeleteDialog(true);
                              }}
                              className="hover:bg-red-500/20 hover:text-red-400"
                              data-testid={`button-delete-${item.id}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
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
          {!isLoading && filteredItems.length > 0 && (
            <div className="flex items-center justify-between mt-6 px-2">
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <span>{t("page", "Page")} {currentPage} {t("of", "of")} {totalPages}</span>
                <span className="text-slate-600">•</span>
                <span>{filteredItems.length} {t("items_per_page", "items total")}</span>
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

      {/* Edit Item Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="bg-slate-900 border-cyan-500/20 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="bg-gradient-to-r from-slate-800 via-blue-900/40 to-cyan-900/40 -m-6 p-6 mb-4 border-b border-cyan-500/20">
            <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
              {t("edit_item", "Edit Item")}
            </DialogTitle>
            <DialogDescription className="text-slate-400 mt-1">
              {t("edit_item_description", "Update the item details below")}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Item Information Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-cyan-400 uppercase tracking-wide">
                {t("item_information", "Item Information")}
              </h3>
              <div className="bg-gradient-to-br from-slate-800/50 to-slate-800/30 border border-slate-700/50 rounded-lg p-4 space-y-3">
                {/* Item Name - Full Width */}
                <div className="space-y-1">
                  <Label className="text-slate-400 text-xs font-medium">{t("item_name", "Item Name")}</Label>
                  <div className="text-white font-semibold text-lg">{selectedItem?.name}</div>
                </div>
                
                {/* Category, Supplier, Device Type - 3 Columns */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-category" className="text-slate-400 text-xs font-medium">{t("category", "Category")}</Label>
                    <Select
                      value={formData.category || "uncategorized"}
                      onValueChange={(value) => setFormData({ ...formData, category: value === "uncategorized" ? null : value })}
                    >
                      <SelectTrigger 
                        id="edit-category"
                        className="bg-slate-900 border-slate-600 text-white"
                        data-testid="select-edit-category"
                      >
                        <SelectValue placeholder={t("select_category", "Select category")} />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-600">
                        <SelectItem value="uncategorized">
                          {t("uncategorized", "Uncategorized")}
                        </SelectItem>
                        {categories
                          .filter(cat => cat.deviceType === selectedItem?.deviceType && cat.isActive)
                          .map((category) => (
                            <SelectItem key={category.id} value={category.id}>
                              {category.name}
                            </SelectItem>
                          ))
                        }
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {selectedItem?.supplierId && suppliers.find(s => s.id === selectedItem.supplierId) ? (
                    <div className="space-y-1">
                      <Label className="text-slate-400 text-xs font-medium">{t("supplier", "Supplier")}</Label>
                      <div className="text-white font-medium truncate">
                        {suppliers.find(s => s.id === selectedItem.supplierId)?.name}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <Label className="text-slate-400 text-xs font-medium">{t("supplier", "Supplier")}</Label>
                      <div className="text-slate-500 text-sm">-</div>
                    </div>
                  )}
                  
                  {selectedItem?.deviceType ? (
                    <div className="space-y-1">
                      <Label className="text-slate-400 text-xs font-medium">{t("device_type", "Device Type")}</Label>
                      <div>
                        <Badge variant="outline" className="border-cyan-500/30 text-cyan-400 bg-cyan-500/5">
                          {selectedItem.deviceType}
                        </Badge>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <Label className="text-slate-400 text-xs font-medium">{t("device_type", "Device Type")}</Label>
                      <div className="text-slate-500 text-sm">-</div>
                    </div>
                  )}
                </div>
                
                {/* Brand, Model - 2 Columns */}
                <div className="grid grid-cols-3 gap-4">
                  {selectedItem?.brand ? (
                    <div className="space-y-1">
                      <Label className="text-slate-400 text-xs font-medium">{t("brand", "Brand")}</Label>
                      <div className="text-white font-medium">{selectedItem.brand}</div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <Label className="text-slate-400 text-xs font-medium">{t("brand", "Brand")}</Label>
                      <div className="text-slate-500 text-sm">-</div>
                    </div>
                  )}
                  
                  {selectedItem?.model ? (
                    <div className="space-y-1">
                      <Label className="text-slate-400 text-xs font-medium">{t("model", "Model")}</Label>
                      <div className="text-white font-medium">{selectedItem.model}</div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <Label className="text-slate-400 text-xs font-medium">{t("model", "Model")}</Label>
                      <div className="text-slate-500 text-sm">-</div>
                    </div>
                  )}
                </div>
                
                {/* Description - Full Width */}
                <div className="space-y-2 pt-1">
                  <Label htmlFor="edit-description" className="text-slate-400 text-xs font-medium">
                    {t("item_description", "Description")}
                  </Label>
                  <Textarea
                    id="edit-description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="bg-slate-800/70 border-cyan-500/20 focus:border-cyan-500/40 text-white min-h-[80px]"
                    placeholder={t("description_placeholder", "Enter item description...")}
                    data-testid="input-edit-description"
                  />
                </div>
              </div>
            </div>

            {/* Stock & Pricing Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-cyan-400 uppercase tracking-wide">
                {t("stock_pricing", "Stock & Pricing")}
              </h3>
              <div className="bg-gradient-to-br from-slate-800/50 to-slate-800/30 border border-slate-700/50 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-quantity" className="text-slate-400 text-xs font-medium">
                      {t("quantity", "Quantity")} *
                    </Label>
                    <Input
                      id="edit-quantity"
                      type="number"
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                      className="bg-slate-800/70 border-cyan-500/20 focus:border-cyan-500/40 text-white"
                      data-testid="input-edit-quantity"
                    />
                  </div>
                  <div className="space-y-2">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Label htmlFor="edit-minQuantity" className="text-slate-400 text-xs font-medium cursor-help">
                            {t("alert_quantity", "Alert Quantity")} *
                          </Label>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{t("alert_quantity_tooltip", "Triggers low stock alert when quantity reaches this level")}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <Input
                      id="edit-minQuantity"
                      type="number"
                      value={formData.minQuantity}
                      onChange={(e) => setFormData({ ...formData, minQuantity: e.target.value })}
                      className="bg-slate-800/70 border-cyan-500/20 focus:border-cyan-500/40 text-white"
                      data-testid="input-edit-min-quantity"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-cost" className="text-slate-400 text-xs font-medium">
                      {t("cost_price", "Cost Price")}
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                        {formatCurrency(0).replace(/[\d.,]/g, '')}
                      </span>
                      <Input
                        id="edit-cost"
                        type="number"
                        step="0.01"
                        value={formData.cost}
                        onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                        className="bg-slate-800/70 border-cyan-500/20 focus:border-cyan-500/40 text-white pl-8"
                        data-testid="input-edit-cost"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-price" className="text-slate-400 text-xs font-medium">
                      {t("selling_price", "Selling Price")}
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                        {formatCurrency(0).replace(/[\d.,]/g, '')}
                      </span>
                      <Input
                        id="edit-price"
                        type="number"
                        step="0.01"
                        value={formData.price}
                        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                        className="bg-slate-800/70 border-cyan-500/20 focus:border-cyan-500/40 text-white pl-8"
                        data-testid="input-edit-price"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <DialogFooter className="mt-6 gap-2">
            <Button 
              variant="outline" 
              onClick={() => {
                setShowEditDialog(false);
                setSelectedItem(null);
                resetForm();
              }}
              className="border-slate-700 hover:bg-slate-800"
              data-testid="button-cancel-edit"
            >
              {t("cancel", "Cancel")}
            </Button>
            <Button 
              onClick={handleUpdate}
              disabled={!formData.name || updateMutation.isPending}
              className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500"
              data-testid="button-confirm-edit"
            >
              {updateMutation.isPending ? t("updating", "Updating...") : t("update", "Update")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="bg-slate-900 border-cyan-500/30">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl text-white">
              {t("delete_item", "Delete Item")}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              {t("confirm_delete_item", "Are you sure you want to delete this item?")}
              {selectedItem && (
                <div className="mt-2 p-3 bg-slate-800 rounded border border-slate-700">
                  <p className="font-medium text-white">{selectedItem.name}</p>
                  <p className="text-sm text-slate-400">{selectedItem.sku}</p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              className="border-slate-700"
              data-testid="button-cancel-delete"
            >
              {t("cancel", "Cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="bg-red-600 hover:bg-red-500"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? t("deleting", "Deleting...") : t("delete", "Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Update Confirmation Dialog */}
      <AlertDialog open={showConfirmUpdateDialog} onOpenChange={setShowConfirmUpdateDialog}>
        <AlertDialogContent className="bg-slate-900 border-cyan-500/30">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl text-white">
              {t("confirm_update", "Confirm Update")}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              {t("confirm_update_message", "Please review the changes before applying them:")}
              {selectedItem && (
                <div className="mt-4 space-y-3">
                  <div className="p-3 bg-slate-800 rounded border border-slate-700">
                    <p className="text-xs text-slate-500 mb-1">{t("item", "Item")}</p>
                    <p className="font-medium text-white">{selectedItem.name}</p>
                    <p className="text-sm text-slate-400">{selectedItem.sku}</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    {formData.description !== (selectedItem.description || "") && (
                      <div className="col-span-2 p-3 bg-slate-800/50 rounded border border-yellow-500/30">
                        <p className="text-xs text-slate-500 mb-1">{t("description", "Description")}</p>
                        <p className="text-sm text-slate-400 line-through">{selectedItem.description || "-"}</p>
                        <p className="text-sm text-white font-medium">{formData.description || "-"}</p>
                      </div>
                    )}
                    
                    {parseInt(formData.quantity) !== selectedItem.quantity && (
                      <div className="p-3 bg-slate-800/50 rounded border border-yellow-500/30">
                        <p className="text-xs text-slate-500 mb-1">{t("quantity", "Quantity")}</p>
                        <p className="text-sm text-slate-400 line-through">{selectedItem.quantity}</p>
                        <p className="text-sm text-white font-medium">{formData.quantity}</p>
                      </div>
                    )}
                    
                    {parseInt(formData.minQuantity) !== selectedItem.minQuantity && (
                      <div className="p-3 bg-slate-800/50 rounded border border-yellow-500/30">
                        <p className="text-xs text-slate-500 mb-1">{t("min_quantity", "Min Quantity")}</p>
                        <p className="text-sm text-slate-400 line-through">{selectedItem.minQuantity}</p>
                        <p className="text-sm text-white font-medium">{formData.minQuantity}</p>
                      </div>
                    )}
                    
                    {formData.cost !== (selectedItem.cost || "0") && (
                      <div className="p-3 bg-slate-800/50 rounded border border-yellow-500/30">
                        <p className="text-xs text-slate-500 mb-1">{t("cost", "Cost")}</p>
                        <p className="text-sm text-slate-400 line-through">{formatCurrency(parseFloat(selectedItem.cost || "0"))}</p>
                        <p className="text-sm text-white font-medium">{formatCurrency(parseFloat(formData.cost))}</p>
                      </div>
                    )}
                    
                    {formData.price !== (selectedItem.price || "0") && (
                      <div className="p-3 bg-slate-800/50 rounded border border-yellow-500/30">
                        <p className="text-xs text-slate-500 mb-1">{t("price", "Price")}</p>
                        <p className="text-sm text-slate-400 line-through">{formatCurrency(parseFloat(selectedItem.price || "0"))}</p>
                        <p className="text-sm text-white font-medium">{formatCurrency(parseFloat(formData.price))}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              className="border-slate-700"
              data-testid="button-cancel-confirm-update"
            >
              {t("cancel", "Cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmUpdate}
              disabled={updateMutation.isPending}
              className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500"
              data-testid="button-apply-update"
            >
              {updateMutation.isPending ? t("updating", "Updating...") : t("apply_changes", "Apply Changes")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* QR Code Print Sheet */}
      <QRCodePrintSheet
        open={showPrintSheet}
        onOpenChange={handleClosePrintSheet}
        units={inventoryUnits}
      />
    </div>
  );
}
