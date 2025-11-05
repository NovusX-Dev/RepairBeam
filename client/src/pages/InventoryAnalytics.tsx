import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, Filter, Package, TrendingUp, Calendar, Wrench, User } from "lucide-react";
import { fromCents } from "@shared/money";
import { format } from "date-fns";
import { useLocalization } from "@/contexts/LocalizationContext";
import { formatTicketId } from "@/lib/utils";
import TicketSummaryDialog from "@/components/TicketSummaryDialog";

interface UsageHistoryItem {
  unit: {
    id: string;
    uniqueTag: string;
    usedAt: string | null;
  };
  ticket: {
    id: string;
    deviceType: string;
    deviceModel: string;
    status: string;
    completedAt: string | null;
  } | null;
  client: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
  supplier: {
    id: string;
    name: string;
  } | null;
}

interface UsageStats {
  inventoryItem: {
    id: string;
    name: string;
    sku: string | null;
    category: string | null;
  };
  usageHistory: UsageHistoryItem[];
  totalUsed: number;
}

export default function InventoryAnalytics() {
  const { t, currentLanguage } = useLocalization();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSupplier, setSelectedSupplier] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [activeSearchFilter, setActiveSearchFilter] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Fetch inventory items with search
  const { data: inventoryItems = [], isLoading: itemsLoading } = useQuery<any[]>({
    queryKey: searchQuery && searchQuery.trim() 
      ? [`/api/inventory?search=${encodeURIComponent(searchQuery.trim())}`]
      : ["/api/inventory"],
  });

  // Fetch suppliers
  const { data: suppliers = [] } = useQuery<any[]>({
    queryKey: ["/api/suppliers"],
  });

  // Fetch usage stats for selected item
  const { data: usageStats, isLoading: statsLoading } = useQuery<UsageStats>({
    queryKey: [`/api/inventory/${selectedItemId}/usage-stats`],
    enabled: !!selectedItemId,
  });

  // Fetch ticket details for selected ticket
  const { data: ticketDetails, isLoading: ticketLoading } = useQuery<any>({
    queryKey: [`/api/tickets/${selectedTicketId}`],
    enabled: !!selectedTicketId,
  });

  // Filter inventory items by supplier and category (search is handled by backend)
  const filteredItems = inventoryItems.filter((item) => {
    const matchesSupplier = selectedSupplier === "all" || item.supplierId === selectedSupplier;
    const matchesCategory = selectedCategory === "all" || item.category === selectedCategory;
    return matchesSupplier && matchesCategory;
  });

  // Get unique categories
  const categories = Array.from(new Set(inventoryItems.map(item => item.category).filter(Boolean)));

  // Reset pagination when modal opens/closes
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedItemId]);

  return (
    <div className="min-h-screen p-6 space-y-6">
      {/* Header with Aurora gradient */}
      <div className="relative overflow-hidden rounded-xl p-6 mb-6"
           style={{
             background: "linear-gradient(135deg, hsl(210 40% 8%) 0%, hsl(210 40% 12%) 100%)",
             border: "1px solid hsl(210 40% 18%)"
           }}>
        <div className="absolute inset-0 opacity-30"
             style={{
               background: "linear-gradient(135deg, hsl(210 40% 6%) 0%, hsl(180 100% 50% / 0.1) 100%)"
             }}></div>
        <div className="relative z-10">
          <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
            <TrendingUp className="w-8 h-8 text-cyan-400" />
            {t("inventory_analytics", "Inventory Analytics")}
          </h1>
          <p className="text-gray-400">{t("track_item_usage_desc", "Track item usage, analyze supplier performance, and monitor inventory trends")}</p>
        </div>
      </div>

      {/* Filters */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-cyan-400" />
            {t("filters", "Filters")}
          </CardTitle>
          <CardDescription>{t("search_and_filter_inventory", "Search and filter inventory items")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={t("search_by_name_unit_ticket", "Search by name, unit tag, or ticket ID...")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search-items"
              />
            </div>

            <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
              <SelectTrigger data-testid="select-supplier-filter">
                <SelectValue placeholder={t("all_suppliers", "All Suppliers")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("all_suppliers", "All Suppliers")}</SelectItem>
                {suppliers.map((supplier) => (
                  <SelectItem key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger data-testid="select-category-filter">
                <SelectValue placeholder={t("all_categories", "All Categories")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("all_categories", "All Categories")}</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Inventory Items Table */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-cyan-400" />
            {t("inventory_items", "Inventory Items")}
          </CardTitle>
          <CardDescription>{t("click_to_view_usage", "Click on an item to view detailed usage history")}</CardDescription>
        </CardHeader>
        <CardContent>
          {itemsLoading ? (
            <div className="text-center py-8 text-muted-foreground">{t("loading_inventory", "Loading inventory items...")}</div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">{t("no_inventory_found", "No inventory items found")}</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("item_name", "Item Name")}</TableHead>
                    <TableHead>{t("category", "Category")}</TableHead>
                    <TableHead className="text-right">{t("stock", "Stock")}</TableHead>
                    <TableHead>{t("status", "Status")}</TableHead>
                    <TableHead>{t("actions", "Actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((item) => {
                    const isLowStock = item.quantity <= item.minQuantity;
                    
                    return (
                      <TableRow key={item.id} data-testid={`row-inventory-item-${item.id}`}>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-cyan-400 border-cyan-400/30">
                            {item.category || t("uncategorized", "Uncategorized")}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={isLowStock ? "text-orange-400 font-semibold" : ""}>
                            {item.quantity}
                          </span>
                        </TableCell>
                        <TableCell>
                          {isLowStock ? (
                            <Badge variant="destructive">{t("low_stock", "Low Stock")}</Badge>
                          ) : (
                            <Badge variant="outline" className="text-green-400 border-green-400/30">{t("in_stock", "In Stock")}</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedItemId(item.id);
                              setActiveSearchFilter(searchQuery);
                            }}
                            className="text-cyan-400 hover:text-cyan-300"
                            data-testid={`button-view-usage-${item.id}`}
                          >
                            {t("view_usage", "View Usage")}
                          </Button>
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

      {/* Usage History Dialog */}
      <Dialog open={!!selectedItemId} onOpenChange={(open) => !open && setSelectedItemId(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-cyan-400 flex items-center gap-2">
              {t("item_usage_history", "Item Usage History")}
              {usageStats && (
                <span className="text-sm font-normal text-muted-foreground">
                  ({usageStats.totalUsed} {t("units_used", "units used")})
                </span>
              )}
            </DialogTitle>
            <DialogDescription>
              {t("detailed_usage_for", "Detailed usage history for")} {usageStats?.inventoryItem?.name}
            </DialogDescription>
          </DialogHeader>

          {statsLoading ? (
            <div className="text-center py-8 text-muted-foreground">{t("loading_usage_history", "Loading usage history...")}</div>
          ) : usageStats && usageStats.usageHistory ? (
            (() => {
              // Filter usage history based on active search
              let filteredHistory = usageStats.usageHistory;
              
              if (activeSearchFilter && activeSearchFilter.trim()) {
                const lowerFilter = activeSearchFilter.toLowerCase().trim();
                
                // Check if it's a ticket ID format (TK-XXXXXX or just XXXXXX)
                const ticketIdMatch = lowerFilter.match(/^(?:tk-)?([a-f0-9]+)$/i);
                const ticketId = ticketIdMatch ? ticketIdMatch[1] : null;
                
                filteredHistory = usageStats.usageHistory.filter((usage: any) => {
                  // Filter by unit tag
                  if (usage.unit?.uniqueTag?.toLowerCase().includes(lowerFilter)) {
                    return true;
                  }
                  
                  // Filter by ticket ID
                  if (ticketId && usage.ticket?.id?.toLowerCase().includes(ticketId)) {
                    return true;
                  }
                  
                  return false;
                });
              }
              
              const startIndex = (currentPage - 1) * itemsPerPage;
              const endIndex = startIndex + itemsPerPage;
              const paginatedHistory = filteredHistory.slice(startIndex, endIndex);
              
              return (
                <div className="space-y-4">
                  {/* Usage History Table */}
                  {filteredHistory.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      {t("no_usage_history", "No usage history available for this item")}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <h3 className="font-semibold text-white flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-cyan-400" />
                        {t("usage_timeline", "Usage Timeline")}
                      </h3>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>{t("unit_tag", "Unit Tag")}</TableHead>
                              <TableHead>{t("ticket", "Ticket")}</TableHead>
                              <TableHead>{t("client", "Client")}</TableHead>
                              <TableHead>{t("device", "Device")}</TableHead>
                              <TableHead>{t("supplier", "Supplier")}</TableHead>
                              <TableHead>{t("used_date", "Used Date")}</TableHead>
                              <TableHead>{t("status", "Status")}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {paginatedHistory.map((usage: any, index: number) => (
                            <TableRow key={usage.unit.id || index} data-testid={`row-usage-history-${index}`}>
                              <TableCell className="font-mono text-xs text-cyan-400">
                                {usage.unit.uniqueTag || "—"}
                              </TableCell>
                              <TableCell>
                                {usage.ticket ? (
                                  <button
                                    onClick={() => setSelectedTicketId(usage.ticket.id)}
                                    className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer group"
                                    data-testid={`button-view-ticket-${usage.ticket.id}`}
                                  >
                                    <Wrench className="w-3 h-3 group-hover:scale-110 transition-transform" />
                                    <span className="text-sm underline decoration-dotted">{formatTicketId(usage.ticket.id)}</span>
                                  </button>
                                ) : "—"}
                              </TableCell>
                              <TableCell>
                                {usage.client ? (
                                  <div className="flex items-center gap-1">
                                    <User className="w-3 h-3 text-muted-foreground" />
                                    <span className="text-sm">{usage.client.firstName} {usage.client.lastName}</span>
                                  </div>
                                ) : "—"}
                              </TableCell>
                              <TableCell className="text-sm">
                                {usage.ticket ? `${usage.ticket.deviceType} - ${usage.ticket.deviceModel}` : "—"}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {usage.supplier?.name || "—"}
                              </TableCell>
                              <TableCell className="text-sm">
                                {usage.unit.usedAt ? format(new Date(usage.unit.usedAt), "MMM dd, yyyy") : "—"}
                              </TableCell>
                              <TableCell>
                                {usage.ticket?.completedAt ? (
                                  <Badge variant="outline" className="text-green-400 border-green-400/30">
                                    {t("finalized", "Finalized")}
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-green-400 border-green-400/30">
                                    {usage.ticket?.status || t("used", "Used")}
                                  </Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </div>
                  
                  {/* Pagination Controls */}
                  {filteredHistory.length > itemsPerPage && (
                    <div className="flex items-center justify-between border-t border-border pt-4">
                      <div className="text-sm text-muted-foreground">
                        {t("showing", "Showing")} {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, filteredHistory.length)} {t("of", "of")} {filteredHistory.length}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                          disabled={currentPage === 1}
                          data-testid="button-prev-page"
                        >
                          {t("previous", "Previous")}
                        </Button>
                        <span className="text-sm text-muted-foreground">
                          {t("page", "Page")} {currentPage} {t("of", "of")} {Math.ceil(filteredHistory.length / itemsPerPage)}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(prev => Math.min(Math.ceil(filteredHistory.length / itemsPerPage), prev + 1))}
                          disabled={currentPage >= Math.ceil(filteredHistory.length / itemsPerPage)}
                          data-testid="button-next-page"
                        >
                          {t("next", "Next")}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()
          ) : (
            <div className="text-center py-8 text-muted-foreground">{t("no_data_available", "No data available")}</div>
          )}
        </DialogContent>
      </Dialog>

      {/* Ticket Details Dialog */}
      <TicketSummaryDialog
        ticket={ticketDetails || null}
        isOpen={!!selectedTicketId}
        onClose={() => setSelectedTicketId(null)}
      />
    </div>
  );
}
