import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocalization } from "@/contexts/LocalizationContext";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { PermissionGate } from "@/components/PermissionGate";
import { PERMISSIONS } from "@shared/permissions";
import { format } from "date-fns";
import { 
  Users, 
  UserPlus, 
  Search, 
  Edit, 
  Trash2, 
  Eye, 
  Plus,
  Phone,
  Mail,
  MapPin,
  Calendar,
  DollarSign,
  ClipboardList,
  Star,
  TrendingUp,
  UserCheck
} from "lucide-react";
import type { Client } from "@shared/schema";

interface ClientStats {
  total: number;
  activeThisMonth: number;
  vipCount: number;
  newThisWeek: number;
}

interface ClientsResponse {
  clients: Client[];
  total: number;
}

interface ClientFormData {
  firstName: string;
  lastName: string;
  cpf: string;
  email: string;
  phone: string;
  streetAddress: string;
  streetNumber: string;
  apartment: string;
  birthday: string;
  notes: string;
  status: string;
  preferredLanguage: string;
  marketingOptIn: boolean;
  tags: string[];
}

const emptyFormData: ClientFormData = {
  firstName: "",
  lastName: "",
  cpf: "",
  email: "",
  phone: "",
  streetAddress: "",
  streetNumber: "",
  apartment: "",
  birthday: "",
  notes: "",
  status: "active",
  preferredLanguage: "en",
  marketingOptIn: false,
  tags: []
};

export default function Clients() {
  const { t, formatCurrency } = useLocalization();
  const { toast } = useToast();

  // State
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(25);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isProfileSheetOpen, setIsProfileSheetOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [formData, setFormData] = useState<ClientFormData>(emptyFormData);

  // Queries
  const { data: clientsData, isLoading: clientsLoading } = useQuery<ClientsResponse>({
    queryKey: ["/api/clients", { status: statusFilter, search: searchTerm, page: currentPage, limit: itemsPerPage }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (searchTerm) params.set("search", searchTerm);
      params.set("page", currentPage.toString());
      params.set("limit", itemsPerPage.toString());
      const response = await fetch(`/api/clients?${params.toString()}`, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch clients");
      return response.json();
    }
  });

  const { data: stats, isLoading: statsLoading } = useQuery<ClientStats>({
    queryKey: ["/api/clients/stats"]
  });

  const { data: clientTickets } = useQuery({
    queryKey: ["/api/clients", selectedClient?.id, "tickets"],
    queryFn: async () => {
      if (!selectedClient?.id) return [];
      const response = await fetch(`/api/clients/${selectedClient.id}/tickets`, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch client tickets");
      return response.json();
    },
    enabled: !!selectedClient?.id && isProfileSheetOpen
  });

  // Mutations
  const createClientMutation = useMutation({
    mutationFn: async (data: ClientFormData) => {
      const response = await apiRequest("POST", "/api/clients", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients/stats"] });
      setIsAddDialogOpen(false);
      setFormData(emptyFormData);
      toast({
        title: t("success", "Success"),
        description: t("client_created_successfully", "Client created successfully")
      });
    },
    onError: () => {
      toast({
        title: t("error", "Error"),
        description: t("client_creation_failed", "Failed to create client"),
        variant: "destructive"
      });
    }
  });

  const updateClientMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ClientFormData> }) => {
      const response = await apiRequest("PUT", `/api/clients/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients/stats"] });
      setIsEditDialogOpen(false);
      setSelectedClient(null);
      setFormData(emptyFormData);
      toast({
        title: t("success", "Success"),
        description: t("client_updated_successfully", "Client updated successfully")
      });
    },
    onError: () => {
      toast({
        title: t("error", "Error"),
        description: t("client_update_failed", "Failed to update client"),
        variant: "destructive"
      });
    }
  });

  const deleteClientMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/clients/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients/stats"] });
      setIsDeleteDialogOpen(false);
      setSelectedClient(null);
      toast({
        title: t("success", "Success"),
        description: t("client_deleted_successfully", "Client deleted successfully")
      });
    },
    onError: (error: any) => {
      toast({
        title: t("error", "Error"),
        description: error.message || t("client_deletion_failed", "Failed to delete client"),
        variant: "destructive"
      });
    }
  });

  // Handlers
  const handleOpenAddDialog = () => {
    setFormData(emptyFormData);
    setIsAddDialogOpen(true);
  };

  const handleOpenEditDialog = (client: Client) => {
    setSelectedClient(client);
    setFormData({
      firstName: client.firstName || "",
      lastName: client.lastName || "",
      cpf: client.cpf || "",
      email: client.email || "",
      phone: client.phone || "",
      streetAddress: client.streetAddress || "",
      streetNumber: client.streetNumber || "",
      apartment: client.apartment || "",
      birthday: client.birthday || "",
      notes: client.notes || "",
      status: client.status || "active",
      preferredLanguage: client.preferredLanguage || "en",
      marketingOptIn: client.marketingOptIn || false,
      tags: client.tags || []
    });
    setIsEditDialogOpen(true);
  };

  const handleOpenProfileSheet = (client: Client) => {
    setSelectedClient(client);
    setIsProfileSheetOpen(true);
  };

  const handleOpenDeleteDialog = (client: Client) => {
    setSelectedClient(client);
    setIsDeleteDialogOpen(true);
  };

  const handleCreateClient = () => {
    createClientMutation.mutate(formData);
  };

  const handleUpdateClient = () => {
    if (selectedClient) {
      updateClientMutation.mutate({ id: selectedClient.id, data: formData });
    }
  };

  const handleDeleteClient = () => {
    if (selectedClient) {
      deleteClientMutation.mutate(selectedClient.id);
    }
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return "-";
    return format(new Date(date), "MMM dd, yyyy");
  };

  const getStatusBadgeVariant = (status: string | null) => {
    switch (status) {
      case "vip": return "default";
      case "active": return "secondary";
      case "inactive": return "outline";
      default: return "secondary";
    }
  };

  const totalPages = Math.ceil((clientsData?.total || 0) / itemsPerPage);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#00FFFF]">{t("clients", "Clients")}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {t("clients_description", "Manage your customer database and view repair history")}
          </p>
        </div>
        <PermissionGate permission={PERMISSIONS.CLIENTS_CREATE}>
          <Button 
            onClick={handleOpenAddDialog}
            className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500"
            data-testid="button-add-client"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            {t("add_client", "Add Client")}
          </Button>
        </PermissionGate>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-slate-800/50 border-cyan-500/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm font-medium">{t("total_clients", "Total Clients")}</p>
                {statsLoading ? (
                  <Skeleton className="h-8 w-16 mt-1" />
                ) : (
                  <p className="text-3xl font-bold text-white" data-testid="text-stat-total-clients">
                    {stats?.total || 0}
                  </p>
                )}
              </div>
              <div className="p-3 bg-cyan-500/10 rounded-lg">
                <Users className="w-6 h-6 text-cyan-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-cyan-500/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm font-medium">{t("active_this_month", "Active This Month")}</p>
                {statsLoading ? (
                  <Skeleton className="h-8 w-16 mt-1" />
                ) : (
                  <p className="text-3xl font-bold text-green-400" data-testid="text-stat-active-clients">
                    {stats?.activeThisMonth || 0}
                  </p>
                )}
              </div>
              <div className="p-3 bg-green-500/10 rounded-lg">
                <TrendingUp className="w-6 h-6 text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-cyan-500/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm font-medium">{t("vip_clients", "VIP Clients")}</p>
                {statsLoading ? (
                  <Skeleton className="h-8 w-16 mt-1" />
                ) : (
                  <p className="text-3xl font-bold text-yellow-400" data-testid="text-stat-vip-clients">
                    {stats?.vipCount || 0}
                  </p>
                )}
              </div>
              <div className="p-3 bg-yellow-500/10 rounded-lg">
                <Star className="w-6 h-6 text-yellow-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-cyan-500/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm font-medium">{t("new_this_week", "New This Week")}</p>
                {statsLoading ? (
                  <Skeleton className="h-8 w-16 mt-1" />
                ) : (
                  <p className="text-3xl font-bold text-blue-400" data-testid="text-stat-new-clients">
                    {stats?.newThisWeek || 0}
                  </p>
                )}
              </div>
              <div className="p-3 bg-blue-500/10 rounded-lg">
                <UserCheck className="w-6 h-6 text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card className="bg-slate-800/50 border-cyan-500/20">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder={t("search_clients", "Search clients by name, CPF, email or phone...")}
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-10 bg-slate-900/50 border-cyan-500/20"
                data-testid="input-search-clients"
              />
            </div>
            <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value); setCurrentPage(1); }}>
              <SelectTrigger className="w-full md:w-48 bg-slate-900/50 border-cyan-500/20" data-testid="select-status-filter">
                <SelectValue placeholder={t("filter_by_status", "Filter by status")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("all_statuses", "All Statuses")}</SelectItem>
                <SelectItem value="active">{t("active", "Active")}</SelectItem>
                <SelectItem value="inactive">{t("inactive", "Inactive")}</SelectItem>
                <SelectItem value="vip">{t("vip", "VIP")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Clients Table */}
      <Card className="bg-slate-800/50 border-cyan-500/20">
        <CardHeader className="border-b border-cyan-500/20">
          <CardTitle className="text-lg font-semibold text-white">
            {t("client_list", "Client List")}
            <span className="text-muted-foreground text-sm font-normal ml-2">
              ({clientsData?.total || 0} {t("total", "total")})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {clientsLoading ? (
            <div className="p-6 space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : clientsData?.clients?.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">{t("no_clients_found", "No clients found")}</h3>
              <p className="text-muted-foreground text-sm">
                {searchTerm || statusFilter !== "all" 
                  ? t("try_different_search", "Try adjusting your search or filters")
                  : t("add_first_client", "Add your first client to get started")}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-cyan-500/20 hover:bg-transparent">
                  <TableHead className="text-cyan-400">{t("name", "Name")}</TableHead>
                  <TableHead className="text-cyan-400">{t("cpf", "CPF")}</TableHead>
                  <TableHead className="text-cyan-400">{t("phone", "Phone")}</TableHead>
                  <TableHead className="text-cyan-400">{t("email", "Email")}</TableHead>
                  <TableHead className="text-cyan-400">{t("last_visit", "Last Visit")}</TableHead>
                  <TableHead className="text-cyan-400">{t("total_spent", "Total Spent")}</TableHead>
                  <TableHead className="text-cyan-400">{t("status", "Status")}</TableHead>
                  <TableHead className="text-cyan-400 text-right">{t("actions", "Actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientsData?.clients?.map((client) => (
                  <TableRow 
                    key={client.id} 
                    className="border-cyan-500/10 hover:bg-slate-700/30 cursor-pointer"
                    onClick={() => handleOpenProfileSheet(client)}
                    data-testid={`row-client-${client.id}`}
                  >
                    <TableCell className="font-medium text-white">
                      {client.firstName} {client.lastName}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {client.cpf || "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {client.phone || "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {client.email || "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(client.lastVisitAt)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatCurrency((client.totalSpendCents || 0) / 100)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(client.status)}>
                        {client.status === "vip" ? "VIP" : client.status === "active" ? t("active", "Active") : t("inactive", "Inactive")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleOpenProfileSheet(client)}
                          data-testid={`button-view-client-${client.id}`}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <PermissionGate permission={PERMISSIONS.CLIENTS_UPDATE}>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleOpenEditDialog(client)}
                            data-testid={`button-edit-client-${client.id}`}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                        </PermissionGate>
                        <PermissionGate permission={PERMISSIONS.CLIENTS_DELETE}>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="text-red-400 hover:text-red-300"
                            onClick={() => handleOpenDeleteDialog(client)}
                            data-testid={`button-delete-client-${client.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </PermissionGate>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t border-cyan-500/20">
              <p className="text-sm text-muted-foreground">
                {t("showing_page", "Showing page")} {currentPage} {t("of", "of")} {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  data-testid="button-prev-page"
                >
                  {t("previous", "Previous")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  data-testid="button-next-page"
                >
                  {t("next", "Next")}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Client Dialog */}
      <Dialog open={isAddDialogOpen || isEditDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setIsAddDialogOpen(false);
          setIsEditDialogOpen(false);
          setFormData(emptyFormData);
          setSelectedClient(null);
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-gradient-to-br from-[#0A192F] to-slate-900">
          <DialogHeader className="border-b border-cyan-500/20 pb-4">
            <DialogTitle className="text-xl font-bold text-[#00FFFF]">
              {isEditDialogOpen ? t("edit_client", "Edit Client") : t("add_new_client", "Add New Client")}
            </DialogTitle>
            <DialogDescription className="text-slate-300">
              {isEditDialogOpen 
                ? t("edit_client_description", "Update client information")
                : t("add_client_description", "Fill in the details to add a new client")}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="firstName" className="text-cyan-400">{t("first_name", "First Name")} *</Label>
              <Input
                id="firstName"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                className="bg-slate-900/50 border-cyan-500/20"
                data-testid="input-first-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName" className="text-cyan-400">{t("last_name", "Last Name")} *</Label>
              <Input
                id="lastName"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                className="bg-slate-900/50 border-cyan-500/20"
                data-testid="input-last-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cpf" className="text-cyan-400">{t("cpf", "CPF")}</Label>
              <Input
                id="cpf"
                value={formData.cpf}
                onChange={(e) => setFormData({ ...formData, cpf: e.target.value.replace(/\D/g, "").slice(0, 11) })}
                placeholder="00000000000"
                className="bg-slate-900/50 border-cyan-500/20"
                data-testid="input-cpf"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-cyan-400">{t("email", "Email")}</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="bg-slate-900/50 border-cyan-500/20"
                data-testid="input-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-cyan-400">{t("phone", "Phone")}</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="bg-slate-900/50 border-cyan-500/20"
                data-testid="input-phone"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="birthday" className="text-cyan-400">{t("birthday", "Birthday")}</Label>
              <Input
                id="birthday"
                value={formData.birthday}
                onChange={(e) => setFormData({ ...formData, birthday: e.target.value })}
                placeholder="DD/MM"
                className="bg-slate-900/50 border-cyan-500/20"
                data-testid="input-birthday"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="streetAddress" className="text-cyan-400">{t("street_address", "Street Address")}</Label>
              <Input
                id="streetAddress"
                value={formData.streetAddress}
                onChange={(e) => setFormData({ ...formData, streetAddress: e.target.value })}
                className="bg-slate-900/50 border-cyan-500/20"
                data-testid="input-street-address"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="streetNumber" className="text-cyan-400">{t("street_number", "Number")}</Label>
              <Input
                id="streetNumber"
                value={formData.streetNumber}
                onChange={(e) => setFormData({ ...formData, streetNumber: e.target.value })}
                className="bg-slate-900/50 border-cyan-500/20"
                data-testid="input-street-number"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="apartment" className="text-cyan-400">{t("apartment", "Apartment")}</Label>
              <Input
                id="apartment"
                value={formData.apartment}
                onChange={(e) => setFormData({ ...formData, apartment: e.target.value })}
                className="bg-slate-900/50 border-cyan-500/20"
                data-testid="input-apartment"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status" className="text-cyan-400">{t("status", "Status")}</Label>
              <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                <SelectTrigger className="bg-slate-900/50 border-cyan-500/20" data-testid="select-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">{t("active", "Active")}</SelectItem>
                  <SelectItem value="inactive">{t("inactive", "Inactive")}</SelectItem>
                  <SelectItem value="vip">{t("vip", "VIP")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="preferredLanguage" className="text-cyan-400">{t("preferred_language", "Preferred Language")}</Label>
              <Select value={formData.preferredLanguage} onValueChange={(value) => setFormData({ ...formData, preferredLanguage: value })}>
                <SelectTrigger className="bg-slate-900/50 border-cyan-500/20" data-testid="select-language">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">{t("english", "English")}</SelectItem>
                  <SelectItem value="pt-BR">{t("portuguese", "Portuguese")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="notes" className="text-cyan-400">{t("notes", "Notes")}</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="bg-slate-900/50 border-cyan-500/20 min-h-[100px]"
                data-testid="textarea-notes"
              />
            </div>
            <div className="flex items-center space-x-2 md:col-span-2">
              <Switch
                id="marketingOptIn"
                checked={formData.marketingOptIn}
                onCheckedChange={(checked) => setFormData({ ...formData, marketingOptIn: checked })}
                data-testid="switch-marketing"
              />
              <Label htmlFor="marketingOptIn" className="text-slate-300">
                {t("marketing_opt_in", "Receive marketing communications")}
              </Label>
            </div>
          </div>

          <DialogFooter className="border-t border-cyan-500/20 pt-4">
            <Button 
              variant="outline" 
              onClick={() => {
                setIsAddDialogOpen(false);
                setIsEditDialogOpen(false);
              }}
              data-testid="button-cancel"
            >
              {t("cancel", "Cancel")}
            </Button>
            <Button 
              onClick={isEditDialogOpen ? handleUpdateClient : handleCreateClient}
              disabled={!formData.firstName || !formData.lastName || createClientMutation.isPending || updateClientMutation.isPending}
              className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500"
              data-testid="button-save-client"
            >
              {createClientMutation.isPending || updateClientMutation.isPending 
                ? t("saving", "Saving...") 
                : isEditDialogOpen ? t("update", "Update") : t("create", "Create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="bg-gradient-to-br from-[#0A192F] to-slate-900 border-cyan-500/20">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">{t("delete_client", "Delete Client")}</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-300">
              {t("delete_client_confirmation", "Are you sure you want to delete this client? This action cannot be undone.")}
              {selectedClient && (
                <span className="block mt-2 font-medium text-white">
                  {selectedClient.firstName} {selectedClient.lastName}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">{t("cancel", "Cancel")}</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteClient}
              className="bg-red-600 hover:bg-red-700"
              data-testid="button-confirm-delete"
            >
              {deleteClientMutation.isPending ? t("deleting", "Deleting...") : t("delete", "Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Client Profile Sheet */}
      <Sheet open={isProfileSheetOpen} onOpenChange={setIsProfileSheetOpen}>
        <SheetContent className="w-full sm:max-w-xl bg-gradient-to-br from-[#0A192F] to-slate-900 border-l border-cyan-500/20 overflow-y-auto">
          <SheetHeader className="border-b border-cyan-500/20 pb-4">
            <SheetTitle className="text-xl font-bold text-[#00FFFF]">
              {selectedClient?.firstName} {selectedClient?.lastName}
            </SheetTitle>
            <SheetDescription className="text-slate-300">
              <Badge variant={getStatusBadgeVariant(selectedClient?.status || null)} className="mr-2">
                {selectedClient?.status === "vip" ? "VIP" : selectedClient?.status === "active" ? t("active", "Active") : t("inactive", "Inactive")}
              </Badge>
              {t("client_since", "Client since")} {formatDate(selectedClient?.createdAt)}
            </SheetDescription>
          </SheetHeader>

          <Tabs defaultValue="summary" className="mt-6">
            <TabsList className="grid w-full grid-cols-3 bg-slate-800/50">
              <TabsTrigger value="summary" data-testid="tab-summary">{t("summary", "Summary")}</TabsTrigger>
              <TabsTrigger value="tickets" data-testid="tab-tickets">{t("tickets", "Tickets")}</TabsTrigger>
              <TabsTrigger value="notes" data-testid="tab-notes">{t("notes", "Notes")}</TabsTrigger>
            </TabsList>

            <TabsContent value="summary" className="space-y-4 mt-4">
              {/* Contact Info */}
              <Card className="bg-slate-800/30 border-cyan-500/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-cyan-400">{t("contact_info", "Contact Information")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {selectedClient?.phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      <span className="text-white">{selectedClient.phone}</span>
                    </div>
                  )}
                  {selectedClient?.email && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      <span className="text-white">{selectedClient.email}</span>
                    </div>
                  )}
                  {(selectedClient?.streetAddress || selectedClient?.streetNumber) && (
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="w-4 h-4 text-muted-foreground" />
                      <span className="text-white">
                        {selectedClient.streetAddress} {selectedClient.streetNumber}
                        {selectedClient.apartment && `, ${selectedClient.apartment}`}
                      </span>
                    </div>
                  )}
                  {selectedClient?.birthday && (
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <span className="text-white">{selectedClient.birthday}</span>
                    </div>
                  )}
                  {selectedClient?.cpf && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground">{t("cpf", "CPF")}:</span>
                      <span className="text-white">{selectedClient.cpf}</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Metrics */}
              <div className="grid grid-cols-2 gap-4">
                <Card className="bg-slate-800/30 border-cyan-500/20">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <DollarSign className="w-4 h-4 text-green-400" />
                      <span className="text-xs text-muted-foreground">{t("total_spent", "Total Spent")}</span>
                    </div>
                    <p className="text-xl font-bold text-white">
                      {formatCurrency((selectedClient?.totalSpendCents || 0) / 100)}
                    </p>
                  </CardContent>
                </Card>
                <Card className="bg-slate-800/30 border-cyan-500/20">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <ClipboardList className="w-4 h-4 text-blue-400" />
                      <span className="text-xs text-muted-foreground">{t("total_tickets", "Total Tickets")}</span>
                    </div>
                    <p className="text-xl font-bold text-white">
                      {selectedClient?.ticketCount || 0}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Quick Actions */}
              <Card className="bg-slate-800/30 border-cyan-500/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-cyan-400">{t("quick_actions", "Quick Actions")}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      setIsProfileSheetOpen(false);
                      handleOpenEditDialog(selectedClient!);
                    }}
                    data-testid="button-quick-edit"
                  >
                    <Edit className="w-4 h-4 mr-1" />
                    {t("edit", "Edit")}
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      window.location.href = `/kanban?clientId=${selectedClient?.id}`;
                    }}
                    data-testid="button-quick-ticket"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    {t("new_ticket", "New Ticket")}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="tickets" className="mt-4">
              {clientTickets?.length === 0 ? (
                <div className="text-center py-8">
                  <ClipboardList className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">{t("no_tickets_for_client", "No tickets found for this client")}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {clientTickets?.map((ticket: any) => (
                    <Card key={ticket.id} className="bg-slate-800/30 border-cyan-500/20">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium text-white text-sm">{ticket.title}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {formatDate(ticket.createdAt)}
                            </p>
                          </div>
                          <Badge variant={ticket.status === "finalized" ? "default" : "secondary"}>
                            {ticket.status}
                          </Badge>
                        </div>
                        {ticket.finalActualCost && (
                          <p className="text-sm text-green-400 mt-2">
                            {formatCurrency(parseFloat(ticket.finalActualCost))}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="notes" className="mt-4">
              <Card className="bg-slate-800/30 border-cyan-500/20">
                <CardContent className="p-4">
                  {selectedClient?.notes ? (
                    <p className="text-sm text-white whitespace-pre-wrap">{selectedClient.notes}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">{t("no_notes", "No notes added for this client")}</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>
    </div>
  );
}
