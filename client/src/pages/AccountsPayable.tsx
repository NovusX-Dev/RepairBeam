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
import { PermissionGate } from "@/components/PermissionGate";
import { PERMISSIONS } from "@shared/permissions";
import { format } from "date-fns";
import { 
  ArrowUpCircle, 
  Plus, 
  Search, 
  Edit, 
  Eye,
  CheckCircle,
  Clock,
  DollarSign,
  Calendar,
  Building2,
  CreditCard,
  AlertTriangle,
  Banknote,
  FileText,
  Tag
} from "lucide-react";
import type { AccountPayable, Supplier, PurchaseOrder } from "@shared/schema";

interface APStats {
  total: number;
  pending: number;
  partiallyPaid: number;
  paid: number;
  overdue: number;
  cancelled: number;
  totalAmount: number;
  paidAmount: number;
  balanceDue: number;
}

interface APFormData {
  supplierId: string;
  purchaseOrderId: string;
  description: string;
  category: string;
  originalAmount: string;
  dueDate: string;
  referenceNumber: string;
  notes: string;
}

const emptyFormData: APFormData = {
  supplierId: "",
  purchaseOrderId: "",
  description: "",
  category: "",
  originalAmount: "",
  dueDate: "",
  referenceNumber: "",
  notes: ""
};

const categories = [
  { value: "inventory", label: "inventory" },
  { value: "utilities", label: "utilities" },
  { value: "rent", label: "rent" },
  { value: "services", label: "services" },
  { value: "other", label: "other" }
];

export default function AccountsPayable() {
  const { t, formatCurrency } = useLocalization();
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDetailsSheetOpen, setIsDetailsSheetOpen] = useState(false);
  const [isRecordPaymentOpen, setIsRecordPaymentOpen] = useState(false);
  const [selectedAP, setSelectedAP] = useState<AccountPayable | null>(null);
  const [formData, setFormData] = useState<APFormData>(emptyFormData);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("bank_transfer");
  const [paymentNotes, setPaymentNotes] = useState("");

  const { data: accounts = [], isLoading: accountsLoading } = useQuery<AccountPayable[]>({
    queryKey: ["/api/accounts-payable"]
  });

  const { data: stats, isLoading: statsLoading } = useQuery<APStats>({
    queryKey: ["/api/accounts-payable/stats"]
  });

  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: ["/api/suppliers"]
  });

  const { data: purchaseOrders = [] } = useQuery<PurchaseOrder[]>({
    queryKey: ["/api/purchase-orders"]
  });

  const createAPMutation = useMutation({
    mutationFn: async (data: APFormData) => {
      const response = await apiRequest("POST", "/api/accounts-payable", {
        ...data,
        supplierId: data.supplierId || null,
        purchaseOrderId: data.purchaseOrderId || null,
        balanceDue: data.originalAmount,
        paidAmount: "0.00",
        status: "pending"
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts-payable"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounts-payable/stats"] });
      setIsAddDialogOpen(false);
      setFormData(emptyFormData);
      toast({
        title: t("success", "Success"),
        description: t("ap_created_successfully", "Account payable created successfully")
      });
    },
    onError: () => {
      toast({
        title: t("error", "Error"),
        description: t("ap_creation_failed", "Failed to create account payable"),
        variant: "destructive"
      });
    }
  });

  const updateAPMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<APFormData> }) => {
      const response = await apiRequest("PATCH", `/api/accounts-payable/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts-payable"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounts-payable/stats"] });
      setIsEditDialogOpen(false);
      setSelectedAP(null);
      setFormData(emptyFormData);
      toast({
        title: t("success", "Success"),
        description: t("ap_updated_successfully", "Account payable updated successfully")
      });
    },
    onError: () => {
      toast({
        title: t("error", "Error"),
        description: t("ap_update_failed", "Failed to update account payable"),
        variant: "destructive"
      });
    }
  });

  const recordPaymentMutation = useMutation({
    mutationFn: async ({ id, amount, method, notes }: { id: string; amount: string; method: string; notes: string }) => {
      const ap = accounts.find(a => a.id === id);
      if (!ap) throw new Error("Account not found");
      
      const currentPaid = parseFloat(ap.paidAmount || "0");
      const newPaid = currentPaid + parseFloat(amount);
      const original = parseFloat(ap.originalAmount);
      const newBalance = original - newPaid;
      
      let newStatus = ap.status;
      if (newBalance <= 0) {
        newStatus = "paid";
      } else if (newPaid > 0) {
        newStatus = "partially_paid";
      }
      
      const response = await apiRequest("PATCH", `/api/accounts-payable/${id}`, {
        paidAmount: newPaid.toFixed(2),
        balanceDue: Math.max(0, newBalance).toFixed(2),
        status: newStatus,
        paymentMethod: method,
        paidDate: newStatus === "paid" ? new Date() : undefined,
        notes: notes ? `${ap.notes || ""}\n[Payment: ${method} - ${amount}] ${notes}`.trim() : ap.notes
      });
      return response.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/accounts-payable"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/accounts-payable/stats"] });
      
      if (selectedAP) {
        const response = await fetch(`/api/accounts-payable/${selectedAP.id}`, { credentials: "include" });
        if (response.ok) {
          const updatedAP = await response.json();
          setSelectedAP(updatedAP);
        }
      }
      
      setIsRecordPaymentOpen(false);
      setPaymentAmount("");
      setPaymentMethod("bank_transfer");
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

  const handleOpenEditDialog = (ap: AccountPayable) => {
    setSelectedAP(ap);
    setFormData({
      supplierId: ap.supplierId || "",
      purchaseOrderId: ap.purchaseOrderId || "",
      description: ap.description,
      category: ap.category || "",
      originalAmount: ap.originalAmount,
      dueDate: ap.dueDate ? format(new Date(ap.dueDate), "yyyy-MM-dd") : "",
      referenceNumber: ap.referenceNumber || "",
      notes: ap.notes || ""
    });
    setIsEditDialogOpen(true);
  };

  const handleOpenDetailsSheet = (ap: AccountPayable) => {
    setSelectedAP(ap);
    setIsDetailsSheetOpen(true);
  };

  const handleOpenRecordPayment = (ap: AccountPayable) => {
    setSelectedAP(ap);
    setPaymentAmount(ap.balanceDue || "0");
    setPaymentMethod("bank_transfer");
    setPaymentNotes("");
    setIsRecordPaymentOpen(true);
  };

  const handleCreate = () => {
    if (!formData.description || !formData.originalAmount || !formData.dueDate) {
      toast({
        title: t("error", "Error"),
        description: t("fill_required_fields", "Please fill in all required fields"),
        variant: "destructive"
      });
      return;
    }
    createAPMutation.mutate(formData);
  };

  const handleUpdate = () => {
    if (!selectedAP) return;
    updateAPMutation.mutate({ id: selectedAP.id, data: formData });
  };

  const handleRecordPayment = () => {
    if (!selectedAP || !paymentAmount) return;
    const amount = parseFloat(paymentAmount);
    const balance = parseFloat(selectedAP.balanceDue || "0");
    if (amount <= 0 || amount > balance) {
      toast({
        title: t("error", "Error"),
        description: t("invalid_payment_amount", "Invalid payment amount"),
        variant: "destructive"
      });
      return;
    }
    recordPaymentMutation.mutate({
      id: selectedAP.id,
      amount: paymentAmount,
      method: paymentMethod,
      notes: paymentNotes
    });
  };

  const getStatusBadge = (status: string, dueDate?: Date | string | null) => {
    const isOverdue = dueDate && new Date(dueDate) < new Date() && status !== "paid" && status !== "cancelled";
    
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
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getCategoryBadge = (category: string | null) => {
    if (!category) return null;
    const colors: Record<string, string> = {
      inventory: "bg-purple-500/20 text-purple-400 border-purple-500/30",
      utilities: "bg-blue-500/20 text-blue-400 border-blue-500/30",
      rent: "bg-orange-500/20 text-orange-400 border-orange-500/30",
      services: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
      other: "bg-gray-500/20 text-gray-400 border-gray-500/30"
    };
    return <Badge className={colors[category] || colors.other}>{t(category, category)}</Badge>;
  };

  const getSupplierName = (supplierId: string | null) => {
    if (!supplierId) return t("no_supplier", "No Supplier");
    const supplier = suppliers.find(s => s.id === supplierId);
    return supplier?.name || t("unknown_supplier", "Unknown Supplier");
  };

  const filteredAccounts = accounts.filter(ap => {
    const matchesSearch = 
      ap.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      getSupplierName(ap.supplierId).toLowerCase().includes(searchTerm.toLowerCase()) ||
      (ap.referenceNumber && ap.referenceNumber.toLowerCase().includes(searchTerm.toLowerCase()));
    
    if (statusFilter === "all") return matchesSearch;
    if (statusFilter === "overdue") {
      return matchesSearch && ap.dueDate && new Date(ap.dueDate) < new Date() && ap.status !== "paid" && ap.status !== "cancelled";
    }
    return matchesSearch && ap.status === statusFilter;
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white" data-testid="text-ap-title">
            {t("accounts_payable", "Accounts Payable")}
          </h1>
          <p className="text-muted-foreground mt-1" data-testid="text-ap-description">
            {t("accounts_payable_description", "Manage outgoing payments and vendor bills")}
          </p>
        </div>
        <PermissionGate permission={PERMISSIONS.POS_PROCESS_SALE}>
          <Button 
            onClick={handleOpenAddDialog}
            className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700"
            data-testid="button-add-ap"
          >
            <Plus className="w-4 h-4 mr-2" />
            {t("add_payable", "Add Payable")}
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
                    <p className="text-sm text-muted-foreground">{t("total_payables", "Total Payables")}</p>
                    <p className="text-2xl font-bold text-white">{stats?.total || 0}</p>
                  </div>
                  <ArrowUpCircle className="w-8 h-8 text-cyan-400" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-navy-800 border-green-500/20">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{t("total_paid_out", "Total Paid Out")}</p>
                    <p className="text-2xl font-bold text-green-400">{formatCurrency(stats?.paidAmount || 0)}</p>
                  </div>
                  <CheckCircle className="w-8 h-8 text-green-400" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-navy-800 border-red-500/20">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{t("outstanding_payables", "Outstanding")}</p>
                    <p className="text-2xl font-bold text-red-400">{formatCurrency(stats?.balanceDue || 0)}</p>
                  </div>
                  <Clock className="w-8 h-8 text-red-400" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-navy-800 border-orange-500/20">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{t("overdue_count", "Overdue")}</p>
                    <p className="text-2xl font-bold text-orange-400">{stats?.overdue || 0}</p>
                  </div>
                  <AlertTriangle className="w-8 h-8 text-orange-400" />
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
            placeholder={t("search_payables", "Search payables...")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-navy-800 border-cyan-500/20"
            data-testid="input-search-ap"
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
              <ArrowUpCircle className="w-16 h-16 text-red-400/30 mb-4" />
              <p className="text-muted-foreground">{t("no_payables_found", "No payables found")}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-cyan-500/20 hover:bg-navy-700/50">
                  <TableHead className="text-cyan-400">{t("supplier", "Supplier")}</TableHead>
                  <TableHead className="text-cyan-400">{t("description", "Description")}</TableHead>
                  <TableHead className="text-cyan-400">{t("category", "Category")}</TableHead>
                  <TableHead className="text-cyan-400">{t("amount", "Amount")}</TableHead>
                  <TableHead className="text-cyan-400">{t("balance", "Balance")}</TableHead>
                  <TableHead className="text-cyan-400">{t("due_date", "Due Date")}</TableHead>
                  <TableHead className="text-cyan-400">{t("status", "Status")}</TableHead>
                  <TableHead className="text-cyan-400 text-right">{t("actions", "Actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAccounts.map((ap) => (
                  <TableRow key={ap.id} className="border-cyan-500/20 hover:bg-navy-700/50">
                    <TableCell className="font-medium text-white">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-cyan-400" />
                        {getSupplierName(ap.supplierId)}
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-300 max-w-[200px] truncate">
                      {ap.description}
                    </TableCell>
                    <TableCell>
                      {getCategoryBadge(ap.category)}
                    </TableCell>
                    <TableCell className="text-white font-medium">
                      {formatCurrency(parseFloat(ap.originalAmount))}
                    </TableCell>
                    <TableCell className="text-red-400 font-medium">
                      {formatCurrency(parseFloat(ap.balanceDue || "0"))}
                    </TableCell>
                    <TableCell className="text-gray-300">
                      {ap.dueDate ? format(new Date(ap.dueDate), "MMM dd, yyyy") : "-"}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(ap.status, ap.dueDate)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenDetailsSheet(ap)}
                          className="hover:bg-cyan-500/20"
                          data-testid={`button-view-ap-${ap.id}`}
                        >
                          <Eye className="w-4 h-4 text-cyan-400" />
                        </Button>
                        {ap.status !== "paid" && ap.status !== "cancelled" && (
                          <PermissionGate permission={PERMISSIONS.POS_PROCESS_SALE}>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenRecordPayment(ap)}
                              className="hover:bg-green-500/20"
                              data-testid={`button-pay-ap-${ap.id}`}
                            >
                              <Banknote className="w-4 h-4 text-green-400" />
                            </Button>
                          </PermissionGate>
                        )}
                        <PermissionGate permission={PERMISSIONS.POS_PROCESS_SALE}>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenEditDialog(ap)}
                            className="hover:bg-blue-500/20"
                            data-testid={`button-edit-ap-${ap.id}`}
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
              <ArrowUpCircle className="w-5 h-5 text-cyan-400" />
              {t("add_payable", "Add Payable")}
            </DialogTitle>
            <DialogDescription>
              {t("add_payable_description", "Create a new account payable entry")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="supplierId">{t("supplier", "Supplier")}</Label>
              <Select value={formData.supplierId} onValueChange={(value) => setFormData({...formData, supplierId: value})}>
                <SelectTrigger className="bg-navy-800 border-cyan-500/20" data-testid="select-supplier">
                  <SelectValue placeholder={t("select_supplier_optional", "Select supplier (optional)")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">{t("none", "None")}</SelectItem>
                  {suppliers.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>{supplier.name}</SelectItem>
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
                placeholder={t("ap_description_placeholder", "Bill or expense description")}
                data-testid="input-description"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="category">{t("category", "Category")}</Label>
                <Select value={formData.category} onValueChange={(value) => setFormData({...formData, category: value})}>
                  <SelectTrigger className="bg-navy-800 border-cyan-500/20" data-testid="select-category">
                    <SelectValue placeholder={t("select_category", "Select category")} />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>{t(cat.label, cat.label)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="referenceNumber">{t("reference_number", "Reference #")}</Label>
                <Input
                  id="referenceNumber"
                  value={formData.referenceNumber}
                  onChange={(e) => setFormData({...formData, referenceNumber: e.target.value})}
                  className="bg-navy-800 border-cyan-500/20"
                  placeholder={t("reference_placeholder", "Invoice/PO #")}
                  data-testid="input-reference"
                />
              </div>
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
              <Label htmlFor="purchaseOrderId">{t("linked_purchase_order", "Linked PO")}</Label>
              <Select value={formData.purchaseOrderId} onValueChange={(value) => setFormData({...formData, purchaseOrderId: value})}>
                <SelectTrigger className="bg-navy-800 border-cyan-500/20" data-testid="select-po">
                  <SelectValue placeholder={t("select_po_optional", "Select PO (optional)")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">{t("none", "None")}</SelectItem>
                  {purchaseOrders.filter(po => !formData.supplierId || po.supplierId === formData.supplierId).map((po) => (
                    <SelectItem key={po.id} value={po.id}>PO-{po.id.substring(0, 8)}</SelectItem>
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
              disabled={createAPMutation.isPending}
              className="bg-gradient-to-r from-cyan-500 to-blue-600"
              data-testid="button-submit-add"
            >
              {createAPMutation.isPending ? t("creating", "Creating...") : t("create", "Create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="bg-navy-900 border-cyan-500/20 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Edit className="w-5 h-5 text-cyan-400" />
              {t("edit_payable", "Edit Payable")}
            </DialogTitle>
            <DialogDescription>
              {t("edit_payable_description", "Update account payable details")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-supplierId">{t("supplier", "Supplier")}</Label>
              <Select value={formData.supplierId} onValueChange={(value) => setFormData({...formData, supplierId: value})}>
                <SelectTrigger className="bg-navy-800 border-cyan-500/20" data-testid="select-edit-supplier">
                  <SelectValue placeholder={t("select_supplier_optional", "Select supplier (optional)")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">{t("none", "None")}</SelectItem>
                  {suppliers.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>{supplier.name}</SelectItem>
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
                <Label htmlFor="edit-category">{t("category", "Category")}</Label>
                <Select value={formData.category} onValueChange={(value) => setFormData({...formData, category: value})}>
                  <SelectTrigger className="bg-navy-800 border-cyan-500/20" data-testid="select-edit-category">
                    <SelectValue placeholder={t("select_category", "Select category")} />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>{t(cat.label, cat.label)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit-referenceNumber">{t("reference_number", "Reference #")}</Label>
                <Input
                  id="edit-referenceNumber"
                  value={formData.referenceNumber}
                  onChange={(e) => setFormData({...formData, referenceNumber: e.target.value})}
                  className="bg-navy-800 border-cyan-500/20"
                  data-testid="input-edit-reference"
                />
              </div>
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
              disabled={updateAPMutation.isPending}
              className="bg-gradient-to-r from-cyan-500 to-blue-600"
              data-testid="button-submit-edit"
            >
              {updateAPMutation.isPending ? t("saving", "Saving...") : t("save", "Save")}
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
              {t("record_payment_description_ap", "Record a payment for this payable")}
            </DialogDescription>
          </DialogHeader>
          {selectedAP && (
            <div className="space-y-4">
              <div className="bg-navy-800 rounded-lg p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("original_amount", "Original Amount")}</span>
                  <span className="text-white font-medium">{formatCurrency(parseFloat(selectedAP.originalAmount))}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("already_paid", "Already Paid")}</span>
                  <span className="text-green-400 font-medium">{formatCurrency(parseFloat(selectedAP.paidAmount || "0"))}</span>
                </div>
                <div className="flex justify-between border-t border-cyan-500/20 pt-2">
                  <span className="text-muted-foreground">{t("balance_due", "Balance Due")}</span>
                  <span className="text-red-400 font-bold">{formatCurrency(parseFloat(selectedAP.balanceDue || "0"))}</span>
                </div>
              </div>
              <div>
                <Label htmlFor="paymentAmount">{t("payment_amount", "Payment Amount")} *</Label>
                <Input
                  id="paymentAmount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={selectedAP.balanceDue || "0"}
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
                    <SelectItem value="bank_transfer">{t("bank_transfer", "Bank Transfer")}</SelectItem>
                    <SelectItem value="pix">{t("pix", "PIX")}</SelectItem>
                    <SelectItem value="check">{t("check", "Check")}</SelectItem>
                    <SelectItem value="cash">{t("cash", "Cash")}</SelectItem>
                    <SelectItem value="credit_card">{t("credit_card", "Credit Card")}</SelectItem>
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
              <ArrowUpCircle className="w-5 h-5 text-cyan-400" />
              {t("payable_details", "Payable Details")}
            </SheetTitle>
            <SheetDescription>
              {selectedAP?.description}
            </SheetDescription>
          </SheetHeader>

          {selectedAP && (
            <div className="mt-6 space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  {getStatusBadge(selectedAP.status, selectedAP.dueDate)}
                  {getCategoryBadge(selectedAP.category)}
                </div>
                {selectedAP.status !== "paid" && selectedAP.status !== "cancelled" && (
                  <Button
                    size="sm"
                    onClick={() => handleOpenRecordPayment(selectedAP)}
                    className="bg-gradient-to-r from-green-500 to-emerald-600"
                    data-testid="button-sheet-record-payment"
                  >
                    <Banknote className="w-4 h-4 mr-2" />
                    {t("record_payment", "Record Payment")}
                  </Button>
                )}
              </div>

              {selectedAP.supplierId && (
                <div className="bg-navy-800 rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Building2 className="w-4 h-4" />
                    <span>{t("supplier", "Supplier")}</span>
                  </div>
                  <p className="text-white font-medium">{getSupplierName(selectedAP.supplierId)}</p>
                </div>
              )}

              <div className="bg-navy-800 rounded-lg p-4 space-y-3">
                <h3 className="font-semibold text-white flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-cyan-400" />
                  {t("financial_summary", "Financial Summary")}
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("original_amount", "Original Amount")}</span>
                    <span className="text-white font-medium">{formatCurrency(parseFloat(selectedAP.originalAmount))}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("paid_amount", "Paid Amount")}</span>
                    <span className="text-green-400 font-medium">{formatCurrency(parseFloat(selectedAP.paidAmount || "0"))}</span>
                  </div>
                  <div className="flex justify-between border-t border-cyan-500/20 pt-2">
                    <span className="text-muted-foreground font-medium">{t("balance_due", "Balance Due")}</span>
                    <span className="text-red-400 font-bold">{formatCurrency(parseFloat(selectedAP.balanceDue || "0"))}</span>
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
                    <span className="text-white">{selectedAP.dueDate ? format(new Date(selectedAP.dueDate), "MMM dd, yyyy") : "-"}</span>
                  </div>
                  {selectedAP.paidDate && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t("paid_date", "Paid Date")}</span>
                      <span className="text-green-400">{format(new Date(selectedAP.paidDate), "MMM dd, yyyy")}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("created", "Created")}</span>
                    <span className="text-white">{selectedAP.createdAt ? format(new Date(selectedAP.createdAt), "MMM dd, yyyy") : "-"}</span>
                  </div>
                </div>
              </div>

              {selectedAP.referenceNumber && (
                <div className="bg-navy-800 rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Tag className="w-4 h-4" />
                    <span>{t("reference_number", "Reference Number")}</span>
                  </div>
                  <p className="text-white font-medium">{selectedAP.referenceNumber}</p>
                </div>
              )}

              {selectedAP.notes && (
                <div className="bg-navy-800 rounded-lg p-4 space-y-3">
                  <h3 className="font-semibold text-white flex items-center gap-2">
                    <FileText className="w-4 h-4 text-cyan-400" />
                    {t("notes", "Notes")}
                  </h3>
                  <p className="text-gray-300 whitespace-pre-wrap">{selectedAP.notes}</p>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
