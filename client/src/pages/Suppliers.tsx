import { useState, useMemo } from "react";
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
import { Plus, Edit, Trash2, Search, Building2, Phone, MapPin, FileText } from "lucide-react";
import { Label } from "@/components/ui/label";

interface Supplier {
  id: string;
  tenantId: string;
  name: string;
  address: string | null;
  contactInfo: string | null;
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
  const [formData, setFormData] = useState({
    name: "",
    address: "",
    contactInfo: "",
    cnpj: "",
  });

  // Fetch suppliers
  const { data: suppliers = [], isLoading } = useQuery<Supplier[]>({
    queryKey: ["/api/suppliers"],
  });

  // Filter suppliers
  const filteredSuppliers = useMemo(() => {
    return suppliers.filter(supplier => 
      supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (supplier.cnpj && supplier.cnpj.includes(searchTerm)) ||
      (supplier.contactInfo && supplier.contactInfo.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [suppliers, searchTerm]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: Partial<Supplier>) => {
      return await apiRequest("/api/suppliers", {
        method: "POST",
        body: JSON.stringify(data),
      });
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
      return await apiRequest(`/api/suppliers/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
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
      return await apiRequest(`/api/suppliers/${id}`, {
        method: "DELETE",
      });
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

  const handleOpenDialog = (supplier?: Supplier) => {
    if (supplier) {
      setEditingSupplier(supplier);
      setFormData({
        name: supplier.name,
        address: supplier.address || "",
        contactInfo: supplier.contactInfo || "",
        cnpj: supplier.cnpj || "",
      });
    } else {
      setEditingSupplier(null);
      setFormData({ name: "", address: "", contactInfo: "", cnpj: "" });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingSupplier(null);
    setFormData({ name: "", address: "", contactInfo: "", cnpj: "" });
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

      {/* Suppliers Table */}
      <Card className="bg-slate-800/50 border-cyan-500/20">
        <CardHeader className="bg-gradient-to-r from-slate-900 to-slate-800 border-b border-cyan-500/20">
          <CardTitle className="text-white flex items-center gap-2">
            <Building2 className="w-5 h-5 text-cyan-400" />
            {t("supplier_list", "Supplier List")}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="text-center py-8 text-slate-400">Loading...</div>
          ) : filteredSuppliers.length === 0 ? (
            <div className="text-center py-8">
              <Building2 className="w-12 h-12 mx-auto text-slate-600 mb-3" />
              <p className="text-slate-400">{t("no_suppliers_found", "No suppliers found")}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-700">
                    <TableHead className="text-slate-300">{t("name", "Name")}</TableHead>
                    <TableHead className="text-slate-300">{t("cnpj", "CNPJ")}</TableHead>
                    <TableHead className="text-slate-300">{t("contact", "Contact")}</TableHead>
                    <TableHead className="text-slate-300">{t("address", "Address")}</TableHead>
                    <TableHead className="text-slate-300">{t("actions", "Actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSuppliers.map((supplier) => (
                    <TableRow key={supplier.id} className="border-slate-700" data-testid={`row-supplier-${supplier.id}`}>
                      <TableCell className="text-white font-medium">{supplier.name}</TableCell>
                      <TableCell className="text-slate-300">{supplier.cnpj || "-"}</TableCell>
                      <TableCell className="text-slate-300">{supplier.contactInfo || "-"}</TableCell>
                      <TableCell className="text-slate-300">{supplier.address || "-"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenDialog(supplier)}
                            className="hover:bg-blue-500/20 hover:text-blue-400"
                            data-testid={`button-edit-${supplier.id}`}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(supplier)}
                            className="hover:bg-red-500/20 hover:text-red-400"
                            data-testid={`button-delete-${supplier.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
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
                  placeholder={t("enter_cnpj", "Enter CNPJ")}
                  value={formData.cnpj}
                  onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                  className="pl-10 bg-slate-800 border-slate-700 text-white"
                  data-testid="input-supplier-cnpj"
                />
              </div>
            </div>

            <div>
              <Label className="text-slate-300">{t("contact_info", "Contact Information")}</Label>
              <div className="relative mt-1">
                <Phone className="absolute left-3 top-3 text-slate-400 w-4 h-4" />
                <Textarea
                  placeholder={t("enter_contact_info", "Enter phone, email, or other contact details")}
                  value={formData.contactInfo}
                  onChange={(e) => setFormData({ ...formData, contactInfo: e.target.value })}
                  className="pl-10 bg-slate-800 border-slate-700 text-white min-h-[80px]"
                  data-testid="input-supplier-contact"
                />
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
