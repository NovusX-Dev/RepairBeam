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
  ArrowDownCircle, 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Eye,
  CheckCircle,
  Clock,
  DollarSign,
  Calendar,
  User,
  CreditCard,
  AlertTriangle,
  Ban,
  Banknote,
  FileText,
  XCircle
} from "lucide-react";
import type { AccountReceivable, Client, PosInvoice } from "@shared/schema";

interface ARStats {
  total: number;
  pending: number;
  partiallyPaid: number;
  paid: number;
  overdue: number;
  cancelled: number;
  writtenOff: number;
  totalAmount: number;
  paidAmount: number;
  balanceDue: number;
}

interface ARFormData {
  clientId: string;
  posInvoiceId: string;
  ticketId: string;
  description: string;
  originalAmount: string;
  dueDate: string;
  notes: string;
}

const emptyFormData: ARFormData = {
  clientId: "",
  posInvoiceId: "",
  ticketId: "",
  description: "",
  originalAmount: "",
  dueDate: "",
  notes: ""
};

export default function AccountsReceivable() {
  const { t, formatCurrency } = useLocalization();
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDetailsSheetOpen, setIsDetailsSheetOpen] = useState(false);
  const [isRecordPaymentOpen, setIsRecordPaymentOpen] = useState(false);
  const [selectedAR, setSelectedAR] = useState<AccountReceivable | null>(null);
  const [formData, setFormData] = useState<ARFormData>(emptyFormData);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentNotes, setPaymentNotes] = useState("");

  const { data: accounts = [], isLoading: accountsLoading } = useQuery<AccountReceivable[]>({
    queryKey: ["/api/accounts-receivable"]
  });

  const { data: stats, isLoading: statsLoading } = useQuery<ARStats>({
    queryKey: ["/api/accounts-receivable/stats"]
  });

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    select: (data: any) => data?.clients || data || []
  });

  const { data: invoices = [] } = useQuery<PosInvoice[]>({
    queryKey: ["/api/pos-invoices"]
  });

  const createARMutation = useMutation({
    mutationFn: async (data: ARFormData) => {
      const response = await apiRequest("POST", "/api/accounts-receivable", {
        ...data,
        balanceDue: data.originalAmount,
        paidAmount: "0.00",
        status: "pending"
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts-receivable"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounts-receivable/stats"] });
      setIsAddDialogOpen(false);
      setFormData(emptyFormData);
      toast({
        title: t("success", "Success"),
        description: t("ar_created_successfully", "Account receivable created successfully")
      });
    },
    onError: () => {
      toast({
        title: t("error", "Error"),
        description: t("ar_creation_failed", "Failed to create account receivable"),
        variant: "destructive"
      });
    }
  });

  const updateARMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ARFormData> }) => {
      const response = await apiRequest("PATCH", `/api/accounts-receivable/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts-receivable"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounts-receivable/stats"] });
      setIsEditDialogOpen(false);
      setSelectedAR(null);
      setFormData(emptyFormData);
      toast({
        title: t("success", "Success"),
        description: t("ar_updated_successfully", "Account receivable updated successfully")
      });
    },
    onError: () => {
      toast({
        title: t("error", "Error"),
        description: t("ar_update_failed", "Failed to update account receivable"),
        variant: "destructive"
      });
    }
  });

  const recordPaymentMutation = useMutation({
    mutationFn: async ({ id, amount, method, notes }: { id: string; amount: string; method: string; notes: string }) => {
      const ar = accounts.find(a => a.id === id);
      if (!ar) throw new Error("Account not found");
      
      const currentPaid = parseFloat(ar.paidAmount || "0");
      const newPaid = currentPaid + parseFloat(amount);
      const original = parseFloat(ar.originalAmount);
      const newBalance = original - newPaid;
      
      let newStatus = ar.status;
      if (newBalance <= 0) {
        newStatus = "paid";
      } else if (newPaid > 0) {
        newStatus = "partially_paid";
      }
      
      const response = await apiRequest("PATCH", `/api/accounts-receivable/${id}`, {
        paidAmount: newPaid.toFixed(2),
        balanceDue: Math.max(0, newBalance).toFixed(2),
        status: newStatus,
        paidDate: newStatus === "paid" ? new Date() : undefined,
        notes: notes ? `${ar.notes || ""}\n[Payment: ${method} - ${amount}] ${notes}`.trim() : ar.notes
      });
      return response.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/accounts-receivable"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/accounts-receivable/stats"] });
      
      if (selectedAR) {
        const response = await fetch(`/api/accounts-receivable/${selectedAR.id}`, { credentials: "include" });
        if (response.ok) {
          const updatedAR = await response.json();
          setSelectedAR(updatedAR);
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
    setIsAddDialogOpen(true);
  };

  const handleOpenEditDialog = (ar: AccountReceivable) => {
    setSelectedAR(ar);
    setFormData({
      clientId: ar.clientId,
      posInvoiceId: ar.posInvoiceId || "",
      ticketId: ar.ticketId || "",
      description: ar.description,
      originalAmount: ar.originalAmount,
      dueDate: ar.dueDate ? format(new Date(ar.dueDate), "yyyy-MM-dd") : "",
      notes: ar.notes || ""
    });
    setIsEditDialogOpen(true);
  };

  const handleOpenDetailsSheet = (ar: AccountReceivable) => {
    setSelectedAR(ar);
    setIsDetailsSheetOpen(true);
  };

  const handleOpenRecordPayment = (ar: AccountReceivable) => {
    setSelectedAR(ar);
    setPaymentAmount(ar.balanceDue || "0");
    setPaymentMethod("cash");
    setPaymentNotes("");
    setIsRecordPaymentOpen(true);
  };

  const handleCreate = () => {
    if (!formData.clientId || !formData.description || !formData.originalAmount || !formData.dueDate) {
      toast({
        title: t("error", "Error"),
        description: t("fill_required_fields", "Please fill in all required fields"),
        variant: "destructive"
      });
      return;
    }
    createARMutation.mutate(formData);
  };

  const handleUpdate = () => {
    if (!selectedAR) return;
    updateARMutation.mutate({ id: selectedAR.id, data: formData });
  };

  const handleRecordPayment = () => {
    if (!selectedAR || !paymentAmount) return;
    const amount = parseFloat(paymentAmount);
    const balance = parseFloat(selectedAR.balanceDue || "0");
    if (amount <= 0 || amount > balance) {
      toast({
        title: t("error", "Error"),
        description: t("invalid_payment_amount", "Invalid payment amount"),
        variant: "destructive"
      });
      return;
    }
    recordPaymentMutation.mutate({
      id: selectedAR.id,
      amount: paymentAmount,
      method: paymentMethod,
      notes: paymentNotes
    });
  };

  const getStatusBadge = (status: string, dueDate?: Date | string | null) => {
    const isOverdue = dueDate && new Date(dueDate) < new Date() && status !== "paid" && status !== "cancelled" && status !== "written_off";
    
    if (isOverdue) {
      return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">{t("overdue", "Overdue")}</Badge>;
    }
    
    switch (status) {
      case "pending":
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">{t("pending", "Pending")}</Badge>;
      case "partially_paid":
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">{t("partially_paid", "Partially Paid")}</Badge>;
      case "paid":
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">{t("paid", "Paid")}</Badge>;
      case "cancelled":
        return <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30">{t("cancelled", "Cancelled")}</Badge>;
      case "written_off":
        return <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">{t("written_off", "Written Off")}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getClientName = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    return client ? `${client.firstName} ${client.lastName}` : t("unknown_client", "Unknown Client");
  };

  const filteredAccounts = accounts.filter(ar => {
    const matchesSearch = 
      ar.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      getClientName(ar.clientId).toLowerCase().includes(searchTerm.toLowerCase());
    
    if (statusFilter === "all") return matchesSearch;
    if (statusFilter === "overdue") {
      return matchesSearch && ar.dueDate && new Date(ar.dueDate) < new Date() && ar.status !== "paid" && ar.status !== "cancelled";
    }
    return matchesSearch && ar.status === statusFilter;
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white" data-testid="text-ar-title">
            {t("accounts_receivable", "Accounts Receivable")}
          </h1>
          <p className="text-muted-foreground mt-1" data-testid="text-ar-description">
            {t("accounts_receivable_description", "Track incoming payments and outstanding invoices")}
          </p>
        </div>
        <PermissionGate permission={PERMISSIONS.POS_PROCESS_SALE}>
          <Button 
            onClick={handleOpenAddDialog}
            className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700"
            data-testid="button-add-ar"
          >
            <Plus className="w-4 h-4 mr-2" />
            {t("add_receivable", "Add Receivable")}
          </Button>
        </PermissionGate>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {statsLoading ? (
          <>
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-24 bg-navy-800" />
            ))}
          </>
        ) : (
          <>
            <Card className="bg-navy-800 border-cyan-500/20">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{t("total_receivables", "Total Receivables")}</p>
                    <p className="text-2xl font-bold text-white">{stats?.total || 0}</p>
                  </div>
                  <ArrowDownCircle className="w-8 h-8 text-cyan-400" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-navy-800 border-green-500/20">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{t("total_collected", "Total Collected")}</p>
                    <p className="text-2xl font-bold text-green-400">{formatCurrency(stats?.paidAmount || 0)}</p>
                  </div>
                  <CheckCircle className="w-8 h-8 text-green-400" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-navy-800 border-yellow-500/20">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{t("outstanding_balance", "Outstanding")}</p>
                    <p className="text-2xl font-bold text-yellow-400">{formatCurrency(stats?.balanceDue || 0)}</p>
                  </div>
                  <Clock className="w-8 h-8 text-yellow-400" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-navy-800 border-red-500/20">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{t("overdue_count", "Overdue")}</p>
                    <p className="text-2xl font-bold text-red-400">{stats?.overdue || 0}</p>
                  </div>
                  <AlertTriangle className="w-8 h-8 text-red-400" />
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={t("search_receivables", "Search receivables...")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-navy-800 border-cyan-500/20"
            data-testid="input-search-ar"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px] bg-navy-800 border-cyan-500/20" data-testid="select-status-filter">
            <SelectValue placeholder={t("filter_by_status", "Filter by status")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("all_statuses", "All Statuses")}</SelectItem>
            <SelectItem value="pending">{t("pending", "Pending")}</SelectItem>
            <SelectItem value="partially_paid">{t("partially_paid", "Partially Paid")}</SelectItem>
            <SelectItem value="paid">{t("paid", "Paid")}</SelectItem>
            <SelectItem value="overdue">{t("overdue", "Overdue")}</SelectItem>
            <SelectItem value="cancelled">{t("cancelled", "Cancelled")}</SelectItem>
            <SelectItem value="written_off">{t("written_off", "Written Off")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="bg-navy-800 border-cyan-500/20">
        <CardContent className="p-0">
          {accountsLoading ? (
            <div className="p-4 space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 bg-navy-700" />
              ))}
            </div>
          ) : filteredAccounts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <ArrowDownCircle className="w-16 h-16 text-cyan-400/30 mb-4" />
              <p className="text-muted-foreground">{t("no_receivables_found", "No receivables found")}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-cyan-500/20 hover:bg-navy-700/50">
                  <TableHead className="text-cyan-400">{t("client", "Client")}</TableHead>
                  <TableHead className="text-cyan-400">{t("description", "Description")}</TableHead>
                  <TableHead className="text-cyan-400">{t("amount", "Amount")}</TableHead>
                  <TableHead className="text-cyan-400">{t("balance", "Balance")}</TableHead>
                  <TableHead className="text-cyan-400">{t("due_date", "Due Date")}</TableHead>
                  <TableHead className="text-cyan-400">{t("status", "Status")}</TableHead>
                  <TableHead className="text-cyan-400 text-right">{t("actions", "Actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAccounts.map((ar) => (
                  <TableRow key={ar.id} className="border-cyan-500/20 hover:bg-navy-700/50">
                    <TableCell className="font-medium text-white">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-cyan-400" />
                        {getClientName(ar.clientId)}
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-300 max-w-[200px] truncate">
                      {ar.description}
                    </TableCell>
                    <TableCell className="text-white font-medium">
                      {formatCurrency(parseFloat(ar.originalAmount))}
                    </TableCell>
                    <TableCell className="text-yellow-400 font-medium">
                      {formatCurrency(parseFloat(ar.balanceDue || "0"))}
                    </TableCell>
                    <TableCell className="text-gray-300">
                      {ar.dueDate ? format(new Date(ar.dueDate), "MMM dd, yyyy") : "-"}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(ar.status, ar.dueDate)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenDetailsSheet(ar)}
                          className="hover:bg-cyan-500/20"
                          data-testid={`button-view-ar-${ar.id}`}
                        >
                          <Eye className="w-4 h-4 text-cyan-400" />
                        </Button>
                        {ar.status !== "paid" && ar.status !== "cancelled" && (
                          <PermissionGate permission={PERMISSIONS.POS_PROCESS_SALE}>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenRecordPayment(ar)}
                              className="hover:bg-green-500/20"
                              data-testid={`button-pay-ar-${ar.id}`}
                            >
                              <Banknote className="w-4 h-4 text-green-400" />
                            </Button>
                          </PermissionGate>
                        )}
                        <PermissionGate permission={PERMISSIONS.POS_PROCESS_SALE}>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenEditDialog(ar)}
                            className="hover:bg-blue-500/20"
                            data-testid={`button-edit-ar-${ar.id}`}
                          >
                            <Edit className="w-4 h-4 text-blue-400" />
                          </Button>
                        </PermissionGate>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="bg-navy-900 border-cyan-500/20 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <ArrowDownCircle className="w-5 h-5 text-cyan-400" />
              {t("add_receivable", "Add Receivable")}
            </DialogTitle>
            <DialogDescription>
              {t("add_receivable_description", "Create a new account receivable entry")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="clientId">{t("client", "Client")} *</Label>
              <Select value={formData.clientId} onValueChange={(value) => setFormData({...formData, clientId: value})}>
                <SelectTrigger className="bg-navy-800 border-cyan-500/20" data-testid="select-client">
                  <SelectValue placeholder={t("select_client", "Select client")} />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>{client.firstName} {client.lastName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="description">{t("description", "Description")} *</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                className="bg-navy-800 border-cyan-500/20"
                placeholder={t("ar_description_placeholder", "Service or product description")}
                data-testid="input-description"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="originalAmount">{t("amount", "Amount")} *</Label>
                <Input
                  id="originalAmount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.originalAmount}
                  onChange={(e) => setFormData({...formData, originalAmount: e.target.value})}
                  className="bg-navy-800 border-cyan-500/20"
                  placeholder="0.00"
                  data-testid="input-amount"
                />
              </div>
              <div>
                <Label htmlFor="dueDate">{t("due_date", "Due Date")} *</Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => setFormData({...formData, dueDate: e.target.value})}
                  className="bg-navy-800 border-cyan-500/20"
                  data-testid="input-due-date"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="posInvoiceId">{t("linked_invoice", "Linked Invoice")}</Label>
              <Select value={formData.posInvoiceId} onValueChange={(value) => setFormData({...formData, posInvoiceId: value})}>
                <SelectTrigger className="bg-navy-800 border-cyan-500/20" data-testid="select-invoice">
                  <SelectValue placeholder={t("select_invoice_optional", "Select invoice (optional)")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">{t("none", "None")}</SelectItem>
                  {invoices.filter(inv => inv.clientId === formData.clientId).map((inv) => (
                    <SelectItem key={inv.id} value={inv.id}>{inv.invoiceNumber}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="notes">{t("notes", "Notes")}</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                className="bg-navy-800 border-cyan-500/20"
                placeholder={t("notes_placeholder", "Additional notes...")}
                data-testid="input-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} data-testid="button-cancel-add">
              {t("cancel", "Cancel")}
            </Button>
            <Button
              onClick={handleCreate}
              disabled={createARMutation.isPending}
              className="bg-gradient-to-r from-cyan-500 to-blue-600"
              data-testid="button-submit-add"
            >
              {createARMutation.isPending ? t("creating", "Creating...") : t("create", "Create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="bg-navy-900 border-cyan-500/20 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Edit className="w-5 h-5 text-cyan-400" />
              {t("edit_receivable", "Edit Receivable")}
            </DialogTitle>
            <DialogDescription>
              {t("edit_receivable_description", "Update account receivable details")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-clientId">{t("client", "Client")} *</Label>
              <Select value={formData.clientId} onValueChange={(value) => setFormData({...formData, clientId: value})}>
                <SelectTrigger className="bg-navy-800 border-cyan-500/20" data-testid="select-edit-client">
                  <SelectValue placeholder={t("select_client", "Select client")} />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>{client.firstName} {client.lastName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="edit-description">{t("description", "Description")} *</Label>
              <Input
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                className="bg-navy-800 border-cyan-500/20"
                data-testid="input-edit-description"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-originalAmount">{t("amount", "Amount")} *</Label>
                <Input
                  id="edit-originalAmount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.originalAmount}
                  onChange={(e) => setFormData({...formData, originalAmount: e.target.value})}
                  className="bg-navy-800 border-cyan-500/20"
                  data-testid="input-edit-amount"
                />
              </div>
              <div>
                <Label htmlFor="edit-dueDate">{t("due_date", "Due Date")} *</Label>
                <Input
                  id="edit-dueDate"
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => setFormData({...formData, dueDate: e.target.value})}
                  className="bg-navy-800 border-cyan-500/20"
                  data-testid="input-edit-due-date"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="edit-notes">{t("notes", "Notes")}</Label>
              <Textarea
                id="edit-notes"
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                className="bg-navy-800 border-cyan-500/20"
                data-testid="input-edit-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} data-testid="button-cancel-edit">
              {t("cancel", "Cancel")}
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={updateARMutation.isPending}
              className="bg-gradient-to-r from-cyan-500 to-blue-600"
              data-testid="button-submit-edit"
            >
              {updateARMutation.isPending ? t("saving", "Saving...") : t("save", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isRecordPaymentOpen} onOpenChange={setIsRecordPaymentOpen}>
        <DialogContent className="bg-navy-900 border-cyan-500/20 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Banknote className="w-5 h-5 text-green-400" />
              {t("record_payment", "Record Payment")}
            </DialogTitle>
            <DialogDescription>
              {t("record_payment_description", "Record a payment for this receivable")}
            </DialogDescription>
          </DialogHeader>
          {selectedAR && (
            <div className="space-y-4">
              <div className="bg-navy-800 rounded-lg p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("original_amount", "Original Amount")}</span>
                  <span className="text-white font-medium">{formatCurrency(parseFloat(selectedAR.originalAmount))}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("already_paid", "Already Paid")}</span>
                  <span className="text-green-400 font-medium">{formatCurrency(parseFloat(selectedAR.paidAmount || "0"))}</span>
                </div>
                <div className="flex justify-between border-t border-cyan-500/20 pt-2">
                  <span className="text-muted-foreground">{t("balance_due", "Balance Due")}</span>
                  <span className="text-yellow-400 font-bold">{formatCurrency(parseFloat(selectedAR.balanceDue || "0"))}</span>
                </div>
              </div>
              <div>
                <Label htmlFor="paymentAmount">{t("payment_amount", "Payment Amount")} *</Label>
                <Input
                  id="paymentAmount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={selectedAR.balanceDue || "0"}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="bg-navy-800 border-cyan-500/20"
                  data-testid="input-payment-amount"
                />
              </div>
              <div>
                <Label htmlFor="paymentMethod">{t("payment_method", "Payment Method")}</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger className="bg-navy-800 border-cyan-500/20" data-testid="select-payment-method">
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
              <div>
                <Label htmlFor="paymentNotes">{t("payment_notes", "Notes")}</Label>
                <Textarea
                  id="paymentNotes"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="bg-navy-800 border-cyan-500/20"
                  placeholder={t("payment_notes_placeholder", "Transaction reference, notes...")}
                  data-testid="input-payment-notes"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRecordPaymentOpen(false)} data-testid="button-cancel-payment">
              {t("cancel", "Cancel")}
            </Button>
            <Button
              onClick={handleRecordPayment}
              disabled={recordPaymentMutation.isPending}
              className="bg-gradient-to-r from-green-500 to-emerald-600"
              data-testid="button-submit-payment"
            >
              {recordPaymentMutation.isPending ? t("processing", "Processing...") : t("record_payment", "Record Payment")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={isDetailsSheetOpen} onOpenChange={setIsDetailsSheetOpen}>
        <SheetContent className="bg-navy-900 border-cyan-500/20 w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-xl text-white flex items-center gap-2">
              <ArrowDownCircle className="w-5 h-5 text-cyan-400" />
              {t("receivable_details", "Receivable Details")}
            </SheetTitle>
            <SheetDescription>
              {selectedAR?.description}
            </SheetDescription>
          </SheetHeader>

          {selectedAR && (
            <div className="mt-6 space-y-6">
              <div className="flex items-center justify-between">
                {getStatusBadge(selectedAR.status, selectedAR.dueDate)}
                {selectedAR.status !== "paid" && selectedAR.status !== "cancelled" && (
                  <Button
                    size="sm"
                    onClick={() => handleOpenRecordPayment(selectedAR)}
                    className="bg-gradient-to-r from-green-500 to-emerald-600"
                    data-testid="button-sheet-record-payment"
                  >
                    <Banknote className="w-4 h-4 mr-2" />
                    {t("record_payment", "Record Payment")}
                  </Button>
                )}
              </div>

              <div className="bg-navy-800 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <User className="w-4 h-4" />
                  <span>{t("client", "Client")}</span>
                </div>
                <p className="text-white font-medium">{getClientName(selectedAR.clientId)}</p>
              </div>

              <div className="bg-navy-800 rounded-lg p-4 space-y-3">
                <h3 className="font-semibold text-white flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-cyan-400" />
                  {t("financial_summary", "Financial Summary")}
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("original_amount", "Original Amount")}</span>
                    <span className="text-white font-medium">{formatCurrency(parseFloat(selectedAR.originalAmount))}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("paid_amount", "Paid Amount")}</span>
                    <span className="text-green-400 font-medium">{formatCurrency(parseFloat(selectedAR.paidAmount || "0"))}</span>
                  </div>
                  <div className="flex justify-between border-t border-cyan-500/20 pt-2">
                    <span className="text-muted-foreground font-medium">{t("balance_due", "Balance Due")}</span>
                    <span className="text-yellow-400 font-bold">{formatCurrency(parseFloat(selectedAR.balanceDue || "0"))}</span>
                  </div>
                </div>
              </div>

              <div className="bg-navy-800 rounded-lg p-4 space-y-3">
                <h3 className="font-semibold text-white flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-cyan-400" />
                  {t("dates", "Dates")}
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("due_date", "Due Date")}</span>
                    <span className="text-white">{selectedAR.dueDate ? format(new Date(selectedAR.dueDate), "MMM dd, yyyy") : "-"}</span>
                  </div>
                  {selectedAR.paidDate && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t("paid_date", "Paid Date")}</span>
                      <span className="text-green-400">{format(new Date(selectedAR.paidDate), "MMM dd, yyyy")}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("created", "Created")}</span>
                    <span className="text-white">{selectedAR.createdAt ? format(new Date(selectedAR.createdAt), "MMM dd, yyyy") : "-"}</span>
                  </div>
                </div>
              </div>

              {selectedAR.notes && (
                <div className="bg-navy-800 rounded-lg p-4 space-y-3">
                  <h3 className="font-semibold text-white flex items-center gap-2">
                    <FileText className="w-4 h-4 text-cyan-400" />
                    {t("notes", "Notes")}
                  </h3>
                  <p className="text-gray-300 whitespace-pre-wrap">{selectedAR.notes}</p>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
