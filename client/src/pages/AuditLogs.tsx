import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocalization } from "@/contexts/LocalizationContext";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DateRangePicker } from "@/components/search-filter/DateRangePicker";
import { PermissionGate } from "@/components/PermissionGate";
import { PERMISSIONS } from "@shared/permissions";
import { 
  FileText, 
  Search, 
  Eye, 
  Shield, 
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Filter,
  X
} from "lucide-react";
import { format } from "date-fns";

interface AuditLog {
  id: string;
  tenantId: string;
  userId: string | null;
  action: string;
  resource: string;
  resourceId: string | null;
  details: any;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
  user?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
  };
}

interface User {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
}

const ACTION_COLORS: Record<string, string> = {
  create: "bg-green-500/20 text-green-400 border-green-500/30",
  update: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  delete: "bg-red-500/20 text-red-400 border-red-500/30",
  login: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  logout: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  approve: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  reject: "bg-orange-500/20 text-orange-400 border-orange-500/30",
};

const RESOURCE_COLORS: Record<string, string> = {
  user: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  group: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
  ticket: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  inventory: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  client: "bg-pink-500/20 text-pink-400 border-pink-500/30",
  purchase_order: "bg-teal-500/20 text-teal-400 border-teal-500/30",
  settings: "bg-slate-500/20 text-slate-400 border-slate-500/30",
};

export default function AuditLogs() {
  const { t } = useLocalization();
  const { user: currentUser } = useAuth();

  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string>("all");
  const [selectedAction, setSelectedAction] = useState<string>("all");
  const [selectedResource, setSelectedResource] = useState<string>("all");
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(50);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setCurrentPage(1);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const buildQueryParams = () => {
    const params = new URLSearchParams();
    params.append("limit", String(itemsPerPage));
    params.append("offset", String((currentPage - 1) * itemsPerPage));
    
    if (selectedUserId !== "all") params.append("userId", selectedUserId);
    if (selectedAction !== "all") params.append("action", selectedAction);
    if (selectedResource !== "all") params.append("resource", selectedResource);
    if (dateRange.from) params.append("startDate", dateRange.from.toISOString());
    if (dateRange.to) params.append("endDate", dateRange.to.toISOString());
    
    return params.toString();
  };

  const { data: logsData, isLoading: logsLoading, error: logsError } = useQuery<{
    logs: AuditLog[];
    total: number;
  }>({
    queryKey: ["/api/audit-logs", currentPage, selectedUserId, selectedAction, selectedResource, dateRange.from, dateRange.to],
    retry: 1,
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const filteredLogs = useMemo(() => {
    if (!logsData?.logs) return [];
    
    if (!debouncedSearchTerm) return logsData.logs;

    const searchLower = debouncedSearchTerm.toLowerCase();
    return logsData.logs.filter((log) => {
      const userName = log.user 
        ? `${log.user.firstName || ''} ${log.user.lastName || ''}`.trim() 
        : log.userId || '';
      const detailsStr = JSON.stringify(log.details || {}).toLowerCase();
      
      return (
        log.action.toLowerCase().includes(searchLower) ||
        log.resource.toLowerCase().includes(searchLower) ||
        (log.resourceId?.toLowerCase().includes(searchLower)) ||
        userName.toLowerCase().includes(searchLower) ||
        detailsStr.includes(searchLower)
      );
    });
  }, [logsData?.logs, debouncedSearchTerm]);

  const uniqueActions = useMemo(() => {
    if (!logsData?.logs) return [];
    return Array.from(new Set(logsData.logs.map(log => log.action))).sort();
  }, [logsData?.logs]);

  const uniqueResources = useMemo(() => {
    if (!logsData?.logs) return [];
    return Array.from(new Set(logsData.logs.map(log => log.resource))).sort();
  }, [logsData?.logs]);

  const totalPages = Math.ceil((logsData?.total || 0) / itemsPerPage);

  const formatTimestamp = (date: Date) => {
    return format(new Date(date), "MMM dd, yyyy HH:mm:ss");
  };

  const getUserDisplay = (log: AuditLog) => {
    if (log.user) {
      const fullName = `${log.user.firstName || ''} ${log.user.lastName || ''}`.trim();
      return fullName || log.user.email || log.userId || "Unknown User";
    }
    return log.userId || "System";
  };

  const getActionColor = (action: string) => {
    return ACTION_COLORS[action.toLowerCase()] || "bg-gray-500/20 text-gray-400 border-gray-500/30";
  };

  const getResourceColor = (resource: string) => {
    return RESOURCE_COLORS[resource.toLowerCase()] || "bg-gray-500/20 text-gray-400 border-gray-500/30";
  };

  const truncateDetails = (details: any) => {
    if (!details) return "—";
    const str = JSON.stringify(details);
    if (str.length > 100) {
      return str.substring(0, 100) + "...";
    }
    return str;
  };

  const handleViewDetails = (log: AuditLog) => {
    setSelectedLog(log);
    setIsDetailsDialogOpen(true);
  };

  const handleClearFilters = () => {
    setSearchTerm("");
    setDebouncedSearchTerm("");
    setSelectedUserId("all");
    setSelectedAction("all");
    setSelectedResource("all");
    setDateRange({ from: undefined, to: undefined });
    setCurrentPage(1);
  };

  const hasActiveFilters = 
    searchTerm !== "" || 
    selectedUserId !== "all" || 
    selectedAction !== "all" || 
    selectedResource !== "all" || 
    dateRange.from !== undefined || 
    dateRange.to !== undefined;

  return (
    <PermissionGate 
      permission={PERMISSIONS.AUDIT_LOGS_READ}
      fallback={
        <div className="min-h-screen flex items-center justify-center p-6">
          <Card className="w-full max-w-md border-red-500/20 bg-red-500/5">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center gap-4">
                <div className="p-4 rounded-full bg-red-500/10">
                  <Shield className="w-8 h-8 text-red-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-2">
                    {t("access_denied", "Access Denied")}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {t("audit_logs_permission_required", "You don't have permission to view audit logs.")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      }
    >
      <div className="h-full p-6 space-y-6">
        <Card className="border-[#00FFFF]/20 bg-gradient-to-br from-[#0A1128] to-[#1a2744] shadow-xl">
          <CardHeader className="bg-gradient-to-r from-[#0A1128] via-[#152547] to-[#0A1128] border-b border-[#00FFFF]/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-[#00FFFF]/10">
                  <FileText className="w-6 h-6 text-[#00FFFF]" />
                </div>
                <div>
                  <CardTitle className="text-2xl font-bold text-white">
                    {t("audit_logs", "Audit Logs")}
                  </CardTitle>
                  <p className="text-sm text-gray-400 mt-1">
                    {t("audit_logs_description", "Track all system activities and changes")}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className="border-[#00FFFF]/30 hover:border-[#00FFFF] hover:bg-[#00FFFF]/10"
                data-testid="button-toggle-filters"
              >
                <Filter className="w-4 h-4 mr-2" />
                {showFilters ? t("hide_filters", "Hide Filters") : t("show_filters", "Show Filters")}
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-6">
            {showFilters && (
              <div className="mb-6 p-4 rounded-lg bg-[#0A1128]/50 border border-[#00FFFF]/10 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                    <Filter className="w-4 h-4" />
                    {t("filters", "Filters")}
                  </h3>
                  {hasActiveFilters && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleClearFilters}
                      className="text-[#00FFFF] hover:bg-[#00FFFF]/10"
                      data-testid="button-clear-filters"
                    >
                      <X className="w-4 h-4 mr-1" />
                      {t("clear_all", "Clear All")}
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="search" className="text-sm text-gray-300">
                      {t("search", "Search")}
                    </Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        id="search"
                        placeholder={t("search_logs", "Search logs...")}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9 border-[#00FFFF]/30 focus:border-[#00FFFF] bg-[#0A1128]/30"
                        data-testid="input-search-logs"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="user-filter" className="text-sm text-gray-300">
                      {t("user", "User")}
                    </Label>
                    <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                      <SelectTrigger 
                        id="user-filter"
                        className="border-[#00FFFF]/30 focus:border-[#00FFFF] bg-[#0A1128]/30"
                        data-testid="select-user-filter"
                      >
                        <SelectValue placeholder={t("all_users", "All Users")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t("all_users", "All Users")}</SelectItem>
                        {users.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {`${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || user.id}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="action-filter" className="text-sm text-gray-300">
                      {t("action", "Action")}
                    </Label>
                    <Select value={selectedAction} onValueChange={setSelectedAction}>
                      <SelectTrigger 
                        id="action-filter"
                        className="border-[#00FFFF]/30 focus:border-[#00FFFF] bg-[#0A1128]/30"
                        data-testid="select-action-filter"
                      >
                        <SelectValue placeholder={t("all_actions", "All Actions")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t("all_actions", "All Actions")}</SelectItem>
                        {uniqueActions.map((action) => (
                          <SelectItem key={action} value={action}>
                            {action}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="resource-filter" className="text-sm text-gray-300">
                      {t("resource", "Resource")}
                    </Label>
                    <Select value={selectedResource} onValueChange={setSelectedResource}>
                      <SelectTrigger 
                        id="resource-filter"
                        className="border-[#00FFFF]/30 focus:border-[#00FFFF] bg-[#0A1128]/30"
                        data-testid="select-resource-filter"
                      >
                        <SelectValue placeholder={t("all_resources", "All Resources")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t("all_resources", "All Resources")}</SelectItem>
                        {uniqueResources.map((resource) => (
                          <SelectItem key={resource} value={resource}>
                            {resource}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm text-gray-300">
                    {t("date_range", "Date Range")}
                  </Label>
                  <DateRangePicker
                    value={dateRange}
                    onChange={setDateRange}
                    onClear={() => setDateRange({ from: undefined, to: undefined })}
                  />
                </div>
              </div>
            )}

            {logsError ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
                <h3 className="text-lg font-semibold mb-2">{t("error_loading_logs", "Error Loading Logs")}</h3>
                <p className="text-sm text-muted-foreground">
                  {t("error_loading_logs_description", "Unable to load audit logs. Please try again.")}
                </p>
              </div>
            ) : logsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 10 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" data-testid={`skeleton-log-${i}`} />
                ))}
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="w-16 h-16 text-gray-600 mb-4" />
                <h3 className="text-lg font-semibold mb-2">{t("no_logs_found", "No Logs Found")}</h3>
                <p className="text-sm text-muted-foreground">
                  {hasActiveFilters
                    ? t("no_logs_match_filters", "No logs match your current filters.")
                    : t("no_logs_available", "No audit logs are available yet.")}
                </p>
                {hasActiveFilters && (
                  <Button
                    variant="outline"
                    onClick={handleClearFilters}
                    className="mt-4 border-[#00FFFF]/30 hover:border-[#00FFFF] hover:bg-[#00FFFF]/10"
                    data-testid="button-clear-filters-empty"
                  >
                    {t("clear_filters", "Clear Filters")}
                  </Button>
                )}
              </div>
            ) : (
              <>
                <div className="rounded-lg border border-[#00FFFF]/20 overflow-hidden">
                  <ScrollArea className="h-[600px]">
                    <Table>
                      <TableHeader className="sticky top-0 bg-[#0A1128] z-10">
                        <TableRow className="border-[#00FFFF]/20 hover:bg-transparent">
                          <TableHead className="text-gray-300 font-semibold">
                            {t("timestamp", "Timestamp")}
                          </TableHead>
                          <TableHead className="text-gray-300 font-semibold">
                            {t("user", "User")}
                          </TableHead>
                          <TableHead className="text-gray-300 font-semibold">
                            {t("action", "Action")}
                          </TableHead>
                          <TableHead className="text-gray-300 font-semibold">
                            {t("resource", "Resource")}
                          </TableHead>
                          <TableHead className="text-gray-300 font-semibold">
                            {t("resource_id", "Resource ID")}
                          </TableHead>
                          <TableHead className="text-gray-300 font-semibold">
                            {t("details", "Details")}
                          </TableHead>
                          <TableHead className="text-gray-300 font-semibold text-right">
                            {t("actions", "Actions")}
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredLogs.map((log) => (
                          <TableRow
                            key={log.id}
                            className="border-[#00FFFF]/10 hover:bg-[#00FFFF]/5 transition-colors"
                            data-testid={`row-log-${log.id}`}
                          >
                            <TableCell className="font-mono text-xs text-gray-400">
                              {formatTimestamp(log.createdAt)}
                            </TableCell>
                            <TableCell className="text-sm">
                              {getUserDisplay(log)}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={`${getActionColor(log.action)} uppercase text-xs font-semibold`}
                              >
                                {log.action}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={`${getResourceColor(log.resource)} text-xs`}
                              >
                                {log.resource}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-mono text-xs text-gray-400">
                              {log.resourceId ? (
                                <span className="truncate max-w-[120px] inline-block">
                                  {log.resourceId}
                                </span>
                              ) : (
                                "—"
                              )}
                            </TableCell>
                            <TableCell className="text-xs text-gray-400 max-w-[200px]">
                              <div className="truncate">
                                {truncateDetails(log.details)}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleViewDetails(log)}
                                className="hover:bg-[#00FFFF]/10 hover:text-[#00FFFF]"
                                data-testid={`button-view-details-${log.id}`}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-6">
                    <p className="text-sm text-gray-400">
                      {t("showing_results", "Showing")} {((currentPage - 1) * itemsPerPage) + 1} -{" "}
                      {Math.min(currentPage * itemsPerPage, logsData?.total || 0)} {t("of", "of")}{" "}
                      {logsData?.total || 0} {t("logs", "logs")}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="border-[#00FFFF]/30 hover:border-[#00FFFF] hover:bg-[#00FFFF]/10 disabled:opacity-50 disabled:cursor-not-allowed"
                        data-testid="button-previous-page"
                      >
                        <ChevronLeft className="w-4 h-4 mr-1" />
                        {t("previous", "Previous")}
                      </Button>
                      <span className="text-sm text-gray-400">
                        {t("page", "Page")} {currentPage} {t("of", "of")} {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="border-[#00FFFF]/30 hover:border-[#00FFFF] hover:bg-[#00FFFF]/10 disabled:opacity-50 disabled:cursor-not-allowed"
                        data-testid="button-next-page"
                      >
                        {t("next", "Next")}
                        <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Eye className="w-5 h-5 text-[#00FFFF]" />
                {t("log_details", "Log Details")}
              </DialogTitle>
              <DialogDescription>
                {t("log_details_description", "Complete information about this audit log entry")}
              </DialogDescription>
            </DialogHeader>
            
            {selectedLog && (
              <ScrollArea className="flex-1 pr-4">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-gray-500">{t("timestamp", "Timestamp")}</Label>
                      <p className="text-sm font-mono mt-1">{formatTimestamp(selectedLog.createdAt)}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">{t("user", "User")}</Label>
                      <p className="text-sm mt-1">{getUserDisplay(selectedLog)}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">{t("action", "Action")}</Label>
                      <div className="mt-1">
                        <Badge
                          variant="outline"
                          className={`${getActionColor(selectedLog.action)} uppercase text-xs font-semibold`}
                        >
                          {selectedLog.action}
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">{t("resource", "Resource")}</Label>
                      <div className="mt-1">
                        <Badge
                          variant="outline"
                          className={`${getResourceColor(selectedLog.resource)} text-xs`}
                        >
                          {selectedLog.resource}
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">{t("resource_id", "Resource ID")}</Label>
                      <p className="text-sm font-mono mt-1">{selectedLog.resourceId || "—"}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">{t("ip_address", "IP Address")}</Label>
                      <p className="text-sm font-mono mt-1">{selectedLog.ipAddress || "—"}</p>
                    </div>
                  </div>

                  {selectedLog.userAgent && (
                    <div>
                      <Label className="text-xs text-gray-500">{t("user_agent", "User Agent")}</Label>
                      <p className="text-xs font-mono mt-1 text-gray-600 break-all">
                        {selectedLog.userAgent}
                      </p>
                    </div>
                  )}

                  <div>
                    <Label className="text-xs text-gray-500 mb-2 block">{t("details", "Details")}</Label>
                    <pre className="text-xs font-mono bg-[#0A1128] p-4 rounded-lg border border-[#00FFFF]/20 overflow-x-auto">
                      {JSON.stringify(selectedLog.details, null, 2)}
                    </pre>
                  </div>
                </div>
              </ScrollArea>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </PermissionGate>
  );
}
