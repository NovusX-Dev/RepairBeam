import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useLocalization } from "@/contexts/LocalizationContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { IssueAssessment } from "@/components/IssueAssessment";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import ProgressVisualization from "@/components/ProgressVisualization";
import { Plus, Clock, User, DollarSign, Check, AlertTriangle, Info, CalendarIcon, Shield, Smartphone, Loader2, MessageSquare, Filter, X, ChevronDown, ChevronUp, Minimize2, Maximize2, Edit } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from 'date-fns/locale';

// Brazilian phone formatting utility
const formatBrazilianPhone = (value: string): string => {
  // Remove all non-digits
  const digits = value.replace(/\D/g, '');
  
  // Limit to 11 digits (DDD + 9-digit cellphone)
  const limitedDigits = digits.slice(0, 11);
  
  // Apply formatting based on length
  if (limitedDigits.length <= 2) {
    return `(${limitedDigits}`;
  } else if (limitedDigits.length <= 7) {
    return `(${limitedDigits.slice(0, 2)})${limitedDigits.slice(2)}`;
  } else {
    return `(${limitedDigits.slice(0, 2)})${limitedDigits.slice(2, 7)}-${limitedDigits.slice(7)}`;
  }
};
import type { Ticket, Client, TicketStatus, TicketPriority } from "@shared/schema";
import { useDeviceBrands, useValidateBrand, useValidateModel } from "@/hooks/useDeviceBrands";
import { useDeviceColors, useSaveCustomColor } from '@/hooks/useDeviceColors';
import { useDeviceModels } from "@/hooks/useDeviceModels";
import { useToast } from "@/hooks/use-toast";

// Problems Tab Component
interface ProblemsTabContentProps {
  ticketId: string;
  deviceType: string;
  issueResponses: any[];
}

function ProblemsTabContent({ ticketId, deviceType, issueResponses }: ProblemsTabContentProps) {
  const { t } = useLocalization();
  
  // Fetch issue questions to get question text and types
  const { data: questions = [] } = useQuery({
    queryKey: ['/api/issue-questions', deviceType],
    enabled: !!deviceType,
  });

  // Create a map of question ID to question data
  const questionMap = questions.reduce((acc: any, question: any) => {
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
      {!issueResponses || issueResponses.length === 0 ? (
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
              ({issueResponses.length} {t("responses", "responses")})
            </span>
          </h3>
          
          <div className="space-y-2">
            {issueResponses.map((response, index) => {
              // Handle special case for additional comments
              if (response.questionId === 'additional_comments') {
                return (
                  <div key={response.id || index} className="bg-blue-50/50 dark:bg-blue-950/20 p-2 rounded border border-blue-200/50 dark:border-blue-800/50">
                    <div className="font-medium text-xs mb-1 text-foreground flex items-center gap-2">
                      <MessageSquare className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                      {t("additional_comments", "Additional Comments")}
                    </div>
                    <div className="text-xs text-muted-foreground italic">
                      "{response.response}"
                    </div>
                  </div>
                );
              }

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

// Kanban column configuration
const getKanbanColumns = (t: (key: string, fallback?: string) => string) => [
  { id: 'backlog', title: t('backlog', 'Backlog'), color: 'bg-gray-100' },
  { id: 'waiting_diagnostics', title: t('waiting_diagnostics', 'Waiting on Diagnostics'), color: 'bg-yellow-100' },
  { id: 'waiting_client_approval', title: t('waiting_client_approval', 'Waiting on Client Approval'), color: 'bg-orange-100' },
  { id: 'approved', title: t('approved', 'Approved'), color: 'bg-green-100' },
  { id: 'servicing', title: t('servicing', 'Servicing'), color: 'bg-blue-100' },
  { id: 'quality_check', title: t('quality_check', 'Quality Check'), color: 'bg-purple-100' },
  { id: 'final_customer_check', title: t('final_customer_check', 'Final Customer Check'), color: 'bg-pink-100' },
  { id: 'finalized', title: t('finalized', 'Finalized / Done'), color: 'bg-emerald-100' },
] as const;

// Ticket creation steps configuration
const getTicketSteps = (t: (key: string, fallback?: string) => string) => [
  { id: 'client_info', title: t('client_information', 'Client Information'), icon: User },
  { id: 'device_details', title: t('device_specifications', 'Device Specifications'), icon: Clock },
  { id: 'problem_description', title: t('issue_assessment', 'Issue Assessment'), icon: DollarSign },
  { id: 'service_timeline', title: t('service_timeline', 'Service Timeline & Coverage'), icon: Clock },
  { id: 'price_estimation', title: t('price_estimation', 'Price Estimation'), icon: DollarSign },
  { id: 'service_checklist', title: t('service_checklist', 'Service Checklist'), icon: Check },
  { id: 'client_authorization', title: t('client_authorization', 'Client Authorization'), icon: Check },
];

// Form data interface
interface TicketFormData {
  // Client Information
  firstName: string;
  lastName: string;
  cpf: string;
  streetAddress: string;
  streetNumber: string;
  apartment: string;
  birthday: string;
  email: string;
  phone: string;
  // Device Information
  deviceType: string;
  deviceBrand: string;
  deviceModel: string;
  deviceColor: string;
  deviceMemory: string;
  deviceStorageCapacity: string;
  serialNumber: string;
  // Service Timeline & Coverage
  clientDeadline: string;
  technicianEstimatedHours: string;
  warrantyType: string;
  costEstimation: string;
  warrantyCost: string;
  totalCost: string;
  costExplanation: string;
  // Service Checklist
  deviceComponents: { [component: string]: string }; // component -> condition mapping
  additionalNotes: string;
  // Issue Assessment
  issueResponses?: Array<{ questionId: string; answer: any }>;
  // Client Authorization
  clientApproved: boolean;
}

type TicketWithClient = Ticket & { client?: Client };

// Currency formatting utility
const formatCurrency = (amount: number, language: string = 'en') => {
  const currency = language === 'pt-BR' ? 'R$' : '$';
  const formattedAmount = language === 'pt-BR' 
    ? amount.toFixed(2).replace('.', ',')  // Brazilian format uses comma for decimals
    : amount.toFixed(2);  // US format uses period for decimals
  return `${currency}${formattedAmount}`;
};

// Helper component for form field with tooltip
interface FormFieldWithTooltipProps {
  label: string;
  tooltip: string;
  required?: boolean;
  hasError?: boolean;
  isValid?: boolean;
  errorMessage?: string;
  children: React.ReactNode;
}

function FormFieldWithTooltip({ 
  label, 
  tooltip, 
  required = false, 
  hasError = false, 
  isValid = false, 
  errorMessage,
  children 
}: FormFieldWithTooltipProps) {
  const { t } = useLocalization();
  const wrapperClasses = `
    form-field-wrapper
    ${hasError ? 'form-field-error' : ''}
    ${isValid ? 'form-field-success' : ''}
  `.trim();

  return (
    <div className={wrapperClasses}>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Label className="flex items-center gap-2">
            {label} {required && <span className="text-red-500">*</span>}
          </Label>
          <div className="flex items-center gap-1">
            <Tooltip delayDuration={300}>
              <TooltipTrigger asChild>
                <Info className="h-4 w-4 text-muted-foreground hover:text-primary cursor-help transition-colors" />
              </TooltipTrigger>
              <TooltipContent 
                side="top"
                sideOffset={8}
                align="center"
                className="max-w-xs bg-[#0A192F] border-[#00FFFF] text-white shadow-lg shadow-[#00FFFF]/20"
              >
                <p className="text-sm">{tooltip}</p>
              </TooltipContent>
            </Tooltip>
            {isValid && (
              <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center success-checkmark">
                <Check className="w-2.5 h-2.5 text-white" />
              </div>
            )}
          </div>
        </div>
        {children}
        
        {/* Whimsical Error State */}
        {hasError && errorMessage && (
          <div className="mt-2 flex items-center gap-2 animate-in slide-in-from-top-2 duration-300">
            <div className="text-red-400 animate-bounce text-lg">
              😅
            </div>
            <span className="text-sm text-red-400 font-medium animate-pulse">
              {errorMessage}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function KanbanTickets() {
  const [draggedTicket, setDraggedTicket] = useState<string | null>(null);
  const [dragHoverColumn, setDragHoverColumn] = useState<string | null>(null);
  const [dragHoverTimeout, setDragHoverTimeout] = useState<NodeJS.Timeout | null>(null);
  const [selectedTicketSummary, setSelectedTicketSummary] = useState<TicketWithClient | null>(null);
  const [newNote, setNewNote] = useState('');
  const [notes, setNotes] = useState<any[]>([]);
  const [issueResponses, setIssueResponses] = useState<any[]>([]);
  const [checklistComponentOrder, setChecklistComponentOrder] = useState<string[]>([]);
  const [shouldCompleteAssessment, setShouldCompleteAssessment] = useState(false);
  const [activeTab, setActiveTab] = useState('general');
  
  // Card collapse/expand state
  const [collapsedCards, setCollapsedCards] = useState<Set<string>>(new Set());
  const [allCardsCollapsed, setAllCardsCollapsed] = useState(true); // Default state is collapsed
  const [isTicketDialogOpen, setIsTicketDialogOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<TicketFormData>({
    firstName: '',
    lastName: '',
    cpf: '',
    streetAddress: '',
    streetNumber: '',
    apartment: '',
    birthday: '',
    email: '',
    phone: '',
    deviceType: '',
    deviceBrand: '',
    deviceModel: '',
    deviceColor: '',
    deviceMemory: '',
    deviceStorageCapacity: '',
    serialNumber: '',
    // Service Timeline & Coverage defaults
    clientDeadline: '',
    technicianEstimatedHours: '',
    warrantyType: 'standard',
    costEstimation: '',
    warrantyCost: '0',
    totalCost: '',
    costExplanation: '',
    // Service Checklist
    deviceComponents: {},
    additionalNotes: '',
    // Issue Assessment
    issueResponses: [],
    // Client Authorization
    clientApproved: false,
  });
  const [displayCPF, setDisplayCPF] = useState('');
  const [formErrors, setFormErrors] = useState<Partial<TicketFormData>>({});
  const [fieldValidation, setFieldValidation] = useState<Record<string, { isValid: boolean; hasError: boolean }>>({});
  
  // Date picker state
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  
  // Client search state
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showClientForm, setShowClientForm] = useState(false);
  
  // Client editing state
  const [showEditClientModal, setShowEditClientModal] = useState(false);
  const [editClientData, setEditClientData] = useState({
    firstName: '',
    lastName: '',
    cpf: '',
    email: '',
    phone: ''
  });
  
  // CPF conflict state
  const [showCPFConflict, setShowCPFConflict] = useState(false);
  const [conflictClient, setConflictClient] = useState<Client | null>(null);
  
  // Ticket creation confirmation state
  const [showCreateConfirmation, setShowCreateConfirmation] = useState(false);
  
  // Filter state management
  const [filters, setFilters] = useState({
    priority: 'all',
    name: '',
    cpf: '',
    deviceType: 'all',
    ticketId: '',
  });
  const [showFilters, setShowFilters] = useState(false);
  
  const queryClient = useQueryClient();
  const { t, currentLanguage } = useLocalization();
  const { toast } = useToast();

  // Fetch notes and issue responses when ticket summary modal opens
  useEffect(() => {
    if (selectedTicketSummary) {
      // Fetch notes
      fetch(`/api/tickets/${selectedTicketSummary.id}/notes`)
        .then(r => r.json())
        .then(setNotes)
        .catch(error => {
          console.error('Failed to fetch notes:', error);
          setNotes([]);
        });
      
      // Fetch issue responses
      fetch(`/api/tickets/${selectedTicketSummary.id}/issue-responses`)
        .then(r => r.json())
        .then(setIssueResponses)
        .catch(error => {
          console.error('Failed to fetch issue responses:', error);
          setIssueResponses([]);
        });

      // Fetch checklist template for component order
      if (selectedTicketSummary.deviceType) {
        fetch(`/api/device-checklist-templates/${selectedTicketSummary.deviceType}`)
          .then(r => r.json())
          .then(template => {
            if (template?.components && Array.isArray(template.components)) {
              setChecklistComponentOrder(template.components);
            }
          })
          .catch(error => {
            console.error('Failed to fetch checklist template:', error);
            setChecklistComponentOrder([]);
          });
      }
    } else {
      setNotes([]);
      setIssueResponses([]);
      setChecklistComponentOrder([]);
    }
  }, [selectedTicketSummary]);

  // Calculate warranty cost and total cost
  const calculateCosts = (estimation = formData.costEstimation, warranty = formData.warrantyType) => {
    const basePrice = parseFloat(estimation) || 0;
    const warrantyPrice = warranty === 'extended' 
      ? (tenant?.settings?.extendedWarrantyPrice || 50)
      : 0;
    const total = basePrice + warrantyPrice;
    
    // Update both fields in a single state update to prevent timing issues
    setFormData(prev => ({
      ...prev,
      warrantyCost: warrantyPrice.toFixed(2),
      totalCost: total.toFixed(2)
    }));
  };

  // Device checklist template query
  const { data: checklistTemplate, isLoading: isLoadingChecklist } = useQuery<any>({
    queryKey: ['/api/device-checklist-templates', formData.deviceType],
    enabled: !!formData.deviceType && currentStep === 5,
  });
  
  const kanbanColumns = getKanbanColumns(t);
  const ticketSteps = getTicketSteps(t);

  // Fetch tickets with client information
  const { data: tickets = [], isLoading } = useQuery<TicketWithClient[]>({
    queryKey: ["/api/tickets"],
    retry: false,
  });

  // Sync selectedTicketSummary with updated tickets data when tickets change
  useEffect(() => {
    if (selectedTicketSummary && tickets.length > 0) {
      const updatedTicket = tickets.find(ticket => ticket.id === selectedTicketSummary.id);
      if (updatedTicket && updatedTicket.status !== selectedTicketSummary.status) {
        // Update selectedTicketSummary with fresh data when status changes
        setSelectedTicketSummary(updatedTicket);
      }
    }
  }, [tickets, selectedTicketSummary]);

  // Initialize all cards as collapsed by default
  useEffect(() => {
    if (tickets.length > 0) {
      const allTicketIds = new Set(tickets.map(ticket => ticket.id));
      setCollapsedCards(allTicketIds);
    }
  }, [tickets]);

  // Helper functions for card collapse/expand
  const toggleCardCollapse = (ticketId: string, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent opening the ticket summary modal
    setCollapsedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(ticketId)) {
        newSet.delete(ticketId);
      } else {
        newSet.add(ticketId);
      }
      
      // Don't update global state when individual cards are toggled
      // Global state should only change when the global button is clicked
      
      return newSet;
    });
  };

  const toggleAllCards = () => {
    if (allCardsCollapsed) {
      // Expand all cards
      setCollapsedCards(new Set());
      setAllCardsCollapsed(false);
    } else {
      // Collapse all cards
      const allTicketIds = new Set(tickets.map(ticket => ticket.id));
      setCollapsedCards(allTicketIds);
      setAllCardsCollapsed(true);
    }
  };

  // Check if a specific card is collapsed
  const isCardCollapsed = (ticketId: string) => collapsedCards.has(ticketId);

  // Tenant settings query for extended warranty price (temporarily simplified)
  const { data: tenant } = useQuery<any>({
    queryKey: ["/api/tenants/current"],
    retry: false,
  });

  // Auto-calculate costs when tenant data loads (initial calculation only)
  useEffect(() => {
    if (tenant && (formData.costEstimation || formData.warrantyType !== 'standard')) {
      calculateCosts(formData.costEstimation, formData.warrantyType);
    }
  }, [tenant?.settings?.extendedWarrantyPrice]); // Only depend on tenant, not form data to avoid conflicts

  // Client search query
  const { data: searchResults = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients/search", clientSearchQuery],
    queryFn: async () => {
      if (clientSearchQuery.length < 2) return [];
      const response = await fetch(`/api/clients/search?q=${encodeURIComponent(clientSearchQuery)}`);
      if (!response.ok) throw new Error('Failed to search clients');
      return response.json();
    },
    enabled: clientSearchQuery.length >= 2,
    retry: false,
  });

  // Device brands query - fetches AI-generated brand list based on device type
  const { data: deviceBrands, isLoading: brandsLoading } = useDeviceBrands(
    formData.deviceType || null
  );
  
  // Device models query - fetches AI-generated model list based on device type and brand
  const { data: deviceModels, isLoading: modelsLoading } = useDeviceModels(
    formData.deviceType || '',
    formData.deviceBrand || ''
  );

  // Device colors query - fetches colors from free API based on device type, brand, and model
  const { data: deviceColors, isLoading: colorsLoading } = useDeviceColors(
    formData.deviceType || '',
    formData.deviceBrand || '',
    formData.deviceModel || ''
  );

  // Brand and model validation hooks
  const { validateBrand } = useValidateBrand();
  const { validateModel } = useValidateModel();
  const { saveCustomColor } = useSaveCustomColor();

  // Update ticket status mutation
  const updateTicketStatus = useMutation({
    mutationFn: async ({ ticketId, status }: { ticketId: string; status: TicketStatus }) => {
      return await apiRequest("PUT", `/api/tickets/${ticketId}/status`, { status });
    },
    onMutate: async ({ ticketId, status }) => {
      // Cancel any outgoing refetches to avoid optimistic update being overwritten
      await queryClient.cancelQueries({ queryKey: ["/api/tickets"] });

      // Snapshot the previous value
      const previousTickets = queryClient.getQueryData(["/api/tickets"]);

      // Optimistically update to the new value
      queryClient.setQueryData(["/api/tickets"], (old: any) => {
        if (!old) return old;
        return old.map((ticket: any) =>
          ticket.id === ticketId ? { ...ticket, status } : ticket
        );
      });

      // Return a context object with the snapshotted value
      return { previousTickets };
    },
    onError: (err, variables, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousTickets) {
        queryClient.setQueryData(["/api/tickets"], context.previousTickets);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tickets"] });
    },
  });

  // Update ticket priority mutation
  const updateTicketPriority = useMutation({
    mutationFn: async ({ ticketId, priority }: { ticketId: string; priority: TicketPriority }) => {
      return await apiRequest("PUT", `/api/tickets/${ticketId}/priority`, { priority });
    },
    onMutate: async ({ ticketId, priority }) => {
      // Cancel any outgoing refetches to avoid optimistic update being overwritten
      await queryClient.cancelQueries({ queryKey: ["/api/tickets"] });

      // Snapshot the previous value
      const previousTickets = queryClient.getQueryData(["/api/tickets"]);

      // Optimistically update to the new value
      queryClient.setQueryData(["/api/tickets"], (old: any) => {
        if (!old) return old;
        return old.map((ticket: any) =>
          ticket.id === ticketId ? { ...ticket, priority } : ticket
        );
      });

      // Update selected ticket summary if it's the same ticket
      if (selectedTicketSummary && selectedTicketSummary.id === ticketId) {
        setSelectedTicketSummary(prev => prev ? { ...prev, priority } : null);
      }

      // Return a context object with the snapshotted value
      return { previousTickets };
    },
    onError: (err, variables, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousTickets) {
        queryClient.setQueryData(["/api/tickets"], context.previousTickets);
      }
      toast({
        title: t("error", "Error"),
        description: t("priority_update_failed", "Failed to update ticket priority"),
        variant: "destructive",
      });
    },
    onSuccess: () => {
      toast({
        title: t("success", "Success"),
        description: t("priority_updated", "Ticket priority updated successfully"),
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tickets"] });
    },
  });

  // Create client mutation
  const createClientMutation = useMutation({
    mutationFn: async (clientData: Omit<Client, 'id' | 'createdAt' | 'updatedAt' | 'tenantId'>) => {
      const response = await apiRequest("POST", "/api/clients", clientData);
      return await response.json();
    },
    onSuccess: (newClient: Client) => {
      setSelectedClient(newClient);
      setShowClientForm(false);
      setFormData({
        firstName: '',
        lastName: '',
        cpf: '',
        streetAddress: '',
        streetNumber: '',
        apartment: '',
        birthday: '',
        email: '',
        phone: '',
        deviceType: '',
        deviceBrand: '',
        deviceModel: '',
        deviceColor: '',
        deviceMemory: '',
        deviceStorageCapacity: '',
        serialNumber: '',
        // Service Timeline & Coverage defaults
        clientDeadline: '',
        technicianEstimatedHours: '',
        warrantyType: 'standard',
        costEstimation: '',
        warrantyCost: '0',
        totalCost: '',
        costExplanation: '',
        // Service Checklist defaults
        deviceComponents: {},
        additionalNotes: '',
        // Issue Assessment defaults
        issueResponses: [],
        // Client Authorization defaults
        clientApproved: false,
      });
      setDisplayCPF('');
      setFormErrors({});
    },
  });

  // Update client mutation
  const updateClientMutation = useMutation({
    mutationFn: async ({ clientId, clientData }: { clientId: string; clientData: Partial<Client> }) => {
      const response = await apiRequest("PUT", `/api/clients/${clientId}`, clientData);
      return await response.json();
    },
    onSuccess: (updatedClient: Client) => {
      setSelectedClient(updatedClient);
      setShowEditClientModal(false);
      
      // Invalidate client searches to refresh any cached data
      queryClient.invalidateQueries({ queryKey: ['/api/clients'] });
      
      toast({
        title: t("success", "Success"),
        description: t("client_updated_successfully", "Client information updated successfully"),
      });
    },
    onError: (error) => {
      console.error('Failed to update client:', error);
      toast({
        title: t("error", "Error"),
        description: t("client_update_failed", "Failed to update client information. Please try again."),
        variant: "destructive",
      });
    },
  });

  const createTicketMutation = useMutation({
    mutationFn: async (ticketData: Omit<Ticket, 'id' | 'createdAt' | 'updatedAt' | 'tenantId'>) => {
      const response = await apiRequest("POST", "/api/tickets", ticketData);
      return await response.json();
    },
    onSuccess: (newTicket: Ticket) => {
      // Refresh tickets query to show the new ticket
      queryClient.invalidateQueries({ queryKey: ['/api/tickets'] });
      
      // Close the dialog and reset form
      handleDialogChange(false);
      
      // Show success toast
      toast({
        title: t("success", "Success"),
        description: t("ticket_created_successfully", "Ticket created successfully!"),
      });
    },
    onError: (error) => {
      console.error('Failed to create ticket:', error);
      toast({
        title: t("error", "Error"),
        description: t("ticket_creation_failed", "Failed to create ticket. Please try again."),
        variant: "destructive",
      });
    },
  });

  // Check for CPF conflict
  const checkCPFConflict = async (cpf: string) => {
    if (cpf.length !== 11) return;
    
    try {
      const response = await fetch(`/api/clients/cpf/${cpf}`);
      if (response.ok) {
        const existingClient = await response.json();
        setConflictClient(existingClient);
        setShowCPFConflict(true);
      }
    } catch (error) {
      // No conflict found or error - continue normally
    }
  };

  // Filter tickets based on current filter criteria
  const filteredTickets = tickets.filter(ticket => {
    // Filter by priority
    if (filters.priority !== 'all' && ticket.priority !== filters.priority) {
      return false;
    }
    
    // Filter by client name (search in first name and last name)
    if (filters.name) {
      const fullName = `${ticket.client?.firstName || ''} ${ticket.client?.lastName || ''}`.toLowerCase();
      if (!fullName.includes(filters.name.toLowerCase())) {
        return false;
      }
    }
    
    // Filter by CPF
    if (filters.cpf) {
      const cleanFilterCPF = filters.cpf.replace(/\D/g, '');
      const ticketCPF = ticket.client?.cpf?.replace(/\D/g, '') || '';
      if (!ticketCPF.includes(cleanFilterCPF)) {
        return false;
      }
    }
    
    // Filter by device type
    if (filters.deviceType !== 'all' && ticket.deviceType !== filters.deviceType) {
      return false;
    }
    
    // Filter by ticket ID (search in ID)
    if (filters.ticketId) {
      const ticketIdSearch = filters.ticketId.toLowerCase();
      const ticketId = ticket.id.toLowerCase();
      if (!ticketId.includes(ticketIdSearch)) {
        return false;
      }
    }
    
    return true;
  });

  // Get unique device types for filter dropdown
  const deviceTypes = Array.from(new Set(
    tickets
      .map(ticket => ticket.deviceType)
      .filter(Boolean)
  )).sort();

  // Clear filters function
  const clearFilters = () => {
    setFilters({
      priority: 'all',
      name: '',
      cpf: '',
      deviceType: 'all',
      ticketId: '',
    });
  };

  // Check if any filters are active
  const hasActiveFilters = filters.priority !== 'all' || filters.name || filters.cpf || filters.deviceType !== 'all' || filters.ticketId;

  // Group filtered tickets by status
  const ticketsByStatus = kanbanColumns.reduce((acc, column) => {
    acc[column.id] = filteredTickets.filter(ticket => ticket.status === column.id);
    return acc;
  }, {} as Record<string, TicketWithClient[]>);

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, ticketId: string) => {
    setDraggedTicket(ticketId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    
    // Clear any existing timeout
    if (dragHoverTimeout) {
      clearTimeout(dragHoverTimeout);
    }
    
    // Set new timeout for hover highlighting
    const timeout = setTimeout(() => {
      setDragHoverColumn(columnId);
    }, 250); // 0.25 second delay
    
    setDragHoverTimeout(timeout);
  };

  const handleDragLeave = () => {
    // Clear timeout when leaving
    if (dragHoverTimeout) {
      clearTimeout(dragHoverTimeout);
      setDragHoverTimeout(null);
    }
    setDragHoverColumn(null);
  };

  const handleDrop = (e: React.DragEvent, newStatus: TicketStatus) => {
    e.preventDefault();
    if (draggedTicket) {
      const ticket = tickets.find(t => t.id === draggedTicket);
      if (ticket && ticket.status !== newStatus) {
        updateTicketStatus.mutate({ ticketId: draggedTicket, status: newStatus });
      }
    }
    setDraggedTicket(null);
    setDragHoverColumn(null);
    if (dragHoverTimeout) {
      clearTimeout(dragHoverTimeout);
      setDragHoverTimeout(null);
    }
  };

  const getPriorityColor = (priority: TicketPriority) => {
    switch (priority) {
      case 'vip': return 'bg-gradient-to-r from-purple-600 to-pink-600 text-white';
      case 'critical': return 'bg-gradient-to-r from-red-500 to-red-600 text-white';
      case 'medium': return 'bg-gradient-to-r from-yellow-500 to-amber-500 text-white';
      case 'low': return 'bg-gradient-to-r from-green-500 to-emerald-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const getPriorityLabel = (priority: TicketPriority) => {
    switch (priority) {
      case 'vip': return 'VIP';
      case 'critical': return t('critical', 'Critical');
      case 'medium': return t('medium', 'Medium');
      case 'low': return t('low', 'Low');
      default: return priority;
    }
  };

  // Get status-based card styling with good contrast
  const getStatusCardStyling = (status: string): string => {
    switch (status) {
      case 'backlog':
        return 'bg-gradient-to-br from-slate-50 to-slate-100 border-slate-300 hover:shadow-slate-200';
      case 'waiting_diagnostics':
        return 'bg-gradient-to-br from-amber-50 to-yellow-100 border-amber-300 hover:shadow-amber-200';
      case 'waiting_client_approval':
        return 'bg-gradient-to-br from-orange-50 to-orange-100 border-orange-300 hover:shadow-orange-200';
      case 'approved':
        return 'bg-gradient-to-br from-emerald-50 to-green-100 border-emerald-300 hover:shadow-emerald-200';
      case 'servicing':
        return 'bg-gradient-to-br from-blue-50 to-blue-100 border-blue-300 hover:shadow-blue-200';
      case 'quality_check':
        return 'bg-gradient-to-br from-purple-50 to-purple-100 border-purple-300 hover:shadow-purple-200';
      case 'final_customer_check':
        return 'bg-gradient-to-br from-indigo-50 to-indigo-100 border-indigo-300 hover:shadow-indigo-200';
      case 'finalized':
        return 'bg-gradient-to-br from-green-50 to-green-100 border-green-300 hover:shadow-green-200';
      default:
        return 'bg-gradient-to-br from-gray-50 to-gray-100 border-gray-300 hover:shadow-gray-200';
    }
  };

  // Get status-based text color for good readability
  const getStatusTextColor = (status: string): string => {
    switch (status) {
      case 'backlog':
        return 'text-slate-700';
      case 'waiting_diagnostics':
        return 'text-amber-800';
      case 'waiting_client_approval':
        return 'text-orange-800';
      case 'approved':
        return 'text-emerald-800';
      case 'servicing':
        return 'text-blue-800';
      case 'quality_check':
        return 'text-purple-800';
      case 'final_customer_check':
        return 'text-indigo-800';
      case 'finalized':
        return 'text-green-800';
      default:
        return 'text-gray-700';
    }
  };

  // Get status-based muted text color for secondary information
  const getStatusMutedColor = (status: string): string => {
    switch (status) {
      case 'backlog':
        return 'text-slate-600';
      case 'waiting_diagnostics':
        return 'text-amber-700';
      case 'waiting_client_approval':
        return 'text-orange-700';
      case 'approved':
        return 'text-emerald-700';
      case 'servicing':
        return 'text-blue-700';
      case 'quality_check':
        return 'text-purple-700';
      case 'final_customer_check':
        return 'text-indigo-700';
      case 'finalized':
        return 'text-green-700';
      default:
        return 'text-gray-600';
    }
  };

  // Get the next status in the workflow sequence
  const getNextStatus = (currentStatus: string): string | null => {
    const columns = getKanbanColumns(t);
    const currentIndex = columns.findIndex(col => col.id === currentStatus);
    
    if (currentIndex === -1 || currentIndex === columns.length - 1) {
      return null; // Invalid status or already at the end
    }
    
    return columns[currentIndex + 1].id;
  };

  // Handle moving ticket to next status
  const handleMoveToNext = (ticketId: string, currentStatus: string) => {
    const nextStatus = getNextStatus(currentStatus);
    if (nextStatus) {
      updateTicketStatus.mutate({ ticketId, status: nextStatus as TicketStatus });
    }
  };

  // Email validation helper
  const isValidEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // CPF formatting helpers
  const formatCPF = (cpf: string) => {
    // Remove all non-digits
    const numbers = cpf.replace(/\D/g, '');
    
    // Format as XXX.XXX.XXX-XX
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 6) return `${numbers.slice(0, 3)}.${numbers.slice(3)}`;
    if (numbers.length <= 9) return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6)}`;
    return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6, 9)}-${numbers.slice(9, 11)}`;
  };

  const getUnformattedCPF = (cpf: string) => {
    return cpf.replace(/\D/g, '');
  };

  // Form validation for client info step
  const validateClientInfo = () => {
    const errors: Partial<TicketFormData> = {};
    
    if (!formData.firstName.trim()) {
      errors.firstName = 'required';
    }
    if (!formData.lastName.trim()) {
      errors.lastName = 'required';
    }
    if (!formData.cpf.trim()) {
      errors.cpf = 'required';
    }
    if (!formData.streetAddress.trim()) {
      errors.streetAddress = 'required';
    }
    if (!formData.streetNumber.trim()) {
      errors.streetNumber = 'required';
    }
    if (!formData.email.trim()) {
      errors.email = 'required';
    } else if (!isValidEmail(formData.email)) {
      errors.email = 'invalid_email_format';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Form validation for device info step
  const validateDeviceInfo = () => {
    const errors: Partial<TicketFormData> = {};
    
    if (!formData.deviceType.trim()) {
      errors.deviceType = 'required';
    }
    if (!formData.deviceBrand.trim()) {
      errors.deviceBrand = 'required';
    }
    if (!formData.deviceModel.trim()) {
      errors.deviceModel = 'required';
    }
    if (!formData.deviceColor.trim()) {
      errors.deviceColor = 'required';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle form input changes
  // Date formatting and validation
  const formatDateForLocale = (dateString: string, locale: string) => {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    
    if (locale.startsWith('pt')) {
      // Brazilian format: dd/mm/yyyy
      return date.toLocaleDateString('pt-BR');
    } else {
      // English format: mm/dd/yyyy
      return date.toLocaleDateString('en-US');
    }
  };

  const handleDateChange = (value: string) => {
    // Limit year to 4 digits by validating the date format
    if (value) {
      const dateParts = value.split('-');
      if (dateParts.length === 3) {
        const [year, month, day] = dateParts;
        // Ensure year is exactly 4 digits and within reasonable range
        if (year.length > 4 || parseInt(year) > new Date().getFullYear() + 100) {
          return; // Don't update if year is invalid
        }
      }
    }
    
    // Update form data without validation for birthday field
    setFormData(prev => ({ ...prev, birthday: value }));
    
    // Clear any errors
    if (formErrors.birthday) {
      setFormErrors(prev => ({ ...prev, birthday: undefined }));
    }
  };

  const validateField = (field: keyof TicketFormData, value: string) => {
    let isValid = false;
    
    switch (field) {
      case 'firstName':
      case 'lastName':
        isValid = value.trim().length >= 2;
        break;
      case 'email':
        const emailRegex = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
        isValid = emailRegex.test(value) && value.length > 0;
        break;
      case 'cpf':
        isValid = value.replace(/\D/g, '').length === 11;
        break;
      case 'streetAddress':
        isValid = value.trim().length >= 3;
        break;
      case 'streetNumber':
        isValid = value.trim().length >= 1;
        break;
      case 'birthday':
        if (!value) return false; // Don't show valid indicator when empty
        const date = new Date(value);
        const currentYear = new Date().getFullYear();
        const birthYear = date.getFullYear();
        isValid = !isNaN(date.getTime()) && birthYear >= 1900 && birthYear <= currentYear;
        break;
      case 'apartment':
        isValid = value.trim().length > 0; // Show valid when has content
        break;
      case 'deviceType':
        isValid = ['Phone', 'Laptop', 'Desktop'].includes(value);
        break;
      case 'deviceBrand':
      case 'deviceModel':
      case 'deviceColor':
        isValid = value.trim().length > 0;
        break;
      case 'deviceMemory':
      case 'deviceStorageCapacity':
      case 'serialNumber':
        isValid = value.trim().length > 0;
        break;
      default:
        isValid = value.length > 0;
    }
    
    return isValid;
  };
  
  const handleInputChange = (field: keyof TicketFormData, value: string) => {
    setFormData(prev => {
      const newFormData = { ...prev, [field]: value };
      
      // Reset dependent fields when device type changes
      if (field === 'deviceType') {
        newFormData.deviceBrand = '';
        newFormData.deviceModel = '';
      }
      
      return newFormData;
    });
    
    // Clear errors for the changed field and dependent fields
    if (formErrors[field]) {
      setFormErrors(prev => {
        const newErrors = { ...prev, [field]: undefined };
        
        // Clear dependent field errors when device type changes
        if (field === 'deviceType') {
          newErrors.deviceBrand = undefined;
          newErrors.deviceModel = undefined;
        }
        
        return newErrors;
      });
    }
    
    // Reset dependent field validations when device type changes
    if (field === 'deviceType') {
      setFieldValidation(prev => ({
        ...prev,
        deviceBrand: { isValid: false, hasError: false },
        deviceModel: { isValid: false, hasError: false }
      }));
    }
    
    // Real-time validation for micro-interactions
    const isValid = validateField(field, value);
    setFieldValidation(prev => ({
      ...prev,
      [field]: { isValid, hasError: false }
    }));
    
    // Recalculate costs when cost estimation or warranty type changes
    if (field === 'costEstimation' || field === 'warrantyType') {
      // Calculate immediately with the new values without any delay
      const newEstimation = field === 'costEstimation' ? value : formData.costEstimation;
      const newWarrantyType = field === 'warrantyType' ? value : formData.warrantyType;
      
      // Use requestAnimationFrame for immediate but smooth update
      requestAnimationFrame(() => {
        calculateCosts(newEstimation, newWarrantyType);
      });
    }
  };

  // Handle CPF input with formatting
  const handleCPFChange = (value: string) => {
    const unformatted = getUnformattedCPF(value);
    const formatted = formatCPF(value);
    
    // Only allow up to 11 digits
    if (unformatted.length <= 11) {
      setFormData(prev => ({ ...prev, cpf: unformatted }));
      setDisplayCPF(formatted);
      
      // Clear error when user starts typing
      if (formErrors.cpf) {
        setFormErrors(prev => ({ ...prev, cpf: undefined }));
      }
      
      // Real-time validation for micro-interactions
      const isValid = validateField('cpf', unformatted);
      setFieldValidation(prev => ({
        ...prev,
        cpf: { isValid, hasError: false }
      }));
      
      // Check for CPF conflict when complete
      if (unformatted.length === 11) {
        checkCPFConflict(unformatted);
      }
    }
  };

  // CPF conflict resolution handlers
  const handleUseExistingClient = () => {
    if (conflictClient) {
      setSelectedClient(conflictClient);
      setShowClientForm(false);
      setShowCPFConflict(false);
      setConflictClient(null);
    }
  };

  const handleOverwriteClient = () => {
    // Continue with creating new client - conflict is acknowledged
    handleSaveNewClient();
    setShowCPFConflict(false);
    setConflictClient(null);
  };

  const handleSaveNewClient = () => {
    if (!validateClientInfo()) return;
    
    const clientData = {
      firstName: formData.firstName,
      lastName: formData.lastName,
      cpf: formData.cpf,
      email: formData.email,
      phone: formData.phone,
      streetAddress: formData.streetAddress,
      streetNumber: formData.streetNumber,
      apartment: formData.apartment || null,
      birthday: formData.birthday || null,
      notes: null,
    };
    
    createClientMutation.mutate(clientData);
  };

  const handleCreateTicket = () => {
    // Validate client selection
    if (!selectedClient) {
      toast({
        title: t("error", "Error"),
        description: t("no_client_selected", "Please select a client first"),
        variant: "destructive",
      });
      return;
    }

    // Validate device info
    if (!validateDeviceInfo()) return;
    
    // Check for client approval
    if (!formData.clientApproved) {
      toast({
        title: t("authorization_required", "Authorization Required"),
        description: t("client_approval_required", "Client approval is required before creating the ticket. Please enable the authorization toggle."),
        variant: "destructive",
      });
      return;
    }

    // Show confirmation dialog
    setShowCreateConfirmation(true);
  };

  const handleConfirmCreateTicket = () => {

    // Generate unique ticket ID with collision protection
    const generateUniqueTicketId = async (): Promise<string> => {
      const generateId = () => {
        const timestamp = Date.now().toString(36);
        const randomPart = Math.random().toString(36).substr(2, 9);
        return `TK-${timestamp}-${randomPart}`.toUpperCase();
      };

      let attempts = 0;
      const maxAttempts = 10;
      
      while (attempts < maxAttempts) {
        const ticketId = generateId();
        
        // Check if ID already exists
        try {
          const response = await fetch(`/api/tickets/check-id/${ticketId}`);
          const { exists } = await response.json();
          
          if (!exists) {
            return ticketId;
          }
        } catch (error) {
          console.warn('Error checking ticket ID uniqueness:', error);
        }
        
        attempts++;
      }
      
      // Fallback: use timestamp + random number if all attempts fail
      return `TK-${Date.now()}-${Math.floor(Math.random() * 999999)}`;
    };

    const createTicketWithUniqueId = async () => {
      const uniqueId = await generateUniqueTicketId();
      
      const ticketData = {
        id: uniqueId,
        clientId: selectedClient?.id || '',
        title: `${formData.deviceType} ${formData.deviceBrand} ${formData.deviceModel} - ${formData.deviceColor}`,
        description: t("device_repair_request_description", "Device repair request for {deviceType} {deviceBrand} {deviceModel} in {deviceColor}")
          .replace("{deviceType}", formData.deviceType)
          .replace("{deviceBrand}", formData.deviceBrand)
          .replace("{deviceModel}", formData.deviceModel)
          .replace("{deviceColor}", formData.deviceColor),
        status: 'backlog' as const,
        priority: 'medium' as const,
        assignedTo: null,
        estimatedCost: null,
        actualCost: null,
        deviceType: formData.deviceType,
        deviceModel: formData.deviceModel,
        deviceColor: formData.deviceColor,
        deviceMemory: formData.deviceMemory || null,
        deviceStorageCapacity: formData.deviceStorageCapacity || null,
        issueDescription: null,
        // Service Timeline & Coverage fields with form data
        clientDeadline: formData.clientDeadline || null,
        technicianEstimatedHours: formData.technicianEstimatedHours ? parseInt(formData.technicianEstimatedHours) : null,
        warrantyType: formData.warrantyType as 'standard' | 'extended',
        costEstimation: formData.costEstimation || null,
        totalCost: formData.totalCost || null,
        costExplanation: formData.costExplanation || null,
        // Service Checklist data
        serviceChecklist: {
          components: formData.deviceComponents,
          additionalNotes: formData.additionalNotes
        },
        issueResponses: formData.issueResponses || [],
      };
      
      createTicketMutation.mutate(ticketData);
    };
    
    // Execute the ticket creation
    createTicketWithUniqueId();
    setShowCreateConfirmation(false);
  };

  // Handle next step
  const handleNextStep = () => {
    // Smooth scroll to top when navigating between steps
    setTimeout(() => {
      const dialogContent = document.querySelector('[role="dialog"]');
      if (dialogContent) {
        dialogContent.scrollTo({
          top: 0,
          behavior: 'smooth'
        });
      }
    }, 50);
    
    if (currentStep === 0) {
      if (selectedClient) {
        // Client is selected, proceed to next step
        setCurrentStep(currentStep + 1);
      } else if (showClientForm) {
        // Save new client first
        handleSaveNewClient();
      } else {
        // No client selected, need to search or add one
        return;
      }
    } else if (currentStep === 1) {
      // Validate device info before proceeding
      if (!validateDeviceInfo()) return;
      setCurrentStep(currentStep + 1);
    } else if (currentStep === 2) {
      // Issue Assessment step - trigger completion
      setShouldCompleteAssessment(true);
    } else if (currentStep === 5) {
      // Service Checklist step - auto-set unselected components to N/A
      if (checklistTemplate && checklistTemplate.components) {
        const updatedComponents = { ...formData.deviceComponents };
        
        // Set any unselected components to "not_applicable" (N/A)
        checklistTemplate.components.forEach((component: string) => {
          if (!updatedComponents[component]) {
            updatedComponents[component] = 'not_applicable';
          }
        });
        
        // Update form data with auto-set components
        setFormData(prev => ({
          ...prev,
          deviceComponents: updatedComponents
        }));
      }
      
      setCurrentStep(currentStep + 1);
    } else if (currentStep < ticketSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  // Handle previous step
  const handlePreviousStep = () => {
    // Smooth scroll to top when navigating between steps
    setTimeout(() => {
      const dialogContent = document.querySelector('[role="dialog"]');
      if (dialogContent) {
        dialogContent.scrollTo({
          top: 0,
          behavior: 'smooth'
        });
      }
    }, 50);
    
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Reset form when dialog closes
  const handleDialogChange = (open: boolean) => {
    setIsTicketDialogOpen(open);
    if (!open) {
      setCurrentStep(0);
      setFormData({
        firstName: '',
        lastName: '',
        cpf: '',
        streetAddress: '',
        streetNumber: '',
        apartment: '',
        birthday: '',
        email: '',
        phone: '',
        deviceType: '',
        deviceBrand: '',
        deviceModel: '',
        deviceColor: '',
        deviceMemory: '',
        deviceStorageCapacity: '',
        serialNumber: '',
        // Service Timeline & Coverage defaults
        clientDeadline: '',
        technicianEstimatedHours: '',
        warrantyType: 'standard',
        costEstimation: '',
        warrantyCost: '0',
        totalCost: '',
        costExplanation: '',
        // Service Checklist defaults
        deviceComponents: {},
        additionalNotes: '',
        // Issue Assessment defaults
        issueResponses: [],
        // Client Authorization defaults
        clientApproved: false,
      });
      setDisplayCPF('');
      setFormErrors({});
      setFieldValidation({});
      
      // Reset client search states
      setClientSearchQuery('');
      setSelectedClient(null);
      setShowClientForm(false);
      setShowCPFConflict(false);
      setConflictClient(null);
    }
  };

  // Kanban Loading Skeleton Component
  const KanbanSkeleton = () => (
    <div className="h-full w-full flex flex-col overflow-hidden">
      {/* Page Header Skeleton */}
      <div className="flex items-center justify-between mb-6 flex-shrink-0">
        <div className="space-y-3">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
      
      {/* Kanban Columns Skeleton */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full overflow-x-auto">
          <div className="flex gap-6 h-full pb-6" style={{ minWidth: 'fit-content' }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex flex-col w-80 bg-card rounded-lg border border-border">
                {/* Column Header Skeleton */}
                <div className="p-4 border-b border-border">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-5 w-24" />
                    <Skeleton className="h-6 w-8 rounded-full" />
                  </div>
                </div>
                
                {/* Column Content Skeleton */}
                <div className="flex-1 p-4 space-y-3">
                  {[1, 2, 3].map((j) => (
                    <div key={j} className="animate-pulse">
                      <div className="bg-background rounded-lg p-4 border border-border space-y-3">
                        <div className="flex items-center justify-between">
                          <Skeleton className="h-4 w-16" />
                          <Skeleton className="h-6 w-12 rounded" />
                        </div>
                        <Skeleton className="h-5 w-full" />
                        <Skeleton className="h-4 w-3/4" />
                        <div className="flex items-center justify-between pt-2">
                          <Skeleton className="h-4 w-20" />
                          <Skeleton className="h-4 w-24" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <TooltipProvider>
        <KanbanSkeleton />
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <div className="w-full flex flex-col">
      {/* Action Bar */}
      <div className="flex items-center justify-between mb-2 flex-shrink-0">
        <div className="flex items-center gap-3">
          {/* Filter Toggle Button */}
          <Button 
            variant="outline" 
            onClick={() => setShowFilters(!showFilters)}
            className={`transition-all duration-200 ${hasActiveFilters ? 'border-[#00FFFF] bg-[#00FFFF]/10 text-[#00FFFF]' : ''}`}
            data-testid="button-toggle-filters"
          >
            <Filter className="w-4 h-4 mr-2" />
            {t("filters", "Filters")}
            {hasActiveFilters && (
              <Badge variant="secondary" className="ml-2 bg-[#00FFFF] text-[#0A192F] h-5 w-5 p-0 text-xs">
                {Object.values(filters).filter(v => v && v !== 'all').length}
              </Badge>
            )}
          </Button>
          
          {/* Global Expand/Collapse All Button */}
          <Button 
            variant="outline" 
            onClick={toggleAllCards}
            className="transition-all duration-200 hover:bg-muted/50"
            data-testid="button-toggle-all-cards"
          >
            {allCardsCollapsed ? <Maximize2 className="w-4 h-4 mr-2" /> : <Minimize2 className="w-4 h-4 mr-2" />}
            {allCardsCollapsed ? t("expand_all", "Expand All") : t("collapse_all", "Collapse All")}
          </Button>
        </div>
        
        <Dialog open={isTicketDialogOpen} onOpenChange={handleDialogChange}>
          <DialogTrigger asChild>
            <Button className="btn-next-hover" data-testid="button-create-ticket">
              <Plus className="w-4 h-4 mr-2" />
              {t("new_ticket", "New Ticket")}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto bg-gradient-to-br from-[#0A192F] to-slate-900 dark:from-[#0A192F] dark:to-slate-900">
            <DialogHeader className="border-b border-[#00FFFF]/20 pb-4 mb-0">
              <DialogTitle className="text-2xl font-bold text-[#00FFFF]">
                {t("create_new_ticket", "Create New Ticket")}
              </DialogTitle>
              <DialogDescription className="text-slate-300 text-base">
                {t("create_ticket_description", "Follow the steps to create a new repair ticket for your client.")}
              </DialogDescription>
            </DialogHeader>
            
            {/* Enhanced Progress Stepper */}
            <div className="bg-slate-800/50 border-b border-[#00FFFF]/20 py-6">
              {/* Progress Percentage Display with Motivational Messages */}
              <div className="mb-6 text-center space-y-3">
                <div className="inline-flex items-center gap-3 bg-slate-700/80 px-6 py-3 rounded-full shadow-md border border-[#00FFFF]/30">
                  <div className="text-2xl font-bold bg-gradient-to-r from-[#0A192F] to-[#00FFFF] bg-clip-text text-transparent">
                    {Math.round((currentStep / (ticketSteps.length - 1)) * 100)}%
                  </div>
                  <div className="text-sm text-slate-300">
                    {t("progress_complete", "Complete")}
                  </div>
                </div>
                
                {/* Motivational Message */}
                <div className="text-sm text-center transition-all duration-500">
                  {currentStep === 0 && (
                    <div className="text-primary animate-pulse-text font-medium">
                      🎯 {t("motivational_start", "Great! Let's find your client and get started")}
                    </div>
                  )}
                  {currentStep > 0 && currentStep < ticketSteps.length - 1 && (
                    <div className="text-green-400 animate-bounce-subtle font-medium">
                      🚀 {t("motivational_progress", "You're making excellent progress!")}
                    </div>
                  )}
                  {currentStep === ticketSteps.length - 1 && (
                    <div className="text-yellow-400 animate-celebrate font-bold">
                      🎉 {t("motivational_complete", "Almost there! You're a champion!")}
                    </div>
                  )}
                </div>
                
                {/* Achievement Badges */}
                {currentStep > 0 && (
                  <div className="flex justify-center gap-2">
                    {Array.from({ length: currentStep }, (_, i) => (
                      <div key={i} className="w-3 h-3 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.1}s` }}></div>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="flex items-center justify-between relative">
                {/* Animated Connection Line */}
                <div className="absolute top-4 left-8 right-8 h-1 bg-muted-foreground/10 rounded-full z-0"></div>
                <div 
                  className="absolute top-4 left-8 h-1 bg-gradient-to-r from-primary via-primary to-primary/80 rounded-full transition-all duration-500 ease-out z-0 shadow-sm shadow-primary/30"
                  style={{ 
                    width: `${(currentStep / (ticketSteps.length - 1)) * (100 - 16)}%`,
                    animation: currentStep > 0 ? 'progress-glow 2s infinite alternate' : 'none'
                  }}
                ></div>
                
                {/* Step Indicators */}
                {ticketSteps.map((step, index) => {
                  const Icon = step.icon;
                  const isCompleted = index < currentStep;
                  const isCurrent = index === currentStep;
                  const isUpcoming = index > currentStep;
                  
                  return (
                    <div key={step.id} className="flex flex-col items-center relative z-10 group">
                      <div className={`
                        w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 relative overflow-hidden cursor-pointer
                        ${isCompleted ? 
                          'bg-gradient-to-br from-green-400 to-green-600 border-green-500 text-white shadow-lg shadow-green-500/30 scale-110 hover:scale-115' : 
                          isCurrent ? 
                            'bg-gradient-to-br from-primary to-primary/80 border-primary text-white shadow-lg shadow-primary/40 animate-pulse-slow scale-105 hover:scale-110' : 
                            isUpcoming ?
                              'border-muted-foreground/20 text-muted-foreground/50 bg-background hover:border-primary/30 hover:text-primary/70 hover:scale-105' :
                              'border-muted-foreground/30 text-muted-foreground bg-background'}
                      `}>
                        {isCompleted ? (
                          <div className="relative">
                            <Check className="w-5 h-5 animate-bounce-subtle" />
                            <div className="absolute inset-0 bg-white/20 rounded-full animate-ping opacity-75"></div>
                          </div>
                        ) : (
                          <Icon className={`w-5 h-5 ${isCurrent ? 'animate-pulse' : ''} group-hover:scale-110 transition-transform`} />
                        )}
                        
                        {/* Achievement Badge for Completed Steps */}
                        {isCompleted && (
                          <div className="absolute -top-2 -right-2 w-5 h-5 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full flex items-center justify-center animate-bounce shadow-lg shadow-yellow-400/30">
                            <div className="text-xs text-yellow-900 font-bold">⭐</div>
                          </div>
                        )}
                        
                        {/* Current Step Pulse Ring */}
                        {isCurrent && (
                          <div className="absolute inset-0 rounded-full border-2 border-primary/30 animate-ping"></div>
                        )}
                      </div>
                      <div className={`mt-3 text-xs text-center max-w-20 font-medium transition-all duration-300 ${
                        isCompleted ? 'text-green-600 font-semibold' :
                        isCurrent ? 'text-primary font-bold animate-pulse-text' : 
                        isUpcoming ? 'text-muted-foreground/70' : 'text-muted-foreground'
                      }`}>
                        {step.title}
                        {isCompleted && (
                          <div className="text-green-500 mt-1 animate-bounce-subtle">
                            ✓
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Step Content */}
            <div className="px-4 py-6">
              {currentStep === 0 && (
                <div className="max-w-4xl mx-auto">
                  <div className="bg-slate-800/70 rounded-xl shadow-lg border border-[#00FFFF]/20 overflow-hidden">
                    <div className="bg-gradient-to-r from-[#0A192F] to-[#00FFFF] px-6 py-4">
                      <h3 className="text-xl font-bold text-white flex items-center gap-3">
                        <User className="w-5 h-5" />
                        {showClientForm ? t("add_new_client", "Add New Client") : t("client_search", "Find Client")}
                      </h3>
                      <p className="text-cyan-100 text-sm mt-1">
                        {showClientForm 
                          ? t("add_client_subtitle", "Enter the client's information to get started")
                          : t("find_client_subtitle", "Search for an existing client or add a new one")
                        }
                      </p>
                    </div>
                    
                    <div className="p-6 space-y-6">
                      {!selectedClient && !showClientForm && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="clientSearch">
                          {t("search_client", "Search for existing client")}
                        </Label>
                        <div className="relative">
                          <Input
                            id="clientSearch"
                            placeholder={t("search_placeholder", "Type name, CPF, email, or ticket number...")}
                            value={clientSearchQuery}
                            onChange={(e) => setClientSearchQuery(e.target.value)}
                            className="pl-10"
                            data-testid="input-client-search"
                          />
                          <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>

                      {/* Search Results */}
                      {clientSearchQuery.length >= 2 && searchResults.length > 0 && (
                        <div className="border rounded-lg p-4 bg-muted/50 space-y-2">
                          <h4 className="font-medium text-sm text-muted-foreground">
                            {t("search_results", "Search Results")}
                          </h4>
                          <div className="space-y-2">
                            {searchResults.map((client) => (
                              <div
                                key={client.id}
                                className="flex items-center justify-between p-3 border rounded-lg bg-background hover:bg-muted/50 cursor-pointer transition-all duration-200 hover:scale-105"
                                onClick={() => {
                                  setSelectedClient(client);
                                  setClientSearchQuery('');
                                }}
                                data-testid={`client-result-${client.id}`}
                              >
                                <div className="flex-1">
                                  <div className="font-medium">
                                    {client.firstName} {client.lastName}
                                  </div>
                                  <div className="text-sm text-muted-foreground space-y-1">
                                    {client.cpf && (
                                      <div>CPF: {client.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")}</div>
                                    )}
                                    {client.email && <div>{client.email}</div>}
                                    {client.streetAddress && client.streetNumber && (
                                      <div>{client.streetAddress}, {client.streetNumber}</div>
                                    )}
                                  </div>
                                </div>
                                <Button size="sm" variant="outline" data-testid="button-select-client">
                                  {t("select", "Select")}
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* No Results Message */}
                      {clientSearchQuery.length >= 2 && searchResults.length === 0 && (
                        <div className="text-center p-8 text-muted-foreground">
                          <User className="mx-auto h-12 w-12 mb-4 opacity-50" />
                          <p>{t("no_clients_found", "No clients found matching your search")}</p>
                        </div>
                      )}

                      {/* Add New Client Button */}
                      <div className="flex justify-center pt-4">
                        <Button
                          onClick={() => setShowClientForm(true)}
                          className="bg-primary hover:bg-primary/90 transition-all duration-200 hover:scale-105 hover:shadow-lg hover:shadow-primary/20"
                          data-testid="button-add-new-client"
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          {t("add_new_client", "Add New Client")}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Selected Client Display */}
                  {selectedClient && !showClientForm && (
                    <div className="border rounded-lg p-6 bg-green-50 border-green-200">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-semibold text-green-800">
                          {t("selected_client", "Selected Client")}
                        </h4>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditClientData({
                                firstName: selectedClient.firstName,
                                lastName: selectedClient.lastName,
                                cpf: selectedClient.cpf || '',
                                email: selectedClient.email || '',
                                phone: selectedClient.phone || ''
                              });
                              setShowEditClientModal(true);
                            }}
                            data-testid="button-modify-client"
                          >
                            <Edit className="w-4 h-4 mr-1" />
                            {t("modify", "Modify")}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedClient(null)}
                            data-testid="button-change-client"
                          >
                            {t("change", "Change")}
                          </Button>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <span className="text-sm font-medium text-green-600">{t("name", "Name")}:</span>
                          <p className="text-green-800 font-medium">
                            {selectedClient.firstName} {selectedClient.lastName}
                          </p>
                        </div>
                        
                        <div>
                          <span className="text-sm font-medium text-green-600">{t("cpf", "CPF")}:</span>
                          <p className="text-green-800 font-medium">
                            {selectedClient.cpf 
                              ? selectedClient.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")
                              : t("not_provided", "Not provided")
                            }
                          </p>
                        </div>
                        
                        <div>
                          <span className="text-sm font-medium text-green-600">{t("email", "Email")}:</span>
                          <p className="text-green-800 font-medium">
                            {selectedClient.email || t("not_provided", "Not provided")}
                          </p>
                        </div>
                        
                        <div>
                          <span className="text-sm font-medium text-green-600">{t("phone", "Phone")}:</span>
                          <p className="text-green-800 font-medium">
                            {selectedClient.phone 
                              ? (selectedClient.phone.includes('(') ? selectedClient.phone : formatBrazilianPhone(selectedClient.phone))
                              : t("not_provided", "Not provided")
                            }
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Add New Client Form */}
                  {showClientForm && (
                    <div className="space-y-6 border rounded-lg p-6 bg-muted/20">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold">{t("add_new_client", "Add New Client")}</h4>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowClientForm(false)}
                          data-testid="button-cancel-add-client"
                        >
                          {t("cancel", "Cancel")}
                        </Button>
                      </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    {/* First Name */}
                    <FormFieldWithTooltip
                      label={t("first_name", "First Name")}
                      tooltip={t("first_name_tooltip", "Enter the client's legal first name as it appears on official documents. This helps with accurate identification and record keeping.")}
                      required
                      hasError={!!formErrors.firstName}
                      isValid={fieldValidation.firstName?.isValid && formData.firstName.length > 0}
                    >
                      <Input
                        id="firstName"
                        value={formData.firstName}
                        onChange={(e) => handleInputChange('firstName', e.target.value)}
                        className={formErrors.firstName ? 'border-red-500' : ''}
                        placeholder={t("first_name_placeholder", "e.g., João")}
                        data-testid="input-first-name"
                      />
                    </FormFieldWithTooltip>

                    {/* Last Name */}
                    <FormFieldWithTooltip
                      label={t("last_name", "Last Name")}
                      tooltip={t("last_name_tooltip", "Enter the client's family name or surname. Use the full surname including any compound names or particles (da, de, dos, etc.).")}
                      required
                      hasError={!!formErrors.lastName}
                      isValid={fieldValidation.lastName?.isValid && formData.lastName.length > 0}
                    >
                      <Input
                        id="lastName"
                        value={formData.lastName}
                        onChange={(e) => handleInputChange('lastName', e.target.value)}
                        className={formErrors.lastName ? 'border-red-500' : ''}
                        placeholder={t("last_name_placeholder", "e.g., Silva Santos")}
                        data-testid="input-last-name"
                      />
                    </FormFieldWithTooltip>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* CPF */}
                    <FormFieldWithTooltip
                      label={t("cpf", "CPF")}
                      tooltip={t("cpf_tooltip", "Enter the Brazilian individual taxpayer registry (CPF). Format: 000.000.000-00. The system will automatically format and validate the number. Only digits are stored.")}
                      required
                      hasError={!!formErrors.cpf}
                      isValid={fieldValidation.cpf?.isValid && formData.cpf.length > 0}
                    >
                      <Input
                        id="cpf"
                        value={displayCPF}
                        onChange={(e) => handleCPFChange(e.target.value)}
                        placeholder="000.000.000-00"
                        className={formErrors.cpf ? 'border-red-500' : ''}
                        data-testid="input-cpf"
                      />
                    </FormFieldWithTooltip>

                    {/* Email */}
                    <FormFieldWithTooltip
                      label={t("email", "Email")}
                      tooltip={t("email_tooltip", "Enter a valid email address for communication. This will be used for repair updates, notifications, and service confirmations. Format: user@domain.com")}
                      required
                      hasError={!!formErrors.email}
                      isValid={fieldValidation.email?.isValid && formData.email.length > 0}
                    >
                      <Input
                        id="email"
                        value={formData.email}
                        onChange={(e) => handleInputChange('email', e.target.value)}
                        className={formErrors.email ? 'border-red-500' : ''}
                        placeholder={t("email_placeholder", "e.g., joao@exemplo.com")}
                        data-testid="input-email"
                      />
                      {formErrors.email === 'invalid_email_format' && (
                        <div className="text-sm text-red-500 error-message" data-testid="error-email-format">
                          {t("email_format_error", "Please enter a valid email address (e.g., name@example.com)")}
                        </div>
                      )}
                    </FormFieldWithTooltip>
                  </div>

                  {/* Phone Field */}
                  <div className="grid grid-cols-1 gap-4">
                    <FormFieldWithTooltip
                      label={t("phone", "Phone")}
                      tooltip={t("phone_tooltip", "Enter the client's mobile phone number with area code (DDD). Format: (11)94048-6530. Maximum 11 digits including area code.")}
                      required
                      hasError={!!formErrors.phone}
                      isValid={fieldValidation.phone?.isValid && formData.phone.length > 0}
                    >
                      <Input
                        id="phone"
                        value={formData.phone}
                        onChange={(e) => {
                          const formattedPhone = formatBrazilianPhone(e.target.value);
                          handleInputChange('phone', formattedPhone);
                        }}
                        className={formErrors.phone ? 'border-red-500' : ''}
                        placeholder={t("phone_placeholder", "(xx)xxxxx-xxxx")}
                        maxLength={14}
                        data-testid="input-phone"
                      />
                    </FormFieldWithTooltip>
                  </div>

                  {/* Address Fields */}
                  <div className="grid grid-cols-2 gap-4">
                    {/* Street Address */}
                    <FormFieldWithTooltip
                      label={t("street_address", "Street Address")}
                      tooltip={t("street_address_tooltip", "Enter the full street name without the number. Include any street type (Rua, Avenida, Alameda, etc.). This is used for accurate address identification and delivery/service location.")}
                      required
                      hasError={!!formErrors.streetAddress}
                      isValid={fieldValidation.streetAddress?.isValid && formData.streetAddress.length > 0}
                    >
                      <Input
                        id="streetAddress"
                        value={formData.streetAddress}
                        onChange={(e) => handleInputChange('streetAddress', e.target.value)}
                        className={formErrors.streetAddress ? 'border-red-500' : ''}
                        placeholder={t("street_address_placeholder", "e.g., Rua das Flores")}
                        data-testid="input-street-address"
                      />
                    </FormFieldWithTooltip>

                    {/* Street Number */}
                    <FormFieldWithTooltip
                      label={t("street_number", "Street Number")}
                      tooltip={t("street_number_tooltip", "Enter the building or house number on the street. Use only numbers or include letters for subdivisions (123A, 456-B). This helps locate the exact address for service visits.")}
                      required
                      hasError={!!formErrors.streetNumber}
                      isValid={fieldValidation.streetNumber?.isValid && formData.streetNumber.length > 0}
                    >
                      <Input
                        id="streetNumber"
                        value={formData.streetNumber}
                        onChange={(e) => handleInputChange('streetNumber', e.target.value)}
                        className={formErrors.streetNumber ? 'border-red-500' : ''}
                        placeholder={t("street_number_placeholder", "e.g., 123")}
                        title={t("street_number_format_hint", "Please enter a valid number")}
                        data-testid="input-street-number"
                      />
                    </FormFieldWithTooltip>
                  </div>

                  {/* Apartment/Unit */}
                  <div className="grid grid-cols-2 gap-4">
                    <FormFieldWithTooltip
                      label={t("apartment_unit", "Apartment/Unit")}
                      tooltip={t("apartment_tooltip", "Optional field for apartment number, unit, suite, or other address details (complemento). Include information like apartment number, block, floor, or suite that helps identify the specific location within a building.")}
                      hasError={!!formErrors.apartment}
                      isValid={fieldValidation.apartment?.isValid && formData.apartment.length > 0}
                      errorMessage={formErrors.apartment}
                    >
                      <Input
                        id="apartment"
                        value={formData.apartment}
                        onChange={(e) => handleInputChange('apartment', e.target.value)}
                        placeholder={t("apartment_placeholder", "e.g., Apt 4B, Block C")}
                        data-testid="input-apartment"
                      />
                    </FormFieldWithTooltip>
                    <div></div>
                  </div>

                  {/* Birthday */}
                  <div className="grid grid-cols-2 gap-4">
                    <FormFieldWithTooltip
                      label={t("birthday", "Birthday")}
                      tooltip={t("birthday_tooltip", "Optional field for the client's date of birth. This can help with customer identification and may be useful for warranty tracking or age-specific service policies. The date is stored securely and used only for business purposes.")}
                      hasError={!!formErrors.birthday}
                      isValid={fieldValidation.birthday?.isValid && formData.birthday.length > 0}
                      errorMessage={formErrors.birthday}
                    >
                      <Input
                        id="birthday"
                        type="date"
                        value={formData.birthday}
                        onChange={(e) => handleDateChange(e.target.value)}
                        max={new Date().toISOString().split('T')[0]} // Prevent future dates
                        min="1900-01-01" // Reasonable minimum year
                        placeholder={'YYYY-MM-DD'}
                        data-testid="input-birthday"
                      />
                    </FormFieldWithTooltip>
                    <div></div>
                  </div>

                    </div>
                  )}
                    </div>
                  </div>
                </div>
              )}

              {/* Device Specifications Step */}
              {currentStep === 1 && (
                <div className="max-w-4xl mx-auto">
                  <div className="bg-slate-800/70 rounded-xl shadow-lg border border-[#00FFFF]/20 overflow-hidden">
                    <div className="bg-gradient-to-r from-[#0A192F] to-[#00FFFF] px-6 py-4">
                      <h3 className="text-xl font-bold text-white flex items-center gap-3">
                        <Clock className="w-5 h-5" />
                        {ticketSteps[1].title}
                      </h3>
                      <p className="text-cyan-100 text-sm mt-1">
                        {t("device_specs_description", "Enter details about the device that needs repair")}
                      </p>
                    </div>
                    
                    <div className="p-6 space-y-6">
                  
                  {/* Device Type Selection - Primary Field */}
                  <div className="mb-8">
                    <Label htmlFor="deviceType" className="text-base font-medium">
                      {t("deviceType", "Device Type")} *
                    </Label>
                    <Select
                      value={formData.deviceType}
                      onValueChange={(value) => {
                        // Reset dependent fields when device type changes
                        setFormData(prev => ({
                          ...prev,
                          deviceType: value,
                          deviceBrand: '',
                          deviceModel: '',
                          deviceColor: '',
                          deviceMemory: '',
                          deviceStorageCapacity: ''
                        }));
                      }}
                      data-testid="select-device-type"
                    >
                      <SelectTrigger className={`mt-2 ${formErrors.deviceType ? 'border-red-500' : ''}`}>
                        <SelectValue placeholder={t("selectDeviceType", "Select device type...")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Phone">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">📱</span>
                            {t("deviceTypePhone", "Phone")}
                          </div>
                        </SelectItem>
                        <SelectItem value="Laptop">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">💻</span>
                            {t("deviceTypeLaptop", "Laptop")}
                          </div>
                        </SelectItem>
                        <SelectItem value="Desktop">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">🖥️</span>
                            {t("deviceTypeDesktop", "Desktop")}
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    {formErrors.deviceType && (
                      <div className="text-sm text-red-500 mt-1">
                        {t("deviceTypeRequired", "Please select a device type")}
                      </div>
                    )}
                  </div>

                  {/* Device Details - Only show after device type is selected */}
                  {formData.deviceType && (
                    <div className="space-y-6 animate-in slide-in-from-top-2 duration-300">
                      <div className="text-sm text-muted-foreground mb-4 flex items-center gap-2">
                        <span className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></span>
                        {t("device_details_unlocked", "Device details are now available")}
                      </div>
                  
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormFieldWithTooltip
                          label={t("device_brand", "Brand")}
                          tooltip={t("device_brand_tooltip", "Select the device manufacturer/brand from our AI-curated list. This list is automatically updated quarterly with popular brands from the repair industry. If you don't see the brand, you can type it manually and we'll validate it.")}
                          required
                          hasError={!!formErrors.deviceBrand}
                          isValid={fieldValidation.deviceBrand?.isValid && formData.deviceBrand.length > 0}
                        >
                          <SearchableSelect
                            value={formData.deviceBrand || ''}
                            placeholder={t("device_brand_placeholder", "Select or search for brand...")}
                            searchPlaceholder={t("brand_search_placeholder", "Search brands...")}
                            emptyText={t("no_brands_found", "No brands found")}
                            items={deviceBrands?.items || []}
                            isLoading={brandsLoading}
                            allowCustomInput={true}
                            onValueChange={(value) => {
                              // Reset dependent fields when brand changes
                              setFormData(prev => ({
                                ...prev,
                                deviceBrand: value,
                                deviceModel: '',
                                deviceColor: '',
                                deviceMemory: '',
                                deviceStorageCapacity: ''
                              }));
                            }}
                            onCustomValue={async (brandName) => {
                              try {
                                console.log(`💰 Validating custom brand: ${brandName}`);
                                const result = await validateBrand(formData.deviceType, brandName);
                                
                                if (result.correctedName) {
                                  // Reset dependent fields when brand changes via custom value
                                  setFormData(prev => ({
                                    ...prev,
                                    deviceBrand: result.correctedName || '',
                                    deviceModel: '',
                                    deviceColor: '',
                                    deviceMemory: '',
                                    deviceStorageCapacity: ''
                                  }));
                                  if (result.added) {
                                    // Optionally refresh the brand list to include the new brand
                                    console.log(`✅ Added new brand: ${result.correctedName}`);
                                  }
                                } else {
                                  // Still allow the user to use the brand even if validation failed
                                  setFormData(prev => ({
                                    ...prev,
                                    deviceBrand: brandName,
                                    deviceModel: '',
                                    deviceColor: '',
                                    deviceMemory: '',
                                    deviceStorageCapacity: ''
                                  }));
                                }
                              } catch (error) {
                                console.error('Brand validation failed:', error);
                                // Allow user to proceed even if validation fails, but reset dependent fields
                                setFormData(prev => ({
                                  ...prev,
                                  deviceBrand: brandName,
                                  deviceModel: '',
                                  deviceColor: '',
                                  deviceMemory: '',
                                  deviceStorageCapacity: ''
                                }));
                              }
                            }}
                            data-testid="select-device-brand"
                          />
                        </FormFieldWithTooltip>
                        
                        <FormFieldWithTooltip
                          label={t("device_model", "Model")}
                          tooltip={t("device_model_tooltip", "Select or enter the specific model number or name of the device. Models are automatically generated from the last 4 years for each brand. If your model isn't listed, you can still type it in manually.")}
                          required
                          hasError={!!formErrors.deviceModel}
                          isValid={fieldValidation.deviceModel?.isValid && formData.deviceModel.length > 0}
                        >
                          <SearchableSelect
                            placeholder={t("device_model_placeholder", "Select or type model...")}
                            value={formData.deviceModel || ''}
                            onValueChange={(value) => {
                              // Reset dependent fields when model changes
                              setFormData(prev => ({
                                ...prev,
                                deviceModel: value,
                                deviceColor: '',
                                deviceMemory: '',
                                deviceStorageCapacity: ''
                              }));
                            }}
                            items={deviceModels?.items || []}
                            isLoading={modelsLoading}
                            allowCustomInput={true}
                            disabled={!formData.deviceType || !formData.deviceBrand}
                            emptyText={
                              !formData.deviceType || !formData.deviceBrand 
                                ? t("selectDeviceTypeBrandFirst", "Select device type and brand first") 
                                : t("configs.no_models_available", "No models available for this brand")
                            }
                            onCustomValue={async (modelName) => {
                              try {
                                console.log(`💰 Validating custom model: ${modelName}`);
                                const result = await validateModel(formData.deviceType, formData.deviceBrand, modelName);
                                
                                if (result.correctedName) {
                                  // Reset dependent fields when model changes via custom value
                                  setFormData(prev => ({
                                    ...prev,
                                    deviceModel: result.correctedName || '',
                                    deviceColor: '',
                                    deviceMemory: '',
                                    deviceStorageCapacity: ''
                                  }));
                                  if (result.added) {
                                    // Optionally refresh the model list to include the new model
                                    console.log(`✅ Added new model: ${result.correctedName}`);
                                  }
                                } else {
                                  // Still allow the user to use the model even if validation failed
                                  setFormData(prev => ({
                                    ...prev,
                                    deviceModel: modelName,
                                    deviceColor: '',
                                    deviceMemory: '',
                                    deviceStorageCapacity: ''
                                  }));
                                }
                              } catch (error) {
                                console.error('Model validation failed:', error);
                                // Allow user to proceed even if validation fails, but reset dependent fields
                                setFormData(prev => ({
                                  ...prev,
                                  deviceModel: modelName,
                                  deviceColor: '',
                                  deviceMemory: '',
                                  deviceStorageCapacity: ''
                                }));
                              }
                            }}
                            data-testid="select-device-model"
                          />
                        </FormFieldWithTooltip>
                        
                        <FormFieldWithTooltip
                          label={t("device_color", "Color")}
                          tooltip={t("device_color_tooltip", "The color of the device. This helps identify the specific device and affects repair parts needed.")}
                          required
                          hasError={!!formErrors.deviceColor}
                          isValid={fieldValidation.deviceColor?.isValid && formData.deviceColor.length > 0}
                        >
                          <div className="space-y-1">
                            <SearchableSelect
                              value={formData.deviceColor || ''}
                              onValueChange={(value) => handleInputChange('deviceColor', value)}
                              items={deviceColors?.colors || []}
                              isLoading={colorsLoading}
                              allowCustomInput={true}
                              disabled={!formData.deviceType || !formData.deviceBrand || !formData.deviceModel}
                              emptyText={
                                !formData.deviceType || !formData.deviceBrand || !formData.deviceModel
                                  ? t("select_device_model_first", "Select device model first") 
                                  : t("configs.no_colors_available", "No colors available for this model")
                              }
                              placeholder={t("device_color_placeholder", "Select or enter color")}
                              onCustomValue={async (colorName) => {
                                try {
                                  console.log(`🎨 Saving custom color: ${colorName} for ${formData.deviceBrand} ${formData.deviceModel}`);
                                  
                                  // First set the color in the form
                                  handleInputChange('deviceColor', colorName);
                                  
                                  // Then save it to the database
                                  const result = await saveCustomColor(
                                    formData.deviceType, 
                                    formData.deviceBrand, 
                                    formData.deviceModel, 
                                    colorName
                                  );
                                  
                                  if (result.success) {
                                    console.log(`✅ Custom color saved: ${result.message}`);
                                    toast({
                                      title: t("color_saved", "Color saved!"),
                                      description: t("color_saved_description", "This color is now available for future use with this device model."),
                                    });
                                  }
                                } catch (error) {
                                  console.error('Failed to save custom color:', error);
                                  // Still allow the user to use the color even if saving fails
                                  handleInputChange('deviceColor', colorName);
                                }
                              }}
                              data-testid="select-device-color"
                            />
                            {deviceColors?.fallback && (
                              <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                                <span>⚠️</span>
                                {deviceColors.message || t("showing_common_colors", "Showing common colors - device-specific colors temporarily unavailable")}
                              </p>
                            )}
                          </div>
                        </FormFieldWithTooltip>

                        <FormFieldWithTooltip
                          label={t("device_memory", "Memory (RAM)")}
                          tooltip={t("device_memory_tooltip", "The amount of RAM in the device. This information helps with diagnostic and repair procedures. Common values: 4GB, 8GB, 16GB, 32GB.")}
                          hasError={!!formErrors.deviceMemory}
                          isValid={fieldValidation.deviceMemory?.isValid && formData.deviceMemory.length > 0}
                        >
                          <Input
                            id="deviceMemory"
                            value={formData.deviceMemory || ''}
                            onChange={(e) => handleInputChange('deviceMemory', e.target.value)}
                            placeholder={t("device_memory_placeholder", "e.g., 8GB, 16GB (optional)")}
                            data-testid="input-device-memory"
                          />
                        </FormFieldWithTooltip>

                        <FormFieldWithTooltip
                          label={t("device_storage_capacity", "Storage Capacity")}
                          tooltip={t("device_storage_capacity_tooltip", "The storage capacity of the device. Helps identify the specific model variant and affects data recovery procedures. Common values: 64GB, 128GB, 256GB, 512GB, 1TB.")}
                          hasError={!!formErrors.deviceStorageCapacity}
                          isValid={fieldValidation.deviceStorageCapacity?.isValid && formData.deviceStorageCapacity.length > 0}
                        >
                          <Input
                            id="deviceStorageCapacity"
                            value={formData.deviceStorageCapacity || ''}
                            onChange={(e) => handleInputChange('deviceStorageCapacity', e.target.value)}
                            placeholder={t("device_storage_placeholder", "e.g., 256GB, 1TB (optional)")}
                            data-testid="input-device-storage"
                          />
                        </FormFieldWithTooltip>
                        
                        <FormFieldWithTooltip
                          label={t("serial_number", "Serial Number")}
                          tooltip={t("serial_number_tooltip", "Optional field for the device's serial number if available. This helps with warranty verification, authenticity checks, and tracking specific device history. The serial number is usually found in device settings or on a label.")}
                          hasError={!!formErrors.serialNumber}
                          isValid={fieldValidation.serialNumber?.isValid && formData.serialNumber.length > 0}
                        >
                          <Input
                            id="serialNumber"
                            value={formData.serialNumber || ''}
                            onChange={(e) => handleInputChange('serialNumber', e.target.value)}
                            placeholder={t("serial_placeholder", "Optional - if available")}
                            data-testid="input-serial-number"
                          />
                        </FormFieldWithTooltip>
                      </div>
                    </div>
                  )}
                    </div>
                  </div>
                </div>
              )}

              {/* Issue Assessment Step */}
              {currentStep === 2 && (
                <div className="max-w-4xl mx-auto">
                  <div className="bg-slate-800/70 rounded-xl shadow-lg border border-[#00FFFF]/20 overflow-hidden">
                    <div className="bg-gradient-to-r from-[#0A192F] to-[#00FFFF] px-6 py-4">
                      <h3 className="text-xl font-bold text-white flex items-center gap-3">
                        <DollarSign className="w-5 h-5" />
                        {ticketSteps[2].title}
                      </h3>
                      <p className="text-cyan-100 text-sm mt-1">
                        {t("issue_assessment_subtitle", "Diagnose the problem to provide accurate service")}
                      </p>
                    </div>
                    
                    <div className="p-6">
                      <IssueAssessment 
                        deviceType={formData.deviceType}
                        shouldComplete={shouldCompleteAssessment}
                        onComplete={(responses) => {
                          // Store issue responses in form data
                          setFormData(prev => ({
                            ...prev,
                            issueResponses: responses
                          }));
                          // Reset the trigger and move to next step
                          setShouldCompleteAssessment(false);
                          setCurrentStep(currentStep + 1);
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Service Timeline & Coverage Step */}
              {currentStep === 3 && (
                <div className="max-w-4xl mx-auto">
                  <div className="bg-slate-800/70 rounded-xl shadow-lg border border-[#00FFFF]/20 overflow-hidden">
                    <div className="bg-gradient-to-r from-[#0A192F] to-[#00FFFF] px-6 py-4">
                      <h3 className="text-xl font-bold text-white flex items-center gap-3">
                        <Clock className="w-5 h-5" />
                        {ticketSteps[3].title}
                      </h3>
                      <p className="text-cyan-100 text-sm mt-1">
                        {t("service_timeline_subtitle", "Set expectations and coverage details")}
                      </p>
                    </div>
                    
                    <div className="p-6 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Client's Deadline */}
                    <FormFieldWithTooltip
                      label={t("client_deadline", "Client's Deadline")}
                      tooltip={t("client_deadline_tooltip", "When does the client need the device repaired? This helps prioritize work and set expectations.")}
                    >
                      <div className="space-y-3">
                        {/* Date Picker */}
                        <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant={"outline"}
                              className={`w-full justify-start text-left font-normal ${
                                !formData.clientDeadline && "text-muted-foreground"
                              }`}
                              data-testid="button-client-deadline-date"
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {formData.clientDeadline 
                                ? format(new Date(formData.clientDeadline), "PPP", { locale: currentLanguage === 'pt-BR' ? ptBR : undefined })
                                : t("pick_date", "Pick a date")
                              }
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={formData.clientDeadline ? new Date(formData.clientDeadline) : undefined}
                              onSelect={(date) => {
                                if (date) {
                                  // Preserve existing time if any, otherwise set to current time
                                  const existingDate = formData.clientDeadline ? new Date(formData.clientDeadline) : new Date();
                                  const newDate = new Date(date);
                                  newDate.setHours(existingDate.getHours());
                                  newDate.setMinutes(existingDate.getMinutes());
                                  handleInputChange('clientDeadline', newDate.toISOString().slice(0, 16));
                                }
                                setIsCalendarOpen(false);
                              }}
                              disabled={(date) =>
                                date < new Date(new Date().setHours(0, 0, 0, 0))
                              }
                              locale={currentLanguage}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        
                        {/* Time Picker */}
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <Input
                            type="time"
                            id="clientDeadlineTime"
                            value={formData.clientDeadline ? new Date(formData.clientDeadline).toTimeString().slice(0, 5) : ''}
                            onChange={(e) => {
                              const time = e.target.value;
                              const currentDate = formData.clientDeadline ? new Date(formData.clientDeadline) : new Date();
                              const [hours, minutes] = time.split(':').map(Number);
                              currentDate.setHours(hours, minutes);
                              handleInputChange('clientDeadline', currentDate.toISOString().slice(0, 16));
                            }}
                            data-testid="input-client-deadline-time"
                            className="flex-1 min-w-28 max-w-36 [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:brightness-0 [&::-webkit-calendar-picker-indicator]:opacity-70 hover:[&::-webkit-calendar-picker-indicator]:opacity-100 dark:[&::-webkit-calendar-picker-indicator]:invert-0 dark:[&::-webkit-calendar-picker-indicator]:brightness-200 dark:[&::-webkit-calendar-picker-indicator]:opacity-80"
                            placeholder="--:--"
                          />
                        </div>
                      </div>
                    </FormFieldWithTooltip>

                    {/* Technician Estimated Time */}
                    <FormFieldWithTooltip
                      label={t("technician_estimated_time", "Estimated Time to Complete")}
                      tooltip={t("technician_estimated_time_tooltip", "How many hours do you estimate this repair will take? Consider complexity, parts availability, and current workload.")}
                    >
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          id="technicianEstimatedHours"
                          value={formData.technicianEstimatedHours}
                          onChange={(e) => handleInputChange('technicianEstimatedHours', e.target.value)}
                          placeholder="8"
                          min="1"
                          max="200"
                          data-testid="input-estimated-hours"
                          className="flex-1"
                        />
                        <span className="text-sm text-muted-foreground">
                          {t("hours", "hours")}
                        </span>
                      </div>
                    </FormFieldWithTooltip>
                  </div>

                  {/* Warranty Coverage */}
                  <FormFieldWithTooltip
                    label={t("warranty_coverage", "Warranty Coverage")}
                    tooltip={t("warranty_coverage_tooltip", "Select the warranty type. Standard is free for 3 months, Extended is paid for 6 months.")}
                  >
                    <RadioGroup 
                      value={formData.warrantyType} 
                      onValueChange={(value) => handleInputChange('warrantyType', value)}
                      className="grid grid-cols-1 md:grid-cols-2 gap-4"
                    >
                      <div className="flex items-center space-x-2 p-4 border rounded-lg hover:bg-accent/50 transition-colors">
                        <RadioGroupItem value="standard" id="warranty-standard" />
                        <Label htmlFor="warranty-standard" className="flex-1 cursor-pointer">
                          <div className="font-medium">{t("standard_warranty", "Standard (3 months, free)")}</div>
                          <div className="text-sm text-muted-foreground">
                            {t("standard_warranty_desc", "3-month warranty included at no additional cost")}
                          </div>
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2 p-4 border rounded-lg hover:bg-accent/50 transition-colors">
                        <RadioGroupItem value="extended" id="warranty-extended" />
                        <Label htmlFor="warranty-extended" className="flex-1 cursor-pointer">
                          <div className="font-medium">
                            {t("extended_warranty", `Extended (6 months, ${formatCurrency(tenant?.settings?.extendedWarrantyPrice || 50, currentLanguage.code)})`)}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {t("extended_warranty_desc", "6-month warranty for additional peace of mind")}
                          </div>
                        </Label>
                      </div>
                    </RadioGroup>
                  </FormFieldWithTooltip>
                    </div>
                  </div>
                </div>
              )}

              {/* Price Estimation Step */}
              {currentStep === 4 && (
                <div className="max-w-4xl mx-auto">
                  <div className="bg-slate-800/70 rounded-xl shadow-lg border border-[#00FFFF]/20 overflow-hidden">
                    <div className="bg-gradient-to-r from-[#0A192F] to-[#00FFFF] px-6 py-4">
                      <h3 className="text-xl font-bold text-white flex items-center gap-3">
                        <DollarSign className="w-5 h-5" />
                        {t("price_estimation_title", "Price Estimation")}
                      </h3>
                      <p className="text-cyan-100 text-sm mt-1">
                        {t("price_estimation_desc", "Provide cost estimates and breakdown for this repair")}
                      </p>
                    </div>
                    
                    <div className="p-6 space-y-6">
                  
                  <div className="space-y-4">
                    {/* Cost Estimation */}
                    <FormFieldWithTooltip
                      label={t("cost_estimation", "Cost Estimation")}
                      tooltip={t("cost_estimation_tooltip", "Provide an estimated total cost for this repair including parts and labor.")}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">
                          {currentLanguage.code === 'pt-BR' ? 'R$' : '$'}
                        </span>
                        <Input
                          type="number"
                          id="costEstimation"
                          value={formData.costEstimation}
                          onChange={(e) => handleInputChange('costEstimation', e.target.value)}
                          placeholder="280.00"
                          min="0"
                          step="0.01"
                          data-testid="input-cost-estimation"
                          className="flex-1"
                        />
                      </div>
                    </FormFieldWithTooltip>

                    {/* Warranty Cost */}
                    <FormFieldWithTooltip
                      label={t("warranty_cost", "Warranty Cost")}
                      tooltip={t("warranty_cost_tooltip", "Cost for the selected warranty type. Standard warranty is free, extended warranty has an additional cost.")}
                    >
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-md border">
                          <span className="text-sm text-muted-foreground">
                            {currentLanguage.code === 'pt-BR' ? 'R$' : '$'}
                          </span>
                          <span className="text-base font-medium text-foreground" data-testid="text-warranty-cost">
                            {formData.warrantyCost || '0.00'}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formData.warrantyType === 'extended' 
                            ? t("extended_warranty_selected", "Extended Warranty (6 months) selected")
                            : t("standard_warranty_selected", "Standard Warranty (3 months, free) selected")
                          }
                        </div>
                      </div>
                    </FormFieldWithTooltip>

                    {/* Total Cost */}
                    <FormFieldWithTooltip
                      label={t("total_cost", "Total Cost")}
                      tooltip={t("total_cost_tooltip", "Total cost including repair estimate and warranty cost.")}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">
                          {currentLanguage.code === 'pt-BR' ? 'R$' : '$'}
                        </span>
                        <div className="flex-1 p-3 bg-primary/10 rounded-md border border-primary/30">
                          <span className="text-lg font-bold text-primary" data-testid="text-total-cost">
                            {formData.totalCost || '0.00'}
                          </span>
                        </div>
                      </div>
                    </FormFieldWithTooltip>

                    {/* Cost Explanation */}
                    <FormFieldWithTooltip
                      label={t("cost_explanation", "Cost Breakdown")}
                      tooltip={t("cost_explanation_tooltip", "Explain how you calculated the cost. Include details about parts, labor time, and any additional fees.")}
                    >
                      <Textarea
                        id="costExplanation"
                        value={formData.costExplanation}
                        onChange={(e) => handleInputChange('costExplanation', e.target.value)}
                        placeholder={t("cost_explanation_placeholder", "Example: Labor (3 hours @ $50/hr) + Screen replacement part ($120) + diagnostic fee ($30) = $280 total")}
                        rows={4}
                        data-testid="textarea-cost-explanation"
                        className="resize-none"
                      />
                    </FormFieldWithTooltip>
                  </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Service Checklist Step */}
              {currentStep === 5 && (
                <div className="max-w-4xl mx-auto">
                  <div className="bg-slate-800/70 rounded-xl shadow-lg border border-[#00FFFF]/20 overflow-hidden">
                    <div className="bg-gradient-to-r from-[#0A192F] to-[#00FFFF] px-6 py-4">
                      <h3 className="text-xl font-bold text-white flex items-center gap-3">
                        <Check className="w-5 h-5" />
                        {t("service_checklist", "Service Checklist")}
                      </h3>
                      <p className="text-cyan-100 text-sm mt-1">
                        {t("checklist_description", "Document the current condition of each component to ensure accountability when returning the device to the client.")}
                      </p>
                    </div>
                    
                    <div className="p-6 space-y-6">

                  {isLoadingChecklist ? (
                    <div className="space-y-4">
                      {[...Array(6)].map((_, i) => (
                        <div key={i} className="flex items-center justify-between p-4 border border-border rounded-lg">
                          <Skeleton className="h-4 w-24" />
                          <Skeleton className="h-8 w-32" />
                        </div>
                      ))}
                    </div>
                  ) : checklistTemplate?.components && Array.isArray(checklistTemplate.components) ? (
                    <div className="space-y-4">
                      <div className="grid gap-4">
                        {(checklistTemplate.components as string[]).map((component: string) => (
                          <div key={component} className="flex items-center justify-between p-4 border border-border rounded-lg bg-card">
                            <Label className="font-medium text-sm capitalize" htmlFor={`component-${component}`}>
                              {t(component.toLowerCase().replace(/\s+/g, '_'), component.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()))}
                            </Label>
                            <Select
                              value={formData.deviceComponents[component] || ''}
                              onValueChange={(value) => {
                                setFormData(prev => ({
                                  ...prev,
                                  deviceComponents: {
                                    ...prev.deviceComponents,
                                    [component]: value
                                  }
                                }));
                              }}
                            >
                              <SelectTrigger className="w-48" data-testid={`select-component-${component.toLowerCase()}`}>
                                <SelectValue placeholder={t("select_condition", "Select condition")} />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="excellent">{t("excellent", "Excellent")}</SelectItem>
                                <SelectItem value="good">{t("good", "Good")}</SelectItem>
                                <SelectItem value="fair">{t("fair", "Fair")}</SelectItem>
                                <SelectItem value="poor">{t("poor", "Poor")}</SelectItem>
                                <SelectItem value="damaged">{t("damaged", "Damaged")}</SelectItem>
                                <SelectItem value="missing">{t("missing", "Missing")}</SelectItem>
                                <SelectItem value="not_applicable">{t("not_applicable", "N/A - Not Applicable")}</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        ))}
                      </div>

                      {/* Additional Notes */}
                      <FormFieldWithTooltip
                        label={t("additional_notes", "Additional Notes")}
                        tooltip={t("additional_notes_tooltip", "Any additional observations about the device condition or specific damage details.")}
                      >
                        <Textarea
                          id="additionalNotes"
                          value={formData.additionalNotes}
                          onChange={(e) => handleInputChange('additionalNotes', e.target.value)}
                          placeholder={t("additional_notes_placeholder", "Example: Small scratch on back cover near camera, screen has minor scuffs but fully functional...")}
                          rows={4}
                          data-testid="textarea-additional-notes"
                          className="resize-none"
                        />
                      </FormFieldWithTooltip>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      <div className="space-y-4">
                        <AlertTriangle className="w-12 h-12 mx-auto" />
                        <h3 className="text-lg font-semibold">{t("no_checklist_template", "No Checklist Template Available")}</h3>
                        <p>{t("no_checklist_message", "Please select a device type in the previous step to load the appropriate checklist.")}</p>
                      </div>
                    </div>
                  )}
                    </div>
                  </div>
                </div>
              )}

              {/* Client Authorization Step */}
              {currentStep === 6 && (
                <div className="max-w-4xl mx-auto">
                  <div className="bg-slate-800/70 rounded-xl shadow-lg border border-[#00FFFF]/20 overflow-hidden">
                    <div className="bg-gradient-to-r from-[#0A192F] to-[#00FFFF] px-6 py-4">
                      <h3 className="text-xl font-bold text-white flex items-center gap-3">
                        <Check className="w-5 h-5" />
                        {ticketSteps[6].title}
                      </h3>
                      <p className="text-cyan-100 text-sm mt-1">
                        {t("authorization_subtitle", "Final authorization and terms agreement")}
                      </p>
                    </div>
                    
                    <div className="p-6 space-y-6">
                      <div className="text-center mb-8">
                        <div className="text-6xl mb-4">✅</div>
                    <h3 className="text-2xl font-semibold text-white mb-2">
                      {t("client_authorization", "Client Authorization")}
                    </h3>
                    <p className="text-muted-foreground">
                      {t("authorization_subtitle", "Review all details and obtain client approval")}
                    </p>
                  </div>

                  {/* Comprehensive Summary */}
                  <div className="grid gap-6">
                    {/* Client Information Summary */}
                    <div className="space-y-4 bg-muted/20 rounded-lg p-6 border border-[#00FFFF]/20">
                      <h4 className="text-lg font-semibold text-[#00FFFF] flex items-center gap-2">
                        <User className="w-5 h-5" />
                        {t("client_information_summary", "Client Information")}
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <span className="text-sm text-muted-foreground">{t("full_name", "Full Name")}:</span>
                          <p className="text-white font-medium">
                            {selectedClient 
                              ? `${selectedClient.firstName} ${selectedClient.lastName}`
                              : formData.firstName && formData.lastName 
                                ? `${formData.firstName} ${formData.lastName}`
                                : t("not_available", "N/A")
                            }
                          </p>
                        </div>
                        <div>
                          <span className="text-sm text-muted-foreground">{t("cpf", "CPF")}:</span>
                          <p className="text-white font-medium">
                            {selectedClient?.cpf || displayCPF || formData.cpf || t("not_available", "N/A")}
                          </p>
                        </div>
                        <div>
                          <span className="text-sm text-muted-foreground">{t("email", "Email")}:</span>
                          <p className="text-white font-medium">
                            {selectedClient?.email || formData.email || t("not_available", "N/A")}
                          </p>
                        </div>
                        <div>
                          <span className="text-sm text-muted-foreground">{t("phone", "Phone")}:</span>
                          <p className="text-white font-medium">
                            {selectedClient?.phone || formData.phone || t("not_available", "N/A")}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Device Information Summary */}
                    <div className="space-y-4 bg-muted/20 rounded-lg p-6 border border-[#00FFFF]/20">
                      <h4 className="text-lg font-semibold text-[#00FFFF] flex items-center gap-2">
                        <Smartphone className="w-5 h-5" />
                        {t("device_information_summary", "Device Information")}
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <span className="text-sm text-muted-foreground">{t("device_type", "Device Type")}:</span>
                          <p className="text-white font-medium">{formData.deviceType}</p>
                        </div>
                        <div>
                          <span className="text-sm text-muted-foreground">{t("brand_model", "Brand & Model")}:</span>
                          <p className="text-white font-medium">{formData.deviceBrand} {formData.deviceModel}</p>
                        </div>
                        <div>
                          <span className="text-sm text-muted-foreground">{t("color", "Color")}:</span>
                          <p className="text-white font-medium">{formData.deviceColor || t("not_available", "N/A")}</p>
                        </div>
                        <div>
                          <span className="text-sm text-muted-foreground">{t("memory_storage", "Memory & Storage")}:</span>
                          <p className="text-white font-medium">
                            {formData.deviceMemory && `${formData.deviceMemory} RAM`}
                            {formData.deviceMemory && formData.deviceStorageCapacity && ', '}
                            {formData.deviceStorageCapacity && `${formData.deviceStorageCapacity} Storage`}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Service & Cost Summary */}
                    <div className="space-y-4 bg-muted/20 rounded-lg p-6 border border-[#00FFFF]/20">
                      <h4 className="text-lg font-semibold text-[#00FFFF] flex items-center gap-2">
                        <DollarSign className="w-5 h-5" />
                        {t("service_cost_summary", "Service & Cost Summary")}
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <span className="text-sm text-muted-foreground">{t("estimated_cost", "Estimated Cost")}:</span>
                          <p className="text-white font-medium">{formatCurrency(parseFloat(formData.costEstimation || '0'), currentLanguage.code)}</p>
                        </div>
                        <div>
                          <span className="text-sm text-muted-foreground">{t("warranty_type", "Warranty")}:</span>
                          <p className="text-white font-medium">
                            {formData.warrantyType === 'extended' 
                              ? `${t("extended_warranty_format", "Extended")} (+${formatCurrency(parseFloat(formData.warrantyCost || '0'), currentLanguage.code)})`
                              : t("standard_free", "Standard (Free)")
                            }
                          </p>
                        </div>
                        <div>
                          <span className="text-sm text-muted-foreground">{t("total_cost", "Total Cost")}:</span>
                          <p className="text-2xl font-bold text-[#00FFFF]">{formatCurrency(parseFloat(formData.totalCost || '0'), currentLanguage.code)}</p>
                        </div>
                        <div>
                          <span className="text-sm text-muted-foreground">{t("estimated_hours", "Est. Hours")}:</span>
                          <p className="text-white font-medium">{formData.technicianEstimatedHours || t("not_available", "N/A")}h</p>
                        </div>
                      </div>
                      {formData.costExplanation && (
                        <div className="mt-4 pt-4 border-t border-muted/20">
                          <span className="text-sm text-muted-foreground">{t("cost_breakdown", "Cost Breakdown")}:</span>
                          <p className="text-white mt-1">{formData.costExplanation}</p>
                        </div>
                      )}
                    </div>

                    {/* Client Approval Section */}
                    <div className="space-y-4 bg-gradient-to-r from-[#00FFFF]/10 to-[#0A192F]/50 rounded-lg p-6 border-2 border-[#00FFFF]/30">
                      <h4 className="text-lg font-semibold text-[#00FFFF] flex items-center gap-2">
                        <Shield className="w-5 h-5" />
                        {t("authorization_required", "Authorization Required")}
                      </h4>
                      
                      <FormFieldWithTooltip
                        label={t("client_approval", "Client Authorization")}
                        tooltip={t("client_approval_tooltip", "The client must approve all service details, costs, and conditions before the repair ticket can be created. This serves as their consent to proceed with the repair.")}
                        required
                      >
                        <div className="flex items-center space-x-3 p-4 bg-muted/30 rounded-md border">
                          <Switch
                            checked={formData.clientApproved}
                            onCheckedChange={(checked) => {
                              setFormData(prev => ({ ...prev, clientApproved: checked }));
                            }}
                            data-testid="switch-client-approved"
                          />
                          <div className="flex-1">
                            <Label htmlFor="client-approved" className="text-base font-medium cursor-pointer">
                              {t("client_has_approved", "Client has reviewed and approved all details")}
                            </Label>
                            <p className="text-sm text-muted-foreground mt-1">
                              {t("approval_confirmation", "By enabling this, you confirm the client has agreed to the service terms, cost, and timeline.")}
                            </p>
                          </div>
                          {formData.clientApproved && (
                            <div className="text-green-500">
                              <Check className="w-6 h-6" />
                            </div>
                          )}
                        </div>
                      </FormFieldWithTooltip>

                      {!formData.clientApproved && (
                        <div className="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-md">
                          <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0" />
                          <p className="text-sm text-yellow-300">
                            {t("approval_warning", "Client approval is required before creating the repair ticket.")}
                          </p>
                        </div>
                      )}
                    </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Other steps - Should not happen */}
              {currentStep > 6 && (
                <div className="text-center py-12 text-muted-foreground">
                  <div className="space-y-4">
                    <div className="text-6xl">🚧</div>
                    <h3 className="text-lg font-semibold">{t("under_construction", "Under Construction")}</h3>
                    <p>{t("step_under_development", "This step is currently under development")}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Step Status Indicator */}
            {currentStep > 0 && (
              <div className="text-center py-4 border border-green-500/20 rounded-lg bg-green-500/5 mb-6">
                <div className="flex items-center justify-center gap-2 text-green-400">
                  <Check className="w-4 h-4" />
                  <span className="text-sm font-medium">
                    {`${currentStep} ${t("of", "of")} ${ticketSteps.length} ${t("steps_completed", "steps completed")}`}
                  </span>
                </div>
              </div>
            )}
            
            {/* Enhanced Navigation Buttons */}
            <div className="flex justify-between pt-6 border-t border-[#00FFFF]/20 bg-slate-800/50 px-6 py-4">
              <Button 
                variant="outline" 
                onClick={handlePreviousStep}
                disabled={currentStep === 0}
                className="px-6 py-2 shadow-md hover:shadow-lg transition-all duration-200 border-slate-300 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500"
                data-testid="button-previous-step"
              >
                <span className="mr-2">←</span>
                {t("previous", "Previous")}
              </Button>
              
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => handleDialogChange(false)}
                  className="px-6 py-2 shadow-md hover:shadow-lg transition-all duration-200 border-slate-300 dark:border-slate-600 hover:border-red-400 dark:hover:border-red-500 hover:text-red-600 dark:hover:text-red-400"
                  data-testid="button-cancel"
                >
                  {t("cancel", "Cancel")}
                </Button>
                
                {currentStep < ticketSteps.length - 1 ? (
                  <Button 
                    onClick={handleNextStep}
                    disabled={currentStep === 0 && !selectedClient && !showClientForm}
                    className="btn-next-hover relative overflow-hidden group px-6 py-2 bg-gradient-to-r from-[#0A192F] to-[#00FFFF] hover:from-[#0A192F] hover:to-[#00FFFF]/80 shadow-lg hover:shadow-xl hover:shadow-[#00FFFF]/20 transition-all duration-200"
                    data-testid="button-next-step"
                  >
                    <div className="flex items-center gap-2">
                      {t("next", "Next")}
                      <div className="transition-transform group-hover:translate-x-1">
                        →
                      </div>
                    </div>
                  </Button>
                ) : (
                  <Button 
                    onClick={handleCreateTicket}
                    disabled={createTicketMutation.isPending}
                    className="btn-next-hover bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 shadow-lg shadow-green-500/30 relative overflow-hidden"
                    data-testid="button-create-ticket-final"
                  >
                    <div className="flex items-center gap-2">
                      <div className="text-lg">🎉</div>
                      {t("create_ticket", "Create Ticket")}
                      <div className="text-lg">🎉</div>
                    </div>
                    <div className="absolute inset-0 bg-white/10 rounded-lg animate-ping opacity-30"></div>
                  </Button>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* CPF Conflict Dialog */}
        <Dialog open={showCPFConflict} onOpenChange={setShowCPFConflict}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-orange-600">
                <AlertTriangle className="h-5 w-5" />
                {t("cpf_conflict", "CPF Already Exists")}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <p className="text-muted-foreground">
                {t("cpf_conflict_message", "A client with this CPF already exists in your system.")}
              </p>
              
              {conflictClient && (
                <div className="border rounded-lg p-4 bg-muted/50">
                  <h4 className="font-medium mb-2">
                    {t("existing_client", "Existing Client:")}
                  </h4>
                  <div className="space-y-1 text-sm">
                    <div className="font-medium">
                      {conflictClient.firstName} {conflictClient.lastName}
                    </div>
                    {conflictClient.cpf && (
                      <div>CPF: {conflictClient.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")}</div>
                    )}
                    {conflictClient.email && <div>{conflictClient.email}</div>}
                  </div>
                </div>
              )}
              
              <p className="text-sm text-muted-foreground">
                {t("cpf_conflict_options", "Would you like to use the existing client or create a new one?")}
              </p>
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                onClick={handleUseExistingClient}
                className="flex-1"
                data-testid="button-use-existing-client"
              >
                {t("use_existing", "Use Existing")}
              </Button>
              <Button
                onClick={handleOverwriteClient}
                className="flex-1 bg-orange-600 hover:bg-orange-700"
                data-testid="button-create-new-anyway"
              >
                {t("create_new_anyway", "Create New Anyway")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        
        </div>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="mb-2 p-3 border border-border rounded-lg bg-card shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4" />
              <span className="font-medium text-sm">{t("filter_options", "Filter Options")}</span>
            </div>
            {hasActiveFilters && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={clearFilters}
                className="text-muted-foreground hover:text-foreground h-7 px-2 text-xs"
                data-testid="button-clear-filters"
              >
                <X className="w-3 h-3 mr-1" />
                {t("clear_filters", "Clear Filters")}
              </Button>
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {/* Priority Filter */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">{t("filter_by_priority", "Filter by Priority")}</Label>
              <Select 
                value={filters.priority} 
                onValueChange={(value) => setFilters(prev => ({ ...prev, priority: value }))}
              >
                <SelectTrigger className="w-full" data-testid="select-priority-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("all_priorities", "All Priorities")}</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="vip">VIP</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Client Name Filter */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">{t("filter_by_name", "Filter by Client Name")}</Label>
              <Input
                placeholder={t("search_by_name", "Search by name...")}
                value={filters.name}
                onChange={(e) => setFilters(prev => ({ ...prev, name: e.target.value }))}
                className="w-full"
                data-testid="input-name-filter"
              />
            </div>

            {/* CPF Filter */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">{t("filter_by_cpf", "Filter by CPF")}</Label>
              <Input
                placeholder={t("search_by_cpf", "Search by CPF...")}
                value={filters.cpf}
                onChange={(e) => setFilters(prev => ({ ...prev, cpf: e.target.value }))}
                className="w-full"
                data-testid="input-cpf-filter"
              />
            </div>

            {/* Device Type Filter */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">{t("filter_by_device_type", "Filter by Device Type")}</Label>
              <Select 
                value={filters.deviceType} 
                onValueChange={(value) => setFilters(prev => ({ ...prev, deviceType: value }))}
              >
                <SelectTrigger className="w-full" data-testid="select-device-type-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("all_device_types", "All Device Types")}</SelectItem>
                  {deviceTypes.map(deviceType => (
                    <SelectItem key={deviceType} value={deviceType}>
                      {deviceType}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Ticket ID Filter */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">{t("filter_by_ticket_id", "Filter by Ticket ID")}</Label>
              <Input
                placeholder={t("search_by_ticket_id", "Search by ticket ID...")}
                value={filters.ticketId}
                onChange={(e) => setFilters(prev => ({ ...prev, ticketId: e.target.value }))}
                className="w-full"
                data-testid="input-ticket-id-filter"
              />
            </div>
          </div>

          {/* Active Filters Summary */}
          {hasActiveFilters && (
            <div className="mt-4 pt-4 border-t border-border">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>{t("showing_filtered_results", "Showing filtered results")}:</span>
                <span className="font-medium text-foreground">
                  {filteredTickets.length} {filteredTickets.length === 1 ? 'ticket' : 'tickets'}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Kanban Board Container - Constrained to parent width */}
      <div className="w-full overflow-hidden">
        <div 
          className="w-full overflow-x-auto border border-border rounded-lg bg-muted/20"
        >
          <div className="flex gap-4 p-2" style={{ width: 'fit-content' }}>
          {kanbanColumns.map((column) => (
            <div
              key={column.id}
              className={`w-84 ${column.color} rounded-lg p-3 flex flex-col flex-shrink-0 transition-all duration-200 ${
                dragHoverColumn === column.id 
                  ? 'ring-2 ring-[#00FFFF] ring-offset-2 bg-opacity-80 shadow-lg transform scale-[1.02]' 
                  : ''
              }`}
              onDragOver={(e) => handleDragOver(e, column.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, column.id as TicketStatus)}
              data-testid={`column-${column.id}`}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-800">{column.title}</h3>
                <Badge variant="secondary" className="bg-[#0A192F] text-[#00FFFF] border border-[#00FFFF]/30 font-semibold shadow-sm">
                  {ticketsByStatus[column.id]?.length || 0}
                </Badge>
              </div>

              {/* Tickets */}
              <div className="space-y-3 overflow-y-auto overflow-x-hidden pr-1 kanban-scroll">
                {ticketsByStatus[column.id]?.map((ticket) => {
                  const collapsed = isCardCollapsed(ticket.id);
                  
                  return (
                    <Card
                      key={ticket.id}
                      className={`cursor-pointer hover:shadow-md transition-all duration-200 ${getStatusCardStyling(ticket.status)}`}
                      draggable
                      onDragStart={(e) => handleDragStart(e, ticket.id)}
                      onClick={() => setSelectedTicketSummary(ticket)}
                      data-testid={`ticket-${ticket.id}`}
                    >
                      <CardContent className={`${collapsed ? 'p-3' : 'p-4 pr-4'} ${getStatusTextColor(ticket.status)}`}>
                        {/* Header row with priority, ticket ID, and expand/collapse button */}
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-3 h-3 rounded-full ${getPriorityColor(ticket.priority as TicketPriority)}`}
                              title={`${t("priority", "Priority")}: ${ticket.priority}`}
                            ></div>
                            <span className={`text-xs ${getStatusMutedColor(ticket.status)}`}>
                              #{ticket.id.slice(-6).toUpperCase()}
                            </span>
                          </div>
                          
                          {/* Individual card expand/collapse button */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => toggleCardCollapse(ticket.id, e)}
                            className={`h-6 w-6 p-0 hover:bg-[#00FFFF]/20 hover:text-[#00FFFF] transition-colors ${getStatusMutedColor(ticket.status)}`}
                            data-testid={`button-toggle-card-${ticket.id}`}
                          >
                            {collapsed ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
                          </Button>
                        </div>

                        {/* Ticket title - always shown */}
                        <h4 className={`font-medium text-sm ${collapsed ? 'line-clamp-1' : 'line-clamp-2'} mb-2`}>
                          {ticket.title}
                        </h4>

                        {collapsed ? (
                          /* COLLAPSED VIEW - Minimal information */
                          <div className="space-y-1">
                            {/* Client name only */}
                            {ticket.client && (
                              <div className={`flex items-center text-xs ${getStatusMutedColor(ticket.status)}`}>
                                <User className="w-3 h-3 mr-1" />
                                {ticket.client.firstName} {ticket.client.lastName}
                              </div>
                            )}
                          </div>
                        ) : (
                          /* EXPANDED VIEW - Full information */
                          <div className="space-y-2">
                            {/* Device info */}
                            {(ticket.deviceType || ticket.deviceModel) && (
                              <p className={`text-xs ${getStatusMutedColor(ticket.status)}`}>
                                {[ticket.deviceType, ticket.deviceModel].filter(Boolean).join(' - ')}
                              </p>
                            )}

                            {/* Client info */}
                            {ticket.client && (
                              <div className={`flex items-center text-xs ${getStatusMutedColor(ticket.status)}`}>
                                <User className="w-3 h-3 mr-1" />
                                {ticket.client.firstName} {ticket.client.lastName}
                              </div>
                            )}

                            {/* Cost info */}
                            {ticket.estimatedCost && (
                              <div className={`flex items-center text-xs ${getStatusMutedColor(ticket.status)}`}>
                                <DollarSign className="w-3 h-3 mr-1" />
                                {t("estimated_cost_abbrev", "Est")}: ${ticket.estimatedCost}
                              </div>
                            )}

                            {/* Progress Visualization */}
                            <div className="relative overflow-visible">
                              <ProgressVisualization
                                key={`card-progress-${ticket.id}-${ticket.status}`}
                                currentStatus={ticket.status}
                                ticketId={ticket.id}
                                createdAt={ticket.createdAt}
                                technicianEstimatedHours={ticket.technicianEstimatedHours}
                                onAdvanceStatus={(ticketId, nextStatus) => {
                                  updateTicketStatus.mutate({ ticketId, status: nextStatus as TicketStatus });
                                }}
                                isAdvancing={updateTicketStatus.isPending}
                                compact={true}
                                showAdvanceButton={true}
                                headerStyle="simple"
                              />
                            </div>

                            {/* Created date */}
                            <div className={`flex items-center text-xs ${getStatusMutedColor(ticket.status)}`}>
                              <Clock className="w-3 h-3 mr-1" />
                              {new Date(ticket.createdAt!).toLocaleDateString()}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}

                {/* Empty state */}
                {(!ticketsByStatus[column.id] || ticketsByStatus[column.id].length === 0) && (
                  <div className="flex items-center justify-center text-muted-foreground text-sm py-4">
                    {t("no_tickets_stage", "No tickets in this stage")}
                  </div>
                )}
              </div>
            </div>
          ))}
          </div>
        </div>
      </div>

      {/* Ticket Summary Modal */}
      <Dialog open={!!selectedTicketSummary} onOpenChange={() => setSelectedTicketSummary(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          {selectedTicketSummary && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Smartphone className="w-5 h-5" />
                  {t("ticket_summary", "Ticket Summary")} - #{selectedTicketSummary.id.slice(-6).toUpperCase()}
                </DialogTitle>
              </DialogHeader>
              
              {/* Priority and Status Header - Improved Design */}
              <div className="flex items-center justify-between mb-6 p-4 bg-muted/30 rounded-lg border">
                <div className="flex items-center gap-4">
                  {/* Priority Selector - Prominent Position */}
                  <div className="flex items-center gap-3">
                    <label className="text-sm font-semibold text-foreground">{t("priority", "Priority")}</label>
                    <Select
                      value={selectedTicketSummary.priority}
                      onValueChange={(newPriority) => {
                        updateTicketPriority.mutate({ 
                          ticketId: selectedTicketSummary.id, 
                          priority: newPriority as TicketPriority 
                        });
                      }}
                      data-testid="select-ticket-priority-header"
                    >
                      <SelectTrigger className="w-36 h-9">
                        <SelectValue>
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${getPriorityColor(selectedTicketSummary.priority as TicketPriority)}`}>
                            {getPriorityLabel(selectedTicketSummary.priority as TicketPriority)}
                          </span>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low" data-testid="priority-low-header">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${getPriorityColor('low')}`}>
                            {getPriorityLabel('low')}
                          </span>
                        </SelectItem>
                        <SelectItem value="medium" data-testid="priority-medium-header">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${getPriorityColor('medium')}`}>
                            {getPriorityLabel('medium')}
                          </span>
                        </SelectItem>
                        <SelectItem value="critical" data-testid="priority-critical-header">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${getPriorityColor('critical')}`}>
                            {getPriorityLabel('critical')}
                          </span>
                        </SelectItem>
                        <SelectItem value="vip" data-testid="priority-vip-header">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${getPriorityColor('vip')}`}>
                            {getPriorityLabel('vip')}
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
                  <Badge className={`${getStatusCardStyling(selectedTicketSummary.status)} px-3 py-1`}>
                    {getKanbanColumns(t).find(col => col.id === selectedTicketSummary.status)?.title}
                  </Badge>
                </div>
              </div>

              {/* Smart Collapsible Progress Section */}
              <div className="mb-6 p-3 bg-card/50 border border-border rounded-lg">
                <ProgressVisualization
                  key={`progress-${selectedTicketSummary.id}-${selectedTicketSummary.status}`}
                  currentStatus={selectedTicketSummary.status}
                  ticketId={selectedTicketSummary.id}
                  createdAt={selectedTicketSummary.createdAt}
                  technicianEstimatedHours={selectedTicketSummary.technicianEstimatedHours}
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

              {/* Tabs Interface - Simplified */}
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="general" data-testid="tab-general-info">
                    {t("general_info", "General Info")}
                  </TabsTrigger>
                  <TabsTrigger value="problems" data-testid="tab-problems">
                    {t("problems", "Problems")}
                  </TabsTrigger>
                  <TabsTrigger value="checklist" data-testid="tab-checklist">
                    {t("checklist", "Checklist")}
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
                          <div className="truncate text-slate-200">{selectedTicketSummary.deviceType}</div>
                        </div>
                        <div className="bg-slate-800/50 dark:bg-slate-900/50 p-2 rounded border border-cyan-500/20">
                          <div className="font-medium text-cyan-400">{t("model", "Model")}</div>
                          <div className="truncate text-slate-200">{selectedTicketSummary.deviceModel}</div>
                        </div>
                        <div className="bg-slate-800/50 dark:bg-slate-900/50 p-2 rounded border border-cyan-500/20">
                          <div className="font-medium text-cyan-400">{t("color", "Color")}</div>
                          <div className="truncate text-slate-200">{selectedTicketSummary.deviceColor || "N/A"}</div>
                        </div>
                      </div>
                    </div>

                    {/* Client Information */}
                    {selectedTicketSummary.client && (
                      <div className="bg-muted/5 border border-muted/20 rounded-lg p-3">
                        <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                          <User className="h-4 w-4 text-green-600 dark:text-green-400" />
                          {t("client_information", "Client Information")}
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                          <div className="bg-slate-800/50 dark:bg-slate-900/50 p-2 rounded border border-cyan-500/20">
                            <div className="font-medium text-cyan-400">{t("name", "Name")}</div>
                            <div className="truncate text-slate-200">{selectedTicketSummary.client.firstName} {selectedTicketSummary.client.lastName}</div>
                          </div>
                          <div className="bg-slate-800/50 dark:bg-slate-900/50 p-2 rounded border border-cyan-500/20">
                            <div className="font-medium text-cyan-400">{t("email", "Email")}</div>
                            <div className="truncate text-slate-200">{selectedTicketSummary.client.email}</div>
                          </div>
                          <div className="bg-slate-800/50 dark:bg-slate-900/50 p-2 rounded border border-cyan-500/20">
                            <div className="font-medium text-cyan-400">{t("phone", "Phone")}</div>
                            <div className="truncate text-slate-200">{selectedTicketSummary.client.phone}</div>
                          </div>
                          <div className="bg-slate-800/50 dark:bg-slate-900/50 p-2 rounded border border-cyan-500/20">
                            <div className="font-medium text-cyan-400">{t("cpf", "CPF")}</div>
                            <div className="truncate text-slate-200">{selectedTicketSummary.client.cpf}</div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Ticket Summary */}
                    <div className="bg-muted/5 border border-muted/20 rounded-lg p-3">
                      <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                        {t("ticket_summary", "Ticket Summary")}
                      </h3>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-slate-800/50 dark:bg-slate-900/50 p-2 rounded border border-cyan-500/20">
                          <div className="font-medium text-cyan-400">{t("total_cost", "Total Cost")}</div>
                          <div className="font-bold text-emerald-400">
                            {selectedTicketSummary.totalCost || selectedTicketSummary.costEstimation 
                              ? formatCurrency(parseFloat(selectedTicketSummary.totalCost || selectedTicketSummary.costEstimation), currentLanguage.code)
                              : "N/A"}
                          </div>
                        </div>
                        <div className="bg-slate-800/50 dark:bg-slate-900/50 p-2 rounded border border-cyan-500/20">
                          <div className="font-medium text-cyan-400">{t("warranty_type", "Warranty")}</div>
                          <div className="text-slate-200">
                            {selectedTicketSummary.warrantyType === 'extended' 
                              ? t("extended_warranty_short", "Extended (6m)")
                              : t("standard_warranty_short", "Standard (3m)")}
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 gap-2 text-xs mt-2">
                        <div className="bg-slate-800/50 dark:bg-slate-900/50 p-2 rounded border border-cyan-500/20">
                          <div className="font-medium text-cyan-400">{t("created_on", "Created")}</div>
                          <div className="text-slate-200">{new Date(selectedTicketSummary.createdAt!).toLocaleDateString()}</div>
                        </div>
                      </div>
                      {selectedTicketSummary.description && (
                        <div className="mt-2 bg-slate-800/50 dark:bg-slate-900/50 p-2 rounded border border-cyan-500/20">
                          <div className="font-medium text-cyan-400 mb-1">{t("description", "Description")}</div>
                          <div className="text-xs text-slate-300 italic">"{selectedTicketSummary.description}"</div>
                        </div>
                      )}
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
                              await fetch(`/api/tickets/${selectedTicketSummary.id}/notes`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ content: newNote })
                              });
                              setNewNote('');
                              // Refresh notes
                              const updatedNotes = await fetch(`/api/tickets/${selectedTicketSummary.id}/notes`).then(r => r.json());
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
                </TabsContent>

                {/* Problems Tab */}
                <TabsContent value="problems" className="space-y-4">
                  <ProblemsTabContent 
                    ticketId={selectedTicketSummary.id}
                    deviceType={selectedTicketSummary.deviceType}
                    issueResponses={issueResponses}
                  />
                </TabsContent>

                {/* Checklist Tab */}
                <TabsContent value="checklist" className="space-y-4">
                  <div className="space-y-3">
                    <h3 className="font-semibold text-lg">{t("service_checklist", "Service Checklist")}</h3>
                    
                    {!selectedTicketSummary.serviceChecklist?.components || Object.keys(selectedTicketSummary.serviceChecklist.components).length === 0 ? (
                      <div className="text-sm text-muted-foreground">
                        {t("no_checklist_available", "No service checklist available")}
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* Compact Grid Layout */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {checklistComponentOrder.map((component) => {
                            const condition = selectedTicketSummary.serviceChecklist.components[component];
                            if (!condition) return null;
                            return (
                              <div key={component} className="flex items-center justify-between p-2 bg-muted/5 border border-muted/20 rounded-md text-xs">
                                <span className="font-medium capitalize truncate pr-2">{component.replace(/([A-Z])/g, ' $1').trim()}</span>
                                <span className={`text-xs px-1.5 py-0.5 rounded-full whitespace-nowrap flex-shrink-0 ${
                                  condition === 'excellent' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' :
                                  condition === 'good' ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300' :
                                  condition === 'fair' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300' :
                                  condition === 'poor' ? 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300' :
                                  condition === 'damaged' ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' :
                                  condition === 'missing' ? 'bg-red-200 text-red-800 dark:bg-red-900 dark:text-red-200' :
                                  condition === 'not_applicable' ? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' :
                                  'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                                }`}>
                                  {condition === 'not_applicable' ? 'N/A' : condition.replace('_', ' ')}
                                </span>
                              </div>
                            );
                          })}
                        </div>

                        {/* Summary Stats */}
                        <div className="bg-muted/5 border border-muted/20 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium text-sm">{t("condition_summary", "Condition Summary")}</h4>
                            <span className="text-xs text-muted-foreground">
                              {Object.values(selectedTicketSummary.serviceChecklist.components).filter(c => c && c !== 'not_applicable').length} {t("components_assessed", "components assessed")}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {(() => {
                              const conditions = Object.values(selectedTicketSummary.serviceChecklist.components).filter(c => c && c !== 'not_applicable');
                              const conditionCounts = conditions.reduce((acc: any, condition) => {
                                acc[condition] = (acc[condition] || 0) + 1;
                                return acc;
                              }, {});
                              
                              return Object.entries(conditionCounts).map(([condition, count]) => (
                                <span key={condition} className={`text-xs px-2 py-1 rounded-full font-medium ${
                                  condition === 'excellent' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' :
                                  condition === 'good' ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300' :
                                  condition === 'fair' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300' :
                                  condition === 'poor' ? 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300' :
                                  condition === 'damaged' ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' :
                                  condition === 'missing' ? 'bg-red-200 text-red-800 dark:bg-red-900 dark:text-red-200' :
                                  'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                                }`}>
                                  {count}× {condition.replace('_', ' ')}
                                </span>
                              ));
                            })()}
                          </div>
                        </div>
                        
                        {/* Additional Notes */}
                        {selectedTicketSummary.serviceChecklist?.additionalNotes && selectedTicketSummary.serviceChecklist.additionalNotes.trim() && (
                          <div className="bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-800/50 rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-2">
                              <MessageSquare className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                              <h4 className="font-medium text-sm">{t("additional_notes", "Additional Notes")}</h4>
                            </div>
                            <p className="text-sm text-muted-foreground italic">"{selectedTicketSummary.serviceChecklist.additionalNotes}"</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
              
              <div className="flex justify-end">
                <Button variant="outline" onClick={() => setSelectedTicketSummary(null)}>
                  {t("close", "Close")}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Ticket Creation Confirmation Dialog */}
      <Dialog open={showCreateConfirmation} onOpenChange={setShowCreateConfirmation}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Check className="w-5 h-5 text-green-500" />
              {t("confirm_ticket_creation", "Create Repair Ticket?")}
            </DialogTitle>
            <DialogDescription>
              {t("confirmation_message", "Are you sure you want to create this repair ticket?")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm space-y-1">
              <p className="font-medium text-foreground">{t("this_will", "This will:")}</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>{t("create_ticket_backlog", "Create a new ticket in the BackLog")}</li>
                <li>{t("lock_service_details", "Lock in the agreed service details and cost")}</li>
                <li>{t("begin_repair_process", "Begin the repair process")}</li>
              </ul>
            </div>

            <div className="bg-muted/20 p-3 rounded-md space-y-1 text-sm">
              <div><strong>{t("client", "Client")}:</strong> {selectedClient ? `${selectedClient.firstName} ${selectedClient.lastName}` : `${formData.firstName} ${formData.lastName}`}</div>
              <div><strong>{t("device", "Device")}:</strong> {formData.deviceType} {formData.deviceBrand} {formData.deviceModel}</div>
              <div><strong>{t("total_cost", "Total Cost")}:</strong> ${formData.totalCost}</div>
            </div>
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 gap-2">
            <Button variant="outline" onClick={() => setShowCreateConfirmation(false)}>
              {t("cancel", "Cancel")}
            </Button>
            <Button onClick={handleConfirmCreateTicket} className="bg-green-600 hover:bg-green-700">
              {t("create_ticket", "Create Ticket")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Client Edit Modal */}
      <Dialog open={showEditClientModal} onOpenChange={setShowEditClientModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("modify_client", "Modify Client Information")}</DialogTitle>
            <DialogDescription>
              {t("modify_client_description", "Update the client's information below.")}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-firstName">{t("first_name", "First Name")}</Label>
                <Input
                  id="edit-firstName"
                  value={editClientData.firstName}
                  onChange={(e) => setEditClientData(prev => ({ ...prev, firstName: e.target.value }))}
                  placeholder={t("first_name", "First Name")}
                  data-testid="input-edit-first-name"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit-lastName">{t("last_name", "Last Name")}</Label>
                <Input
                  id="edit-lastName"
                  value={editClientData.lastName}
                  onChange={(e) => setEditClientData(prev => ({ ...prev, lastName: e.target.value }))}
                  placeholder={t("last_name", "Last Name")}
                  data-testid="input-edit-last-name"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-cpf">{t("cpf", "CPF")}</Label>
              <Input
                id="edit-cpf"
                value={editClientData.cpf}
                onChange={(e) => setEditClientData(prev => ({ ...prev, cpf: e.target.value }))}
                placeholder={t("cpf", "CPF")}
                data-testid="input-edit-cpf"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-email">{t("email", "Email")}</Label>
              <Input
                id="edit-email"
                type="email"
                value={editClientData.email}
                onChange={(e) => setEditClientData(prev => ({ ...prev, email: e.target.value }))}
                placeholder={t("email", "Email")}
                data-testid="input-edit-email"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-phone">{t("phone", "Phone")}</Label>
              <Input
                id="edit-phone"
                value={editClientData.phone}
                onChange={(e) => {
                  const formattedPhone = formatBrazilianPhone(e.target.value);
                  setEditClientData(prev => ({ ...prev, phone: formattedPhone }));
                }}
                placeholder={t("phone_placeholder", "(xx)xxxxx-xxxx")}
                maxLength={14}
                data-testid="input-edit-phone"
              />
            </div>
          </div>
          
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 gap-2">
            <Button 
              variant="outline" 
              onClick={() => setShowEditClientModal(false)}
              data-testid="button-cancel-edit-client"
            >
              {t("cancel", "Cancel")}
            </Button>
            <Button 
              onClick={() => {
                if (selectedClient) {
                  updateClientMutation.mutate({
                    clientId: selectedClient.id,
                    clientData: {
                      firstName: editClientData.firstName,
                      lastName: editClientData.lastName,
                      cpf: editClientData.cpf,
                      email: editClientData.email,
                      phone: editClientData.phone
                    }
                  });
                }
              }}
              disabled={updateClientMutation.isPending}
              data-testid="button-save-edit-client"
            >
              {updateClientMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("saving", "Saving...")}
                </>
              ) : (
                t("save", "Save")
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
