import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocalization } from "@/contexts/LocalizationContext";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
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
  ChevronDown
} from "lucide-react";
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
  itemType?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface InventoryFormData {
  name: string;
  description: string;
  sku: string;
  category: string;
  quantity: string;
  minQuantity: string;
  cost: string;
  price: string;
  supplier: string;
}

export default function Inventory() {
  const { t } = useLocalization();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState("");
  const [filterDeviceType, setFilterDeviceType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [alertsExpanded, setAlertsExpanded] = useState(false);
  
  const [formData, setFormData] = useState<InventoryFormData>({
    name: "",
    description: "",
    sku: "",
    category: "",
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

  // All possible device types
  const deviceTypes = ['Phone', 'Laptop', 'Desktop', 'Other'];

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
                          item.itemType?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesDeviceType = filterDeviceType === "all" || item.deviceType === filterDeviceType;
      
      let matchesStatus = true;
      if (filterStatus === "in_stock") {
        matchesStatus = item.quantity > item.minQuantity;
      } else if (filterStatus === "low_stock") {
        matchesStatus = item.quantity <= item.minQuantity && item.quantity > 0;
      } else if (filterStatus === "out_of_stock") {
        matchesStatus = item.quantity === 0;
      }

      return matchesSearch && matchesDeviceType && matchesStatus;
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
  }, [items, searchTerm, filterDeviceType, filterStatus, sortColumn, sortDirection]);

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
  }, [searchTerm, filterDeviceType, filterStatus]);

  // Low stock items for alerts (includes out of stock items)
  const lowStockItems = useMemo(() => {
    return items.filter(item => item.quantity <= item.minQuantity);
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
      category: "",
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
      category: item.category || "",
      quantity: item.quantity.toString(),
      minQuantity: item.minQuantity.toString(),
      cost: item.cost || "0",
      price: item.price || "0",
      supplier: item.supplier || "",
    });
    setShowEditDialog(true);
  };

  const handleUpdate = () => {
    if (!selectedItem) return;
    
    updateMutation.mutate({
      id: selectedItem.id,
      data: {
        quantity: parseInt(formData.quantity) || 0,
        minQuantity: parseInt(formData.minQuantity) || 0,
        cost: formData.cost,
        price: formData.price,
      },
    });
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
          <CardContent>
            <div className="text-2xl font-bold text-green-400" data-testid="text-total-value">
              ${kpis.totalValue.toFixed(2)}
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
          <CardContent>
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
          <CardContent>
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
          <CardContent>
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
                            <Badge variant={item.itemType === 'Sales' ? "default" : "secondary"} className="text-xs">
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
              <Label className="text-slate-300 text-sm mb-2 block">{t("device_type", "Device Type")}</Label>
              <Select value={filterDeviceType} onValueChange={setFilterDeviceType}>
                <SelectTrigger className="bg-slate-900/50 border-slate-700" data-testid="select-filter-device-type">
                  <SelectValue placeholder={t("all_items", "All Items")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("all_items", "All Items")}</SelectItem>
                  {deviceTypes.map((type) => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
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
                            {item.description && (
                              <div className="text-sm text-slate-400">{item.description}</div>
                            )}
                            {item.deviceType && (
                              <div className="flex gap-2 mt-1">
                                <Badge variant="outline" className="text-xs border-cyan-500/30 text-cyan-400">
                                  {item.deviceType}
                                </Badge>
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {item.itemType && (
                            <Badge variant={item.itemType === 'Sales' ? "default" : "secondary"}>
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
                        <TableCell className="text-slate-300">${parseFloat(item.cost || "0").toFixed(2)}</TableCell>
                        <TableCell className="text-slate-300">${parseFloat(item.price || "0").toFixed(2)}</TableCell>
                        <TableCell className="text-green-400 font-medium">${itemValue.toFixed(2)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
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
        <DialogContent className="bg-slate-900 border-cyan-500/30 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
              {t("edit_item", "Edit Item")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-slate-300">{t("item_name", "Item Name")}</Label>
                  <div className="text-white font-medium">{selectedItem?.name}</div>
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300">{t("category", "Category")}</Label>
                  <div>
                    {selectedItem?.itemType && (
                      <Badge variant={selectedItem.itemType === 'Sales' ? "default" : "secondary"}>
                        {selectedItem.itemType}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              {selectedItem?.description && (
                <div className="space-y-2 mt-3">
                  <Label className="text-slate-300">{t("item_description", "Description")}</Label>
                  <div className="text-slate-400 text-sm">{selectedItem.description}</div>
                </div>
              )}
              {selectedItem?.deviceType && (
                <div className="space-y-2 mt-3">
                  <Label className="text-slate-300">{t("device_type", "Device Type")}</Label>
                  <div>
                    <Badge variant="outline" className="border-cyan-500/30 text-cyan-400">
                      {selectedItem.deviceType}
                    </Badge>
                  </div>
                </div>
              )}
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-quantity" className="text-slate-300">{t("quantity", "Quantity")} *</Label>
                <Input
                  id="edit-quantity"
                  type="number"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                  className="bg-slate-800 border-slate-700"
                  data-testid="input-edit-quantity"
                />
              </div>
              <div className="space-y-2">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Label htmlFor="edit-minQuantity" className="text-slate-300 cursor-help">
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
                  className="bg-slate-800 border-slate-700"
                  data-testid="input-edit-min-quantity"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-cost" className="text-slate-300">{t("cost_price", "Cost Price")}</Label>
                <Input
                  id="edit-cost"
                  type="number"
                  step="0.01"
                  value={formData.cost}
                  onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                  className="bg-slate-800 border-slate-700"
                  data-testid="input-edit-cost"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-price" className="text-slate-300">{t("selling_price", "Selling Price")}</Label>
                <Input
                  id="edit-price"
                  type="number"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  className="bg-slate-800 border-slate-700"
                  data-testid="input-edit-price"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowEditDialog(false);
                setSelectedItem(null);
                resetForm();
              }}
              className="border-slate-700"
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
    </div>
  );
}
