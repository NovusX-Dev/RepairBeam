import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocalization } from "@/contexts/LocalizationContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { 
  Clock, 
  DollarSign, 
  Search, 
  Filter, 
  X, 
  Smartphone, 
  Laptop, 
  Monitor,
  User,
  FileText,
  CheckSquare,
  Shield,
  Calendar as CalendarIcon,
  Wrench,
  MessageSquare
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from 'date-fns/locale';
import type { Ticket, Client, RepairService } from "@shared/schema";
import { formatCurrency as formatCurrencyFromUtility, type Locale } from "@shared/money";

// Extended ticket type with client info
type TicketWithClient = Ticket & { client: Client };

// Device icon helper
const getDeviceIcon = (deviceType: string) => {
  switch (deviceType?.toLowerCase()) {
    case 'phone': return Smartphone;
    case 'laptop': return Laptop;
    case 'desktop': return Monitor;
    default: return Smartphone;
  }
};

export default function CompletedHistory() {
  const { t, currentLanguage } = useLocalization();
  const locale: Locale = currentLanguage.code === 'pt-BR' ? 'pt-BR' : 'en';
  
  // State management
  const [searchTerm, setSearchTerm] = useState("");
  const [deviceTypeFilter, setDeviceTypeFilter] = useState<string>("all");
  const [dateRangeFilter, setDateRangeFilter] = useState<string>("all");
  const [selectedTicket, setSelectedTicket] = useState<TicketWithClient | null>(null);

  // Fetch all tickets
  const { data: allTickets = [], isLoading } = useQuery<TicketWithClient[]>({
    queryKey: ["/api/tickets"],
  });

  // Fetch repair services for service name mapping
  const { data: repairServices = [] } = useQuery<RepairService[]>({
    queryKey: ["/api/repair-services"],
  });

  // Filter only finalized tickets
  const finalizedTickets = useMemo(() => {
    return allTickets.filter(ticket => ticket.status === 'finalized');
  }, [allTickets]);

  // Apply filters
  const filteredTickets = useMemo(() => {
    let filtered = finalizedTickets;

    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(ticket =>
        ticket.client?.firstName?.toLowerCase().includes(searchLower) ||
        ticket.client?.lastName?.toLowerCase().includes(searchLower) ||
        ticket.deviceModel?.toLowerCase().includes(searchLower) ||
        ticket.id?.toLowerCase().includes(searchLower)
      );
    }

    // Device type filter
    if (deviceTypeFilter !== "all") {
      filtered = filtered.filter(ticket => ticket.deviceType === deviceTypeFilter);
    }

    // Date range filter
    if (dateRangeFilter !== "all") {
      const now = new Date();

      switch (dateRangeFilter) {
        case "7days":
          filtered = filtered.filter(t => {
            if (!t.completedAt) return false;
            const diff = Math.floor((now.getTime() - new Date(t.completedAt).getTime()) / (1000 * 60 * 60 * 24));
            return diff <= 7;
          });
          break;
        case "30days":
          filtered = filtered.filter(t => {
            if (!t.completedAt) return false;
            const diff = Math.floor((now.getTime() - new Date(t.completedAt).getTime()) / (1000 * 60 * 60 * 24));
            return diff <= 30;
          });
          break;
        case "90days":
          filtered = filtered.filter(t => {
            if (!t.completedAt) return false;
            const diff = Math.floor((now.getTime() - new Date(t.completedAt).getTime()) / (1000 * 60 * 60 * 24));
            return diff <= 90;
          });
          break;
        case "1year":
          filtered = filtered.filter(t => {
            if (!t.completedAt) return false;
            const diff = Math.floor((now.getTime() - new Date(t.completedAt).getTime()) / (1000 * 60 * 60 * 24));
            return diff <= 365;
          });
          break;
      }
    }

    // Sort by completion date (newest first)
    return filtered.sort((a, b) => {
      if (!a.completedAt || !b.completedAt) return 0;
      return new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime();
    });
  }, [finalizedTickets, searchTerm, deviceTypeFilter, dateRangeFilter]);

  // Format currency helper
  const formatCurrency = (amount: string | number | null | undefined) => {
    if (!amount) return formatCurrencyFromUtility(0, locale);
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    return formatCurrencyFromUtility(Math.round(numAmount * 100), locale);
  };

  // Format date helper
  const formatDate = (dateString: string | Date | null | undefined) => {
    if (!dateString) return t("not_available", "N/A");
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    return format(date, "PPP", { locale: locale === 'pt-BR' ? ptBR : undefined });
  };

  // Get service name by ID
  const getServiceName = (serviceId: string) => {
    const service = repairServices.find(s => s.id === serviceId);
    return service ? service.name : serviceId;
  };

  // Calculate warranty expiration date
  const getWarrantyExpirationDate = (completedAt: string | Date | null | undefined, warrantyType: string | null | undefined) => {
    if (!completedAt || !warrantyType) return null;
    const completionDate = typeof completedAt === 'string' ? new Date(completedAt) : completedAt;
    const expirationDate = new Date(completionDate);
    
    // Add months based on warranty type
    const monthsToAdd = warrantyType === 'extended' ? 6 : 3;
    expirationDate.setMonth(expirationDate.getMonth() + monthsToAdd);
    
    return expirationDate;
  };

  // Check if warranty has expired
  const isWarrantyExpired = (completedAt: string | Date | null | undefined, warrantyType: string | null | undefined) => {
    const expirationDate = getWarrantyExpirationDate(completedAt, warrantyType);
    if (!expirationDate) return false;
    return new Date() > expirationDate;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header with Aurora gradient */}
        <Card className="bg-slate-800/70 rounded-xl shadow-lg border border-[#00FFFF]/20 overflow-hidden">
          <div className="bg-gradient-to-r from-[#0A192F] to-[#00FFFF] px-6 py-6">
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <CheckSquare className="w-8 h-8" />
              {t("completed_history", "Completed History")}
            </h1>
            <p className="text-cyan-100 text-sm mt-2">
              {t("completed_history_desc", "View all completed repair tickets with full details")}
            </p>
          </div>

          {/* Filters Section */}
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Search */}
              <div className="md:col-span-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    placeholder={t("search_tickets", "Search by client, device, or ticket ID...")}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-slate-700/50 border-[#00FFFF]/20 text-white"
                    data-testid="input-search-tickets"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm("")}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Device Type Filter */}
              <Select value={deviceTypeFilter} onValueChange={setDeviceTypeFilter}>
                <SelectTrigger className="bg-slate-700/50 border-[#00FFFF]/20 text-white" data-testid="select-device-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("all_devices", "All Devices")}</SelectItem>
                  <SelectItem value="Phone">{t("phone", "Phone")}</SelectItem>
                  <SelectItem value="Laptop">{t("laptop", "Laptop")}</SelectItem>
                  <SelectItem value="Desktop">{t("desktop", "Desktop")}</SelectItem>
                </SelectContent>
              </Select>

              {/* Date Range Filter */}
              <Select value={dateRangeFilter} onValueChange={setDateRangeFilter}>
                <SelectTrigger className="bg-slate-700/50 border-[#00FFFF]/20 text-white" data-testid="select-date-range">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("all_time", "All Time")}</SelectItem>
                  <SelectItem value="7days">{t("last_7_days", "Last 7 Days")}</SelectItem>
                  <SelectItem value="30days">{t("last_30_days", "Last 30 Days")}</SelectItem>
                  <SelectItem value="90days">{t("last_90_days", "Last 90 Days")}</SelectItem>
                  <SelectItem value="1year">{t("last_year", "Last Year")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-4 text-sm">
              <span className="text-cyan-400 font-medium">
                {filteredTickets.length} {t("tickets_found", "tickets found")}
              </span>
              {(searchTerm || deviceTypeFilter !== "all" || dateRangeFilter !== "all") && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchTerm("");
                    setDeviceTypeFilter("all");
                    setDateRangeFilter("all");
                  }}
                  className="text-cyan-400 hover:text-cyan-300"
                  data-testid="button-clear-filters"
                >
                  <X className="w-4 h-4 mr-1" />
                  {t("clear_filters", "Clear Filters")}
                </Button>
              )}
            </div>
          </div>
        </Card>

        {/* Tickets List */}
        {isLoading ? (
          <div className="text-center py-12 text-cyan-400">
            <Clock className="w-8 h-8 animate-spin mx-auto mb-2" />
            <p>{t("loading", "Loading...")}</p>
          </div>
        ) : filteredTickets.length === 0 ? (
          <Card className="bg-slate-800/70 p-12 text-center border border-[#00FFFF]/20">
            <FileText className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-medium text-white mb-2">
              {t("no_completed_tickets", "No Completed Tickets Found")}
            </h3>
            <p className="text-muted-foreground">
              {searchTerm || deviceTypeFilter !== "all" || dateRangeFilter !== "all"
                ? t("try_different_filters", "Try adjusting your filters or search terms")
                : t("no_tickets_yet", "Completed tickets will appear here")}
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTickets.map((ticket) => {
              const DeviceIcon = getDeviceIcon(ticket.deviceType || 'phone');
              return (
                <Card
                  key={ticket.id}
                  className="bg-slate-800/70 border border-[#00FFFF]/20 hover:border-[#00FFFF]/40 transition-all cursor-pointer overflow-hidden"
                  onClick={() => setSelectedTicket(ticket)}
                  data-testid={`card-ticket-${ticket.id}`}
                >
                  {/* Card Header with gradient */}
                  <div className="bg-gradient-to-r from-[#0A192F] to-[#00FFFF]/20 px-4 py-3 border-b border-[#00FFFF]/20">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <DeviceIcon className="w-5 h-5 text-cyan-400" />
                        <span className="text-white font-medium">
                          {ticket.deviceModel || t("unknown_device", "Unknown Device")}
                        </span>
                      </div>
                      {ticket.warrantyType && (
                        <Badge variant="outline" className="bg-green-950/50 text-green-400 border-green-600">
                          <Shield className="w-3 h-3 mr-1" />
                          {ticket.warrantyType === 'standard' ? t("standard", "Standard") : t("extended", "Extended")}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Card Content */}
                  <div className="p-4 space-y-3">
                    {/* Client Info */}
                    <div className="flex items-center gap-2 text-sm">
                      <User className="w-4 h-4 text-cyan-400" />
                      <span className="text-white font-medium">
                        {ticket.client?.firstName} {ticket.client?.lastName}
                      </span>
                    </div>

                    {/* Completion Date */}
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CalendarIcon className="w-4 h-4" />
                      <span>{formatDate(ticket.completedAt)}</span>
                    </div>

                    {/* Metrics */}
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-700">
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="w-4 h-4 text-cyan-400" />
                        <span className="text-white">{ticket.actualHours || ticket.technicianEstimatedHours}h</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <DollarSign className="w-4 h-4 text-green-400" />
                        <span className="text-white font-medium">
                          {formatCurrency(ticket.finalActualCost || ticket.totalCost)}
                        </span>
                      </div>
                    </div>

                    {/* Services Count */}
                    {ticket.selectedServices && Array.isArray(ticket.selectedServices) && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Wrench className="w-4 h-4" />
                        <span>
                          {ticket.selectedServices.length} {t("services", "services")}
                        </span>
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Ticket Details Dialog */}
      <Dialog open={!!selectedTicket} onOpenChange={(open) => !open && setSelectedTicket(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-slate-900 border-[#00FFFF]/20">
          {selectedTicket && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold text-white flex items-center gap-3">
                  <CheckSquare className="w-6 h-6 text-green-400" />
                  {t("ticket_details", "Ticket Details")}
                </DialogTitle>
                <DialogDescription className="text-cyan-400">
                  {t("completed_on", "Completed on")} {formatDate(selectedTicket.completedAt)}
                </DialogDescription>
              </DialogHeader>

              <Tabs defaultValue="summary" className="w-full">
                <TabsList className="grid w-full grid-cols-3 bg-slate-800">
                  <TabsTrigger value="summary">{t("summary", "Summary")}</TabsTrigger>
                  <TabsTrigger value="services">{t("services", "Services")}</TabsTrigger>
                  <TabsTrigger value="completion">{t("completion_details", "Completion")}</TabsTrigger>
                </TabsList>

                {/* Summary Tab */}
                <TabsContent value="summary" className="space-y-4 mt-4">
                  <Card className="bg-slate-800/50 border-[#00FFFF]/20 p-4">
                    <h3 className="text-lg font-semibold text-white mb-3">{t("client_device", "Client & Device")}</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">{t("client", "Client")}</span>
                        <p className="text-white font-medium">
                          {selectedTicket.client?.firstName} {selectedTicket.client?.lastName}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">{t("phone", "Phone")}</span>
                        <p className="text-white">{selectedTicket.client?.phone || t("not_provided", "Not provided")}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">{t("device", "Device")}</span>
                        <p className="text-white font-medium">
                          {selectedTicket.deviceModel || t("unknown_device", "Unknown Device")}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">{t("color", "Color")}</span>
                        <p className="text-white">{selectedTicket.deviceColor || t("not_specified", "Not specified")}</p>
                      </div>
                    </div>
                  </Card>

                  <Card className="bg-slate-800/50 border-[#00FFFF]/20 p-4">
                    <h3 className="text-lg font-semibold text-white mb-3">{t("cost_time", "Cost & Time")}</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">{t("final_cost", "Final Cost")}</span>
                        <p className="text-green-400 text-xl font-bold">
                          {formatCurrency(selectedTicket.finalActualCost || selectedTicket.totalCost)}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">{t("actual_hours", "Actual Hours")}</span>
                        <p className="text-cyan-400 text-xl font-bold">
                          {selectedTicket.actualHours || selectedTicket.technicianEstimatedHours}h
                        </p>
                      </div>
                      {selectedTicket.warrantyType && (
                        <div className="col-span-2">
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">{t("warranty_coverage", "Warranty Coverage")}</span>
                            {isWarrantyExpired(selectedTicket.completedAt, selectedTicket.warrantyType) && (
                              <span className="text-red-500 text-sm font-semibold uppercase">
                                {t("expired", "Expired")}
                              </span>
                            )}
                          </div>
                          <div className="text-white space-y-1">
                            <Badge variant="outline" className="bg-green-950/50 text-green-400 border-green-600">
                              <Shield className="w-3 h-3 mr-1" />
                              {selectedTicket.warrantyType === 'standard' 
                                ? t("standard_3_months", "Standard (3 months)") 
                                : t("extended_6_months", "Extended (6 months)")}
                            </Badge>
                            <p className="text-sm text-muted-foreground mt-1">
                              {t("expires_on", "Expires on")}: {formatDate(getWarrantyExpirationDate(selectedTicket.completedAt, selectedTicket.warrantyType))}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </Card>
                </TabsContent>

                {/* Services Tab */}
                <TabsContent value="services" className="space-y-4 mt-4">
                  <Card className="bg-slate-800/50 border-[#00FFFF]/20 p-4">
                    <h3 className="text-lg font-semibold text-white mb-3">{t("performed_services", "Performed Services")}</h3>
                    {selectedTicket.selectedServices && Array.isArray(selectedTicket.selectedServices) && selectedTicket.selectedServices.length > 0 ? (
                      <ul className="space-y-2">
                        {(selectedTicket.selectedServices as string[]).map((serviceId, index) => (
                          <li key={index} className="flex items-center gap-2 text-white">
                            <Wrench className="w-4 h-4 text-cyan-400" />
                            <span>{getServiceName(serviceId)}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-muted-foreground">{t("no_services", "No services recorded")}</p>
                    )}
                  </Card>
                </TabsContent>

                {/* Completion Tab */}
                <TabsContent value="completion" className="space-y-4 mt-4">
                  <Card className="bg-slate-800/50 border-[#00FFFF]/20 p-4">
                    <h3 className="text-lg font-semibold text-white mb-3">{t("completion_notes", "Completion Notes")}</h3>
                    <div className="bg-slate-900/50 p-4 rounded-lg">
                      <p className="text-white whitespace-pre-wrap">
                        {selectedTicket.completionNotes || t("no_notes", "No completion notes provided")}
                      </p>
                    </div>
                  </Card>

                  <Card className="bg-slate-800/50 border-[#00FFFF]/20 p-4">
                    <h3 className="text-lg font-semibold text-white mb-3">{t("timeline", "Timeline")}</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t("created", "Created")}</span>
                        <span className="text-white">{formatDate(selectedTicket.createdAt)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t("completed", "Completed")}</span>
                        <span className="text-white">{formatDate(selectedTicket.completedAt)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t("completed_by", "Completed By")}</span>
                        <span className="text-white">{selectedTicket.completedBy || t("not_recorded", "Not recorded")}</span>
                      </div>
                    </div>
                  </Card>
                </TabsContent>
              </Tabs>

              <div className="flex justify-end">
                <Button 
                  variant="outline" 
                  onClick={() => setSelectedTicket(null)}
                  className="border-[#00FFFF]/20 text-white"
                  data-testid="button-close-details"
                >
                  {t("close", "Close")}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
