import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useLocalization } from "@/contexts/LocalizationContext";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { PermissionGate } from "@/components/PermissionGate";
import { PERMISSIONS } from "@shared/permissions";
import { format } from "date-fns";
import { 
  FileText, 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Eye,
  Send,
  CheckCircle,
  XCircle,
  Clock,
  ArrowRightCircle,
  DollarSign,
  Calendar,
  User,
  FileCheck,
  ClipboardList,
  Wrench,
  Package,
  Smartphone,
  Link
} from "lucide-react";
import type { Quote, QuoteItem, Client, Ticket } from "@shared/schema";

interface QuoteStats {
  total: number;
  draft: number;
  sent: number;
  accepted: number;
  rejected: number;
  expired: number;
  converted: number;
  totalValue: number;
  pendingValue: number;
}

interface QuoteFormData {
  clientId: string;
  title: string;
  description: string;
  validUntil: string;
  notes: string;
  termsAndConditions: string;
}

interface QuoteItemFormData {
  description: string;
  quantity: number;
  unitPrice: string;
  discountAmount: string;
}

interface TicketSummary {
  ticket: {
    id: string;
    title: string;
    description: string | null;
    status: string;
    deviceType: string | null;
    deviceBrand: string | null;
    deviceModel: string | null;
  };
  client: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
  } | null;
  lineItems: Array<{
    type: string;
    description: string;
    quantity: number;
    unitPrice: string;
    discountAmount: string;
    totalPrice: string;
    repairServiceId?: string;
    inventoryItemId?: string;
    sortOrder: number;
  }>;
  summary: {
    servicesTotal: number;
    partsTotal: number;
    extraCosts: number;
    subtotal: number;
    totalAmount: number;
  };
}

const emptyFormData: QuoteFormData = {
  clientId: "",
  title: "",
  description: "",
  validUntil: "",
  notes: "",
  termsAndConditions: ""
};

const emptyItemFormData: QuoteItemFormData = {
  description: "",
  quantity: 1,
  unitPrice: "",
  discountAmount: "0"
};

export default function Quotes() {
  const { t, formatCurrency } = useLocalization();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDetailsSheetOpen, setIsDetailsSheetOpen] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [formData, setFormData] = useState<QuoteFormData>(emptyFormData);
  const [lineItems, setLineItems] = useState<QuoteItemFormData[]>([]);
  const [newItem, setNewItem] = useState<QuoteItemFormData>(emptyItemFormData);
  const [isImportFromTicketOpen, setIsImportFromTicketOpen] = useState(false);
  const [ticketSearchTerm, setTicketSearchTerm] = useState("");
  const [ticketStatusFilter, setTicketStatusFilter] = useState("all");
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [ticketSummary, setTicketSummary] = useState<TicketSummary | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);

  const { data: quotes = [], isLoading: quotesLoading } = useQuery<Quote[]>({
    queryKey: ["/api/quotes"]
  });

  const { data: stats, isLoading: statsLoading } = useQuery<QuoteStats>({
    queryKey: ["/api/quotes/stats"]
  });

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    select: (data: any) => data?.clients || data || []
  });

  const { data: tickets = [] } = useQuery<Ticket[]>({
    queryKey: ["/api/tickets"],
    enabled: isImportFromTicketOpen
  });

  const { data: quoteItems = [] } = useQuery<QuoteItem[]>({
    queryKey: ["/api/quotes", selectedQuote?.id, "items"],
    queryFn: async () => {
      if (!selectedQuote?.id) return [];
      const response = await fetch(`/api/quotes/${selectedQuote.id}/items`, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch quote items");
      return response.json();
    },
    enabled: !!selectedQuote?.id && isDetailsSheetOpen
  });

  const createQuoteMutation = useMutation({
    mutationFn: async (data: { quote: Partial<QuoteFormData>; items: QuoteItemFormData[] }) => {
      const response = await apiRequest("POST", "/api/quotes", {
        ...data.quote,
        status: 'draft'
      });
      const newQuote = await response.json();
      
      for (const item of data.items) {
        const totalPrice = (parseFloat(item.unitPrice) * item.quantity) - parseFloat(item.discountAmount || '0');
        await apiRequest("POST", `/api/quotes/${newQuote.id}/items`, {
          ...item,
          totalPrice: totalPrice.toFixed(2)
        });
      }
      
      return newQuote;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/quotes/stats"] });
      setIsAddDialogOpen(false);
      setFormData(emptyFormData);
      setLineItems([]);
      toast({
        title: t("success", "Success"),
        description: t("quote_created_successfully", "Quote created successfully")
      });
    },
    onError: () => {
      toast({
        title: t("error", "Error"),
        description: t("quote_creation_failed", "Failed to create quote"),
        variant: "destructive"
      });
    }
  });

  const updateQuoteMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<QuoteFormData> }) => {
      const response = await apiRequest("PATCH", `/api/quotes/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/quotes/stats"] });
      setIsEditDialogOpen(false);
      setSelectedQuote(null);
      setFormData(emptyFormData);
      toast({
        title: t("success", "Success"),
        description: t("quote_updated_successfully", "Quote updated successfully")
      });
    },
    onError: () => {
      toast({
        title: t("error", "Error"),
        description: t("quote_update_failed", "Failed to update quote"),
        variant: "destructive"
      });
    }
  });

  const updateQuoteStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const response = await apiRequest("PATCH", `/api/quotes/${id}`, { status });
      return response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/quotes/stats"] });
      
      // If ticket was auto-moved to Approved, show extended notification
      if (data.ticketStatusUpdated && data.ticketId) {
        queryClient.invalidateQueries({ queryKey: ["/api/tickets"] });
        toast({
          title: t("quote_accepted_ticket_moved", "Quote Accepted - Ticket Updated"),
          description: t("ticket_auto_moved_to_approved", "The linked ticket has been automatically moved to the Approved column."),
          duration: 8000,
        });
      } else {
        toast({
          title: t("success", "Success"),
          description: t("quote_status_updated", "Quote status updated")
        });
      }
    },
    onError: () => {
      toast({
        title: t("error", "Error"),
        description: t("quote_status_update_failed", "Failed to update quote status"),
        variant: "destructive"
      });
    }
  });

  const deleteQuoteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/quotes/${id}`);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/quotes/stats"] });
      setIsDeleteDialogOpen(false);
      setSelectedQuote(null);
      toast({
        title: t("success", "Success"),
        description: t("quote_deleted_successfully", "Quote deleted successfully")
      });
    },
    onError: () => {
      toast({
        title: t("error", "Error"),
        description: t("quote_deletion_failed", "Failed to delete quote"),
        variant: "destructive"
      });
    }
  });

  const convertToInvoiceMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("POST", `/api/quotes/${id}/convert-to-invoice`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/quotes/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pos-invoices"] });
      toast({
        title: t("success", "Success"),
        description: t("quote_converted_to_invoice", "Quote converted to invoice successfully")
      });
    },
    onError: (error: any) => {
      toast({
        title: t("error", "Error"),
        description: error?.message || t("quote_conversion_failed", "Failed to convert quote to invoice"),
        variant: "destructive"
      });
    }
  });

  const createQuoteFromTicketMutation = useMutation({
    mutationFn: async (ticketId: string) => {
      const response = await apiRequest("POST", `/api/quotes/from-ticket/${ticketId}`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/quotes/stats"] });
      setIsImportFromTicketOpen(false);
      setSelectedTicketId(null);
      setTicketSummary(null);
      setIsPreviewMode(false);
      toast({
        title: t("success", "Success"),
        description: t("quote_created_from_ticket", "Quote created from ticket successfully")
      });
    },
    onError: (error: any) => {
      toast({
        title: t("error", "Error"),
        description: error?.message || t("quote_from_ticket_failed", "Failed to create quote from ticket"),
        variant: "destructive"
      });
    }
  });

  const handleOpenAddDialog = () => {
    setFormData(emptyFormData);
    setLineItems([]);
    setIsAddDialogOpen(true);
  };

  const handleOpenEditDialog = (quote: Quote) => {
    setSelectedQuote(quote);
    setFormData({
      clientId: quote.clientId || "",
      title: quote.title || "",
      description: quote.description || "",
      validUntil: quote.validUntil ? format(new Date(quote.validUntil), "yyyy-MM-dd") : "",
      notes: quote.notes || "",
      termsAndConditions: quote.termsAndConditions || ""
    });
    setIsEditDialogOpen(true);
  };

  const handleOpenDetailsSheet = (quote: Quote) => {
    setSelectedQuote(quote);
    setIsDetailsSheetOpen(true);
  };

  const handleOpenDeleteDialog = (quote: Quote) => {
    setSelectedQuote(quote);
    setIsDeleteDialogOpen(true);
  };

  const handleAddLineItem = () => {
    if (!newItem.description || !newItem.unitPrice) return;
    setLineItems([...lineItems, { ...newItem }]);
    setNewItem(emptyItemFormData);
  };

  const handleRemoveLineItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const handleCreateQuote = () => {
    createQuoteMutation.mutate({ quote: formData, items: lineItems });
  };

  const handleUpdateQuote = () => {
    if (selectedQuote) {
      updateQuoteMutation.mutate({ id: selectedQuote.id, data: formData });
    }
  };

  const handleDeleteQuote = () => {
    if (selectedQuote) {
      deleteQuoteMutation.mutate(selectedQuote.id);
    }
  };

  const handleSendQuote = (quote: Quote) => {
    updateQuoteStatusMutation.mutate({ id: quote.id, status: 'sent' });
  };

  const handleAcceptQuote = (quote: Quote) => {
    updateQuoteStatusMutation.mutate({ id: quote.id, status: 'accepted' });
  };

  const handleRejectQuote = (quote: Quote) => {
    updateQuoteStatusMutation.mutate({ id: quote.id, status: 'rejected' });
  };

  const handleConvertToInvoice = (quote: Quote) => {
    convertToInvoiceMutation.mutate(quote.id);
  };

  const handleOpenImportFromTicket = () => {
    setTicketSearchTerm("");
    setTicketStatusFilter("all");
    setSelectedTicketId(null);
    setTicketSummary(null);
    setIsPreviewMode(false);
    setIsImportFromTicketOpen(true);
  };

  const handleSelectTicket = async (ticketId: string) => {
    setSelectedTicketId(ticketId);
    try {
      const response = await fetch(`/api/tickets/${ticketId}/quote-summary`, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch ticket summary");
      const summary = await response.json();
      setTicketSummary(summary);
      setIsPreviewMode(true);
    } catch (error) {
      toast({
        title: t("error", "Error"),
        description: t("failed_to_load_ticket_summary", "Failed to load ticket summary"),
        variant: "destructive"
      });
    }
  };

  const handleCreateQuoteFromTicket = () => {
    if (selectedTicketId) {
      createQuoteFromTicketMutation.mutate(selectedTicketId);
    }
  };

  const handleBackToTicketSelection = () => {
    setIsPreviewMode(false);
    setTicketSummary(null);
    setSelectedTicketId(null);
  };

  const getTicketStatusColor = (status: string) => {
    switch (status) {
      case "backlog": return "text-gray-400";
      case "waiting_parts": return "text-yellow-400";
      case "in_progress": return "text-blue-400";
      case "done": return "text-green-400";
      case "finalized": return "text-purple-400";
      default: return "text-gray-400";
    }
  };

  const filteredTickets = tickets.filter(ticket => {
    if (ticket.isArchived) return false;
    const matchesSearch = 
      ticket.title?.toLowerCase().includes(ticketSearchTerm.toLowerCase()) ||
      ticket.deviceBrand?.toLowerCase().includes(ticketSearchTerm.toLowerCase()) ||
      ticket.deviceModel?.toLowerCase().includes(ticketSearchTerm.toLowerCase());
    const matchesStatus = ticketStatusFilter === "all" || ticket.status === ticketStatusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "draft": return "secondary";
      case "sent": return "default";
      case "accepted": return "default";
      case "rejected": return "destructive";
      case "expired": return "outline";
      case "converted": return "default";
      default: return "secondary";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "draft": return "text-gray-400";
      case "sent": return "text-blue-400";
      case "accepted": return "text-green-400";
      case "rejected": return "text-red-400";
      case "expired": return "text-orange-400";
      case "converted": return "text-purple-400";
      default: return "text-gray-400";
    }
  };

  const getClientName = (clientId: string | null) => {
    if (!clientId) return t("no_client", "No Client");
    const client = clients.find(c => c.id === clientId);
    return client ? `${client.firstName} ${client.lastName}` : t("unknown_client", "Unknown Client");
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return "-";
    return format(new Date(date), "MMM dd, yyyy");
  };

  const calculateLineItemsTotal = () => {
    return lineItems.reduce((sum, item) => {
      const itemTotal = (parseFloat(item.unitPrice) * item.quantity) - parseFloat(item.discountAmount || '0');
      return sum + (isNaN(itemTotal) ? 0 : itemTotal);
    }, 0);
  };

  const filteredQuotes = quotes.filter(quote => {
    const matchesSearch = 
      quote.quoteNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      quote.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      getClientName(quote.clientId).toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || quote.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#00FFFF]" data-testid="text-quotes-title">
            {t("quotes", "Quotes")}
          </h1>
          <p className="text-muted-foreground text-sm mt-1" data-testid="text-quotes-description">
            {t("quotes_description", "Create and manage customer quotes")}
          </p>
        </div>
        <PermissionGate permission={PERMISSIONS.QUOTES_CREATE}>
          <div className="flex gap-2">
            <Button 
              onClick={handleOpenImportFromTicket}
              variant="outline"
              className="border-cyan-500/30 hover:bg-cyan-500/10"
              data-testid="button-import-from-ticket"
            >
              <ClipboardList className="w-4 h-4 mr-2" />
              {t("import_from_ticket", "Import from Ticket")}
            </Button>
            <Button 
              onClick={handleOpenAddDialog}
              className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500"
              data-testid="button-add-quote"
            >
              <Plus className="w-4 h-4 mr-2" />
              {t("create_quote", "Create Quote")}
            </Button>
          </div>
        </PermissionGate>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-slate-800/50 border-cyan-500/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm font-medium">{t("total_quotes", "Total Quotes")}</p>
                {statsLoading ? (
                  <Skeleton className="h-8 w-16 mt-1" />
                ) : (
                  <p className="text-3xl font-bold text-white" data-testid="text-stat-total-quotes">
                    {stats?.total || 0}
                  </p>
                )}
              </div>
              <div className="p-3 bg-cyan-500/10 rounded-lg">
                <FileText className="w-6 h-6 text-cyan-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-cyan-500/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm font-medium">{t("pending_quotes", "Pending Quotes")}</p>
                {statsLoading ? (
                  <Skeleton className="h-8 w-16 mt-1" />
                ) : (
                  <p className="text-3xl font-bold text-blue-400" data-testid="text-stat-pending-quotes">
                    {stats?.sent || 0}
                  </p>
                )}
              </div>
              <div className="p-3 bg-blue-500/10 rounded-lg">
                <Send className="w-6 h-6 text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-cyan-500/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm font-medium">{t("accepted_quotes", "Accepted Quotes")}</p>
                {statsLoading ? (
                  <Skeleton className="h-8 w-16 mt-1" />
                ) : (
                  <p className="text-3xl font-bold text-green-400" data-testid="text-stat-accepted-quotes">
                    {stats?.accepted || 0}
                  </p>
                )}
              </div>
              <div className="p-3 bg-green-500/10 rounded-lg">
                <CheckCircle className="w-6 h-6 text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-cyan-500/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm font-medium">{t("pending_value", "Pending Value")}</p>
                {statsLoading ? (
                  <Skeleton className="h-8 w-24 mt-1" />
                ) : (
                  <p className="text-3xl font-bold text-yellow-400" data-testid="text-stat-pending-value">
                    {formatCurrency(stats?.pendingValue || 0)}
                  </p>
                )}
              </div>
              <div className="p-3 bg-yellow-500/10 rounded-lg">
                <DollarSign className="w-6 h-6 text-yellow-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-slate-800/50 border-cyan-500/20">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder={t("search_quotes", "Search quotes...")}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-slate-900/50 border-slate-700"
                data-testid="input-search-quotes"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-48 bg-slate-900/50 border-slate-700" data-testid="select-status-filter">
                <SelectValue placeholder={t("filter_by_status", "Filter by status")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("all_statuses", "All Statuses")}</SelectItem>
                <SelectItem value="draft">{t("draft", "Draft")}</SelectItem>
                <SelectItem value="sent">{t("sent", "Sent")}</SelectItem>
                <SelectItem value="accepted">{t("accepted", "Accepted")}</SelectItem>
                <SelectItem value="rejected">{t("rejected", "Rejected")}</SelectItem>
                <SelectItem value="expired">{t("expired", "Expired")}</SelectItem>
                <SelectItem value="converted">{t("converted", "Converted")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {quotesLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredQuotes.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground" data-testid="text-no-quotes">
                {t("no_quotes_found", "No quotes found")}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-700">
                    <TableHead className="text-cyan-400">{t("quote_number", "Quote #")}</TableHead>
                    <TableHead className="text-cyan-400">{t("client", "Client")}</TableHead>
                    <TableHead className="text-cyan-400">{t("title", "Title")}</TableHead>
                    <TableHead className="text-cyan-400">{t("amount", "Amount")}</TableHead>
                    <TableHead className="text-cyan-400">{t("status", "Status")}</TableHead>
                    <TableHead className="text-cyan-400">{t("valid_until", "Valid Until")}</TableHead>
                    <TableHead className="text-cyan-400 text-right">{t("actions", "Actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredQuotes.map((quote) => (
                    <TableRow key={quote.id} className="border-slate-700 hover:bg-slate-800/50" data-testid={`row-quote-${quote.id}`}>
                      <TableCell className="font-mono text-white">{quote.quoteNumber}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-muted-foreground" />
                          <span>{getClientName(quote.clientId)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">{quote.title || "-"}</TableCell>
                      <TableCell className="font-semibold text-white">
                        {formatCurrency(parseFloat(quote.totalAmount || '0'))}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(quote.status)} className={getStatusColor(quote.status)}>
                          {t(quote.status, quote.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          <span>{formatDate(quote.validUntil)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <TooltipProvider>
                          <div className="flex items-center justify-end gap-2">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleOpenDetailsSheet(quote)}
                                  className="hover:bg-cyan-500/10"
                                  data-testid={`button-view-quote-${quote.id}`}
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{t("view_quote", "View Quote")}</p>
                              </TooltipContent>
                            </Tooltip>
                            {quote.status === 'draft' && (
                              <>
                                <PermissionGate permission={PERMISSIONS.QUOTES_UPDATE}>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleOpenEditDialog(quote)}
                                        className="hover:bg-blue-500/10"
                                        data-testid={`button-edit-quote-${quote.id}`}
                                      >
                                        <Edit className="w-4 h-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>{t("edit_quote", "Edit Quote")}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </PermissionGate>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleSendQuote(quote)}
                                      className="hover:bg-green-500/10 text-green-400"
                                      data-testid={`button-send-quote-${quote.id}`}
                                    >
                                      <Send className="w-4 h-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>{t("send_quote", "Send Quote")}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </>
                            )}
                            {quote.status === 'sent' && (
                              <>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleAcceptQuote(quote)}
                                      className="hover:bg-green-500/10 text-green-400"
                                      data-testid={`button-accept-quote-${quote.id}`}
                                    >
                                      <CheckCircle className="w-4 h-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>{t("accept_quote", "Accept Quote")}</p>
                                  </TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleRejectQuote(quote)}
                                      className="hover:bg-red-500/10 text-red-400"
                                      data-testid={`button-reject-quote-${quote.id}`}
                                    >
                                      <XCircle className="w-4 h-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>{t("reject_quote", "Reject Quote")}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </>
                            )}
                            {quote.status === 'accepted' && !quote.convertedToInvoiceId && (
                              <PermissionGate permission={PERMISSIONS.INVOICES_CREATE}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleConvertToInvoice(quote)}
                                      disabled={convertToInvoiceMutation.isPending}
                                      className="hover:bg-purple-500/10 text-purple-400"
                                      data-testid={`button-convert-quote-${quote.id}`}
                                    >
                                      <ArrowRightCircle className="w-4 h-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>{t("convert_to_invoice", "Convert to Invoice")}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </PermissionGate>
                            )}
                            <PermissionGate permission={PERMISSIONS.QUOTES_DELETE}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleOpenDeleteDialog(quote)}
                                    className="hover:bg-red-500/10 text-red-400"
                                    data-testid={`button-delete-quote-${quote.id}`}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{t("delete_quote", "Delete Quote")}</p>
                                </TooltipContent>
                              </Tooltip>
                            </PermissionGate>
                          </div>
                        </TooltipProvider>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-3xl bg-slate-900 border-cyan-500/20 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-cyan-400">{t("create_quote", "Create Quote")}</DialogTitle>
            <DialogDescription>{t("create_quote_description", "Create a new quote for a customer")}</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("client", "Client")}</Label>
                <Select value={formData.clientId} onValueChange={(value) => setFormData({ ...formData, clientId: value })}>
                  <SelectTrigger className="bg-slate-800 border-slate-700" data-testid="select-client">
                    <SelectValue placeholder={t("select_client", "Select a client")} />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.firstName} {client.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("valid_until", "Valid Until")}</Label>
                <Input
                  type="date"
                  value={formData.validUntil}
                  onChange={(e) => setFormData({ ...formData, validUntil: e.target.value })}
                  className="bg-slate-800 border-slate-700"
                  data-testid="input-valid-until"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t("title", "Title")}</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder={t("quote_title_placeholder", "e.g., Phone Repair Quote")}
                className="bg-slate-800 border-slate-700"
                data-testid="input-title"
              />
            </div>

            <div className="space-y-2">
              <Label>{t("description", "Description")}</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder={t("quote_description_placeholder", "Describe the services or products...")}
                className="bg-slate-800 border-slate-700"
                rows={3}
                data-testid="input-description"
              />
            </div>

            <div className="space-y-4">
              <Label className="text-lg font-semibold text-cyan-400">{t("line_items", "Line Items")}</Label>
              
              <div className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-5">
                  <Label className="text-xs">{t("description", "Description")}</Label>
                  <Input
                    value={newItem.description}
                    onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                    placeholder={t("item_description", "Item description")}
                    className="bg-slate-800 border-slate-700"
                    data-testid="input-item-description"
                  />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">{t("quantity", "Qty")}</Label>
                  <Input
                    type="number"
                    min="1"
                    value={newItem.quantity}
                    onChange={(e) => setNewItem({ ...newItem, quantity: parseInt(e.target.value) || 1 })}
                    className="bg-slate-800 border-slate-700"
                    data-testid="input-item-quantity"
                  />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">{t("unit_price", "Unit Price")}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={newItem.unitPrice}
                    onChange={(e) => setNewItem({ ...newItem, unitPrice: e.target.value })}
                    placeholder="0.00"
                    className="bg-slate-800 border-slate-700"
                    data-testid="input-item-price"
                  />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">{t("discount", "Discount")}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={newItem.discountAmount}
                    onChange={(e) => setNewItem({ ...newItem, discountAmount: e.target.value })}
                    placeholder="0.00"
                    className="bg-slate-800 border-slate-700"
                    data-testid="input-item-discount"
                  />
                </div>
                <div className="col-span-1">
                  <Button
                    type="button"
                    onClick={handleAddLineItem}
                    size="icon"
                    className="bg-cyan-600 hover:bg-cyan-500"
                    data-testid="button-add-item"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {lineItems.length > 0 && (
                <div className="border border-slate-700 rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-slate-700 bg-slate-800/50">
                        <TableHead className="text-xs">{t("description", "Description")}</TableHead>
                        <TableHead className="text-xs text-right">{t("quantity", "Qty")}</TableHead>
                        <TableHead className="text-xs text-right">{t("unit_price", "Price")}</TableHead>
                        <TableHead className="text-xs text-right">{t("discount", "Discount")}</TableHead>
                        <TableHead className="text-xs text-right">{t("total", "Total")}</TableHead>
                        <TableHead className="w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lineItems.map((item, index) => {
                        const total = (parseFloat(item.unitPrice) * item.quantity) - parseFloat(item.discountAmount || '0');
                        return (
                          <TableRow key={index} className="border-slate-700">
                            <TableCell>{item.description}</TableCell>
                            <TableCell className="text-right">{item.quantity}</TableCell>
                            <TableCell className="text-right">{formatCurrency(parseFloat(item.unitPrice))}</TableCell>
                            <TableCell className="text-right">{formatCurrency(parseFloat(item.discountAmount || '0'))}</TableCell>
                            <TableCell className="text-right font-semibold">{formatCurrency(total)}</TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveLineItem(index)}
                                className="hover:bg-red-500/10 text-red-400 h-8 w-8"
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      <TableRow className="border-slate-700 bg-slate-800/30">
                        <TableCell colSpan={4} className="text-right font-semibold text-cyan-400">
                          {t("total", "Total")}:
                        </TableCell>
                        <TableCell className="text-right font-bold text-white text-lg">
                          {formatCurrency(calculateLineItemsTotal())}
                        </TableCell>
                        <TableCell></TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>{t("notes", "Internal Notes")}</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder={t("internal_notes_placeholder", "Notes visible only to your team...")}
                className="bg-slate-800 border-slate-700"
                rows={2}
                data-testid="input-notes"
              />
            </div>

            <div className="space-y-2">
              <Label>{t("terms_and_conditions", "Terms & Conditions")}</Label>
              <Textarea
                value={formData.termsAndConditions}
                onChange={(e) => setFormData({ ...formData, termsAndConditions: e.target.value })}
                placeholder={t("terms_placeholder", "Terms and conditions...")}
                className="bg-slate-800 border-slate-700"
                rows={2}
                data-testid="input-terms"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} data-testid="button-cancel-create">
              {t("cancel", "Cancel")}
            </Button>
            <Button
              onClick={handleCreateQuote}
              disabled={createQuoteMutation.isPending || lineItems.length === 0}
              className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500"
              data-testid="button-confirm-create"
            >
              {createQuoteMutation.isPending ? t("creating", "Creating...") : t("create_quote", "Create Quote")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl bg-slate-900 border-cyan-500/20">
          <DialogHeader>
            <DialogTitle className="text-cyan-400">{t("edit_quote", "Edit Quote")}</DialogTitle>
            <DialogDescription>{t("edit_quote_description", "Update quote details")}</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("client", "Client")}</Label>
                <Select value={formData.clientId} onValueChange={(value) => setFormData({ ...formData, clientId: value })}>
                  <SelectTrigger className="bg-slate-800 border-slate-700">
                    <SelectValue placeholder={t("select_client", "Select a client")} />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.firstName} {client.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("valid_until", "Valid Until")}</Label>
                <Input
                  type="date"
                  value={formData.validUntil}
                  onChange={(e) => setFormData({ ...formData, validUntil: e.target.value })}
                  className="bg-slate-800 border-slate-700"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t("title", "Title")}</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="bg-slate-800 border-slate-700"
              />
            </div>

            <div className="space-y-2">
              <Label>{t("description", "Description")}</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="bg-slate-800 border-slate-700"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>{t("notes", "Internal Notes")}</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="bg-slate-800 border-slate-700"
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              {t("cancel", "Cancel")}
            </Button>
            <Button
              onClick={handleUpdateQuote}
              disabled={updateQuoteMutation.isPending}
              className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500"
            >
              {updateQuoteMutation.isPending ? t("saving", "Saving...") : t("save_changes", "Save Changes")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={isDetailsSheetOpen} onOpenChange={setIsDetailsSheetOpen}>
        <SheetContent className="w-full sm:max-w-xl bg-slate-900 border-cyan-500/20 overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-cyan-400 flex items-center gap-2">
              <FileCheck className="w-5 h-5" />
              {selectedQuote?.quoteNumber}
            </SheetTitle>
            <SheetDescription>{t("quote_details", "Quote Details")}</SheetDescription>
          </SheetHeader>
          
          {selectedQuote && (
            <div className="space-y-6 mt-6">
              <div className="flex items-center justify-between">
                <Badge variant={getStatusBadgeVariant(selectedQuote.status)} className={`${getStatusColor(selectedQuote.status)} text-sm px-3 py-1`}>
                  {t(selectedQuote.status, selectedQuote.status)}
                </Badge>
                <p className="text-2xl font-bold text-white">
                  {formatCurrency(parseFloat(selectedQuote.totalAmount || '0'))}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">{t("client", "Client")}</p>
                  <p className="text-white flex items-center gap-2">
                    <User className="w-4 h-4 text-cyan-400" />
                    {getClientName(selectedQuote.clientId)}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">{t("valid_until", "Valid Until")}</p>
                  <p className="text-white flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-cyan-400" />
                    {formatDate(selectedQuote.validUntil)}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">{t("created", "Created")}</p>
                  <p className="text-white">{formatDate(selectedQuote.createdAt)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">{t("issued", "Issued")}</p>
                  <p className="text-white">{formatDate(selectedQuote.issuedDate)}</p>
                </div>
              </div>

              {selectedQuote.title && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">{t("title", "Title")}</p>
                  <p className="text-white">{selectedQuote.title}</p>
                </div>
              )}

              {selectedQuote.description && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">{t("description", "Description")}</p>
                  <p className="text-white text-sm">{selectedQuote.description}</p>
                </div>
              )}

              <div className="space-y-3">
                <p className="text-sm font-semibold text-cyan-400">{t("line_items", "Line Items")}</p>
                {quoteItems.length > 0 ? (
                  <div className="border border-slate-700 rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-slate-700 bg-slate-800/50">
                          <TableHead className="text-xs">{t("description", "Description")}</TableHead>
                          <TableHead className="text-xs text-right">{t("quantity", "Qty")}</TableHead>
                          <TableHead className="text-xs text-right">{t("price", "Price")}</TableHead>
                          <TableHead className="text-xs text-right">{t("total", "Total")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {quoteItems.map((item) => (
                          <TableRow key={item.id} className="border-slate-700">
                            <TableCell>{item.description}</TableCell>
                            <TableCell className="text-right">{item.quantity}</TableCell>
                            <TableCell className="text-right">{formatCurrency(parseFloat(item.unitPrice))}</TableCell>
                            <TableCell className="text-right font-semibold">{formatCurrency(parseFloat(item.totalPrice))}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">{t("no_items", "No items")}</p>
                )}
              </div>

              <div className="space-y-2 p-4 bg-slate-800/50 rounded-lg">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t("subtotal", "Subtotal")}</span>
                  <span className="text-white">{formatCurrency(parseFloat(selectedQuote.subtotal || '0'))}</span>
                </div>
                {parseFloat(selectedQuote.discountAmount || '0') > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t("discount", "Discount")}</span>
                    <span className="text-green-400">-{formatCurrency(parseFloat(selectedQuote.discountAmount || '0'))}</span>
                  </div>
                )}
                {parseFloat(selectedQuote.taxAmount || '0') > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t("tax", "Tax")}</span>
                    <span className="text-white">{formatCurrency(parseFloat(selectedQuote.taxAmount || '0'))}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold border-t border-slate-700 pt-2 mt-2">
                  <span className="text-cyan-400">{t("total", "Total")}</span>
                  <span className="text-white">{formatCurrency(parseFloat(selectedQuote.totalAmount || '0'))}</span>
                </div>
              </div>

              {selectedQuote.notes && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">{t("notes", "Notes")}</p>
                  <p className="text-white text-sm bg-slate-800/50 p-3 rounded-lg">{selectedQuote.notes}</p>
                </div>
              )}

              {selectedQuote.ticketId && (
                <div className="space-y-2 p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Link className="w-4 h-4 text-cyan-400" />
                    <p className="text-xs text-cyan-400 font-medium">{t("linked_to_ticket", "Linked to Repair Ticket")}</p>
                  </div>
                  <p className="text-white text-sm">{t("ticket_id", "Ticket ID")}: {selectedQuote.ticketId.slice(0, 8)}...</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10"
                    onClick={() => {
                      setIsDetailsSheetOpen(false);
                      setLocation(`/kanban?ticketId=${selectedQuote.ticketId}`);
                    }}
                    data-testid="button-view-linked-ticket"
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    {t("view_ticket", "View Ticket")}
                  </Button>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="bg-slate-900 border-red-500/20">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-400">{t("delete_quote", "Delete Quote")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("delete_quote_confirmation", "Are you sure you want to delete this quote? This action cannot be undone.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">{t("cancel", "Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteQuote}
              className="bg-red-600 hover:bg-red-500"
              data-testid="button-confirm-delete"
            >
              {deleteQuoteMutation.isPending ? t("deleting", "Deleting...") : t("delete", "Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isImportFromTicketOpen} onOpenChange={setIsImportFromTicketOpen}>
        <DialogContent className="max-w-4xl bg-slate-900 border-cyan-500/20 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-cyan-400 flex items-center gap-2">
              <ClipboardList className="w-5 h-5" />
              {isPreviewMode ? t("quote_preview", "Quote Preview") : t("import_from_ticket", "Import from Ticket")}
            </DialogTitle>
            <DialogDescription>
              {isPreviewMode 
                ? t("review_quote_before_creating", "Review the quote details before creating")
                : t("select_ticket_to_import", "Select a repair ticket to create a quote from its services and parts")}
            </DialogDescription>
          </DialogHeader>

          {!isPreviewMode ? (
            <div className="space-y-4 py-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    placeholder={t("search_tickets", "Search tickets...")}
                    value={ticketSearchTerm}
                    onChange={(e) => setTicketSearchTerm(e.target.value)}
                    className="pl-10 bg-slate-800 border-slate-700"
                    data-testid="input-search-tickets"
                  />
                </div>
                <Select value={ticketStatusFilter} onValueChange={setTicketStatusFilter}>
                  <SelectTrigger className="w-full md:w-48 bg-slate-800 border-slate-700" data-testid="select-ticket-status">
                    <SelectValue placeholder={t("filter_by_status", "Filter by status")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("all_statuses", "All Statuses")}</SelectItem>
                    <SelectItem value="backlog">{t("backlog", "Backlog")}</SelectItem>
                    <SelectItem value="waiting_parts">{t("waiting_parts", "Waiting Parts")}</SelectItem>
                    <SelectItem value="in_progress">{t("in_progress", "In Progress")}</SelectItem>
                    <SelectItem value="done">{t("done", "Done")}</SelectItem>
                    <SelectItem value="finalized">{t("finalized", "Finalized")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {filteredTickets.length === 0 ? (
                <div className="text-center py-12">
                  <ClipboardList className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">{t("no_tickets_found", "No tickets found")}</p>
                </div>
              ) : (
                <div className="border border-slate-700 rounded-lg overflow-hidden max-h-[400px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-slate-700 bg-slate-800/50">
                        <TableHead className="text-cyan-400">{t("ticket", "Ticket")}</TableHead>
                        <TableHead className="text-cyan-400">{t("device", "Device")}</TableHead>
                        <TableHead className="text-cyan-400">{t("status", "Status")}</TableHead>
                        <TableHead className="text-cyan-400">{t("estimated_cost", "Est. Cost")}</TableHead>
                        <TableHead className="text-cyan-400 text-right">{t("actions", "Actions")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTickets.map((ticket) => (
                        <TableRow key={ticket.id} className="border-slate-700 hover:bg-slate-800/50" data-testid={`row-ticket-${ticket.id}`}>
                          <TableCell>
                            <div>
                              <p className="font-medium text-white">{ticket.title}</p>
                              <p className="text-xs text-muted-foreground">{ticket.id.slice(0, 8)}...</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Smartphone className="w-4 h-4 text-cyan-400" />
                              <span>{ticket.deviceBrand} {ticket.deviceModel}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={getTicketStatusColor(ticket.status)}>
                              {t(ticket.status, ticket.status)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {formatCurrency(parseFloat(ticket.estimatedCost || ticket.totalCost || '0'))}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSelectTicket(ticket.id)}
                              className="hover:bg-cyan-500/10 text-cyan-400"
                              data-testid={`button-select-ticket-${ticket.id}`}
                            >
                              {t("select", "Select")}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6 py-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBackToTicketSelection}
                className="text-muted-foreground hover:text-white"
              >
                ← {t("back_to_tickets", "Back to tickets")}
              </Button>

              {ticketSummary && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-800/50 rounded-lg">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <ClipboardList className="w-5 h-5 text-cyan-400" />
                        <h3 className="font-semibold text-white">{t("ticket_info", "Ticket Info")}</h3>
                      </div>
                      <div className="space-y-1 text-sm">
                        <p><span className="text-muted-foreground">{t("title", "Title")}:</span> <span className="text-white">{ticketSummary.ticket.title}</span></p>
                        <p><span className="text-muted-foreground">{t("device", "Device")}:</span> <span className="text-white">{ticketSummary.ticket.deviceBrand} {ticketSummary.ticket.deviceModel}</span></p>
                        <p><span className="text-muted-foreground">{t("status", "Status")}:</span> <Badge variant="outline" className={getTicketStatusColor(ticketSummary.ticket.status)}>{t(ticketSummary.ticket.status, ticketSummary.ticket.status)}</Badge></p>
                      </div>
                    </div>
                    
                    {ticketSummary.client && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <User className="w-5 h-5 text-cyan-400" />
                          <h3 className="font-semibold text-white">{t("client_info", "Client Info")}</h3>
                        </div>
                        <div className="space-y-1 text-sm">
                          <p><span className="text-muted-foreground">{t("name", "Name")}:</span> <span className="text-white">{ticketSummary.client.firstName} {ticketSummary.client.lastName}</span></p>
                          {ticketSummary.client.email && <p><span className="text-muted-foreground">{t("email", "Email")}:</span> <span className="text-white">{ticketSummary.client.email}</span></p>}
                          {ticketSummary.client.phone && <p><span className="text-muted-foreground">{t("phone", "Phone")}:</span> <span className="text-white">{ticketSummary.client.phone}</span></p>}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <h3 className="font-semibold text-cyan-400">{t("line_items", "Line Items")}</h3>
                    {ticketSummary.lineItems.length > 0 ? (
                      <div className="border border-slate-700 rounded-lg overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow className="border-slate-700 bg-slate-800/50">
                              <TableHead className="text-xs">{t("type", "Type")}</TableHead>
                              <TableHead className="text-xs">{t("description", "Description")}</TableHead>
                              <TableHead className="text-xs text-right">{t("quantity", "Qty")}</TableHead>
                              <TableHead className="text-xs text-right">{t("unit_price", "Price")}</TableHead>
                              <TableHead className="text-xs text-right">{t("total", "Total")}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {ticketSummary.lineItems.map((item, index) => (
                              <TableRow key={index} className="border-slate-700">
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    {item.type === 'service' ? (
                                      <Wrench className="w-4 h-4 text-blue-400" />
                                    ) : (
                                      <Package className="w-4 h-4 text-green-400" />
                                    )}
                                    <span className="text-xs">{item.type === 'service' ? t("service", "Service") : t("part", "Part")}</span>
                                  </div>
                                </TableCell>
                                <TableCell>{item.description}</TableCell>
                                <TableCell className="text-right">{item.quantity}</TableCell>
                                <TableCell className="text-right">{formatCurrency(parseFloat(item.unitPrice))}</TableCell>
                                <TableCell className="text-right font-semibold">{formatCurrency(parseFloat(item.totalPrice))}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-sm">{t("no_items_in_ticket", "No services or parts in this ticket")}</p>
                    )}
                  </div>

                  <div className="space-y-2 p-4 bg-slate-800/50 rounded-lg">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-2">
                        <Wrench className="w-4 h-4 text-blue-400" />
                        {t("services_total", "Services")}
                      </span>
                      <span className="text-white">{formatCurrency(ticketSummary.summary.servicesTotal)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-2">
                        <Package className="w-4 h-4 text-green-400" />
                        {t("parts_total", "Parts")}
                      </span>
                      <span className="text-white">{formatCurrency(ticketSummary.summary.partsTotal)}</span>
                    </div>
                    {ticketSummary.summary.extraCosts > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{t("extra_costs", "Extra Costs")}</span>
                        <span className="text-white">{formatCurrency(ticketSummary.summary.extraCosts)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-lg font-bold border-t border-slate-700 pt-2 mt-2">
                      <span className="text-cyan-400">{t("total", "Total")}</span>
                      <span className="text-white">{formatCurrency(ticketSummary.summary.totalAmount)}</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsImportFromTicketOpen(false)}>
              {t("cancel", "Cancel")}
            </Button>
            {isPreviewMode && ticketSummary && (
              <Button
                onClick={handleCreateQuoteFromTicket}
                disabled={createQuoteFromTicketMutation.isPending}
                className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500"
                data-testid="button-create-quote-from-ticket"
              >
                {createQuoteFromTicketMutation.isPending ? t("creating", "Creating...") : t("create_quote", "Create Quote")}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
