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
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, Search, Building2, Phone, Smartphone, Mail, MapPin, FileText } from "lucide-react";
import { Label } from "@/components/ui/label";

interface Supplier {
  id: string;
  tenantId: string;
  name: string;
  address: string | null;
  phone: string | null;
  cellphone: string | null;
  email: string | null;
  cnpj: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export default function Suppliers() {
  const { t } = useLocalization();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(15);
  const [formData, setFormData] = useState({
    name: "",
    address: "",
    phone: "",
    cellphone: "",
    email: "",
    cnpj: "",
  });

  // Fetch suppliers
  const { data: suppliers = [], isLoading } = useQuery<Supplier[]>({
    queryKey: ["/api/suppliers"],
  });

  // Filter and sort suppliers alphabetically
  const filteredSuppliers = useMemo(() => {
    const filtered = suppliers.filter(supplier => 
      supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (supplier.cnpj && supplier.cnpj.includes(searchTerm)) ||
      (supplier.phone && supplier.phone.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (supplier.cellphone && supplier.cellphone.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (supplier.email && supplier.email.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    // Sort alphabetically by name
    return filtered.sort((a, b) => a.name.localeCompare(b.name));
  }, [suppliers, searchTerm]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredSuppliers.length / itemsPerPage);
  const paginatedSuppliers = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredSuppliers.slice(startIndex, endIndex);
  }, [filteredSuppliers, currentPage, itemsPerPage]);

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: Partial<Supplier>) => {
      return await apiRequest("POST", "/api/suppliers", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] });
      toast({
        title: t("success", "Success"),
        description: t("supplier_created", "Supplier created successfully"),
      });
      handleCloseDialog();
    },
    onError: () => {
      toast({
        title: t("error", "Error"),
        description: t("supplier_create_failed", "Failed to create supplier"),
        variant: "destructive",
      });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Supplier> }) => {
      return await apiRequest("PUT", `/api/suppliers/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] });
      toast({
        title: t("success", "Success"),
        description: t("supplier_updated", "Supplier updated successfully"),
      });
      handleCloseDialog();
    },
    onError: () => {
      toast({
        title: t("error", "Error"),
        description: t("supplier_update_failed", "Failed to update supplier"),
        variant: "destructive",
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/suppliers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] });
      toast({
        title: t("success", "Success"),
        description: t("supplier_deleted", "Supplier deleted successfully"),
      });
    },
    onError: () => {
      toast({
        title: t("error", "Error"),
        description: t("supplier_delete_failed", "Failed to delete supplier"),
        variant: "destructive",
      });
    },
  });

  // Format CNPJ as user types
  const formatCNPJ = (value: string) => {
    // Remove all non-numeric characters
    const numbers = value.replace(/\D/g, '');
    
    // Limit to 14 digits
    const limitedNumbers = numbers.slice(0, 14);
    
    // Apply formatting: XX.XXX.XXX/XXXX-XX
    if (limitedNumbers.length <= 2) {
      return limitedNumbers;
    } else if (limitedNumbers.length <= 5) {
      return `${limitedNumbers.slice(0, 2)}.${limitedNumbers.slice(2)}`;
    } else if (limitedNumbers.length <= 8) {
      return `${limitedNumbers.slice(0, 2)}.${limitedNumbers.slice(2, 5)}.${limitedNumbers.slice(5)}`;
    } else if (limitedNumbers.length <= 12) {
      return `${limitedNumbers.slice(0, 2)}.${limitedNumbers.slice(2, 5)}.${limitedNumbers.slice(5, 8)}/${limitedNumbers.slice(8)}`;
    } else {
      return `${limitedNumbers.slice(0, 2)}.${limitedNumbers.slice(2, 5)}.${limitedNumbers.slice(5, 8)}/${limitedNumbers.slice(8, 12)}-${limitedNumbers.slice(12)}`;
    }
  };

  // Format Brazilian landline phone: (XX) XXXX-XXXX
  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    const limitedNumbers = numbers.slice(0, 10);
    
    if (limitedNumbers.length <= 2) {
      return limitedNumbers;
    } else if (limitedNumbers.length <= 6) {
      return `(${limitedNumbers.slice(0, 2)}) ${limitedNumbers.slice(2)}`;
    } else {
      return `(${limitedNumbers.slice(0, 2)}) ${limitedNumbers.slice(2, 6)}-${limitedNumbers.slice(6)}`;
    }
  };

  // Format Brazilian cellphone: (XX) XXXXX-XXXX
  const formatCellphone = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    const limitedNumbers = numbers.slice(0, 11);
    
    if (limitedNumbers.length <= 2) {
      return limitedNumbers;
    } else if (limitedNumbers.length <= 7) {
      return `(${limitedNumbers.slice(0, 2)}) ${limitedNumbers.slice(2)}`;
    } else {
      return `(${limitedNumbers.slice(0, 2)}) ${limitedNumbers.slice(2, 7)}-${limitedNumbers.slice(7)}`;
    }
  };

  // Validate email format
  const isValidEmail = (email: string) => {
    if (!email) return true; // Empty is valid (optional field)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleOpenDialog = (supplier?: Supplier) => {
    if (supplier) {
      setEditingSupplier(supplier);
      setFormData({
        name: supplier.name,
        address: supplier.address || "",
        phone: supplier.phone || "",
        cellphone: supplier.cellphone || "",
        email: supplier.email || "",
        cnpj: supplier.cnpj || "",
      });
    } else {
      setEditingSupplier(null);
      setFormData({ name: "", address: "", phone: "", cellphone: "", email: "", cnpj: "" });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingSupplier(null);
    setFormData({ name: "", address: "", phone: "", cellphone: "", email: "", cnpj: "" });
  };

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      toast({
        title: t("error", "Error"),
        description: t("supplier_name_required", "Supplier name is required"),
        variant: "destructive",
      });
      return;
    }

    if (formData.email && !isValidEmail(formData.email)) {
      toast({
        title: t("error", "Error"),
        description: t("invalid_email", "Please enter a valid email address"),
        variant: "destructive",
      });
      return;
    }

    if (editingSupplier) {
      updateMutation.mutate({ id: editingSupplier.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (supplier: Supplier) => {
    if (window.confirm(t("confirm_delete_supplier", "Are you sure you want to delete this supplier?"))) {
      deleteMutation.mutate(supplier.id);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">{t("suppliers", "Suppliers")}</h1>
          <p className="text-slate-400 mt-1">{t("manage_suppliers", "Manage your suppliers and vendors")}</p>
        </div>
        <Button
          onClick={() => handleOpenDialog()}
          className="bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600"
          data-testid="button-add-supplier"
        >
          <Plus className="w-4 h-4 mr-2" />
          {t("add_supplier", "Add Supplier")}
        </Button>
      </div>

      {/* Search */}
      <Card className="bg-slate-800/50 border-cyan-500/20">
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
            <Input
              placeholder={t("search_suppliers", "Search suppliers by name, CNPJ, or contact...")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-slate-900/50 border-slate-700 text-white"
              data-testid="input-search-suppliers"
            />
          </div>
        </CardContent>
      </Card>

      {/* Suppliers Grid */}
      {isLoading ? (
        <div className="text-center py-12 text-slate-400">Loading...</div>
      ) : filteredSuppliers.length === 0 ? (
        <Card className="bg-slate-800/50 border-cyan-500/20">
          <CardContent className="py-12">
            <div className="text-center">
              <Building2 className="w-16 h-16 mx-auto text-slate-600 mb-4" />
              <p className="text-slate-400 text-lg">{t("no_suppliers_found", "No suppliers found")}</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginatedSuppliers.map((supplier) => (
              <Card key={supplier.id} className="bg-slate-800/50 border-cyan-500/20 hover:border-cyan-500/40 transition-all" data-testid={`card-supplier-${supplier.id}`}>
              <CardHeader className="bg-gradient-to-r from-blue-900/50 to-cyan-900/50 pb-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Building2 className="w-5 h-5 text-cyan-400 flex-shrink-0" />
                    <CardTitle className="text-lg text-white truncate">{supplier.name}</CardTitle>
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenDialog(supplier)}
                      className="h-8 w-8 p-0 hover:bg-blue-500/20 hover:text-blue-400"
                      data-testid={`button-edit-${supplier.id}`}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(supplier)}
                      className="h-8 w-8 p-0 hover:bg-red-500/20 hover:text-red-400"
                      data-testid={`button-delete-${supplier.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                {supplier.cnpj && (
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-slate-400">{t("cnpj", "CNPJ")}</p>
                      <p className="text-sm text-slate-200 font-mono">{supplier.cnpj}</p>
                    </div>
                  </div>
                )}
                
                {supplier.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-slate-400">{t("phone", "Phone")}</p>
                      <p className="text-sm text-slate-200">{supplier.phone}</p>
                    </div>
                  </div>
                )}
                
                {supplier.cellphone && (
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-slate-400">{t("cellphone", "Cellphone")}</p>
                      <p className="text-sm text-slate-200">{supplier.cellphone}</p>
                    </div>
                  </div>
                )}
                
                {supplier.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-slate-400">{t("email", "Email")}</p>
                      <p className="text-sm text-slate-200 truncate">{supplier.email}</p>
                    </div>
                  </div>
                )}
                
                {supplier.address && (
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-xs text-slate-400">{t("address", "Address")}</p>
                      <p className="text-sm text-slate-200 line-clamp-2">{supplier.address}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Pagination Controls */}
        {filteredSuppliers.length > 0 && (
          <div className="flex items-center justify-between mt-6 px-2">
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <span>{t("page", "Page")} {currentPage} {t("of", "of")} {totalPages}</span>
              <span className="text-slate-600">•</span>
              <span>{filteredSuppliers.length} {t("items_per_page", "items total")}</span>
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
        </>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-slate-900 border-cyan-500/20 text-white max-w-2xl">
          <DialogHeader className="bg-gradient-to-r from-blue-900/50 to-cyan-900/50 -m-6 p-6 mb-6 border-b border-cyan-500/20">
            <DialogTitle className="text-xl font-bold text-white">
              {editingSupplier ? t("edit_supplier", "Edit Supplier") : t("add_supplier", "Add Supplier")}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="text-slate-300">{t("supplier_name", "Supplier Name")} *</Label>
              <div className="relative mt-1">
                <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <Input
                  placeholder={t("enter_supplier_name", "Enter supplier name")}
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="pl-10 bg-slate-800 border-slate-700 text-white"
                  data-testid="input-supplier-name"
                />
              </div>
            </div>

            <div>
              <Label className="text-slate-300">{t("cnpj", "CNPJ")}</Label>
              <div className="relative mt-1">
                <FileText className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <Input
                  placeholder={t("enter_cnpj", "Digite o CNPJ")}
                  value={formData.cnpj}
                  onChange={(e) => setFormData({ ...formData, cnpj: formatCNPJ(e.target.value) })}
                  className="pl-10 bg-slate-800 border-slate-700 text-white"
                  data-testid="input-supplier-cnpj"
                  maxLength={18}
                />
              </div>
            </div>

            <div>
              <Label className="text-slate-300">{t("phone", "Phone")}</Label>
              <div className="relative mt-1">
                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <Input
                  placeholder="(11) 1234-5678"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: formatPhone(e.target.value) })}
                  className="pl-10 bg-slate-800 border-slate-700 text-white"
                  data-testid="input-supplier-phone"
                  maxLength={14}
                />
              </div>
            </div>

            <div>
              <Label className="text-slate-300">{t("cellphone", "Cellphone")}</Label>
              <div className="relative mt-1">
                <Smartphone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <Input
                  placeholder="(11) 91234-5678"
                  value={formData.cellphone}
                  onChange={(e) => setFormData({ ...formData, cellphone: formatCellphone(e.target.value) })}
                  className="pl-10 bg-slate-800 border-slate-700 text-white"
                  data-testid="input-supplier-cellphone"
                  maxLength={15}
                />
              </div>
            </div>

            <div>
              <Label className="text-slate-300">{t("email", "Email")}</Label>
              <div className="relative mt-1">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <Input
                  type="email"
                  placeholder="supplier@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value.toLowerCase() })}
                  className={`pl-10 bg-slate-800 border-slate-700 text-white ${formData.email && !isValidEmail(formData.email) ? 'border-red-500' : ''}`}
                  data-testid="input-supplier-email"
                />
                {formData.email && !isValidEmail(formData.email) && (
                  <p className="text-red-400 text-xs mt-1">{t("invalid_email_format", "Invalid email format")}</p>
                )}
              </div>
            </div>

            <div>
              <Label className="text-slate-300">{t("address", "Address")}</Label>
              <div className="relative mt-1">
                <MapPin className="absolute left-3 top-3 text-slate-400 w-4 h-4" />
                <Textarea
                  placeholder={t("enter_address", "Enter full address")}
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="pl-10 bg-slate-800 border-slate-700 text-white min-h-[80px]"
                  data-testid="input-supplier-address"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 mt-6">
            <Button
              variant="outline"
              onClick={handleCloseDialog}
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
              data-testid="button-cancel"
            >
              {t("cancel", "Cancel")}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
              className="bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600"
              data-testid="button-save-supplier"
            >
              {editingSupplier ? t("update", "Update") : t("create", "Create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
