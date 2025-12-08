import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
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
  DollarSign,
  Calendar,
  User,
  CreditCard,
  AlertTriangle,
  Ban,
  Receipt,
  Banknote,
  ArrowRightCircle,
  Link,
  ClipboardList
} from "lucide-react";
import type { PosInvoice, PosInvoiceItem, Client, Payment, Ticket } from "@shared/schema";
import { Smartphone, Wrench, Package } from "lucide-react";

interface TicketSummary {
  ticket: {
    id: string;
    title: string;
    description: string;
    status: string;
    deviceType: string;
    deviceBrand: string;
    deviceModel: string;
  };
  client: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  } | null;
  lineItems: Array<{
    type: 'service' | 'part';
    description: string;
    quantity: number;
    unitPrice: string;
    totalPrice: string;
  }>;
  summary: {
    servicesTotal: number;
    partsTotal: number;
    extraCosts: number;
    subtotal: number;
    totalAmount: number;
  };
}

interface InvoiceStats {
  total: number;
  draft: number;
  issued: number;
  partiallyPaid: number;
  paid: number;
  overdue: number;
  void: number;
  totalAmount: number;
  paidAmount: number;
  balanceDue: number;
}

interface InvoiceFormData {
  clientId: string;
  dueDate: string;
  notes: string;
  internalNotes: string;
}

interface InvoiceItemFormData {
  description: string;
  quantity: number;
  unitPrice: string;
  discountAmount: string;
}

const emptyFormData: InvoiceFormData = {
  clientId: "",
  dueDate: "",
  notes: "",
  internalNotes: ""
};

const emptyItemFormData: InvoiceItemFormData = {
  description: "",
  quantity: 1,
  unitPrice: "",
  discountAmount: "0"
};

export default function Invoices() {
  const { t, formatCurrency } = useLocalization();
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDetailsSheetOpen, setIsDetailsSheetOpen] = useState(false);
  const [isRecordPaymentOpen, setIsRecordPaymentOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<PosInvoice | null>(null);
  const [formData, setFormData] = useState<InvoiceFormData>(emptyFormData);
  const [lineItems, setLineItems] = useState<InvoiceItemFormData[]>([]);
  const [newItem, setNewItem] = useState<InvoiceItemFormData>(emptyItemFormData);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentNotes, setPaymentNotes] = useState("");

  // Import from ticket state
  const [isImportFromTicketOpen, setIsImportFromTicketOpen] = useState(false);
  const [ticketSearchTerm, setTicketSearchTerm] = useState("");
  const [ticketStatusFilter, setTicketStatusFilter] = useState("all");
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [ticketSummary, setTicketSummary] = useState<TicketSummary | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);

  const { data: invoices = [], isLoading: invoicesLoading } = useQuery<PosInvoice[]>({
    queryKey: ["/api/pos-invoices"]
  });

  const { data: stats, isLoading: statsLoading } = useQuery<InvoiceStats>({
    queryKey: ["/api/pos-invoices/stats"]
  });

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    select: (data: any) => data?.clients || data || []
  });

  const { data: invoiceItems = [] } = useQuery<PosInvoiceItem[]>({
    queryKey: ["/api/pos-invoices", selectedInvoice?.id, "items"],
    queryFn: async () => {
      if (!selectedInvoice?.id) return [];
      const response = await fetch(`/api/pos-invoices/${selectedInvoice.id}/items`, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch invoice items");
      return response.json();
    },
    enabled: !!selectedInvoice?.id && isDetailsSheetOpen
  });

  const { data: invoicePayments = [] } = useQuery<Payment[]>({
    queryKey: ["/api/pos-invoices", selectedInvoice?.id, "payments"],
    queryFn: async () => {
      if (!selectedInvoice?.id) return [];
      const response = await fetch(`/api/pos-invoices/${selectedInvoice.id}/payments`, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch payments");
      return response.json();
    },
    enabled: !!selectedInvoice?.id && isDetailsSheetOpen
  });

  // Tickets for import feature
  const { data: tickets = [] } = useQuery<Ticket[]>({
    queryKey: ["/api/tickets"],
    enabled: isImportFromTicketOpen
  });

  // Filter tickets for import dialog
  const filteredTickets = tickets.filter(ticket => {
    if (ticket.isArchived) return false;
    const matchesSearch = 
      ticket.title?.toLowerCase().includes(ticketSearchTerm.toLowerCase()) ||
      ticket.deviceBrand?.toLowerCase().includes(ticketSearchTerm.toLowerCase()) ||
      ticket.deviceModel?.toLowerCase().includes(ticketSearchTerm.toLowerCase());
    const matchesStatus = ticketStatusFilter === "all" || ticket.status === ticketStatusFilter;
    return matchesSearch && matchesStatus;
  });

  // Mutation for creating invoice from ticket
  const createInvoiceFromTicketMutation = useMutation({
    mutationFn: async (ticketId: string) => {
      const response = await apiRequest("POST", `/api/pos-invoices/from-ticket/${ticketId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pos-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pos-invoices/stats"] });
      setIsImportFromTicketOpen(false);
      setTicketSummary(null);
      setSelectedTicketId(null);
      setIsPreviewMode(false);
      toast({
        title: t("success", "Success"),
        description: t("invoice_created_from_ticket", "Invoice created from ticket successfully")
      });
    },
    onError: (error: any) => {
      const message = error?.message || t("invoice_creation_failed", "Failed to create invoice");
      toast({
        title: t("error", "Error"),
        description: message,
        variant: "destructive"
      });
    }
  });

  const createInvoiceMutation = useMutation({
    mutationFn: async (data: { invoice: Partial<InvoiceFormData>; items: InvoiceItemFormData[] }) => {
      const subtotal = data.items.reduce((sum, item) => {
        const itemTotal = (parseFloat(item.unitPrice) * item.quantity) - parseFloat(item.discountAmount || '0');
        return sum + itemTotal;
      }, 0);
      
      const response = await apiRequest("POST", "/api/pos-invoices", {
        ...data.invoice,
        status: 'draft',
        subtotal: subtotal.toFixed(2),
        totalAmount: subtotal.toFixed(2),
        balanceDue: subtotal.toFixed(2),
        paidAmount: '0.00'
      });
      const newInvoice = await response.json();
      
      for (let i = 0; i < data.items.length; i++) {
        const item = data.items[i];
        const totalPrice = (parseFloat(item.unitPrice) * item.quantity) - parseFloat(item.discountAmount || '0');
        await apiRequest("POST", `/api/pos-invoices/${newInvoice.id}/items`, {
          ...item,
          totalPrice: totalPrice.toFixed(2),
          sortOrder: i
        });
      }
      
      return newInvoice;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pos-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pos-invoices/stats"] });
      setIsAddDialogOpen(false);
      setFormData(emptyFormData);
      setLineItems([]);
      toast({
        title: t("success", "Success"),
        description: t("invoice_created_successfully", "Invoice created successfully")
      });
    },
    onError: () => {
      toast({
        title: t("error", "Error"),
        description: t("invoice_creation_failed", "Failed to create invoice"),
        variant: "destructive"
      });
    }
  });

  const updateInvoiceMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InvoiceFormData> }) => {
      const response = await apiRequest("PATCH", `/api/pos-invoices/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pos-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pos-invoices/stats"] });
      setIsEditDialogOpen(false);
      setSelectedInvoice(null);
      setFormData(emptyFormData);
      toast({
        title: t("success", "Success"),
        description: t("invoice_updated_successfully", "Invoice updated successfully")
      });
    },
    onError: () => {
      toast({
        title: t("error", "Error"),
        description: t("invoice_update_failed", "Failed to update invoice"),
        variant: "destructive"
      });
    }
  });

  const updateInvoiceStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const updates: any = { status };
      if (status === 'issued') {
        updates.issuedDate = new Date();
      }
      const response = await apiRequest("PATCH", `/api/pos-invoices/${id}`, updates);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pos-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pos-invoices/stats"] });
      toast({
        title: t("success", "Success"),
        description: t("invoice_status_updated", "Invoice status updated")
      });
    },
    onError: () => {
      toast({
        title: t("error", "Error"),
        description: t("invoice_status_update_failed", "Failed to update invoice status"),
        variant: "destructive"
      });
    }
  });

  const deleteInvoiceMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/pos-invoices/${id}`);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pos-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pos-invoices/stats"] });
      setIsDeleteDialogOpen(false);
      setSelectedInvoice(null);
      toast({
        title: t("success", "Success"),
        description: t("invoice_deleted_successfully", "Invoice deleted successfully")
      });
    },
    onError: () => {
      toast({
        title: t("error", "Error"),
        description: t("invoice_deletion_failed", "Failed to delete invoice"),
        variant: "destructive"
      });
    }
  });

  const recordPaymentMutation = useMutation({
    mutationFn: async ({ invoiceId, amount, method, notes }: { invoiceId: string; amount: string; method: string; notes: string }) => {
      const response = await apiRequest("POST", `/api/pos-invoices/${invoiceId}/payments`, {
        amount,
        paymentMethodType: method,
        notes
      });
      return response.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/pos-invoices"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/pos-invoices/stats"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/pos-invoices", selectedInvoice?.id, "payments"] });
      
      if (selectedInvoice) {
        const response = await fetch(`/api/pos-invoices/${selectedInvoice.id}`, { credentials: "include" });
        if (response.ok) {
          const updatedInvoice = await response.json();
          setSelectedInvoice(updatedInvoice);
        }
      }
      
      setIsRecordPaymentOpen(false);
      setPaymentAmount("");
      setPaymentMethod("cash");
      setPaymentNotes("");
      toast({
        title: t("success", "Success"),
        description: t("payment_recorded_successfully", "Payment recorded successfully")
      });
    },
    onError: () => {
      toast({
        title: t("error", "Error"),
        description: t("payment_recording_failed", "Failed to record payment"),
        variant: "destructive"
      });
    }
  });

  const handleOpenAddDialog = () => {
    setFormData(emptyFormData);
    setLineItems([]);
    setIsAddDialogOpen(true);
  };

  const handleOpenEditDialog = (invoice: PosInvoice) => {
    setSelectedInvoice(invoice);
    setFormData({
      clientId: invoice.clientId || "",
      dueDate: invoice.dueDate ? format(new Date(invoice.dueDate), "yyyy-MM-dd") : "",
      notes: invoice.notes || "",
      internalNotes: invoice.internalNotes || ""
    });
    setIsEditDialogOpen(true);
  };

  const handleOpenDetailsSheet = (invoice: PosInvoice) => {
    setSelectedInvoice(invoice);
    setIsDetailsSheetOpen(true);
  };

  const handleOpenDeleteDialog = (invoice: PosInvoice) => {
    setSelectedInvoice(invoice);
    setIsDeleteDialogOpen(true);
  };

  const handleOpenRecordPayment = (invoice: PosInvoice) => {
    setSelectedInvoice(invoice);
    setPaymentAmount(invoice.balanceDue || "0");
    setPaymentMethod("cash");
    setPaymentNotes("");
    setIsRecordPaymentOpen(true);
  };

  const handleAddLineItem = () => {
    if (!newItem.description || !newItem.unitPrice) return;
    setLineItems([...lineItems, { ...newItem }]);
    setNewItem(emptyItemFormData);
  };

  const handleRemoveLineItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  // Import from ticket handlers
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

  const handleCreateInvoiceFromTicket = () => {
    if (selectedTicketId) {
      createInvoiceFromTicketMutation.mutate(selectedTicketId);
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

  const handleCreateInvoice = () => {
    createInvoiceMutation.mutate({ invoice: formData, items: lineItems });
  };

  const handleUpdateInvoice = () => {
    if (selectedInvoice) {
      updateInvoiceMutation.mutate({ id: selectedInvoice.id, data: formData });
    }
  };

  const handleDeleteInvoice = () => {
    if (selectedInvoice) {
      deleteInvoiceMutation.mutate(selectedInvoice.id);
    }
  };

  const handleIssueInvoice = (invoice: PosInvoice) => {
    updateInvoiceStatusMutation.mutate({ id: invoice.id, status: 'issued' });
  };

  const handleVoidInvoice = (invoice: PosInvoice) => {
    updateInvoiceStatusMutation.mutate({ id: invoice.id, status: 'void' });
  };

  const handleRecordPayment = () => {
    if (selectedInvoice && paymentAmount) {
      recordPaymentMutation.mutate({
        invoiceId: selectedInvoice.id,
        amount: paymentAmount,
        method: paymentMethod,
        notes: paymentNotes
      });
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-slate-500/20 text-slate-300 border-slate-500/30';
      case 'issued': return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      case 'partially_paid': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
      case 'paid': return 'bg-green-500/20 text-green-300 border-green-500/30';
      case 'overdue': return 'bg-red-500/20 text-red-300 border-red-500/30';
      case 'void': return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
      case 'cancelled': return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
      default: return 'bg-slate-500/20 text-slate-300 border-slate-500/30';
    }
  };

  const getStatusBadgeVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'paid': return 'default';
      case 'overdue': return 'destructive';
      default: return 'outline';
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      draft: t("draft", "Draft"),
      issued: t("issued", "Issued"),
      partially_paid: t("partially_paid", "Partially Paid"),
      paid: t("paid", "Paid"),
      overdue: t("overdue", "Overdue"),
      void: t("void", "Void"),
      cancelled: t("cancelled", "Cancelled")
    };
    return labels[status] || status;
  };

  const filteredInvoices = invoices.filter(invoice => {
    const matchesSearch = 
      invoice.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      getClientName(invoice.clientId).toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || invoice.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const calculateLineItemsTotal = () => {
    return lineItems.reduce((sum, item) => {
      const itemTotal = (parseFloat(item.unitPrice || '0') * item.quantity) - parseFloat(item.discountAmount || '0');
      return sum + itemTotal;
    }, 0);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Receipt className="w-8 h-8 text-cyan-400" />
            {t("invoices", "Invoices")}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t("invoices_description", "Manage invoices and track payments")}
          </p>
        </div>
        <PermissionGate permission={PERMISSIONS.INVOICES_CREATE}>
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
              data-testid="button-add-invoice"
            >
              <Plus className="w-4 h-4 mr-2" />
              {t("create_invoice", "Create Invoice")}
            </Button>
          </div>
        </PermissionGate>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-slate-800/50 border-cyan-500/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm font-medium">{t("total_invoices", "Total Invoices")}</p>
                {statsLoading ? (
                  <Skeleton className="h-8 w-16 mt-1" />
                ) : (
                  <p className="text-3xl font-bold text-white" data-testid="text-stat-total-invoices">
                    {stats?.total || 0}
                  </p>
                )}
              </div>
              <div className="p-3 bg-cyan-500/10 rounded-lg">
                <Receipt className="w-6 h-6 text-cyan-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-cyan-500/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm font-medium">{t("total_paid", "Total Paid")}</p>
                {statsLoading ? (
                  <Skeleton className="h-8 w-24 mt-1" />
                ) : (
                  <p className="text-3xl font-bold text-green-400" data-testid="text-stat-total-paid">
                    {formatCurrency(stats?.paidAmount || 0)}
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
                <p className="text-muted-foreground text-sm font-medium">{t("balance_due", "Balance Due")}</p>
                {statsLoading ? (
                  <Skeleton className="h-8 w-24 mt-1" />
                ) : (
                  <p className="text-3xl font-bold text-yellow-400" data-testid="text-stat-balance-due">
                    {formatCurrency(stats?.balanceDue || 0)}
                  </p>
                )}
              </div>
              <div className="p-3 bg-yellow-500/10 rounded-lg">
                <Clock className="w-6 h-6 text-yellow-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-cyan-500/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm font-medium">{t("overdue_invoices", "Overdue")}</p>
                {statsLoading ? (
                  <Skeleton className="h-8 w-16 mt-1" />
                ) : (
                  <p className="text-3xl font-bold text-red-400" data-testid="text-stat-overdue">
                    {stats?.overdue || 0}
                  </p>
                )}
              </div>
              <div className="p-3 bg-red-500/10 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-red-400" />
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
                placeholder={t("search_invoices", "Search invoices...")}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-slate-900/50 border-slate-700"
                data-testid="input-search-invoices"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-48 bg-slate-900/50 border-slate-700" data-testid="select-status-filter">
                <SelectValue placeholder={t("filter_by_status", "Filter by status")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("all_statuses", "All Statuses")}</SelectItem>
                <SelectItem value="draft">{t("draft", "Draft")}</SelectItem>
                <SelectItem value="issued">{t("issued", "Issued")}</SelectItem>
                <SelectItem value="partially_paid">{t("partially_paid", "Partially Paid")}</SelectItem>
                <SelectItem value="paid">{t("paid", "Paid")}</SelectItem>
                <SelectItem value="overdue">{t("overdue", "Overdue")}</SelectItem>
                <SelectItem value="void">{t("void", "Void")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {invoicesLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="text-center py-12">
              <Receipt className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground" data-testid="text-no-invoices">
                {t("no_invoices_found", "No invoices found")}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-700">
                    <TableHead className="text-cyan-400">{t("invoice_number", "Invoice #")}</TableHead>
                    <TableHead className="text-cyan-400">{t("client", "Client")}</TableHead>
                    <TableHead className="text-cyan-400">{t("total", "Total")}</TableHead>
                    <TableHead className="text-cyan-400">{t("paid", "Paid")}</TableHead>
                    <TableHead className="text-cyan-400">{t("balance", "Balance")}</TableHead>
                    <TableHead className="text-cyan-400">{t("status", "Status")}</TableHead>
                    <TableHead className="text-cyan-400">{t("due_date", "Due Date")}</TableHead>
                    <TableHead className="text-cyan-400 text-right">{t("actions", "Actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvoices.map((invoice) => (
                    <TableRow key={invoice.id} className="border-slate-700 hover:bg-slate-800/50" data-testid={`row-invoice-${invoice.id}`}>
                      <TableCell className="font-mono text-white">{invoice.invoiceNumber}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-muted-foreground" />
                          <span>{getClientName(invoice.clientId)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-semibold text-white">
                        {formatCurrency(parseFloat(invoice.totalAmount || '0'))}
                      </TableCell>
                      <TableCell className="text-green-400">
                        {formatCurrency(parseFloat(invoice.paidAmount || '0'))}
                      </TableCell>
                      <TableCell className="text-yellow-400">
                        {formatCurrency(parseFloat(invoice.balanceDue || '0'))}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(invoice.status)} className={getStatusColor(invoice.status)}>
                          {getStatusLabel(invoice.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          <span>{formatDate(invoice.dueDate)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenDetailsSheet(invoice)}
                            className="hover:bg-cyan-500/10"
                            data-testid={`button-view-invoice-${invoice.id}`}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          {invoice.status === 'draft' && (
                            <>
                              <PermissionGate permission={PERMISSIONS.INVOICES_UPDATE}>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleOpenEditDialog(invoice)}
                                  className="hover:bg-blue-500/10"
                                  data-testid={`button-edit-invoice-${invoice.id}`}
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                              </PermissionGate>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleIssueInvoice(invoice)}
                                className="hover:bg-green-500/10 text-green-400"
                                data-testid={`button-issue-invoice-${invoice.id}`}
                              >
                                <Send className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                          {(invoice.status === 'issued' || invoice.status === 'partially_paid') && (
                            <PermissionGate permission={PERMISSIONS.INVOICES_UPDATE}>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleOpenRecordPayment(invoice)}
                                className="hover:bg-green-500/10 text-green-400"
                                data-testid={`button-record-payment-${invoice.id}`}
                              >
                                <Banknote className="w-4 h-4" />
                              </Button>
                            </PermissionGate>
                          )}
                          {invoice.status !== 'void' && invoice.status !== 'paid' && (
                            <PermissionGate permission={PERMISSIONS.INVOICES_VOID}>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleVoidInvoice(invoice)}
                                className="hover:bg-red-500/10 text-red-400"
                                data-testid={`button-void-invoice-${invoice.id}`}
                              >
                                <Ban className="w-4 h-4" />
                              </Button>
                            </PermissionGate>
                          )}
                          {invoice.status === 'draft' && (
                            <PermissionGate permission={PERMISSIONS.INVOICES_DELETE}>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleOpenDeleteDialog(invoice)}
                                className="hover:bg-red-500/10 text-red-400"
                                data-testid={`button-delete-invoice-${invoice.id}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </PermissionGate>
                          )}
                        </div>
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
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-slate-900 border-cyan-500/20">
          <DialogHeader>
            <DialogTitle className="text-xl text-white flex items-center gap-2">
              <Receipt className="w-5 h-5 text-cyan-400" />
              {t("create_invoice", "Create Invoice")}
            </DialogTitle>
            <DialogDescription>
              {t("create_invoice_description", "Create a new invoice with line items")}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("client", "Client")}</Label>
                <Select value={formData.clientId} onValueChange={(value) => setFormData({ ...formData, clientId: value })}>
                  <SelectTrigger className="bg-slate-800 border-slate-700" data-testid="select-client">
                    <SelectValue placeholder={t("select_client", "Select client")} />
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
                <Label>{t("due_date", "Due Date")}</Label>
                <Input
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                  className="bg-slate-800 border-slate-700"
                  data-testid="input-due-date"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-lg">{t("line_items", "Line Items")}</Label>
              </div>
              
              <div className="bg-slate-800/50 p-4 rounded-lg space-y-4">
                <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-5">
                    <Input
                      placeholder={t("description", "Description")}
                      value={newItem.description}
                      onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                      className="bg-slate-900 border-slate-700"
                      data-testid="input-item-description"
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number"
                      placeholder={t("qty", "Qty")}
                      value={newItem.quantity}
                      onChange={(e) => setNewItem({ ...newItem, quantity: parseInt(e.target.value) || 1 })}
                      className="bg-slate-900 border-slate-700"
                      data-testid="input-item-quantity"
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number"
                      step="0.01"
                      placeholder={t("price", "Price")}
                      value={newItem.unitPrice}
                      onChange={(e) => setNewItem({ ...newItem, unitPrice: e.target.value })}
                      className="bg-slate-900 border-slate-700"
                      data-testid="input-item-price"
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number"
                      step="0.01"
                      placeholder={t("discount", "Discount")}
                      value={newItem.discountAmount}
                      onChange={(e) => setNewItem({ ...newItem, discountAmount: e.target.value })}
                      className="bg-slate-900 border-slate-700"
                      data-testid="input-item-discount"
                    />
                  </div>
                  <div className="col-span-1">
                    <Button
                      type="button"
                      onClick={handleAddLineItem}
                      className="w-full bg-cyan-600 hover:bg-cyan-500"
                      data-testid="button-add-item"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {lineItems.length > 0 && (
                  <div className="space-y-2">
                    {lineItems.map((item, index) => {
                      const itemTotal = (parseFloat(item.unitPrice) * item.quantity) - parseFloat(item.discountAmount || '0');
                      return (
                        <div key={index} className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg">
                          <div className="flex-1">
                            <span className="text-white">{item.description}</span>
                            <span className="text-muted-foreground ml-2">
                              {item.quantity} x {formatCurrency(parseFloat(item.unitPrice))}
                            </span>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-white font-semibold">{formatCurrency(itemTotal)}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveLineItem(index)}
                              className="text-red-400 hover:bg-red-500/10"
                              data-testid={`button-remove-item-${index}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                    <div className="flex justify-end pt-4 border-t border-slate-700">
                      <div className="text-right">
                        <span className="text-muted-foreground mr-4">{t("total", "Total")}:</span>
                        <span className="text-2xl font-bold text-cyan-400">
                          {formatCurrency(calculateLineItemsTotal())}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t("notes", "Notes")}</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="bg-slate-800 border-slate-700"
                placeholder={t("invoice_notes_placeholder", "Notes visible to client...")}
                data-testid="textarea-notes"
              />
            </div>

            <div className="space-y-2">
              <Label>{t("internal_notes", "Internal Notes")}</Label>
              <Textarea
                value={formData.internalNotes}
                onChange={(e) => setFormData({ ...formData, internalNotes: e.target.value })}
                className="bg-slate-800 border-slate-700"
                placeholder={t("internal_notes_placeholder", "Notes for internal use only...")}
                data-testid="textarea-internal-notes"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} data-testid="button-cancel-create">
              {t("cancel", "Cancel")}
            </Button>
            <Button
              onClick={handleCreateInvoice}
              disabled={createInvoiceMutation.isPending || lineItems.length === 0}
              className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500"
              data-testid="button-confirm-create"
            >
              {createInvoiceMutation.isPending ? t("creating", "Creating...") : t("create_invoice", "Create Invoice")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-xl bg-slate-900 border-cyan-500/20">
          <DialogHeader>
            <DialogTitle className="text-xl text-white flex items-center gap-2">
              <Edit className="w-5 h-5 text-cyan-400" />
              {t("edit_invoice", "Edit Invoice")}
            </DialogTitle>
            <DialogDescription>
              {t("edit_invoice_description", "Update invoice details")}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t("client", "Client")}</Label>
              <Select value={formData.clientId} onValueChange={(value) => setFormData({ ...formData, clientId: value })}>
                <SelectTrigger className="bg-slate-800 border-slate-700">
                  <SelectValue placeholder={t("select_client", "Select client")} />
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
              <Label>{t("due_date", "Due Date")}</Label>
              <Input
                type="date"
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                className="bg-slate-800 border-slate-700"
              />
            </div>
            <div className="space-y-2">
              <Label>{t("notes", "Notes")}</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="bg-slate-800 border-slate-700"
              />
            </div>
            <div className="space-y-2">
              <Label>{t("internal_notes", "Internal Notes")}</Label>
              <Textarea
                value={formData.internalNotes}
                onChange={(e) => setFormData({ ...formData, internalNotes: e.target.value })}
                className="bg-slate-800 border-slate-700"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              {t("cancel", "Cancel")}
            </Button>
            <Button
              onClick={handleUpdateInvoice}
              disabled={updateInvoiceMutation.isPending}
              className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500"
            >
              {updateInvoiceMutation.isPending ? t("saving", "Saving...") : t("save_changes", "Save Changes")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isRecordPaymentOpen} onOpenChange={setIsRecordPaymentOpen}>
        <DialogContent className="max-w-md bg-slate-900 border-cyan-500/20">
          <DialogHeader>
            <DialogTitle className="text-xl text-white flex items-center gap-2">
              <Banknote className="w-5 h-5 text-green-400" />
              {t("record_payment", "Record Payment")}
            </DialogTitle>
            <DialogDescription>
              {t("record_payment_description", "Record a payment for this invoice")}
            </DialogDescription>
          </DialogHeader>
          
          {selectedInvoice && (
            <div className="space-y-4 py-4">
              <div className="p-4 bg-slate-800/50 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("invoice", "Invoice")}:</span>
                  <span className="text-white font-mono">{selectedInvoice.invoiceNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("total_amount", "Total Amount")}:</span>
                  <span className="text-white">{formatCurrency(parseFloat(selectedInvoice.totalAmount || '0'))}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("already_paid", "Already Paid")}:</span>
                  <span className="text-green-400">{formatCurrency(parseFloat(selectedInvoice.paidAmount || '0'))}</span>
                </div>
                <div className="flex justify-between border-t border-slate-700 pt-2">
                  <span className="text-muted-foreground">{t("balance_due", "Balance Due")}:</span>
                  <span className="text-yellow-400 font-semibold">{formatCurrency(parseFloat(selectedInvoice.balanceDue || '0'))}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t("payment_amount", "Payment Amount")}</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="bg-slate-800 border-slate-700"
                  data-testid="input-payment-amount"
                />
              </div>

              <div className="space-y-2">
                <Label>{t("payment_method", "Payment Method")}</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger className="bg-slate-800 border-slate-700" data-testid="select-payment-method">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">{t("cash", "Cash")}</SelectItem>
                    <SelectItem value="credit_card">{t("credit_card", "Credit Card")}</SelectItem>
                    <SelectItem value="debit_card">{t("debit_card", "Debit Card")}</SelectItem>
                    <SelectItem value="pix">{t("pix", "PIX")}</SelectItem>
                    <SelectItem value="bank_transfer">{t("bank_transfer", "Bank Transfer")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t("payment_notes", "Payment Notes")} ({t("optional", "optional")})</Label>
                <Textarea
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="bg-slate-800 border-slate-700"
                  placeholder={t("payment_notes_placeholder", "Transaction reference, notes...")}
                  data-testid="textarea-payment-notes"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRecordPaymentOpen(false)}>
              {t("cancel", "Cancel")}
            </Button>
            <Button
              onClick={handleRecordPayment}
              disabled={recordPaymentMutation.isPending || !paymentAmount || parseFloat(paymentAmount) <= 0}
              className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500"
              data-testid="button-confirm-payment"
            >
              {recordPaymentMutation.isPending ? t("processing", "Processing...") : t("record_payment", "Record Payment")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={isDetailsSheetOpen} onOpenChange={setIsDetailsSheetOpen}>
        <SheetContent className="w-full sm:max-w-xl bg-slate-900 border-cyan-500/20 overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-xl text-white flex items-center gap-2">
              <Receipt className="w-5 h-5 text-cyan-400" />
              {t("invoice_details", "Invoice Details")}
            </SheetTitle>
            <SheetDescription>
              {selectedInvoice?.invoiceNumber}
            </SheetDescription>
          </SheetHeader>

          {selectedInvoice && (
            <div className="mt-6 space-y-6">
              <div className="flex items-center justify-between">
                <Badge variant={getStatusBadgeVariant(selectedInvoice.status)} className={`${getStatusColor(selectedInvoice.status)} px-3 py-1`}>
                  {getStatusLabel(selectedInvoice.status)}
                </Badge>
                {selectedInvoice.quoteId && (
                  <Badge variant="outline" className="border-cyan-500/30 text-cyan-400">
                    <Link className="w-3 h-3 mr-1" />
                    {t("from_quote", "From Quote")}
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 p-4 bg-slate-800/50 rounded-lg">
                <div>
                  <p className="text-xs text-muted-foreground">{t("client", "Client")}</p>
                  <p className="text-white font-medium flex items-center gap-2">
                    <User className="w-4 h-4 text-cyan-400" />
                    {getClientName(selectedInvoice.clientId)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t("issued_date", "Issued Date")}</p>
                  <p className="text-white font-medium flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-cyan-400" />
                    {formatDate(selectedInvoice.issuedDate)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t("due_date", "Due Date")}</p>
                  <p className="text-white font-medium flex items-center gap-2">
                    <Clock className="w-4 h-4 text-yellow-400" />
                    {formatDate(selectedInvoice.dueDate)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t("paid_date", "Paid Date")}</p>
                  <p className="text-white font-medium flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    {formatDate(selectedInvoice.paidDate)}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-medium text-cyan-400">{t("line_items", "Line Items")}</h4>
                <div className="space-y-2">
                  {invoiceItems.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                      <div>
                        <p className="text-white">{item.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.quantity} x {formatCurrency(parseFloat(item.unitPrice))}
                        </p>
                      </div>
                      <span className="text-white font-semibold">
                        {formatCurrency(parseFloat(item.totalPrice))}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 bg-slate-800/50 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("subtotal", "Subtotal")}</span>
                  <span className="text-white">{formatCurrency(parseFloat(selectedInvoice.subtotal || '0'))}</span>
                </div>
                {parseFloat(selectedInvoice.discountAmount || '0') > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("discount", "Discount")}</span>
                    <span className="text-red-400">-{formatCurrency(parseFloat(selectedInvoice.discountAmount || '0'))}</span>
                  </div>
                )}
                {parseFloat(selectedInvoice.taxAmount || '0') > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("tax", "Tax")}</span>
                    <span className="text-white">{formatCurrency(parseFloat(selectedInvoice.taxAmount || '0'))}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-slate-700 pt-2">
                  <span className="text-cyan-400">{t("total", "Total")}</span>
                  <span className="text-white font-bold">{formatCurrency(parseFloat(selectedInvoice.totalAmount || '0'))}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-green-400">{t("paid", "Paid")}</span>
                  <span className="text-green-400">{formatCurrency(parseFloat(selectedInvoice.paidAmount || '0'))}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-yellow-400">{t("balance_due", "Balance Due")}</span>
                  <span className="text-yellow-400 font-bold">{formatCurrency(parseFloat(selectedInvoice.balanceDue || '0'))}</span>
                </div>
              </div>

              {invoicePayments.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-cyan-400">{t("payment_history", "Payment History")}</h4>
                  <div className="space-y-2">
                    {invoicePayments.map((payment) => (
                      <div key={payment.id} className="flex items-center justify-between p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                        <div>
                          <p className="text-white font-mono text-sm">{payment.paymentNumber}</p>
                          <p className="text-xs text-muted-foreground">
                            {payment.paymentMethodType} • {formatDate(payment.createdAt)}
                          </p>
                        </div>
                        <span className="text-green-400 font-semibold">
                          {formatCurrency(parseFloat(payment.amount))}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedInvoice.notes && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">{t("notes", "Notes")}</p>
                  <p className="text-white text-sm bg-slate-800/50 p-3 rounded-lg">{selectedInvoice.notes}</p>
                </div>
              )}

              {selectedInvoice.ticketId && (
                <div className="space-y-1 p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-lg">
                  <div className="flex items-center gap-2">
                    <ClipboardList className="w-4 h-4 text-cyan-400" />
                    <p className="text-xs text-cyan-400 font-medium">{t("linked_to_ticket", "Linked to Repair Ticket")}</p>
                  </div>
                  <p className="text-white text-sm">{t("ticket_id", "Ticket ID")}: {selectedInvoice.ticketId.slice(0, 8)}...</p>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="bg-slate-900 border-red-500/20">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-400" />
              {t("delete_invoice", "Delete Invoice")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("delete_invoice_confirmation", "Are you sure you want to delete this invoice? This action cannot be undone.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel", "Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteInvoice}
              className="bg-red-600 hover:bg-red-700"
              data-testid="button-confirm-delete"
            >
              {deleteInvoiceMutation.isPending ? t("deleting", "Deleting...") : t("delete", "Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isImportFromTicketOpen} onOpenChange={setIsImportFromTicketOpen}>
        <DialogContent className="max-w-4xl bg-slate-900 border-cyan-500/20 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-cyan-400 flex items-center gap-2">
              <ClipboardList className="w-5 h-5" />
              {isPreviewMode ? t("invoice_preview", "Invoice Preview") : t("import_from_ticket", "Import from Ticket")}
            </DialogTitle>
            <DialogDescription>
              {isPreviewMode 
                ? t("review_invoice_before_creating", "Review the invoice details before creating")
                : t("select_ticket_to_create_invoice", "Select a repair ticket to create an invoice from its services and parts")}
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
                    data-testid="input-search-tickets-invoice"
                  />
                </div>
                <Select value={ticketStatusFilter} onValueChange={setTicketStatusFilter}>
                  <SelectTrigger className="w-full md:w-48 bg-slate-800 border-slate-700" data-testid="select-ticket-status-invoice">
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
                        <TableRow key={ticket.id} className="border-slate-700 hover:bg-slate-800/50" data-testid={`row-ticket-invoice-${ticket.id}`}>
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
                              data-testid={`button-select-ticket-invoice-${ticket.id}`}
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
                onClick={handleCreateInvoiceFromTicket}
                disabled={createInvoiceFromTicketMutation.isPending}
                className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500"
                data-testid="button-create-invoice-from-ticket"
              >
                {createInvoiceFromTicketMutation.isPending ? t("creating", "Creating...") : t("create_invoice", "Create Invoice")}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
