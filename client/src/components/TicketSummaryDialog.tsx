import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useLocalization } from "@/contexts/LocalizationContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import ProgressVisualization from "@/components/ProgressVisualization";
import { Smartphone, User, DollarSign, Clock, MessageSquare, Loader2, Package, Check, AlertTriangle, FileText, Printer, PenTool, History } from "lucide-react";
import SignatureAuditTrail from "@/components/signature/SignatureAuditTrail";
import type { Ticket, Client, TicketStatus, TicketPriority } from "@shared/schema";
import { toCents, fromCents, addCents, formatCurrency as formatCurrencyFromUtility, normalizeCurrency, type Locale } from "@shared/money";
import { formatTicketId } from "@/lib/utils";
import { PermissionGate } from "@/components/PermissionGate";
import { PERMISSIONS } from "@shared/permissions";
import { useInvoice } from "@/hooks/use-invoice";
import DropOffReceiptInvoice from "@/components/invoices/DropOffReceiptInvoice";
import FinalInvoice from "@/components/invoices/FinalInvoice";

type TicketWithClient = Ticket & { client?: Client };

interface RepairService {
  id: string;
  deviceType: string;
  name: string;
  description: string | null;
  estimatedLaborCost: string;
  estimatedCompletionTimeHours: number;
  estimatedCompletionTimeMinutes: number;
  isActive: boolean;
}

interface ProblemsTabContentProps {
  ticketId: string;
  deviceType: string;
  issueResponses: any[];
}

function ProblemsTabContent({ ticketId, deviceType, issueResponses }: ProblemsTabContentProps) {
  const { t } = useLocalization();
  
  // Prefilter responses to exclude special question types that are handled separately
  const visibleResponses = issueResponses.filter(response => 
    response.questionId !== 'selected_defects' && 
    response.questionId !== 'additional_comments'
  );
  
  // Fetch issue questions to get question text and types
  const { data: questions = [] } = useQuery({
    queryKey: ['/api/issue-questions', deviceType],
    enabled: !!deviceType,
  });

  // Create a map of question ID to question data
  const questionMap = (questions as any[]).reduce((acc: any, question: any) => {
    acc[question.id] = question;
    return acc;
  }, {});

  // Format response based on question type
  const formatResponse = (response: any, question: any) => {
    if (!question) return JSON.stringify(response);

    if (question.questionType === 'boolean') {
      if (typeof response === 'object' && response !== null) {
        // Handle complex responses like {answer: false, comment: "..."}
        const answer = response.answer;
        const comment = response.comment;
        const answerText = answer ? t("yes", "Yes") : t("no", "No");
        return comment ? `${answerText} - ${comment}` : answerText;
      } else {
        // Simple boolean response
        return response ? t("yes", "Yes") : t("no", "No");
      }
    } else if (question.questionType === 'single_choice' || question.questionType === 'multiple_choice') {
      // For choice questions, try to find a localized version or return as-is
      if (typeof response === 'string') {
        return t(response, response.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2'));
      }
      return response;
    } else if (question.questionType === 'text') {
      return response || t("no_response", "No response provided");
    }

    return response;
  };

  return (
    <div className="space-y-4">
      {/* Handle additional comments separately first */}
      {issueResponses.filter(r => r.questionId === 'additional_comments').map((response, index) => (
        <div key={response.id || index} className="bg-blue-50/50 dark:bg-blue-950/20 p-2 rounded border border-blue-200/50 dark:border-blue-800/50">
          <div className="font-medium text-xs mb-1 text-foreground flex items-center gap-2">
            <MessageSquare className="h-3 w-3 text-blue-600 dark:text-blue-400" />
            {t("additional_comments", "Additional Comments")}
          </div>
          <div className="text-xs text-muted-foreground italic">
            "{response.response}"
          </div>
        </div>
      ))}

      {/* Main visible responses section */}
      {!visibleResponses || visibleResponses.length === 0 ? (
        <div className="bg-muted/5 border border-muted/20 rounded-lg p-4 text-center">
          <AlertTriangle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <h3 className="font-semibold text-sm mb-1">{t("problems_identified", "Problems Identified")}</h3>
          <div className="text-xs text-muted-foreground">
            {t("no_problems_recorded", "No problems recorded during ticket creation")}
          </div>
        </div>
      ) : (
        <div className="bg-muted/5 border border-muted/20 rounded-lg p-3">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
            {t("problems_identified", "Problems Identified")}
            <span className="text-xs text-muted-foreground font-normal">
              ({visibleResponses.length} {t("responses", "responses")})
            </span>
          </h3>
          
          <div className="space-y-2">
            {visibleResponses.map((response, index) => {
              const question = questionMap[response.questionId];
              const questionText = question ? t(question.questionKey, question.questionKey) : `${t("question", "Question")} ${index + 1}`;
              const formattedResponse = formatResponse(response.response, question);
              
              return (
                <div key={response.id || index} className="bg-slate-800/50 dark:bg-slate-900/50 p-2 rounded border border-cyan-500/20">
                  <div className="font-medium text-xs mb-1 text-cyan-400">
                    {questionText}
                    {question?.isRequired && <span className="text-red-400 ml-1">*</span>}
                  </div>
                  <div className="text-xs text-slate-200">
                    {formattedResponse}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

interface DefectsListProps {
  selectedDefects: string[];
  deviceType: string;
}

function DefectsList({ selectedDefects, deviceType }: DefectsListProps) {
  const { t } = useLocalization();
  
  // Fetch all possible defects for the device type
  const { data: allDefects = [], isLoading, isError } = useQuery<any[]>({
    queryKey: [`/api/possible-defects/device/${deviceType}`],
    enabled: !!deviceType && selectedDefects.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Filter defects to only show selected ones
  const defects = allDefects.filter(defect => selectedDefects.includes(defect.id));

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-slate-700/30 rounded-md p-3 animate-pulse">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-slate-600 rounded"></div>
              <div className="h-4 bg-slate-600 rounded w-3/4"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 rounded-md p-3 text-center">
        <AlertTriangle className="w-5 h-5 text-red-400 mx-auto mb-2" />
        <p className="text-sm text-red-400">{t("error_loading_defects", "Error loading defect details")}</p>
      </div>
    );
  }

  if (defects.length === 0) {
    return (
      <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-md p-3 text-center">
        <AlertTriangle className="w-5 h-5 text-yellow-400 mx-auto mb-2" />
        <p className="text-sm text-yellow-400">{t("defects_not_found", "Selected defects not found in system")}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {defects.map((defect, index) => (
          <div key={defect.id || index} className="bg-red-500/10 border border-red-500/20 rounded-md p-3">
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-red-400 rounded-full mt-2 flex-shrink-0"></div>
              <div className="flex-1 min-w-0">
                <h5 className="font-medium text-sm text-white mb-1">{defect.name}</h5>
                {defect.description && (
                  <p className="text-xs text-slate-300 leading-relaxed">{defect.description}</p>
                )}
                {defect.severity && (
                  <div className="mt-2">
                    <Badge 
                      variant="outline" 
                      className={`text-xs ${
                        defect.severity === 'critical' 
                          ? 'border-red-500 text-red-400' 
                          : defect.severity === 'high'
                          ? 'border-orange-500 text-orange-400'
                          : defect.severity === 'medium'
                          ? 'border-yellow-500 text-yellow-400'
                          : 'border-blue-500 text-blue-400'
                      }`}
                    >
                      {t(`severity_${defect.severity}`, defect.severity?.charAt(0).toUpperCase() + defect.severity?.slice(1) || 'Unknown')}
                    </Badge>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {/* Summary footer */}
      <div className="mt-3 pt-3 border-t border-slate-600">
        <p className="text-xs text-slate-400 text-center">
          {defects.length === 1 
            ? t("one_defect_identified", "1 defect identified during assessment")
            : t("multiple_defects_identified", `${defects.length} defects identified during assessment`)
          }
        </p>
      </div>
    </div>
  );
}

interface TicketSummaryDialogProps {
  ticket: TicketWithClient | null;
  isOpen: boolean;
  onClose: () => void;
  onDelete?: (ticketId: string) => void;
  onPriorityUpdate?: (ticketId: string, priority: TicketPriority) => void;
  onStatusUpdate?: (ticketId: string, status: TicketStatus) => void;
  getKanbanColumns?: (t: any) => any[];
  getPriorityColor?: (priority: TicketPriority) => string;
  getPriorityLabel?: (priority: TicketPriority) => string;
  getStatusCardStyling?: (status: string) => string;
}

export default function TicketSummaryDialog({
  ticket,
  isOpen,
  onClose,
  onDelete,
  onPriorityUpdate,
  onStatusUpdate,
  getKanbanColumns,
  getPriorityColor,
  getPriorityLabel,
  getStatusCardStyling,
}: TicketSummaryDialogProps) {
  const { t, currentLanguage, formatDate } = useLocalization();
  const queryClient = useQueryClient();
  const [newNote, setNewNote] = useState('');
  const [notes, setNotes] = useState<any[]>([]);
  const [issueResponses, setIssueResponses] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('general');
  const { generateAndPrintInvoice } = useInvoice();

  // Currency formatting utility
  const formatCurrency = (amountCents: number, locale: Locale = 'en') => {
    return formatCurrencyFromUtility(amountCents, locale);
  };

  // Fetch notes and issue responses when ticket changes
  useEffect(() => {
    if (ticket) {
      // Fetch notes
      fetch(`/api/tickets/${ticket.id}/notes`)
        .then(r => r.json())
        .then(setNotes)
        .catch(error => {
          console.error('Failed to fetch notes:', error);
          setNotes([]);
        });
      
      // Fetch issue responses
      fetch(`/api/tickets/${ticket.id}/issue-responses`)
        .then(r => r.json())
        .then(setIssueResponses)
        .catch(error => {
          console.error('Failed to fetch issue responses:', error);
          setIssueResponses([]);
        });
    }
  }, [ticket?.id]);

  // Query ticket items for summary view
  const { data: summaryTicketItems = [] } = useQuery<any[]>({
    queryKey: [`/api/tickets/${ticket?.id}/items`],
    enabled: !!ticket?.id,
    staleTime: 30 * 1000, // 30 seconds
  });

  // Load repair services for ticket summary
  const { data: ticketRepairServices = [] } = useQuery<RepairService[]>({
    queryKey: [`/api/repair-services/device/${ticket?.deviceType}`],
    enabled: !!ticket?.deviceType,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  // Load checklists for ticket summary
  const { data: ticketChecklists = [] } = useQuery<any[]>({
    queryKey: [`/api/checklists/device/${ticket?.deviceType}`],
    enabled: !!ticket?.deviceType,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  // Load possible defects for ticket summary
  const { data: ticketPossibleDefects = [] } = useQuery<any[]>({
    queryKey: [`/api/possible-defects/device/${ticket?.deviceType}`],
    enabled: !!ticket?.deviceType,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  // Fetch client data if not already populated on ticket
  const { data: fetchedClient } = useQuery<Client>({
    queryKey: [`/api/clients/${ticket?.clientId}`],
    enabled: !!ticket?.clientId && !ticket?.client,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch store settings for invoice generation
  const { data: storeSettings } = useQuery<any>({
    queryKey: ['/api/store-settings'],
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  // Fetch warranty tiers for calculating warranty cost and duration
  const { data: warrantyTiers = [] } = useQuery<any[]>({
    queryKey: [`/api/warranty-tiers/${ticket?.deviceType}`],
    enabled: !!ticket?.deviceType,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  // Fetch signature requests for the ticket
  const { data: ticketSignatures = [] } = useQuery<any[]>({
    queryKey: [`/api/tickets/${ticket?.id}/signatures`],
    enabled: !!ticket?.id,
    staleTime: 30 * 1000, // 30 seconds
  });

  // Use either ticket.client or fetchedClient
  const clientData = ticket?.client || fetchedClient;

  // Priority update mutation
  const updateTicketPriority = useMutation({
    mutationFn: async ({ ticketId, priority }: { ticketId: string; priority: TicketPriority }) => {
      return apiRequest(`/api/tickets/${ticketId}/priority`, 'PATCH', { priority });
    },
    onSuccess: (_, { ticketId }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/tickets'] });
      queryClient.invalidateQueries({ queryKey: [`/api/tickets/${ticketId}`] });
      if (onPriorityUpdate && ticket) {
        onPriorityUpdate(ticketId, ticket.priority as TicketPriority);
      }
    },
  });

  // Status update mutation
  const updateTicketStatus = useMutation({
    mutationFn: async ({ ticketId, status }: { ticketId: string; status: TicketStatus }) => {
      return apiRequest(`/api/tickets/${ticketId}/status`, 'PATCH', { status });
    },
    onSuccess: (_, { ticketId }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/tickets'] });
      queryClient.invalidateQueries({ queryKey: [`/api/tickets/${ticketId}`] });
      if (onStatusUpdate && ticket) {
        onStatusUpdate(ticketId, ticket.status as TicketStatus);
      }
    },
  });

  if (!ticket) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="w-5 h-5" />
            {t("ticket_summary", "Ticket Summary")} - {formatTicketId(ticket.id)}
          </DialogTitle>
        </DialogHeader>
        
        {/* Priority and Status Header */}
        <div className="flex items-center justify-between mb-6 p-4 bg-muted/30 rounded-lg border">
          <div className="flex items-center gap-4">
            {/* Priority Selector */}
            <div className="flex items-center gap-3">
              <label className="text-sm font-semibold text-foreground">{t("priority", "Priority")}</label>
              <Select
                value={ticket.priority}
                onValueChange={(newPriority) => {
                  updateTicketPriority.mutate({ 
                    ticketId: ticket.id, 
                    priority: newPriority as TicketPriority 
                  });
                }}
                data-testid="select-ticket-priority-header"
              >
                <SelectTrigger className="w-36 h-9">
                  <SelectValue>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getPriorityColor ? getPriorityColor(ticket.priority as TicketPriority) : ''}`}>
                      {getPriorityLabel ? getPriorityLabel(ticket.priority as TicketPriority) : ticket.priority}
                    </span>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low" data-testid="priority-low-header">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getPriorityColor ? getPriorityColor('low') : ''}`}>
                      {getPriorityLabel ? getPriorityLabel('low') : 'Low'}
                    </span>
                  </SelectItem>
                  <SelectItem value="medium" data-testid="priority-medium-header">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getPriorityColor ? getPriorityColor('medium') : ''}`}>
                      {getPriorityLabel ? getPriorityLabel('medium') : 'Medium'}
                    </span>
                  </SelectItem>
                  <SelectItem value="critical" data-testid="priority-critical-header">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getPriorityColor ? getPriorityColor('critical') : ''}`}>
                      {getPriorityLabel ? getPriorityLabel('critical') : 'Critical'}
                    </span>
                  </SelectItem>
                  <SelectItem value="vip" data-testid="priority-vip-header">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getPriorityColor ? getPriorityColor('vip') : ''}`}>
                      {getPriorityLabel ? getPriorityLabel('vip') : 'VIP'}
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
              {updateTicketPriority.isPending && (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>
          </div>

          {/* Status Badge */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">{t("status", "Status")}:</span>
            <Badge className={`${getStatusCardStyling ? getStatusCardStyling(ticket.status) : ''} px-3 py-1`}>
              {getKanbanColumns ? getKanbanColumns(t).find(col => col.id === ticket.status)?.title : ticket.status}
            </Badge>
          </div>
        </div>

        {/* Smart Collapsible Progress Section */}
        <div className="mb-6 p-3 bg-card/50 border border-border rounded-lg">
          <ProgressVisualization
            key={`progress-${ticket.id}-${ticket.status}`}
            currentStatus={ticket.status}
            ticketId={ticket.id}
            createdAt={ticket.createdAt ? new Date(ticket.createdAt).toISOString() : undefined}
            technicianEstimatedHours={ticket.technicianEstimatedHours ?? undefined}
            onAdvanceStatus={(ticketId, nextStatus) => {
              updateTicketStatus.mutate({ ticketId, status: nextStatus as TicketStatus });
            }}
            isAdvancing={updateTicketStatus.isPending}
            compact={false}
            collapsible={true}
            defaultExpanded={false}
            showAdvanceButton={true}
            headerStyle="detailed"
          />
        </div>

        {/* Tabs Interface */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="general" data-testid="tab-general-info">
              {t("general_info", "General Info")}
            </TabsTrigger>
            <TabsTrigger value="problems" data-testid="tab-problems">
              {t("problems", "Problems")}
            </TabsTrigger>
            <TabsTrigger value="checklist" data-testid="tab-checklist">
              {t("checklist", "Checklist")}
            </TabsTrigger>
            <TabsTrigger value="signatures" data-testid="tab-signatures">
              <PenTool className="h-3 w-3 mr-1" />
              {t("signatures", "Signatures")}
            </TabsTrigger>
          </TabsList>

          {/* General Info Tab */}
          <TabsContent value="general" className="space-y-4">
            {/* Compact Info Cards */}
            <div className="space-y-4">
              {/* Device Information */}
              <div className="bg-muted/5 border border-muted/20 rounded-lg p-3">
                <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                  <Smartphone className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  {t("device_information", "Device Information")}
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  <div className="bg-slate-800/50 dark:bg-slate-900/50 p-2 rounded border border-cyan-500/20">
                    <div className="font-medium text-cyan-400">{t("type", "Type")}</div>
                    <div className="truncate text-slate-200">{ticket.deviceType}</div>
                  </div>
                  <div className="bg-slate-800/50 dark:bg-slate-900/50 p-2 rounded border border-cyan-500/20">
                    <div className="font-medium text-cyan-400">{t("model", "Model")}</div>
                    <div className="truncate text-slate-200">{ticket.deviceModel}</div>
                  </div>
                  <div className="bg-slate-800/50 dark:bg-slate-900/50 p-2 rounded border border-cyan-500/20">
                    <div className="font-medium text-cyan-400">{t("color", "Color")}</div>
                    <div className="truncate text-slate-200">{ticket.deviceColor || "N/A"}</div>
                  </div>
                </div>
              </div>

              {/* Client Information */}
              {clientData && (
                <div className="bg-muted/5 border border-muted/20 rounded-lg p-3">
                  <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                    <User className="h-4 w-4 text-green-600 dark:text-green-400" />
                    {t("client_information", "Client Information")}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div className="bg-slate-800/50 dark:bg-slate-900/50 p-2 rounded border border-cyan-500/20">
                      <div className="font-medium text-cyan-400">{t("name", "Name")}</div>
                      <div className="truncate text-slate-200">{clientData.firstName} {clientData.lastName}</div>
                    </div>
                    <div className="bg-slate-800/50 dark:bg-slate-900/50 p-2 rounded border border-cyan-500/20">
                      <div className="font-medium text-cyan-400">{t("email", "Email")}</div>
                      <div className="truncate text-slate-200">{clientData.email}</div>
                    </div>
                    <div className="bg-slate-800/50 dark:bg-slate-900/50 p-2 rounded border border-cyan-500/20">
                      <div className="font-medium text-cyan-400">{t("phone", "Phone")}</div>
                      <div className="truncate text-slate-200">{clientData.phone}</div>
                    </div>
                    <div className="bg-slate-800/50 dark:bg-slate-900/50 p-2 rounded border border-cyan-500/20">
                      <div className="font-medium text-cyan-400">{t("cpf", "CPF")}</div>
                      <div className="truncate text-slate-200">{clientData.cpf}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Services & Timeline */}
              <div className="bg-muted/5 border border-muted/20 rounded-lg p-3">
                <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  {t("services_timeline", "Services & Timeline")}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  <div className="bg-slate-800/50 dark:bg-slate-900/50 p-2 rounded border border-cyan-500/20">
                    <div className="font-medium text-cyan-400">{t("client_deadline", "Client Deadline")}</div>
                    <div className="text-slate-200">
                      {ticket.clientDeadline 
                        ? formatDate(ticket.clientDeadline)
                        : t("not_set", "Not set")
                      }
                    </div>
                  </div>
                  <div className="bg-slate-800/50 dark:bg-slate-900/50 p-2 rounded border border-cyan-500/20">
                    <div className="font-medium text-cyan-400">{t("estimated_time", "Estimated Time")}</div>
                    <div className="text-slate-200">
                      {(() => {
                        // Calculate time from selected services if available
                        if (ticket.selectedServices && Array.isArray(ticket.selectedServices) && ticket.selectedServices.length > 0) {
                          const services = ticket.selectedServices;
                          const totalMinutes = services.reduce((total: number, serviceId: string) => {
                            const service = ticketRepairServices.find(s => s.id === serviceId);
                            return service ? total + (service.estimatedCompletionTimeHours * 60) + service.estimatedCompletionTimeMinutes : total;
                          }, 0);
                          
                          if (totalMinutes === 0) return ticket.technicianEstimatedHours ? `${ticket.technicianEstimatedHours}${t("hours_short", "h")}` : t("not_available", "N/A");
                          
                          const hours = Math.floor(totalMinutes / 60);
                          const minutes = totalMinutes % 60;
                          
                          if (hours === 0) return `${minutes}${t("minutes_short", "min")}`;
                          if (minutes === 0) return `${hours}${t("hours_short", "h")}`;
                          return `${hours}${t("hours_short", "h")} ${minutes}${t("minutes_short", "min")}`;
                        }
                        return ticket.technicianEstimatedHours ? `${ticket.technicianEstimatedHours}${t("hours_short", "h")}` : t("not_available", "N/A");
                      })()}
                    </div>
                  </div>
                  <div className="bg-slate-800/50 dark:bg-slate-900/50 p-2 rounded border border-cyan-500/20">
                    <div className="font-medium text-cyan-400">{t("deadline_status", "Status")}</div>
                    <div>
                      {(() => {
                        if (!ticket.clientDeadline) return <span className="text-yellow-400">{t("no_deadline", "No deadline")}</span>;
                        
                        const deadline = new Date(ticket.clientDeadline);
                        const now = new Date();
                        const timeDiff = deadline.getTime() - now.getTime();
                        const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
                        
                        if (daysDiff < 0) return <span className="text-red-400">{t("overdue", "Overdue")}</span>;
                        if (daysDiff <= 2) return <span className="text-yellow-400">{t("urgent", "Urgent")}</span>;
                        return <span className="text-green-400">{t("on_time", "On time")}</span>;
                      })()}
                    </div>
                  </div>
                </div>
                
                {/* Selected Services List */}
                {(() => {
                  let services = [];
                  if (ticket.selectedServices) {
                    if (Array.isArray(ticket.selectedServices)) {
                      services = ticket.selectedServices;
                    } else if (typeof ticket.selectedServices === 'string') {
                      try {
                        services = JSON.parse(ticket.selectedServices);
                      } catch (e) {
                        services = [];
                      }
                    }
                  }
                  
                  if (services.length === 0) return null;
                  
                  return (
                    <div className="mt-3 pt-3 border-t border-muted/20">
                      <div className="font-medium text-cyan-400 text-xs mb-2">{t("selected_services", "Selected Services")}</div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {ticketRepairServices
                          .filter(service => services.includes(service.id))
                          .map((service) => (
                            <div key={service.id} className="flex items-center gap-2 text-xs bg-slate-700/30 rounded p-2">
                              <div className="w-1.5 h-1.5 rounded-full bg-[#00FFFF]"></div>
                              <span className="text-slate-200 truncate">{service.name}</span>
                            </div>
                          ))}
                      </div>
                    </div>
                  );
                })()}
                
                {/* Service Items List */}
                {summaryTicketItems && summaryTicketItems.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-muted/20">
                    <div className="font-medium text-cyan-400 text-xs mb-2">{t("service_items", "Service Items")}</div>
                    <div className="space-y-2">
                      {summaryTicketItems.map((item: any) => (
                        <div key={item.id} className="flex items-start justify-between gap-2 text-xs bg-slate-700/30 rounded p-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <Package className="w-3 h-3 text-cyan-400 flex-shrink-0" />
                              <span className="text-slate-200 font-medium">{item.inventoryItem?.name || t("unnamed_item", "Unnamed Item")}</span>
                            </div>
                            {item.units && item.units.length > 0 && (
                              <div className="text-xs text-muted-foreground mt-1 ml-5">
                                {t("units", "Units")}: {item.units.map((unit: any) => unit.uniqueTag).join(", ")}
                              </div>
                            )}
                            <div className="text-xs text-cyan-200/70 mt-1 ml-5">
                              {t("quantity", "Quantity")}: {item.quantity} × {(() => {
                                const locale: Locale = currentLanguage.code === 'pt-BR' ? 'pt-BR' : 'en';
                                return formatCurrency(toCents(item.unitPrice || '0', locale), locale);
                              })()}
                            </div>
                          </div>
                          <div className="text-right text-cyan-400 font-bold">
                            {(() => {
                              const locale: Locale = currentLanguage.code === 'pt-BR' ? 'pt-BR' : 'en';
                              const unitPriceCents = toCents(item.unitPrice || '0', locale);
                              const itemTotalCents = unitPriceCents * item.quantity;
                              return formatCurrency(itemTotalCents, locale);
                            })()}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Cost Summary */}
              <div className="bg-muted/5 border border-muted/20 rounded-lg p-3">
                <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                  {t("cost_summary", "Cost Summary")}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
                  <div className="bg-slate-800/50 dark:bg-slate-900/50 p-2 rounded border border-cyan-500/20">
                    <div className="font-medium text-cyan-400">{t("services_cost", "Services Cost")}</div>
                    <div className="font-bold text-blue-400">
                      {(() => {
                        let services = [];
                        
                        // Handle different data types for selectedServices
                        if (ticket.selectedServices) {
                          if (Array.isArray(ticket.selectedServices)) {
                            services = ticket.selectedServices;
                          } else if (typeof ticket.selectedServices === 'string') {
                            try {
                              services = JSON.parse(ticket.selectedServices);
                            } catch (e) {
                              services = [];
                            }
                          }
                        }
                        
                        const locale: Locale = currentLanguage.code === 'pt-BR' ? 'pt-BR' : 'en';
                        const totalServicesCents = services.reduce((total: number, serviceId: string) => {
                          const service = ticketRepairServices.find(s => s.id === serviceId);
                          if (service) {
                            const serviceCostCents = toCents(service.estimatedLaborCost || '0', locale);
                            return addCents(total, serviceCostCents);
                          }
                          return total;
                        }, 0);
                        
                        return formatCurrency(totalServicesCents, locale);
                      })()}
                    </div>
                  </div>
                  <div className="bg-slate-800/50 dark:bg-slate-900/50 p-2 rounded border border-cyan-500/20">
                    <div className="font-medium text-cyan-400">{t("items_cost", "Items Cost")}</div>
                    <div className="font-bold text-blue-400">
                      {(() => {
                        const locale: Locale = currentLanguage.code === 'pt-BR' ? 'pt-BR' : 'en';
                        const totalItemsCents = summaryTicketItems.reduce((total: number, item: any) => {
                          const unitPriceCents = toCents(item.unitPrice || '0', locale);
                          const itemTotalCents = unitPriceCents * item.quantity;
                          return addCents(total, itemTotalCents);
                        }, 0);
                        return formatCurrency(totalItemsCents, locale);
                      })()}
                    </div>
                  </div>
                  <div className="bg-slate-800/50 dark:bg-slate-900/50 p-2 rounded border border-cyan-500/20">
                    <div className="font-medium text-cyan-400">{t("extra_costs", "Extra Costs")}</div>
                    <div className="font-bold text-blue-400">
                      {(() => {
                        const locale: Locale = currentLanguage.code === 'pt-BR' ? 'pt-BR' : 'en';
                        const extraCostCents = ticket.costEstimation ? toCents(ticket.costEstimation, locale) : 0;
                        return formatCurrency(extraCostCents, locale);
                      })()}
                    </div>
                  </div>
                  <div className="bg-slate-800/50 dark:bg-slate-900/50 p-2 rounded border border-cyan-500/20">
                    <div className="font-medium text-cyan-400">{t("total_cost", "Total Cost")}</div>
                    <div className="font-bold text-green-400">
                      {(() => {
                        const locale: Locale = currentLanguage.code === 'pt-BR' ? 'pt-BR' : 'en';
                        
                        // Services cost
                        let services = [];
                        if (ticket.selectedServices) {
                          if (Array.isArray(ticket.selectedServices)) {
                            services = ticket.selectedServices;
                          } else if (typeof ticket.selectedServices === 'string') {
                            try {
                              services = JSON.parse(ticket.selectedServices);
                            } catch (e) {
                              services = [];
                            }
                          }
                        }
                        const totalServicesCents = services.reduce((total: number, serviceId: string) => {
                          const service = ticketRepairServices.find(s => s.id === serviceId);
                          if (service) {
                            const serviceCostCents = toCents(service.estimatedLaborCost || '0', locale);
                            return addCents(total, serviceCostCents);
                          }
                          return total;
                        }, 0);
                        
                        // Items cost
                        const totalItemsCents = summaryTicketItems.reduce((total: number, item: any) => {
                          const unitPriceCents = toCents(item.unitPrice || '0', locale);
                          const itemTotalCents = unitPriceCents * item.quantity;
                          return addCents(total, itemTotalCents);
                        }, 0);
                        
                        // Extra costs
                        const extraCostCents = ticket.costEstimation ? toCents(ticket.costEstimation, locale) : 0;
                        
                        // Total
                        const grandTotal = addCents(addCents(totalServicesCents, totalItemsCents), extraCostCents);
                        return formatCurrency(grandTotal, locale);
                      })()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Invoice Actions */}
              <div className="bg-muted/5 border border-muted/20 rounded-lg p-3">
                <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  {t("invoices", "Invoices")}
                </h3>
                <div className="flex flex-wrap gap-2">
                  <PermissionGate permission={PERMISSIONS.TICKETS_UPDATE}>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex items-center gap-2"
                      onClick={() => {
                        if (!clientData || !storeSettings) {
                          return;
                        }
                        const locale: Locale = currentLanguage.code === 'pt-BR' ? 'pt-BR' : 'en';
                        
                        // Parse selected services
                        let services = [];
                        if (ticket.selectedServices) {
                          if (Array.isArray(ticket.selectedServices)) {
                            services = ticket.selectedServices;
                          } else if (typeof ticket.selectedServices === 'string') {
                            try {
                              services = JSON.parse(ticket.selectedServices);
                            } catch (e) {
                              services = [];
                            }
                          }
                        }
                        
                        // Build selected services breakdown with names and costs
                        const selectedServicesBreakdown = services.map((serviceId: string) => {
                          const service = ticketRepairServices.find(s => s.id === serviceId);
                          if (service) {
                            return {
                              name: service.name,
                              cost: service.estimatedLaborCost || '0',
                            };
                          }
                          return null;
                        }).filter(Boolean);
                        
                        // Calculate total cost
                        const totalServicesCents = services.reduce((total: number, serviceId: string) => {
                          const service = ticketRepairServices.find(s => s.id === serviceId);
                          if (service) {
                            const serviceCostCents = toCents(service.estimatedLaborCost || '0', locale);
                            return addCents(total, serviceCostCents);
                          }
                          return total;
                        }, 0);
                        const totalItemsCents = summaryTicketItems.reduce((total: number, item: any) => {
                          const unitPriceCents = toCents(item.unitPrice || '0', locale);
                          const itemTotalCents = unitPriceCents * item.quantity;
                          return addCents(total, itemTotalCents);
                        }, 0);
                        const extraCostCents = ticket.costEstimation ? toCents(ticket.costEstimation, locale) : 0;
                        const totalCostCents = addCents(addCents(totalServicesCents, totalItemsCents), extraCostCents);
                        
                        // Parse service checklist and map IDs to names
                        let serviceChecklist = null;
                        if (ticket.serviceChecklist) {
                          let parsedChecklist = null;
                          if (typeof ticket.serviceChecklist === 'object') {
                            parsedChecklist = ticket.serviceChecklist;
                          } else if (typeof ticket.serviceChecklist === 'string') {
                            try {
                              parsedChecklist = JSON.parse(ticket.serviceChecklist);
                            } catch (e) {
                              parsedChecklist = null;
                            }
                          }
                          
                          if (parsedChecklist) {
                            // Map checklist IDs to names if we have checklist data
                            const selectedChecklistNames = ticketChecklists && ticketChecklists.length > 0
                              ? (parsedChecklist.selectedChecklists || [])
                                  .map((checklistId: string) => {
                                    const checklist = ticketChecklists.find(c => c.id === checklistId);
                                    return checklist?.name;
                                  })
                                  .filter(Boolean)
                              : []; // Empty array if no checklists defined (preserve structure)
                            
                            serviceChecklist = {
                              selectedChecklists: selectedChecklistNames,
                              additionalNotes: parsedChecklist.additionalNotes
                            };
                          }
                        }
                        
                        // Extract and map identified defects
                        let identifiedDefects: string[] = [];
                        if (issueResponses && ticketPossibleDefects && ticketPossibleDefects.length > 0) {
                          const selectedDefectsResponse = issueResponses.find(
                            r => r.questionId === 'selected_defects'
                          );
                          
                          if (selectedDefectsResponse && selectedDefectsResponse.response) {
                            const defectIds = Array.isArray(selectedDefectsResponse.response)
                              ? selectedDefectsResponse.response
                              : [];
                            
                            identifiedDefects = defectIds
                              .map((defectId: string) => {
                                const defect = ticketPossibleDefects.find(d => d.id === defectId);
                                return defect?.name;
                              })
                              .filter(Boolean);
                          }
                        }
                        
                        // Find dropoff signature for the invoice
                        const dropoffSignature = ticketSignatures.find(
                          (sig: any) => sig.type === 'dropoff' && sig.status === 'signed' && sig.signaturePng
                        );
                        
                        generateAndPrintInvoice.mutate({
                          ticketId: ticket.id,
                          type: 'drop_off',
                          InvoiceComponent: DropOffReceiptInvoice,
                          invoiceProps: {
                            shopName: storeSettings.storeName || 'Repair Shop',
                            shopLogo: storeSettings.logoUrl || null,
                            shopAddress: storeSettings.address || null,
                            invoiceNumber: formatTicketId(ticket.id),
                            invoiceDate: formatDate(new Date()),
                            customerName: `${clientData.firstName || ''} ${clientData.lastName || ''}`.trim() || 'N/A',
                            customerPhone: clientData.phone || null,
                            customerEmail: clientData.email || null,
                            deviceType: ticket.deviceType || null,
                            deviceBrand: ticket.deviceBrand || null,
                            deviceModel: ticket.deviceModel || null,
                            deviceColor: ticket.deviceColor || null,
                            deviceMemory: ticket.deviceMemory || null,
                            deviceStorageCapacity: ticket.deviceStorageCapacity || null,
                            serialNumber: null,
                            issueDescription: issueResponses.find(r => r.questionId === 'additional_comments')?.response || null,
                            estimatedCost: fromCents(totalCostCents, locale),
                            estimatedHours: ticket.technicianEstimatedHours || null,
                            extraCost: extraCostCents > 0 ? fromCents(extraCostCents, locale) : null,
                            serviceChecklist: serviceChecklist,
                            selectedServices: selectedServicesBreakdown,
                            identifiedDefects: identifiedDefects.length > 0 ? identifiedDefects : null,
                            language: locale,
                            dropoffSignaturePng: dropoffSignature?.signaturePng || null,
                            dropoffSignedAt: dropoffSignature?.signedAt ? formatDate(new Date(dropoffSignature.signedAt)) : null,
                          },
                        });
                      }}
                      disabled={generateAndPrintInvoice.isPending || !clientData || !storeSettings}
                      data-testid="button-print-drop-off-receipt"
                    >
                      {generateAndPrintInvoice.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Printer className="h-4 w-4" />
                      )}
                      {t("print_drop_off_receipt", "Print Drop-Off Receipt")}
                    </Button>
                  </PermissionGate>

                  <PermissionGate permission={PERMISSIONS.TICKETS_UPDATE}>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex items-center gap-2"
                      onClick={() => {
                        if (!clientData || !storeSettings) {
                          return;
                        }
                        const locale: Locale = currentLanguage.code === 'pt-BR' ? 'pt-BR' : 'en';
                        
                        // Calculate totals
                        let services = [];
                        if (ticket.selectedServices) {
                          if (Array.isArray(ticket.selectedServices)) {
                            services = ticket.selectedServices;
                          } else if (typeof ticket.selectedServices === 'string') {
                            try {
                              services = JSON.parse(ticket.selectedServices);
                            } catch (e) {
                              services = [];
                            }
                          }
                        }
                        
                        // Build items array for parts (convert cents to dollars for FinalInvoice)
                        const partItems = summaryTicketItems.map((item: any) => {
                          const unitPriceCents = toCents(item.unitPrice || '0', locale);
                          const itemTotalCents = unitPriceCents * item.quantity;
                          return {
                            description: item.inventoryItem?.name || t("unnamed_item", "Unnamed Item"),
                            quantity: item.quantity,
                            unitPrice: unitPriceCents / 100,
                            total: itemTotalCents / 100,
                          };
                        });

                        const totalServicesCents = services.reduce((total: number, serviceId: string) => {
                          const service = ticketRepairServices.find(s => s.id === serviceId);
                          if (service) {
                            const serviceCostCents = toCents(service.estimatedLaborCost || '0', locale);
                            return addCents(total, serviceCostCents);
                          }
                          return total;
                        }, 0);
                        
                        const totalItemsCents = summaryTicketItems.reduce((total: number, item: any) => {
                          const unitPriceCents = toCents(item.unitPrice || '0', locale);
                          const itemTotalCents = unitPriceCents * item.quantity;
                          return addCents(total, itemTotalCents);
                        }, 0);
                        
                        const extraCostCents = ticket.costEstimation ? toCents(ticket.costEstimation, locale) : 0;
                        
                        // Calculate warranty cost and valid until date
                        let warrantyCostCents = 0;
                        let warrantyValidUntil = null;
                        const warrantyType = ticket.warrantyType || 'standard';
                        
                        if (warrantyTiers && warrantyTiers.length > 0) {
                          const warrantyTier = warrantyTiers.find((tier: any) => 
                            tier.tierType === warrantyType && tier.isActive
                          );
                          
                          if (warrantyTier) {
                            warrantyCostCents = toCents(warrantyTier.price || '0', locale);
                            
                            // Calculate warranty valid until date based on completion date
                            if (ticket.completedAt && warrantyTier.durationMonths) {
                              const completedDate = new Date(ticket.completedAt);
                              const validUntilDate = new Date(completedDate);
                              validUntilDate.setMonth(validUntilDate.getMonth() + warrantyTier.durationMonths);
                              warrantyValidUntil = formatDate(validUntilDate);
                            }
                          }
                        }
                        
                        // Subtotal is only parts + labor (excluding extra costs and warranty)
                        const subtotalCents = addCents(totalServicesCents, totalItemsCents);
                        const taxCents = 0; // No tax for now
                        // Total includes subtotal + extra costs + warranty + tax
                        const totalCents = addCents(addCents(addCents(subtotalCents, extraCostCents), warrantyCostCents), taxCents);

                        // Find pickup signature for the invoice
                        const pickupSignature = ticketSignatures.find(
                          (sig: any) => sig.type === 'pickup' && sig.status === 'signed' && sig.signaturePng
                        );

                        generateAndPrintInvoice.mutate({
                          ticketId: ticket.id,
                          type: 'final',
                          InvoiceComponent: FinalInvoice,
                          invoiceProps: {
                            shopName: storeSettings.storeName || 'Repair Shop',
                            shopLogo: storeSettings.logoUrl || null,
                            shopAddress: storeSettings.address || null,
                            invoiceNumber: formatTicketId(ticket.id),
                            invoiceDate: formatDate(new Date()),
                            customerName: `${clientData.firstName || ''} ${clientData.lastName || ''}`.trim() || 'N/A',
                            customerPhone: clientData.phone || null,
                            customerEmail: clientData.email || null,
                            deviceType: ticket.deviceType || null,
                            deviceBrand: ticket.deviceBrand || null,
                            deviceModel: ticket.deviceModel || null,
                            serialNumber: null,
                            items: partItems,
                            laborDescription: services.map((serviceId: string) => {
                              const service = ticketRepairServices.find(s => s.id === serviceId);
                              return service?.name || '';
                            }).filter(Boolean).join(', ') || null,
                            laborHours: null,
                            laborRate: null,
                            laborTotal: totalServicesCents / 100,
                            extraCost: extraCostCents > 0 ? extraCostCents / 100 : null,
                            extraCostDescription: extraCostCents > 0 ? t('additional_costs', 'Additional costs') : null,
                            warrantyCost: warrantyCostCents > 0 ? warrantyCostCents / 100 : null,
                            warrantyType: warrantyType,
                            warrantyValidUntil: warrantyValidUntil,
                            subtotal: subtotalCents / 100,
                            taxRate: 0,
                            taxAmount: taxCents / 100,
                            totalAmount: totalCents / 100,
                            paymentMethod: null,
                            warrantyText: storeSettings?.warrantyTermsText || null,
                            footerText: null,
                            language: locale,
                            pickupSignaturePng: pickupSignature?.signaturePng || null,
                            pickupSignedAt: pickupSignature?.signedAt ? formatDate(new Date(pickupSignature.signedAt)) : null,
                          },
                        });
                      }}
                      disabled={generateAndPrintInvoice.isPending || !clientData || !storeSettings}
                      data-testid="button-print-final-invoice"
                    >
                      {generateAndPrintInvoice.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Printer className="h-4 w-4" />
                      )}
                      {t("print_final_invoice", "Print Final Invoice")}
                    </Button>
                  </PermissionGate>
                </div>
              </div>

              {/* Created Date */}
              <div className="bg-muted/5 border border-muted/20 rounded-lg p-3">
                <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  {t("created_date", "Created Date")}
                </h3>
                <div className="text-xs text-slate-200">
                  {formatDate(ticket.createdAt)}
                </div>
              </div>

              {/* Notes Section */}
              <div className="bg-muted/5 border border-muted/20 rounded-lg p-3">
                <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  {t("notes", "Notes")}
                </h3>
                
                {/* Add new note */}
                <div className="space-y-2 mb-3">
                  <Textarea
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder={t("note_placeholder", "Add a note about this ticket...")}
                    rows={2}
                    className="resize-none text-xs"
                  />
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      onClick={async () => {
                        try {
                          await fetch(`/api/tickets/${ticket.id}/notes`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ content: newNote })
                          });
                          setNewNote('');
                          // Refresh notes
                          const updatedNotes = await fetch(`/api/tickets/${ticket.id}/notes`).then(r => r.json());
                          setNotes(updatedNotes);
                        } catch (error) {
                          console.error('Failed to save note:', error);
                        }
                      }}
                      disabled={!newNote.trim()}
                      className="h-7 text-xs"
                    >
                      {t("save_note", "Save Note")}
                    </Button>
                  </div>
                </div>
                
                {/* Display existing notes */}
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {notes.length === 0 ? (
                    <div className="text-xs text-muted-foreground text-center py-2">
                      {t("no_notes", "No notes yet")}
                    </div>
                  ) : (
                    notes.map((note) => (
                      <div key={note.id} className="bg-slate-800/50 dark:bg-slate-900/50 p-2 rounded border border-cyan-500/20">
                        <p className="text-xs text-slate-200">{note.content}</p>
                        <div className="text-xs text-cyan-400 mt-1">
                          {new Date(note.createdAt).toLocaleString()}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Problems Tab */}
          <TabsContent value="problems" className="space-y-4">
            <ProblemsTabContent 
              ticketId={ticket.id}
              deviceType={ticket.deviceType || ''}
              issueResponses={issueResponses}
            />
            
            {/* Defects Section */}
            {(() => {
              // Extract selected defects from issue responses
              const selectedDefectsResponse = issueResponses?.find(
                response => response.questionId === 'selected_defects'
              );
              
              let selectedDefects: string[] = [];
              if (selectedDefectsResponse) {
                try {
                  // Parse the defects array from stored data
                  const defectsData = selectedDefectsResponse.response;
                  if (Array.isArray(defectsData)) {
                    selectedDefects = defectsData;
                  } else if (typeof defectsData === 'string') {
                    selectedDefects = JSON.parse(defectsData);
                  }
                } catch (error) {
                  console.error('Failed to parse selected defects:', error);
                  selectedDefects = [];
                }
              }

              // Only render if defects were selected
              if (!selectedDefects || selectedDefects.length === 0) {
                return null;
              }

              return (
                <div className="bg-muted/5 border border-muted/20 rounded-lg p-3">
                  <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                    {t("identified_defects", "Identified Defects")}
                    <Badge variant="outline" className="border-red-500 text-red-400">
                      {selectedDefects.length} {t("defects_found", "found")}
                    </Badge>
                  </h3>
                  
                  <div className="mb-3">
                    <p className="text-xs text-muted-foreground">
                      {t("defects_found_during_assessment", "Defects found during device assessment")}
                    </p>
                  </div>
                  
                  {/* Defects List */}
                  <DefectsList 
                    selectedDefects={selectedDefects} 
                    deviceType={ticket.deviceType || ''} 
                  />
                </div>
              );
            })()}
          </TabsContent>

          {/* Checklist Tab */}
          <TabsContent value="checklist" className="space-y-4">
            <div className="space-y-3">
              <h3 className="font-semibold text-lg">{t("service_checklist", "Service Checklist")}</h3>
              
              {(() => {
                const serviceChecklist = ticket.serviceChecklist as any;
                const selectedChecklists = serviceChecklist?.selectedChecklists || [];
                
                if (!selectedChecklists || selectedChecklists.length === 0) {
                  return (
                    <div className="text-sm text-muted-foreground">
                      {t("no_checklist_available", "No service checklist available")}
                    </div>
                  );
                }

                return (
                  <div className="space-y-4">
                    {/* Selected Checklists Header */}
                    <div className="bg-gradient-to-r from-[#0A192F] to-[#00FFFF] rounded-lg p-4">
                      <div className="flex items-center gap-3">
                        <Check className="w-5 h-5 text-white" />
                        <h4 className="font-semibold text-white">
                          {t("selected_checklists", "Selected Checklists")}
                        </h4>
                        <div className="bg-white/20 text-white text-xs px-2 py-1 rounded-full font-medium">
                          {selectedChecklists.length}
                        </div>
                      </div>
                      <p className="text-cyan-100 text-sm mt-1">
                        {t("checklists_for_service", "Checklists configured for this service")}
                      </p>
                    </div>

                    {/* Additional Notes */}
                    {serviceChecklist?.additionalNotes && (
                      <div className="bg-blue-50/50 dark:bg-blue-950/20 p-3 rounded border border-blue-200/50 dark:border-blue-800/50">
                        <div className="font-medium text-sm mb-2 flex items-center gap-2">
                          <MessageSquare className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          {t("additional_notes", "Additional Notes")}
                        </div>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                          {serviceChecklist.additionalNotes}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </TabsContent>

          {/* Signatures Tab */}
          <TabsContent value="signatures" className="space-y-4">
            <div className="bg-muted/5 border border-muted/20 rounded-lg p-4">
              <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
                <PenTool className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                {t("signature_history", "Signature History")}
              </h3>

              {/* Dropoff Signature Section */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-sm flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5 text-blue-500" />
                    {t("dropoff_signature", "Drop-off Signature")}
                  </h4>
                  {(() => {
                    const dropoffSig = ticketSignatures.find((sig: any) => sig.type === 'dropoff');
                    if (!dropoffSig) {
                      return (
                        <Badge variant="outline" className="text-xs bg-gray-500/10 text-gray-400 border-gray-500/20">
                          {t("not_requested", "Not requested")}
                        </Badge>
                      );
                    }
                    if (dropoffSig.status === 'signed') {
                      return (
                        <Badge variant="outline" className="text-xs bg-green-500/10 text-green-400 border-green-500/20">
                          <Check className="h-3 w-3 mr-1" />
                          {t("signed", "Signed")}
                        </Badge>
                      );
                    }
                    if (dropoffSig.status === 'expired') {
                      return (
                        <Badge variant="outline" className="text-xs bg-red-500/10 text-red-400 border-red-500/20">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          {t("expired", "Expired")}
                        </Badge>
                      );
                    }
                    return (
                      <Badge variant="outline" className="text-xs bg-yellow-500/10 text-yellow-400 border-yellow-500/20">
                        <Clock className="h-3 w-3 mr-1" />
                        {t("pending", "Pending")}
                      </Badge>
                    );
                  })()}
                </div>
                {(() => {
                  const dropoffSig = ticketSignatures.find((sig: any) => sig.type === 'dropoff');
                  if (dropoffSig) {
                    return (
                      <div className="space-y-3">
                        {dropoffSig.signaturePng && (
                          <div className="bg-white p-3 rounded border border-border/50">
                            <img 
                              src={`data:image/png;base64,${dropoffSig.signaturePng}`} 
                              alt={t("dropoff_signature", "Drop-off Signature")}
                              className="max-h-20 mx-auto"
                              data-testid="img-dropoff-signature"
                            />
                            {dropoffSig.signedAt && (
                              <div className="text-xs text-center text-muted-foreground mt-2">
                                {t("signed_on", "Signed on")}: {formatDate(new Date(dropoffSig.signedAt))}
                              </div>
                            )}
                          </div>
                        )}
                        <div className="border border-border/30 rounded-lg overflow-hidden">
                          <div className="bg-muted/30 px-3 py-2 border-b border-border/30 flex items-center gap-2">
                            <History className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-xs font-medium">{t("audit_trail", "Audit Trail")}</span>
                          </div>
                          <div className="max-h-48 overflow-y-auto">
                            <SignatureAuditTrail signatureRequestId={dropoffSig.id} />
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div className="text-sm text-muted-foreground italic">
                      {t("no_dropoff_signature_requested", "No drop-off signature has been requested yet")}
                    </div>
                  );
                })()}
              </div>

              {/* Pickup Signature Section */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-sm flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5 text-green-500" />
                    {t("pickup_signature", "Pick-up Signature")}
                  </h4>
                  {(() => {
                    const pickupSig = ticketSignatures.find((sig: any) => sig.type === 'pickup');
                    if (!pickupSig) {
                      return (
                        <Badge variant="outline" className="text-xs bg-gray-500/10 text-gray-400 border-gray-500/20">
                          {t("not_requested", "Not requested")}
                        </Badge>
                      );
                    }
                    if (pickupSig.status === 'signed') {
                      return (
                        <Badge variant="outline" className="text-xs bg-green-500/10 text-green-400 border-green-500/20">
                          <Check className="h-3 w-3 mr-1" />
                          {t("signed", "Signed")}
                        </Badge>
                      );
                    }
                    if (pickupSig.status === 'expired') {
                      return (
                        <Badge variant="outline" className="text-xs bg-red-500/10 text-red-400 border-red-500/20">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          {t("expired", "Expired")}
                        </Badge>
                      );
                    }
                    return (
                      <Badge variant="outline" className="text-xs bg-yellow-500/10 text-yellow-400 border-yellow-500/20">
                        <Clock className="h-3 w-3 mr-1" />
                        {t("pending", "Pending")}
                      </Badge>
                    );
                  })()}
                </div>
                {(() => {
                  const pickupSig = ticketSignatures.find((sig: any) => sig.type === 'pickup');
                  if (pickupSig) {
                    return (
                      <div className="space-y-3">
                        {pickupSig.signaturePng && (
                          <div className="bg-white p-3 rounded border border-border/50">
                            <img 
                              src={`data:image/png;base64,${pickupSig.signaturePng}`} 
                              alt={t("pickup_signature", "Pick-up Signature")}
                              className="max-h-20 mx-auto"
                              data-testid="img-pickup-signature"
                            />
                            {pickupSig.signedAt && (
                              <div className="text-xs text-center text-muted-foreground mt-2">
                                {t("signed_on", "Signed on")}: {formatDate(new Date(pickupSig.signedAt))}
                              </div>
                            )}
                          </div>
                        )}
                        <div className="border border-border/30 rounded-lg overflow-hidden">
                          <div className="bg-muted/30 px-3 py-2 border-b border-border/30 flex items-center gap-2">
                            <History className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-xs font-medium">{t("audit_trail", "Audit Trail")}</span>
                          </div>
                          <div className="max-h-48 overflow-y-auto">
                            <SignatureAuditTrail signatureRequestId={pickupSig.id} />
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div className="text-sm text-muted-foreground italic">
                      {t("no_pickup_signature_requested", "No pick-up signature has been requested yet")}
                    </div>
                  );
                })()}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Footer Actions */}
        <div className="flex justify-between items-center mt-6 pt-4 border-t">
          {onDelete && ticket.status !== 'finalized' ? (
            <PermissionGate permission={PERMISSIONS.TICKETS_DELETE}>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => onDelete(ticket.id)}
                data-testid="button-delete-ticket"
              >
                {t("delete_ticket", "Delete Ticket")}
              </Button>
            </PermissionGate>
          ) : <div />}
          <Button variant="outline" onClick={onClose} data-testid="button-close-ticket-summary">
            {t("close", "Close")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
