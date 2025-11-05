import { useState, useEffect, useRef, useMemo, memo } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
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
import TicketSummaryDialog from "@/components/TicketSummaryDialog";
import { Plus, Clock, User, DollarSign, Check, AlertTriangle, Info, CalendarIcon, Shield, Smartphone, Laptop, Monitor, Loader2, MessageSquare, Filter, X, ChevronDown, ChevronUp, Minimize2, Maximize2, Edit, Users, Lock, FileText, CheckSquare, GitCompare, AlertCircle, Wrench, CheckCircle, Repeat, Package, Search } from "lucide-react";
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
import type { Ticket, Client, TicketStatus, TicketPriority, WarrantyTier } from "@shared/schema";
import { toCents, fromCents, addCents, formatCurrency as formatCurrencyFromUtility, normalizeCurrency, type Locale } from "@shared/money";
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

// Defects List Component
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
  { id: 'service_timeline', title: t('services_and_timeline', 'Services and Timeline'), icon: Clock },
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
  // Services and Timeline
  clientDeadline: string;
  technicianEstimatedHours: string;
  selectedServices: string[]; // Array of selected repair service IDs
  costEstimation: string;
  totalCost: string;
  costExplanation: string;
  // Service Items (Inventory)
  selectedItems: Array<{ inventoryItemId: string; quantity: number; unitPrice: string }>;
  // Service Checklist
  selectedChecklists: string[]; // Array of selected checklist IDs
  additionalNotes: string;
  // Issue Assessment
  issueResponses?: Array<{ questionId: string; answer: any }>;
  // Client Authorization
  clientApproved: boolean;
}

type TicketWithClient = Ticket & { client?: Client };

// Currency formatting utility using cents-based money utilities
const formatCurrency = (amountCents: number, locale: Locale = 'en') => {
  return formatCurrencyFromUtility(amountCents, locale);
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

// Repair Service Cards Component
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

interface RepairServiceCardsProps {
  deviceType: string;
  selectedServices: string[];
  onServiceToggle: (serviceId: string) => void;
  warrantyCoverage?: Map<string, { ticketId: string; warrantyType: string; expiresAt: Date }>;
  currentDefects?: string[];
}

function RepairServiceCards({ deviceType, selectedServices, onServiceToggle, warrantyCoverage, currentDefects }: RepairServiceCardsProps) {
  const { t, currentLanguage, formatDate } = useLocalization();
  
  // Fetch repair services for the selected device type
  const { data: services = [], isLoading, error, isError } = useQuery<RepairService[]>({
    queryKey: [`/api/repair-services/device/${deviceType}`],
    enabled: !!deviceType,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  // Filter only active services
  const activeServices = services.filter(service => service.isActive);
  const hasLoadedServices = !isLoading && !isError;

  if (!deviceType) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Smartphone className="mx-auto h-12 w-12 mb-4 opacity-50" />
        <p>{t("select_device_first", "Please select a device type first to see available services")}</p>
      </div>
    );
  }

  // Enhanced loading state with better visual feedback
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-lg font-semibold text-white">
            {t("available_services", "Available Services")} 
            <span className="text-[#00FFFF] ml-2">({deviceType})</span>
          </h4>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">{t("loading_services", "Loading...")}</span>
          </div>
        </div>
        
        {/* Enhanced skeleton loading with shimmer effect */}
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-slate-800/50 border border-slate-600 rounded-lg p-4 animate-pulse">
              <div className="flex items-start gap-3">
                <div className="w-4 h-4 bg-slate-600 rounded border-2 border-slate-500"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-slate-600 rounded w-3/4"></div>
                  <div className="h-3 bg-slate-700 rounded w-full"></div>
                  <div className="flex gap-4">
                    <div className="h-3 bg-slate-600 rounded w-16"></div>
                    <div className="h-3 bg-slate-600 rounded w-20"></div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Enhanced error state
  if (isError) {
    return (
      <div className="text-center py-8">
        <AlertTriangle className="mx-auto h-12 w-12 mb-4 text-red-400" />
        <h4 className="text-lg font-semibold text-white mb-2">
          {t("error_loading_services", "Error Loading Services")}
        </h4>
        <p className="text-sm text-muted-foreground mb-4">
          {t("services_load_error", "Unable to load repair services. Please try again.")}
        </p>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => window.location.reload()}
          className="border-red-400 text-red-400 hover:bg-red-400/10"
        >
          {t("retry", "Retry")}
        </Button>
      </div>
    );
  }

  // Enhanced empty state with more context
  if (hasLoadedServices && activeServices.length === 0) {
    const hasInactiveServices = services.length > activeServices.length;
    
    return (
      <div className="text-center py-8">
        <AlertTriangle className="mx-auto h-12 w-12 mb-4 text-yellow-400 opacity-75" />
        <h4 className="text-lg font-semibold text-white mb-2">
          {t("no_services_available", "No Services Available")}
        </h4>
        <p className="text-muted-foreground mb-2">
          {t("no_active_services", `No active repair services found for ${deviceType} devices`)}
        </p>
        {hasInactiveServices && (
          <p className="text-sm text-yellow-400 mb-4">
            {t("inactive_services_note", "Some services exist but are currently disabled")}
          </p>
        )}
        <p className="text-sm text-muted-foreground">
          {t("contact_admin", "Contact your administrator to configure repair services")}
        </p>
      </div>
    );
  }

  const formatTime = (hours: number, minutes: number) => {
    if (hours === 0) return `${minutes}${t("minutes_short", "min")}`;
    if (minutes === 0) return `${hours}${t("hours_short", "h")}`;
    return `${hours}${t("hours_short", "h")} ${minutes}${t("minutes_short", "min")}`;
  };

  const formatCurrency = (amount: string) => {
    const locale: Locale = currentLanguage.code === 'pt-BR' ? 'pt-BR' : 'en';
    const cents = toCents(amount, locale);
    return formatCurrencyFromUtility(cents, locale);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-lg font-semibold text-white">
          {t("available_services", "Available Services")} 
          <span className="text-[#00FFFF] ml-2">({deviceType})</span>
        </h4>
        <Badge variant="outline" className="border-[#00FFFF] text-[#00FFFF]">
          {selectedServices.length} {t("selected", "selected")}
        </Badge>
      </div>
      
      {/* Responsive grid: 3 columns on lg+, 2 on md, 1 on sm */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
        {activeServices.map((service) => {
          const isSelected = selectedServices.includes(service.id);
          
          // Check if this service is warranty-covered
          const isWarrantyCovered = (() => {
            if (!warrantyCoverage || !currentDefects || currentDefects.length === 0) return false;
            
            // Check if any current defect+service combination is covered
            return currentDefects.some(defectId => {
              const coverageKey = `${defectId}:${service.id}`;
              return warrantyCoverage.has(coverageKey);
            });
          })();
          
          // Get warranty info if covered
          const warrantyInfo = (() => {
            if (!isWarrantyCovered || !warrantyCoverage || !currentDefects) return null;
            
            for (const defectId of currentDefects) {
              const coverageKey = `${defectId}:${service.id}`;
              if (warrantyCoverage.has(coverageKey)) {
                return warrantyCoverage.get(coverageKey);
              }
            }
            return null;
          })();
          
          return (
            <Card 
              key={service.id}
              className={`
                cursor-pointer transition-all duration-200 hover:scale-[1.01]
                ${isSelected 
                  ? 'border-[#00FFFF] bg-[#00FFFF]/10 shadow-md shadow-[#00FFFF]/20' 
                  : 'border-slate-600 hover:border-[#00FFFF]/50 bg-slate-800/50'
                }
                ${isWarrantyCovered ? 'ring-2 ring-green-500/50' : ''}
              `}
              onClick={() => onServiceToggle(service.id)}
              data-testid={`service-card-${service.id}`}
            >
              <CardContent className="p-3">
                <div className="space-y-2">
                  {/* Header with checkbox and title */}
                  <div className="flex items-center gap-2">
                    <div className={`
                      w-4 h-4 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0
                      ${isSelected 
                        ? 'bg-[#00FFFF] border-[#00FFFF]' 
                        : 'border-slate-400 hover:border-[#00FFFF]'
                      }
                    `}>
                      {isSelected && <Check className="w-2.5 h-2.5 text-slate-900" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h5 className="font-medium text-white text-sm leading-tight">{service.name}</h5>
                      {isWarrantyCovered && warrantyInfo && (
                        <div className="flex items-center gap-1 mt-1">
                          <Shield className="w-3 h-3 text-green-400" />
                          <span className="text-xs text-green-400 font-medium">
                            {t("warranty_covered", "Warranty Covered")}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Description (if exists) */}
                  {service.description && (
                    <p className="text-xs text-slate-300 leading-tight line-clamp-2">
                      {service.description}
                    </p>
                  )}
                  
                  {/* Time and Cost - compact layout */}
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1 text-slate-400">
                      <Clock className="w-3 h-3" />
                      <span>{formatTime(service.estimatedCompletionTimeHours, service.estimatedCompletionTimeMinutes)}</span>
                    </div>
                    <div className="flex items-center gap-1 text-[#00FFFF]">
                      <DollarSign className="w-3 h-3" />
                      <span className="font-medium">{formatCurrency(service.estimatedLaborCost)}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      
      {selectedServices.length > 0 && (
        <div className="mt-4 p-3 bg-[#00FFFF]/10 border border-[#00FFFF]/30 rounded-lg">
          <p className="text-sm text-slate-300">
            {t("services_note", "Selected services will be used to calculate total time and cost estimates")}
          </p>
        </div>
      )}
    </div>
  );
}

// Item Selection Dialog Component (extracted for performance)
interface ItemSelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableItems: any[];
  isLoadingItems: boolean;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  onAddItem: (item: { inventoryItemId: number; quantity: number; unitPrice: string }) => void;
  currentLanguage: any;
  t: (key: string, fallback: string) => string;
  deviceType: string;
}

const ItemSelectionDialog = memo(({
  open,
  onOpenChange,
  availableItems,
  isLoadingItems,
  searchQuery,
  onSearchQueryChange,
  onAddItem,
  currentLanguage,
  t,
  deviceType,
}: ItemSelectionDialogProps) => {
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState('');
  const [selectedBrand, setSelectedBrand] = useState<string>('all');
  const [selectedModel, setSelectedModel] = useState<string>('all');

  // Fetch brands for the device type
  const { data: brandsData } = useDeviceBrands(deviceType || null);
  
  // Fetch models for the selected brand
  const { data: modelsData } = useDeviceModels(
    deviceType || '',
    selectedBrand || ''
  );

  // Extract brand and model lists
  const brands = brandsData?.items || [];
  const models = modelsData?.items || [];

  // Reset model when brand changes
  useEffect(() => {
    setSelectedModel('all');
  }, [selectedBrand]);

  // Filter items client-side using useMemo to prevent unnecessary recalculations
  const filteredItems = useMemo(() => {
    return (availableItems || []).filter((item: any) => {
      // Text search filter (name or SKU)
      const matchesSearch = !searchQuery || 
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.sku && item.sku.toLowerCase().includes(searchQuery.toLowerCase()));
      
      // Brand filter
      const matchesBrand = selectedBrand === 'all' || 
        item.brand === selectedBrand ||
        (selectedBrand === 'Other' && !item.brand);
      
      // Model filter
      const matchesModel = selectedModel === 'all' || 
        item.model === selectedModel ||
        (selectedModel === 'Other' && !item.model);
      
      return matchesSearch && matchesBrand && matchesModel;
    });
  }, [availableItems, searchQuery, selectedBrand, selectedModel]);

  // Clear selected item when filters change and the item is no longer in filtered results
  useEffect(() => {
    if (selectedItem && !filteredItems.find((item: any) => item.id === selectedItem.id)) {
      setSelectedItem(null);
      setUnitPrice('');
    }
  }, [filteredItems, selectedItem]);

  const handleAddItem = () => {
    if (!selectedItem || !unitPrice || quantity < 1) return;

    onAddItem({
      inventoryItemId: selectedItem.id,
      quantity,
      unitPrice,
    });

    // Reset state
    setSelectedItem(null);
    setQuantity(1);
    setUnitPrice('');
    setSelectedBrand('all');
    setSelectedModel('all');
    onSearchQueryChange('');
    onOpenChange(false);
  };

  const handleCancel = () => {
    setSelectedItem(null);
    setQuantity(1);
    setUnitPrice('');
    setSelectedBrand('all');
    setSelectedModel('all');
    onSearchQueryChange('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]" data-testid="dialog-item-selection">
        <DialogHeader>
          <div className="bg-gradient-to-r from-[#0A192F] to-[#00FFFF] -mx-6 -mt-6 px-6 py-4 mb-4">
            <DialogTitle className="text-white flex items-center gap-2">
              <Package className="h-5 w-5" />
              {t("select_service_item", "Select Service Item")}
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Filters Row */}
          <div className="grid grid-cols-3 gap-3">
            {/* Brand Filter */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                {t("brand", "Brand")}
              </Label>
              <Select
                value={selectedBrand}
                onValueChange={setSelectedBrand}
              >
                <SelectTrigger data-testid="select-brand-filter">
                  <SelectValue placeholder={t("all_brands", "All Brands")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {t("all_brands", "All Brands")}
                  </SelectItem>
                  {brands.map((brand) => (
                    <SelectItem key={brand} value={brand}>
                      {brand}
                    </SelectItem>
                  ))}
                  <SelectItem value="Other">
                    {t("other", "Other")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Model Filter */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                {t("model", "Model")}
              </Label>
              <Select
                value={selectedModel}
                onValueChange={setSelectedModel}
                disabled={selectedBrand === 'all'}
              >
                <SelectTrigger data-testid="select-model-filter">
                  <SelectValue placeholder={t("all_models", "All Models")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {t("all_models", "All Models")}
                  </SelectItem>
                  {models.map((model) => (
                    <SelectItem key={model} value={model}>
                      {model}
                    </SelectItem>
                  ))}
                  <SelectItem value="Other">
                    {t("other", "Other")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Search */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                {t("search", "Search")}
              </Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder={t("search_items", "Search by name or SKU...")}
                  value={searchQuery}
                  onChange={(e) => onSearchQueryChange(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-items"
                />
              </div>
            </div>
          </div>

          {/* Items List */}
          <div className="border rounded-lg max-h-60 overflow-y-auto">
            {isLoadingItems ? (
              <div className="p-8 text-center text-muted-foreground">
                {t("loading", "Loading...")}
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                {t("no_items_available", "No service items available for this device type")}
              </div>
            ) : (
              <div className="divide-y">
                {filteredItems.map((item: any) => (
                  <div
                    key={item.id}
                    className={`p-3 hover:bg-muted/50 cursor-pointer transition-colors ${
                      selectedItem?.id === item.id ? 'bg-primary/10 border-l-4 border-primary' : ''
                    }`}
                    onClick={() => {
                      setSelectedItem(item);
                      setUnitPrice(item.price || '0');
                    }}
                    data-testid={`item-option-${item.id}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="font-medium">{item.name}</div>
                        {item.supplierName && (
                          <div className="text-xs text-muted-foreground">{item.supplierName}</div>
                        )}
                        {item.sku && (
                          <div className="text-sm text-muted-foreground">SKU: {item.sku}</div>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="font-medium text-primary">
                          {currentLanguage.code === 'pt-BR' ? 'R$' : '$'} {item.price}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {t("stock", "Stock")}: {item.quantity}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quantity and Price */}
          {selectedItem && (
            <div className="bg-muted/30 p-4 rounded-lg space-y-4">
              <div className="font-medium text-lg">{selectedItem.name}</div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    {t("quantity", "Quantity")}
                  </label>
                  <Input
                    type="number"
                    min="1"
                    max={selectedItem.quantity}
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, Math.min(selectedItem.quantity, parseInt(e.target.value) || 1)))}
                    data-testid="input-item-quantity"
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    {t("selling_price", "Selling Price")}
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {currentLanguage.code === 'pt-BR' ? 'R$' : '$'}
                    </span>
                    <Input
                      type="text"
                      value={unitPrice}
                      onChange={(e) => {
                        const value = e.target.value.replace(/[^0-9.,]/g, '');
                        setUnitPrice(value);
                      }}
                      placeholder={currentLanguage.code === 'pt-BR' ? '10,00' : '10.00'}
                      data-testid="input-item-unit-price"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t">
                <span className="font-medium">{t("total", "Total")}:</span>
                <span className="text-lg font-bold text-primary">
                  {currentLanguage.code === 'pt-BR' ? 'R$' : '$'} {(parseFloat(unitPrice || '0') * quantity).toFixed(2)}
                </span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleCancel}
            data-testid="button-cancel-item-selection"
          >
            {t("cancel", "Cancel")}
          </Button>
          <Button
            onClick={handleAddItem}
            disabled={!selectedItem || !unitPrice || quantity < 1}
            data-testid="button-confirm-add-item"
          >
            {t("add_item", "Add Item")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

ItemSelectionDialog.displayName = 'ItemSelectionDialog';

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
    // Services and Timeline defaults
    clientDeadline: '',
    technicianEstimatedHours: '',
    selectedServices: [],
    costEstimation: '',
    totalCost: '',
    costExplanation: '',
    // Service Items
    selectedItems: [],
    // Service Checklist
    selectedChecklists: [],
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
    phone: '',
    birthday: ''
  });
  
  // CPF conflict state
  const [showCPFConflict, setShowCPFConflict] = useState(false);
  const [conflictClient, setConflictClient] = useState<Client | null>(null);
  
  // Ticket creation confirmation state
  const [showCreateConfirmation, setShowCreateConfirmation] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  
  // Completion dialog state
  const [showCompletionDialog, setShowCompletionDialog] = useState(false);
  const [ticketToFinalize, setTicketToFinalize] = useState<TicketWithClient | null>(null);
  const [completionData, setCompletionData] = useState({
    completionNotes: '',
    actualHours: '',
    finalActualCost: '',
  });

  // Item selection dialog state
  const [showItemSelectionDialog, setShowItemSelectionDialog] = useState(false);
  const [itemSearchQuery, setItemSearchQuery] = useState('');

  // Finalization wizard state
  const [wizardStep, setWizardStep] = useState(1);
  const [wizardData, setWizardData] = useState({
    finalChecklist: {} as Record<string, boolean>,
    clientAuthorized: false,
    selectedWarrantyTier: 'standard' as string, // Default to standard warranty
    confirmedItemIds: [] as string[], // Track which items were actually used
  });
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const itemsInitializedRef = useRef(false); // Track if service items have been initialized
  
  // Quality check detection
  const getQualityCheckStatus = () => {
    if (!ticketToFinalize) return { requiresQualityReview: false, initialCount: 0, finalCount: 0, hasNewDefects: false };
    
    const initialDefects = (ticketToFinalize.serviceChecklist as any)?.selectedChecklists || [];
    const finalDefects = Object.keys(wizardData.finalChecklist).filter(key => wizardData.finalChecklist[key]);
    
    // Check if any final defect is NOT in the initial defects list (NEW defects)
    const hasNewDefects = finalDefects.some(defect => !initialDefects.includes(defect));
    
    // Quality check required if ANY new defects are detected
    const requiresQualityReview = hasNewDefects;
    
    return {
      requiresQualityReview,
      initialCount: initialDefects.length,
      finalCount: finalDefects.length,
      hasNewDefects
    };
  };

  // Wizard navigation functions
  const resetWizard = () => {
    setWizardStep(1);
    setWizardData({
      finalChecklist: {},
      clientAuthorized: false,
      selectedWarrantyTier: 'standard', // Reset to default warranty
      confirmedItemIds: [],
    });
    setValidationErrors([]);
    itemsInitializedRef.current = false; // Reset initialization flag
  };

  const canAdvanceWizard = () => {
    switch(wizardStep) {
      case 1: // Summary - must have hours and cost
        return completionData.actualHours && completionData.finalActualCost;
      case 2: // Checklist - always can advance (optional checklist selection)
        return true;
      case 3: // Comparison - always can advance
        return true;
      case 4: // Authorization - must be authorized
        return wizardData.clientAuthorized;
      default:
        return false;
    }
  };

  const handleWizardNext = () => {
    if (wizardStep < 4) {
      if (canAdvanceWizard()) {
        setWizardStep(wizardStep + 1);
        setValidationErrors([]); // Clear errors when advancing
      } else {
        // Show validation errors based on current step
        const errors: string[] = [];
        if (wizardStep === 1) {
          if (!completionData.actualHours) errors.push(t("actual_hours_required", "Actual hours are required"));
          if (!completionData.finalActualCost) errors.push(t("final_cost_required", "Final cost is required"));
        } else if (wizardStep === 4) {
          if (!wizardData.clientAuthorized) errors.push(t("client_authorization_required", "Client authorization is required"));
        }
        setValidationErrors(errors);
      }
    }
  };

  const handleWizardPrevious = () => {
    if (wizardStep > 1) {
      setWizardStep(wizardStep - 1);
    }
  };
  
  // Filter state management
  const [filters, setFilters] = useState({
    priority: 'all',
    name: '',
    cpf: '',
    deviceType: 'all',
    ticketId: '',
    showArchived: true, // Show finalized tickets by default
  });
  const [showFilters, setShowFilters] = useState(false);
  
  const queryClient = useQueryClient();
  const { t, currentLanguage, formatDate } = useLocalization();
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

  // Calculate total cost from estimation using cents-based calculations
  const calculateCosts = (estimation = formData.costEstimation) => {
    const locale: Locale = currentLanguage.code === 'pt-BR' ? 'pt-BR' : 'en';
    const basePriceCents = toCents(estimation, locale);
    
    // Update total cost (no warranty cost) - convert back to formatted string for form storage
    setFormData(prev => ({
      ...prev,
      totalCost: fromCents(basePriceCents, locale)
    }));
  };

  // Configuration checklists query
  const { data: configurationChecklists, isLoading: isLoadingChecklists } = useQuery<any[]>({
    queryKey: ['/api/checklists/device', formData.deviceType],
    enabled: !!formData.deviceType && currentStep === 5,
  });

  // Query for finalization checklists
  const { data: finalizationChecklists } = useQuery<any[]>({
    queryKey: ['/api/checklists/device', ticketToFinalize?.deviceType],
    enabled: !!ticketToFinalize?.deviceType && showCompletionDialog,
  });

  // Checklists query for ticket summary context
  const { data: summaryChecklists } = useQuery<any[]>({
    queryKey: ['/api/checklists/device', selectedTicketSummary?.deviceType],
    enabled: !!selectedTicketSummary?.deviceType,
  });

  // Query ticket items for summary view
  const { data: summaryTicketItems = [] } = useQuery({
    queryKey: [`/api/tickets/${selectedTicketSummary?.id}/items`],
    enabled: !!selectedTicketSummary?.id,
    staleTime: 30 * 1000, // 30 seconds
  });

  // Query for tickets currently being serviced (same device type) - for queue information
  const { data: servicingTickets = [] } = useQuery<TicketWithClient[]>({
    queryKey: ['/api/tickets', 'servicing', formData.deviceType],
    queryFn: async () => {
      const response = await fetch('/api/tickets');
      const allTickets = await response.json();
      // Filter tickets that are being serviced and match the device type
      return allTickets.filter((ticket: any) => 
        ticket.status === 'servicing' && 
        ticket.deviceType === formData.deviceType
      );
    },
    enabled: !!formData.deviceType && currentStep === 3,
  });
  
  // Filter only active checklists
  const activeChecklists = configurationChecklists?.filter(checklist => checklist.isActive) || [];

  // Calculate queue information for servicing tickets
  const getQueueInformation = () => {
    if (!servicingTickets || servicingTickets.length === 0) {
      return {
        count: 0,
        totalHours: 0,
        totalMinutes: 0,
        formattedTime: t("no_queue", "No queue - your device can start immediately")
      };
    }

    let totalMinutes = 0;
    
    // Calculate total time from all servicing tickets of same device type
    servicingTickets.forEach(ticket => {
      if (ticket.selectedServices && Array.isArray(ticket.selectedServices)) {
        ticket.selectedServices.forEach(serviceId => {
          const service = repairServices.find(s => s.id === serviceId);
          if (service) {
            const serviceMinutes = (service.estimatedCompletionTimeHours || 0) * 60 + (service.estimatedCompletionTimeMinutes || 0);
            totalMinutes += serviceMinutes;
          }
        });
      }
    });

    // Add extra 30 minutes per device for steps before reaching Service stage
    const extraMinutesPerDevice = 30;
    totalMinutes += servicingTickets.length * extraMinutesPerDevice;

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    let formattedTime = "";
    if (hours === 0 && minutes === 0) {
      formattedTime = t("queue_almost_done", "Queue almost complete - starting soon");
    } else if (hours === 0) {
      formattedTime = `~${minutes}${t("minutes_short", "min")} ${t("queue_wait", "wait time")}`;
    } else if (minutes === 0) {
      formattedTime = `~${hours}${t("hours_short", "h")} ${t("queue_wait", "wait time")}`;
    } else {
      formattedTime = `~${hours}${t("hours_short", "h")} ${minutes}${t("minutes_short", "min")} ${t("queue_wait", "wait time")}`;
    }

    return {
      count: servicingTickets.length,
      totalHours: hours,
      totalMinutes: minutes,
      formattedTime
    };
  };
  
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

  // Fetch repair services for time calculation (moved here to fix initialization order)
  const { data: repairServices = [] } = useQuery<RepairService[]>({
    queryKey: [`/api/repair-services/device/${formData.deviceType}`],
    enabled: !!formData.deviceType,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  // Query for available inventory items (service items with stock for device type)
  const { data: availableItems = [], isLoading: isLoadingItems } = useQuery({
    queryKey: [`/api/inventory/available-for-ticket/${formData.deviceType}`],
    enabled: !!formData.deviceType,
    staleTime: 30 * 1000, // 30 seconds - inventory changes frequently
  });

  // Load repair services for ticket summary (when viewing existing tickets)
  const { data: ticketRepairServices = [] } = useQuery<RepairService[]>({
    queryKey: [`/api/repair-services/device/${selectedTicketSummary?.deviceType}`],
    enabled: !!selectedTicketSummary?.deviceType,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  // Load repair services for finalization wizard (when finalizing tickets)
  const { data: finalizationRepairServices = [] } = useQuery<RepairService[]>({
    queryKey: [`/api/repair-services/device/${ticketToFinalize?.deviceType}`],
    enabled: !!ticketToFinalize?.deviceType && showCompletionDialog,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  // Query ticket items for finalization confirmation
  const { data: ticketItems = [] } = useQuery({
    queryKey: [`/api/tickets/${ticketToFinalize?.id}/items`],
    enabled: !!ticketToFinalize?.id && showCompletionDialog,
    staleTime: 30 * 1000, // 30 seconds
  });

  // Load warranty tiers for finalization wizard (when finalizing tickets)
  const { data: finalizationWarrantyTiers = [] } = useQuery<WarrantyTier[]>({
    queryKey: [`/api/warranty-tiers/${ticketToFinalize?.deviceType}`],
    enabled: !!ticketToFinalize?.deviceType && showCompletionDialog,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  // Auto-populate final cost with estimated total cost when finalization wizard opens
  useEffect(() => {
    if (showCompletionDialog && ticketToFinalize && completionData.finalActualCost === '') {
      // Check if ticket has selected services
      const hasSelectedServices = ticketToFinalize.selectedServices && Array.isArray(ticketToFinalize.selectedServices) && ticketToFinalize.selectedServices.length > 0;
      
      // If ticket has selected services, wait for finalizationRepairServices to load
      if (hasSelectedServices && finalizationRepairServices.length === 0) {
        return; // Exit early - services data not loaded yet
      }
      
      const locale: Locale = currentLanguage.code === 'pt-BR' ? 'pt-BR' : 'en';
      
      // Calculate total estimated cost (services + items + extra costs)
      let totalServicesCents = 0;
      
      // Calculate services cost if services are selected
      if (hasSelectedServices) {
        const serviceCostsCents = (ticketToFinalize.selectedServices as string[]).map(serviceId => {
          const service = finalizationRepairServices.find(s => s.id === serviceId);
          return service ? toCents(service.estimatedLaborCost, locale) : 0;
        });
        totalServicesCents = addCents(...serviceCostsCents);
      }
      
      // Calculate service items cost
      let totalItemsCents = 0;
      if (ticketToFinalize.selectedItems && Array.isArray(ticketToFinalize.selectedItems) && ticketToFinalize.selectedItems.length > 0) {
        const itemsCostsCents = ticketToFinalize.selectedItems.map((item: any) => {
          const itemTotal = parseFloat(item.unitPrice || '0') * item.quantity;
          return toCents(String(itemTotal), locale);
        });
        totalItemsCents = addCents(...itemsCostsCents);
      }
      
      // Add extra costs
      const extraCostsCents = ticketToFinalize.costEstimation ? toCents(ticketToFinalize.costEstimation, locale) : 0;
      
      // Calculate grand total (always calculate, even if some components are 0)
      const grandTotalCents = addCents(totalServicesCents, totalItemsCents, extraCostsCents);
      
      // Convert back to decimal string for input field
      const totalCostDecimal = (grandTotalCents / 100).toFixed(2);
      
      setCompletionData(prev => ({
        ...prev,
        finalActualCost: totalCostDecimal
      }));
    }
  }, [showCompletionDialog, ticketToFinalize, finalizationRepairServices, completionData.finalActualCost, currentLanguage.code]);

  // Initialize service items as checked by default and calculate final cost with items
  useEffect(() => {
    if (showCompletionDialog && ticketItems && ticketItems.length > 0 && !itemsInitializedRef.current) {
      const locale: Locale = currentLanguage.code === 'pt-BR' ? 'pt-BR' : 'en';
      
      // Mark as initialized to prevent re-running
      itemsInitializedRef.current = true;
      
      // Check all items by default
      const allItemIds = ticketItems.map((item: any) => item.id);
      setWizardData(prev => ({
        ...prev,
        confirmedItemIds: allItemIds
      }));
      
      // Calculate total items cost
      const totalItemsCents = ticketItems.reduce((sum: number, item: any) => {
        const itemTotalCents = toCents(item.totalPrice || '0', locale);
        return sum + itemTotalCents;
      }, 0);
      
      // Add items cost to the existing final cost (treat empty as 0)
      setCompletionData(prev => {
        const currentCostCents = prev.finalActualCost ? toCents(prev.finalActualCost, locale) : 0;
        const newCostCents = currentCostCents + totalItemsCents;
        return {
          ...prev,
          finalActualCost: formatCurrencyFromUtility(newCostCents, locale).replace(/[^\d.,]/g, '')
        };
      });
    }
  }, [showCompletionDialog, ticketItems]);

  // Derive estimated time using useMemo to prevent infinite loops
  const servicesIndex = useMemo(() => {
    return new Map((repairServices || []).map(s => [s.id, s]));
  }, [repairServices]);

  const estimatedTotalMinutes = useMemo(() => {
    return formData.selectedServices.reduce((sum, id) => {
      const service = servicesIndex.get(id);
      return service && service.isActive 
        ? sum + (service.estimatedCompletionTimeHours * 60) + service.estimatedCompletionTimeMinutes 
        : sum;
    }, 0);
  }, [formData.selectedServices, servicesIndex]);

  const computedEstimatedHours = useMemo(() => {
    return estimatedTotalMinutes > 0 ? (estimatedTotalMinutes / 60).toFixed(2) : '';
  }, [estimatedTotalMinutes]);

  // Helper function for time display formatting
  const getFormattedEstimatedTime = () => {
    if (estimatedTotalMinutes === 0) return null;
    
    const hours = Math.floor(estimatedTotalMinutes / 60);
    const minutes = estimatedTotalMinutes % 60;
    
    return { hours, minutes, totalMinutes: estimatedTotalMinutes };
  };

  // Tenant settings query for extended warranty price (temporarily simplified)
  const { data: tenant } = useQuery<any>({
    queryKey: ["/api/tenants/current"],
    retry: false,
  });

  // Auto-calculate costs when tenant data loads (initial calculation only)
  useEffect(() => {
    if (tenant && formData.costEstimation) {
      calculateCosts(formData.costEstimation);
    }
  }, [tenant?.settings?.extendedWarrantyPrice]); // Only depend on tenant, not form data to avoid conflicts

  // Sync computed estimated hours to formData with guarded effect
  const lastSyncedHours = useRef('');
  useEffect(() => {
    if (computedEstimatedHours !== lastSyncedHours.current) {
      lastSyncedHours.current = computedEstimatedHours;
      setFormData(prev => 
        prev.technicianEstimatedHours === computedEstimatedHours 
          ? prev 
          : { ...prev, technicianEstimatedHours: computedEstimatedHours }
      );
    }
  }, [computedEstimatedHours]);

  // CRITICAL FIX 2: Reset selectedServices when deviceType changes
  useEffect(() => {
    // Reset selected services when device type changes to prevent mismatched selections
    if (formData.deviceType && formData.selectedServices.length > 0) {
      setFormData(prev => ({
        ...prev,
        selectedServices: [],
        technicianEstimatedHours: '', // Also clear estimated hours
        costEstimation: '', // Clear cost estimation as it may depend on services
        totalCost: '' // Clear total cost
      }));
    }
  }, [formData.deviceType]);

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

  // Fetch client ticket history when a client is selected
  const { data: clientTickets = [], isLoading: isLoadingClientTickets, isError: isClientTicketsError } = useQuery<Ticket[]>({
    queryKey: ["/api/tickets/client", selectedClient?.id],
    enabled: !!selectedClient?.id && isTicketDialogOpen,
    staleTime: 30 * 1000, // 30 seconds
    retry: 1,
  });

  // Warranty coverage checking utility
  const checkWarrantyCoverage = useMemo(() => {
    if (!clientTickets || clientTickets.length === 0 || !formData.deviceType || !formData.selectedChecklists || formData.selectedChecklists.length === 0) {
      return new Map<string, { ticketId: string; warrantyType: string; expiresAt: Date }>();
    }

    const now = new Date();
    const warrantyCoverage = new Map<string, { ticketId: string; warrantyType: string; expiresAt: Date }>();

    // Get current defects from form
    const currentDefects = formData.selectedChecklists;

    // Filter to finalized tickets with the same device type
    const relevantTickets = clientTickets.filter(ticket => 
      ticket.status === 'finalized' && 
      ticket.completedAt && 
      ticket.deviceType === formData.deviceType &&
      ticket.warrantyType
    );

    relevantTickets.forEach(ticket => {
      // Calculate warranty expiration date
      const completedDate = new Date(ticket.completedAt!);
      const warrantyDurationMonths = ticket.warrantyType === 'extended' ? 6 : 3;
      const warrantyExpiresAt = new Date(completedDate);
      warrantyExpiresAt.setMonth(warrantyExpiresAt.getMonth() + warrantyDurationMonths);

      // CRITICAL: Skip this ticket if warranty has expired
      if (warrantyExpiresAt <= now) {
        return; // Warranty expired, skip to next ticket
      }

      // Warranty is still active - proceed with coverage checking
      // Get defects from the previous ticket
      const previousTicketData = ticket.serviceChecklist as any;
      const previousDefects = previousTicketData?.selectedChecklists || [];

      // Get services from the previous ticket
      const previousServices = Array.isArray(ticket.selectedServices) 
        ? ticket.selectedServices as string[] 
        : [];

      // Match current defects with previous defects and services
      currentDefects.forEach(currentDefect => {
        if (previousDefects.includes(currentDefect)) {
          // This defect was found before - check which services were performed
          previousServices.forEach(serviceId => {
            // Create a unique key for this defect+service combination
            const coverageKey = `${currentDefect}:${serviceId}`;
            
            // If this combination is not already covered or has a longer warranty, add it
            if (!warrantyCoverage.has(coverageKey) || 
                warrantyCoverage.get(coverageKey)!.expiresAt < warrantyExpiresAt) {
              warrantyCoverage.set(coverageKey, {
                ticketId: ticket.id,
                warrantyType: ticket.warrantyType!,
                expiresAt: warrantyExpiresAt
              });
            }
          });
        }
      });
    });

    return warrantyCoverage;
  }, [clientTickets, formData.deviceType, formData.selectedChecklists]);

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

  // Finalize ticket with completion data mutation
  const finalizeTicket = useMutation({
    mutationFn: async ({ 
      ticketId, 
      completionNotes, 
      actualHours, 
      finalActualCost,
      confirmedItemIds = []
    }: { 
      ticketId: string; 
      completionNotes: string; 
      actualHours: number; 
      finalActualCost: number; 
      confirmedItemIds?: string[];
    }) => {
      return await apiRequest("PUT", `/api/tickets/${ticketId}/finalize`, { 
        completionNotes, 
        actualHours, 
        finalActualCost,
        confirmedItemIds
      });
    },
    onMutate: async ({ ticketId }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/tickets"] });
      const previousTickets = queryClient.getQueryData(["/api/tickets"]);
      
      // Optimistically update to finalized status
      queryClient.setQueryData(["/api/tickets"], (old: any) => {
        if (!old) return old;
        return old.map((ticket: any) =>
          ticket.id === ticketId ? { ...ticket, status: 'finalized' } : ticket
        );
      });
      
      return { previousTickets };
    },
    onError: (err: any, variables, context) => {
      if (context?.previousTickets) {
        queryClient.setQueryData(["/api/tickets"], context.previousTickets);
      }
      toast({
        title: t("error", "Error"),
        description: err.message || t("finalization_failed", "Failed to finalize ticket"),
        variant: "destructive",
      });
    },
    onSuccess: () => {
      toast({
        title: t("success", "Success"),
        description: t("ticket_finalized", "Ticket finalized successfully"),
      });
      setShowCompletionDialog(false);
      setTicketToFinalize(null);
      setCompletionData({ completionNotes: '', actualHours: '', finalActualCost: '' });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tickets"] });
    },
  });

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
    onSuccess: (data, variables) => {
      // If returning to quality check, close the finalization dialog
      if (variables.status === 'quality_check') {
        setShowCompletionDialog(false);
        resetWizard();
        setCompletionData({ completionNotes: '', actualHours: '', finalActualCost: '' });
        toast({
          title: t("returned_to_quality_check", "Returned to Quality Check"),
          description: t("quality_check_message", "Ticket has been returned to Quality Check due to new defects found."),
          variant: "default",
        });
      } else {
        toast({
          title: t("success", "Success"),
          description: t("status_updated", "Ticket status updated successfully"),
          variant: "default",
        });
      }
    },
    onError: (err, variables, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousTickets) {
        queryClient.setQueryData(["/api/tickets"], context.previousTickets);
      }
      toast({
        title: t("error", "Error"),
        description: err.message || t("status_update_failed", "Failed to update ticket status"),
        variant: "destructive",
      });
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
        costEstimation: '',
        totalCost: '',
        costExplanation: '',
        selectedServices: [],
        // Service Checklist defaults
        selectedChecklists: [],
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
    onSuccess: async (newTicket: Ticket) => {
      // Allocate selected items to the ticket
      if (formData.selectedItems && formData.selectedItems.length > 0) {
        try {
          for (const item of formData.selectedItems) {
            await apiRequest("POST", `/api/tickets/${newTicket.id}/items`, {
              inventoryItemId: item.inventoryItemId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
            });
          }
          // Invalidate inventory queries to reflect stock changes
          queryClient.invalidateQueries({ queryKey: ['/api/inventory'] });
        } catch (error) {
          console.error('Failed to allocate items:', error);
          toast({
            title: t("warning", "Warning"),
            description: t("items_allocation_failed", "Ticket created but some items could not be allocated"),
            variant: "default",
          });
        }
      }
      
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

  const deleteTicketMutation = useMutation({
    mutationFn: async (ticketId: string) => {
      const response = await apiRequest("DELETE", `/api/tickets/${ticketId}`);
      return await response.json();
    },
    onSuccess: () => {
      // Refresh tickets query to update the list
      queryClient.invalidateQueries({ queryKey: ['/api/tickets'] });
      
      // Close both dialogs
      setShowDeleteConfirmation(false);
      setSelectedTicketSummary(null);
      
      // Show success toast
      toast({
        title: t("success", "Success"),
        description: t("ticket_deleted", "Ticket deleted successfully"),
      });
    },
    onError: (error) => {
      console.error('Failed to delete ticket:', error);
      toast({
        title: t("error", "Error"),
        description: t("ticket_deletion_failed", "Failed to delete ticket. Please try again."),
        variant: "destructive",
      });
    },
  });

  // Handle ticket deletion
  const handleDeleteTicket = () => {
    if (selectedTicketSummary) {
      deleteTicketMutation.mutate(selectedTicketSummary.id);
    }
  };

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
    
    // Filter archived tickets (finalized status)
    if (!filters.showArchived && ticket.status === 'finalized') {
      return false;
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
      showArchived: true, // Reset to show all tickets including finalized
    });
  };

  // Check if any filters are active
  const hasActiveFilters = filters.priority !== 'all' || filters.name || filters.cpf || filters.deviceType !== 'all' || filters.ticketId || !filters.showArchived;

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
        // Intercept finalization attempts to show completion dialog
        if (newStatus === 'finalized') {
          setTicketToFinalize(ticket);
          setCompletionData({
            completionNotes: '',
            actualHours: ticket.technicianEstimatedHours?.toString() || '',
            finalActualCost: '', // Will be auto-populated by useEffect once repair services are loaded
          });
          resetWizard(); // Reset wizard to step 1
          setShowCompletionDialog(true);
        } else {
          // For other status changes, proceed normally
          updateTicketStatus.mutate({ ticketId: draggedTicket, status: newStatus });
        }
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
        return 'bg-gradient-to-br from-gray-50 to-gray-100 border-gray-300 opacity-60';
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
        return 'text-gray-600';
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
        // Validate MM/DD or DD/MM format
        const birthdayParts = value.split('/');
        if (birthdayParts.length === 2) {
          const [first, second] = birthdayParts.map(p => parseInt(p));
          // Check if both parts are numbers and within valid ranges
          isValid = !isNaN(first) && !isNaN(second) && 
                   first >= 1 && first <= 31 && 
                   second >= 1 && second <= 12;
        }
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
    
    // Recalculate costs when cost estimation changes
    if (field === 'costEstimation') {
      // Normalize the currency input using money utilities
      const locale: Locale = currentLanguage.code === 'pt-BR' ? 'pt-BR' : 'en';
      const normalizedValue = fromCents(toCents(value, locale), locale);
      
      // Update the field with normalized value to ensure consistent formatting
      setFormData(prev => ({ ...prev, [field]: normalizedValue }));
      
      // Calculate immediately with the normalized value
      requestAnimationFrame(() => {
        calculateCosts(normalizedValue);
      });
      return; // Exit early to avoid duplicate field update
    }
  };

  // Handle service selection toggle
  const handleServiceToggle = (serviceId: string) => {
    setFormData(prev => {
      const currentServices = prev.selectedServices;
      const isSelected = currentServices.includes(serviceId);
      
      const newSelectedServices = isSelected
        ? currentServices.filter(id => id !== serviceId)
        : [...currentServices, serviceId];
      
      return {
        ...prev,
        selectedServices: newSelectedServices
      };
    });
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
        clientDeadline: formData.clientDeadline ? new Date(formData.clientDeadline) : null,
        technicianEstimatedHours: formData.technicianEstimatedHours ? parseInt(formData.technicianEstimatedHours) : null,
        selectedServices: formData.selectedServices || [],
        costEstimation: formData.costEstimation || null,
        totalCost: formData.totalCost || null,
        costExplanation: formData.costExplanation || null,
        // Service Checklist data
        warrantyType: 'standard' as const,
        serviceChecklist: {
          selectedChecklists: formData.selectedChecklists,
          additionalNotes: formData.additionalNotes
        },
        // Completion tracking fields (null for new tickets)
        completedAt: null,
        completedBy: null,
        finalActualCost: null,
        completionNotes: null,
        actualHours: null,
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
      // Service Checklist step - no additional processing needed for checklist selection
      // The selectedChecklists array already contains only the checked items
      
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
        costEstimation: '',
        totalCost: '',
        costExplanation: '',
        selectedServices: [],
        selectedItems: [],
        // Service Checklist defaults
        selectedChecklists: [],
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

  // Callback to add item to form data
  const handleAddItemToTicket = (item: { inventoryItemId: number; quantity: number; unitPrice: string }) => {
    setFormData(prev => ({
      ...prev,
      selectedItems: [
        ...prev.selectedItems,
        {
          inventoryItemId: String(item.inventoryItemId),
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        }
      ]
    }));
  };

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

                  {/* Selected Client Display - Aurora Design */}
                  {selectedClient && !showClientForm && (
                    <div className="bg-slate-700/40 border border-green-500/40 rounded-lg overflow-hidden shadow-lg">
                      {/* Aurora Gradient Header */}
                      <div className="bg-gradient-to-r from-green-900/60 via-green-700/60 to-cyan-800/60 px-5 py-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                              <CheckCircle className="w-6 h-6 text-green-400" />
                            </div>
                            <div>
                              <h4 className="font-bold text-white text-lg">
                                {t("selected_client", "Selected Client")}
                              </h4>
                              <p className="text-green-200 text-xs">{t("client_confirmed", "Client information confirmed")}</p>
                            </div>
                          </div>
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
                                  phone: selectedClient.phone || '',
                                  birthday: selectedClient.birthday || ''
                                });
                                setShowEditClientModal(true);
                              }}
                              className="bg-white/10 hover:bg-white/20 border-white/30 text-white"
                              data-testid="button-modify-client"
                            >
                              <Edit className="w-4 h-4 mr-1" />
                              {t("modify", "Modify")}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedClient(null)}
                              className="bg-white/10 hover:bg-white/20 border-white/30 text-white"
                              data-testid="button-change-client"
                            >
                              <Repeat className="w-4 h-4 mr-1" />
                              {t("change", "Change")}
                            </Button>
                          </div>
                        </div>
                      </div>
                      
                      {/* Client Details */}
                      <div className="p-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="bg-slate-800/50 p-3 rounded-lg border border-cyan-500/20">
                            <span className="text-xs font-medium text-cyan-400 uppercase tracking-wide">{t("name", "Name")}</span>
                            <p className="text-white font-semibold mt-1">
                              {selectedClient.firstName} {selectedClient.lastName}
                            </p>
                          </div>
                          
                          <div className="bg-slate-800/50 p-3 rounded-lg border border-cyan-500/20">
                            <span className="text-xs font-medium text-cyan-400 uppercase tracking-wide">{t("cpf", "CPF")}</span>
                            <p className="text-white font-semibold mt-1">
                              {selectedClient.cpf 
                                ? selectedClient.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")
                                : t("not_provided", "Not provided")
                              }
                            </p>
                          </div>
                          
                          <div className="bg-slate-800/50 p-3 rounded-lg border border-cyan-500/20">
                            <span className="text-xs font-medium text-cyan-400 uppercase tracking-wide">{t("email", "Email")}</span>
                            <p className="text-white font-semibold mt-1 break-all">
                              {selectedClient.email || t("not_provided", "Not provided")}
                            </p>
                          </div>
                          
                          <div className="bg-slate-800/50 p-3 rounded-lg border border-cyan-500/20">
                            <span className="text-xs font-medium text-cyan-400 uppercase tracking-wide">{t("phone", "Phone")}</span>
                            <p className="text-white font-semibold mt-1">
                              {selectedClient.phone 
                                ? (selectedClient.phone.includes('(') ? selectedClient.phone : formatBrazilianPhone(selectedClient.phone))
                                : t("not_provided", "Not provided")
                              }
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Client Ticket History - Show previous devices */}
                  {selectedClient && !showClientForm && isLoadingClientTickets && (
                    <div className="mt-4 border rounded-lg p-6 bg-blue-50 border-blue-200">
                      <div className="flex items-center justify-center gap-2 text-blue-600">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>{t("loading_device_history", "Loading device history...")}</span>
                      </div>
                    </div>
                  )}
                  
                  {selectedClient && !showClientForm && isClientTicketsError && (
                    <div className="mt-4 border rounded-lg p-6 bg-red-50 border-red-200">
                      <p className="text-sm text-red-600">
                        {t("error_loading_history", "Unable to load device history")}
                      </p>
                    </div>
                  )}
                  
                  {selectedClient && !showClientForm && !isLoadingClientTickets && !isClientTicketsError && clientTickets.length > 0 && (
                    <div className="mt-4 bg-slate-700/40 border border-blue-500/40 rounded-lg overflow-hidden shadow-lg">
                      {/* Aurora Gradient Header */}
                      <div className="bg-gradient-to-r from-blue-900/60 via-blue-700/60 to-cyan-800/60 px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                            <Clock className="w-6 h-6 text-blue-400" />
                          </div>
                          <div>
                            <h4 className="font-bold text-white text-lg">
                              {t("device_history", "Device History")} <span className="text-blue-200">({clientTickets.length} {clientTickets.length === 1 ? t("device", "device") : t("devices", "devices")})</span>
                            </h4>
                            <p className="text-blue-200 text-xs">
                              {t("select_previous_device", "Select a previously serviced device to auto-fill information")}
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      {/* Device Cards Grid */}
                      <div className="p-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {clientTickets.map((ticket) => (
                            <div
                              key={ticket.id}
                              className="bg-slate-800/60 border border-cyan-500/30 rounded-lg p-4 hover:border-cyan-400/60 hover:bg-slate-800/80 transition-all shadow-md hover:shadow-xl"
                              data-testid={`device-card-${ticket.id}`}
                            >
                              {/* Device Header */}
                              <div className="flex items-start gap-3 mb-3">
                                <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
                                  {ticket.deviceType === 'Phone' && <Smartphone className="w-5 h-5 text-cyan-400" />}
                                  {ticket.deviceType === 'Laptop' && <Laptop className="w-5 h-5 text-cyan-400" />}
                                  {ticket.deviceType === 'Desktop' && <Monitor className="w-5 h-5 text-cyan-400" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h5 className="font-bold text-white text-sm mb-1 truncate">
                                    {ticket.deviceType} - {ticket.deviceModel}
                                  </h5>
                                  <div className="space-y-1 text-xs text-gray-300">
                                    <div className="flex items-center gap-1">
                                      <span className="text-cyan-400">{t("color", "Color")}:</span> 
                                      <span className="font-medium">{ticket.deviceColor}</span>
                                    </div>
                                    {ticket.deviceMemory && (
                                      <div className="flex items-center gap-1">
                                        <span className="text-cyan-400">{t("memory", "Memory")}:</span>
                                        <span className="font-medium">{ticket.deviceMemory}</span>
                                      </div>
                                    )}
                                    {ticket.deviceStorageCapacity && (
                                      <div className="flex items-center gap-1">
                                        <span className="text-cyan-400">{t("storage", "Storage")}:</span>
                                        <span className="font-medium">{ticket.deviceStorageCapacity}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                              
                              {/* Service Indicators */}
                              <div className="flex flex-wrap gap-2 mb-3">
                                {ticket.selectedServices && Array.isArray(ticket.selectedServices) && ticket.selectedServices.length > 0 && (
                                  <div className="flex items-center gap-1 px-2 py-1 bg-green-500/20 border border-green-500/30 text-green-300 rounded-md text-xs font-medium">
                                    <Wrench className="w-3 h-3" />
                                    <span>{ticket.selectedServices.length} {t("services", "services")}</span>
                                  </div>
                                )}
                                
                                {ticket.serviceChecklist && typeof ticket.serviceChecklist === 'object' && Object.keys(ticket.serviceChecklist as Record<string, any>).length > 0 && (
                                  <div className="flex items-center gap-1 px-2 py-1 bg-orange-500/20 border border-orange-500/30 text-orange-300 rounded-md text-xs font-medium">
                                    <AlertCircle className="w-3 h-3" />
                                    <span>{Object.keys(ticket.serviceChecklist as Record<string, any>).length} {t("defects_found", "defects")}</span>
                                  </div>
                                )}
                                
                                {ticket.warrantyType && ticket.status === 'finalized' && (
                                  <div className="flex items-center gap-1 px-2 py-1 bg-blue-500/20 border border-blue-500/30 text-blue-300 rounded-md text-xs font-medium">
                                    <Shield className="w-3 h-3" />
                                    <span>{ticket.warrantyType === 'extended' ? t("extended_warranty", "Extended") : t("standard_warranty", "Standard")}</span>
                                  </div>
                                )}
                              </div>
                              
                              {/* Last Service Date and Warranty Expiration */}
                              <div className="space-y-2 mb-3 pb-3 border-b border-cyan-500/20">
                                <div className="flex items-center gap-2 text-xs text-gray-400">
                                  <Clock className="w-3 h-3" />
                                  <span className="font-medium">{t("last_service", "Last Service")}:</span>
                                  <span>{ticket.createdAt ? formatDate(ticket.createdAt) : t("not_available", "N/A")}</span>
                                </div>
                                
                                {/* Warranty Expiration Date */}
                                {ticket.warrantyType && ticket.status === 'finalized' && ticket.completedAt && (
                                  (() => {
                                    const completedDate = new Date(ticket.completedAt);
                                    const monthsToAdd = ticket.warrantyType === 'extended' ? 6 : 3;
                                    const expirationDate = new Date(completedDate);
                                    expirationDate.setMonth(expirationDate.getMonth() + monthsToAdd);
                                    const isExpired = new Date() > expirationDate;
                                    
                                    return (
                                      <div className="flex items-center gap-2 text-xs">
                                        <Shield className={`w-3 h-3 ${isExpired ? 'text-red-400' : 'text-blue-400'}`} />
                                        <span className={`font-medium ${isExpired ? 'text-red-400' : 'text-gray-400'}`}>
                                          {t("warranty_expires", "Warranty Expires")}:
                                        </span>
                                        <span className={isExpired ? 'text-red-400 font-semibold' : 'text-gray-400'}>
                                          {formatDate(expirationDate)}
                                        </span>
                                        {isExpired && (
                                          <Badge variant="destructive" className="text-xs py-0 px-2 bg-red-500/20 text-red-400 border-red-500/30">
                                            {t("expired", "Expired")}
                                          </Badge>
                                        )}
                                      </div>
                                    );
                                  })()
                                )}
                              </div>
                              
                              {/* Use Device Button */}
                              <Button
                                size="sm"
                                className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold shadow-md"
                                onClick={() => {
                                  setFormData(prev => ({
                                    ...prev,
                                    deviceType: ticket.deviceType || '',
                                    deviceBrand: ticket.deviceBrand || '',
                                    deviceModel: ticket.deviceModel || '',
                                    deviceColor: ticket.deviceColor || '',
                                    deviceMemory: ticket.deviceMemory || '',
                                    deviceStorageCapacity: ticket.deviceStorageCapacity || '',
                                    selectedServices: [],
                                    technicianEstimatedHours: '',
                                    costEstimation: '',
                                    totalCost: '',
                                  }));
                                  setCurrentStep(1);
                                  toast({
                                    title: t("device_selected", "Device Selected"),
                                    description: t("device_info_filled", "Device information has been auto-filled"),
                                  });
                                }}
                                data-testid={`button-use-device-${ticket.id}`}
                              >
                                <CheckCircle className="w-4 h-4 mr-2" />
                                {t("use_this_device", "Use This Device")}
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Add New Client Form */}
                  {showClientForm && (
                    <div className="space-y-6">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-lg font-semibold text-cyan-400">{t("client_form", "Client Registration Form")}</h4>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowClientForm(false)}
                          className="hover:bg-slate-700/50"
                          data-testid="button-cancel-add-client"
                        >
                          <X className="w-4 h-4 mr-1" />
                          {t("cancel", "Cancel")}
                        </Button>
                      </div>
                      
                      {/* Personal Information Section */}
                      <div className="bg-slate-700/30 border border-cyan-500/20 rounded-lg p-5">
                        <div className="flex items-center gap-2 mb-4">
                          <User className="w-4 h-4 text-cyan-400" />
                          <h5 className="text-sm font-semibold text-cyan-300 uppercase tracking-wide">{t("personal_information", "Personal Information")}</h5>
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

                    {/* Birthday */}
                    <FormFieldWithTooltip
                      label={t("birthday", "Birthday")}
                      tooltip={t("birthday_tooltip", currentLanguage.code === 'pt-BR' 
                        ? "Digite o aniversário do cliente (apenas mês e dia). Isso ajuda com felicitações de aniversário e ofertas especiais. Formato: DD/MM" 
                        : "Enter the client's birthday (month and day only). This helps with birthday greetings and special offers. Format: MM/DD")}
                      hasError={!!formErrors.birthday}
                      isValid={fieldValidation.birthday?.isValid && formData.birthday.length > 0}
                    >
                      <Input
                        id="birthday"
                        value={formData.birthday}
                        onChange={(e) => handleInputChange('birthday', e.target.value)}
                        className={formErrors.birthday ? 'border-red-500' : ''}
                        placeholder={t("birthday_placeholder", currentLanguage.code === 'pt-BR' ? 'DD/MM' : 'MM/DD')}
                        maxLength={5}
                        data-testid="input-birthday"
                      />
                    </FormFieldWithTooltip>
                  </div>
                  </div>
                      
                      {/* Contact Information Section */}
                      <div className="bg-slate-700/30 border border-cyan-500/20 rounded-lg p-5">
                        <div className="flex items-center gap-2 mb-4">
                          <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                          <h5 className="text-sm font-semibold text-cyan-300 uppercase tracking-wide">{t("contact_information", "Contact Information")}</h5>
                        </div>
                        <div className="text-xs text-cyan-200/60 mb-4 flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                          {t("privacy_note", "Your information is stored securely and used only for repair services")}
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
                  </div>
                      
                      {/* Address Information Section */}
                      <div className="bg-slate-700/30 border border-cyan-500/20 rounded-lg p-5">
                        <div className="flex items-center gap-2 mb-4">
                          <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          <h5 className="text-sm font-semibold text-cyan-300 uppercase tracking-wide">{t("address_information", "Address Information")}</h5>
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
                        // Reset dependent fields only when device type actually changes
                        setFormData(prev => {
                          if (prev.deviceType === value) {
                            return prev;
                          }
                          return {
                            ...prev,
                            deviceType: value,
                            deviceBrand: '',
                            deviceModel: '',
                            deviceColor: '',
                            deviceMemory: '',
                            deviceStorageCapacity: ''
                          };
                        });
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
                        {t("services_timeline_subtitle", "Set service expectations and timeline details")}
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
                                ? format(new Date(formData.clientDeadline), "PPP", { locale: currentLanguage.code === 'pt-BR' ? ptBR : undefined })
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
                              locale={currentLanguage.code === 'pt-BR' ? ptBR as any : undefined}
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

                    {/* Technician Estimated Time - Calculated from Selected Services */}
                    <FormFieldWithTooltip
                      label={t("technician_estimated_time", "Estimated Time to Complete")}
                      tooltip={t("technician_estimated_time_tooltip", "Total estimated time calculated from selected repair services. Select services below to see the combined time estimate.")}
                    >
                      <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-md border">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <span className="text-base font-medium text-foreground" data-testid="text-estimated-time">
                          {(() => {
                            if (formData.selectedServices.length === 0) {
                              return t("no_services_selected", "Select services to see estimate");
                            }
                            
                            const timeEstimate = getFormattedEstimatedTime();
                            if (!timeEstimate) {
                              return t("calculating", "Calculating...");
                            }
                            
                            const { hours, minutes } = timeEstimate;
                            if (hours === 0) {
                              return `${minutes}${t("minutes_short", "min")}`;
                            } else if (minutes === 0) {
                              return `${hours}${t("hours_short", "h")}`;
                            } else {
                              return `${hours}${t("hours_short", "h")} ${minutes}${t("minutes_short", "min")}`;
                            }
                          })()}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {formData.selectedServices.length > 0 
                          ? t("calculated_from_services", `Calculated from ${formData.selectedServices.length} selected service(s)`)
                          : t("select_services_note", "Select repair services below to calculate estimated time")
                        }
                      </div>
                    </FormFieldWithTooltip>
                  </div>

                  {/* Queue Information */}
                  {formData.deviceType && (
                    <div className="bg-slate-800/50 rounded-lg border border-[#00FFFF]/20 overflow-hidden">
                      <div className="bg-gradient-to-r from-[#0A192F] to-[#00FFFF] px-4 py-3">
                        <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                          <Users className="w-4 h-4" />
                          {t("queue_information", "Service Queue Information")}
                        </h4>
                        <p className="text-cyan-100 text-xs mt-1">
                          {t("queue_subtitle", "See how many devices are ahead of yours")}
                        </p>
                      </div>
                      <div className="p-4">
                        {(() => {
                          const queueInfo = getQueueInformation();
                          
                          return (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {/* Devices in Queue */}
                              <div className="bg-gradient-to-r from-[#00FFFF]/5 to-[#0A192F]/20 rounded-md border border-[#00FFFF]/20 p-3 text-center">
                                <div className="flex items-center justify-center gap-3 mb-2">
                                  <span className="text-2xl font-bold text-[#00FFFF]" data-testid="queue-device-count">
                                    {queueInfo.count}
                                  </span>
                                  <div className="text-left flex-1 min-w-0">
                                    <div className="text-xs text-muted-foreground whitespace-nowrap overflow-hidden text-ellipsis">
                                      {formData.deviceType} {queueInfo.count === 1 ? t("device_ahead", "device ahead") : t("devices_ahead", "devices ahead")}
                                    </div>
                                  </div>
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {queueInfo.count === 0 
                                    ? t("no_devices_ahead", "No devices ahead of yours")
                                    : `${queueInfo.count} ${formData.deviceType} ${queueInfo.count === 1 ? t("device_currently", "device currently") : t("devices_currently", "devices currently")} ${t("being_serviced", "being serviced")}`
                                  }
                                </div>
                              </div>

                              {/* Estimated Wait Time */}
                              <div className="bg-gradient-to-r from-emerald-500/5 to-[#0A192F]/20 rounded-md border border-emerald-500/20 p-3 text-center">
                                <div className="flex items-center justify-center gap-2 mb-2">
                                  <Clock className="w-5 h-5 text-emerald-400" />
                                  <div className="text-left">
                                    <div className="text-sm font-semibold text-emerald-400" data-testid="queue-wait-time">
                                      {queueInfo.count === 0 ? t("immediate_start", "Can start now") : queueInfo.formattedTime}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      {t("estimated_queue_time", "Estimated queue time")}
                                    </div>
                                  </div>
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {queueInfo.count === 0 
                                    ? t("technician_available", "Technician can start on your device immediately")
                                    : t("wait_time_estimate", "Based on estimated completion times of devices ahead")
                                  }
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  )}

                  {/* Repair Services Selection */}
                  <div className="mt-8">
                    <RepairServiceCards
                      deviceType={formData.deviceType}
                      selectedServices={formData.selectedServices}
                      onServiceToggle={handleServiceToggle}
                      warrantyCoverage={checkWarrantyCoverage}
                      currentDefects={formData.selectedChecklists}
                    />
                  </div>

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
                    {/* Selected Services Cost List */}
                    {formData.selectedServices.length > 0 && (
                      <FormFieldWithTooltip
                        label={t("selected_services_cost", "Selected Services")}
                        tooltip={t("selected_services_cost_tooltip", "Cost breakdown of selected repair services.")}
                      >
                        <div className="space-y-2 p-3 bg-muted/30 rounded-md border">
                          {formData.selectedServices.map(serviceId => {
                            const service = repairServices.find(s => s.id === serviceId);
                            if (!service) return null;
                            
                            // Check if this service is warranty-covered
                            const isWarrantyCovered = (() => {
                              if (!checkWarrantyCoverage || !formData.selectedChecklists || formData.selectedChecklists.length === 0) return false;
                              
                              return formData.selectedChecklists.some(defectId => {
                                const coverageKey = `${defectId}:${serviceId}`;
                                return checkWarrantyCoverage.has(coverageKey);
                              });
                            })();
                            
                            const formatCurrency = (amount: string) => {
                              const locale: Locale = currentLanguage.code === 'pt-BR' ? 'pt-BR' : 'en';
                              const cents = toCents(amount, locale);
                              return formatCurrencyFromUtility(cents, locale);
                            };
                            
                            return (
                              <div key={serviceId} className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-2">
                                  <span className="text-foreground">{service.name}</span>
                                  {isWarrantyCovered && (
                                    <div className="flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">
                                      <Shield className="w-3 h-3" />
                                      <span>{t("warranty", "Warranty")}</span>
                                    </div>
                                  )}
                                </div>
                                <span className={`font-medium ${isWarrantyCovered ? 'text-green-600 line-through' : 'text-primary'}`} data-testid={`service-cost-${serviceId}`}>
                                  {isWarrantyCovered ? formatCurrency('0') : formatCurrency(service.estimatedLaborCost)}
                                </span>
                              </div>
                            );
                          })}
                          <div className="border-t border-muted pt-2 mt-2">
                            <div className="flex items-center justify-between text-sm font-medium">
                              <span className="text-foreground">{t("services_subtotal", "Services Subtotal")}</span>
                              <span className="text-primary" data-testid="services-subtotal">
                                {(() => {
                                  const locale: Locale = currentLanguage.code === 'pt-BR' ? 'pt-BR' : 'en';
                                  const serviceCostsCents = formData.selectedServices.map(serviceId => {
                                    const service = repairServices.find(s => s.id === serviceId);
                                    if (!service) return 0;
                                    
                                    // Check if this service is warranty-covered
                                    const isWarrantyCovered = (() => {
                                      if (!checkWarrantyCoverage || !formData.selectedChecklists || formData.selectedChecklists.length === 0) return false;
                                      
                                      return formData.selectedChecklists.some(defectId => {
                                        const coverageKey = `${defectId}:${serviceId}`;
                                        return checkWarrantyCoverage.has(coverageKey);
                                      });
                                    })();
                                    
                                    // Return 0 cost for warranty-covered services
                                    return isWarrantyCovered ? 0 : toCents(service.estimatedLaborCost, locale);
                                  });
                                  const totalServicesCents = addCents(...serviceCostsCents);
                                  return formatCurrencyFromUtility(totalServicesCents, locale);
                                })()}
                              </span>
                            </div>
                          </div>
                        </div>
                      </FormFieldWithTooltip>
                    )}

                    {/* Service Items Section */}
                    <FormFieldWithTooltip
                      label={t("service_items", "Service Items")}
                      tooltip={t("service_items_tooltip", "Parts and materials from inventory used for this repair")}
                    >
                      <div className="space-y-3">
                        {/* Selected Items List */}
                        {formData.selectedItems.length > 0 && (
                          <div className="space-y-2 p-3 bg-muted/30 rounded-md border">
                            {formData.selectedItems.map((item, index) => {
                              const inventoryItem = availableItems.find((inv: any) => inv.id === item.inventoryItemId);
                              const totalPrice = (parseFloat(item.unitPrice) * item.quantity).toFixed(2);
                              
                              return (
                                <div key={index} className="flex items-center justify-between text-sm">
                                  <div className="flex items-center gap-2">
                                    <span className="text-foreground">{inventoryItem?.name || 'Unknown Item'}</span>
                                    <span className="text-muted-foreground">× {item.quantity}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-primary" data-testid={`item-cost-${index}`}>
                                      {currentLanguage.code === 'pt-BR' ? 'R$' : '$'} {totalPrice}
                                    </span>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        setFormData(prev => ({
                                          ...prev,
                                          selectedItems: prev.selectedItems.filter((_, i) => i !== index)
                                        }));
                                      }}
                                      data-testid={`button-remove-item-${index}`}
                                      className="h-6 w-6 p-0"
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              );
                            })}
                            <div className="border-t border-muted pt-2 mt-2">
                              <div className="flex items-center justify-between text-sm font-medium">
                                <span className="text-foreground">{t("items_subtotal", "Items Subtotal")}</span>
                                <span className="text-primary" data-testid="items-subtotal">
                                  {currentLanguage.code === 'pt-BR' ? 'R$' : '$'} {formData.selectedItems.reduce((sum, item) => 
                                    sum + (parseFloat(item.unitPrice) * item.quantity), 0
                                  ).toFixed(2)}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                        
                        {/* Add Item Button */}
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setShowItemSelectionDialog(true)}
                          data-testid="button-add-service-item"
                          className="w-full"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          {t("add_service_item", "Add Service Item")}
                        </Button>
                      </div>
                    </FormFieldWithTooltip>

                    <FormFieldWithTooltip
                      label={t("extra_costs", "Extra Costs")}
                      tooltip={t("extra_costs_tooltip", "Additional costs not included in services (parts, materials, etc.)")}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">
                          {currentLanguage.code === 'pt-BR' ? 'R$' : '$'}
                        </span>
                        <Input
                          type="text"
                          id="costEstimation"
                          value={formData.costEstimation}
                          onChange={(e) => {
                            // Allow only numbers, dots, and commas - store raw input
                            const value = e.target.value.replace(/[^0-9.,]/g, '');
                            setFormData(prev => ({ ...prev, costEstimation: value }));
                          }}
                          placeholder={currentLanguage.code === 'pt-BR' ? '50,00' : '50.00'}
                          data-testid="input-extra-costs"
                          className="flex-1"
                        />
                      </div>
                    </FormFieldWithTooltip>

                    {/* Total Cost */}
                    <FormFieldWithTooltip
                      label={t("total_cost", "Total Cost")}
                      tooltip={t("total_cost_tooltip", "Total cost including selected services and extra costs.")}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">
                          {currentLanguage.code === 'pt-BR' ? 'R$' : '$'}
                        </span>
                        <div className="flex-1 p-3 bg-primary/10 rounded-md border border-primary/30">
                          <span className="text-lg font-bold text-primary" data-testid="text-total-cost">
                            {(() => {
                              const locale: Locale = currentLanguage.code === 'pt-BR' ? 'pt-BR' : 'en';
                              // Calculate total from selected services using cents, excluding warranty-covered services
                              const serviceCostsCents = formData.selectedServices.map(serviceId => {
                                const service = repairServices.find(s => s.id === serviceId);
                                if (!service) return 0;
                                
                                // Check if this service is warranty-covered
                                const isWarrantyCovered = (() => {
                                  if (!checkWarrantyCoverage || !formData.selectedChecklists || formData.selectedChecklists.length === 0) return false;
                                  
                                  return formData.selectedChecklists.some(defectId => {
                                    const coverageKey = `${defectId}:${serviceId}`;
                                    return checkWarrantyCoverage.has(coverageKey);
                                  });
                                })();
                                
                                // Return 0 cost for warranty-covered services
                                return isWarrantyCovered ? 0 : toCents(service.estimatedLaborCost, locale);
                              });
                              const totalServicesCents = addCents(...serviceCostsCents);
                              
                              // Add service items costs
                              const itemsCostsCents = formData.selectedItems.map(item => {
                                const totalPrice = parseFloat(item.unitPrice) * item.quantity;
                                return toCents(totalPrice.toFixed(2), locale);
                              });
                              const totalItemsCents = itemsCostsCents.length > 0 ? addCents(...itemsCostsCents) : 0;
                              
                              // Add extra costs
                              const extraCostsCents = toCents(formData.costEstimation || '0', locale);
                              const grandTotalCents = addCents(totalServicesCents, totalItemsCents, extraCostsCents);
                              
                              return fromCents(grandTotalCents, locale);
                            })()}
                          </span>
                        </div>
                      </div>
                    </FormFieldWithTooltip>

                    {/* Extra Cost Info */}
                    <FormFieldWithTooltip
                      label={t("extra_cost_info", "Extra Cost Info")}
                      tooltip={t("extra_cost_info_tooltip", "Explain any extra costs beyond the selected services (parts, materials, special fees, etc.)")}
                    >
                      <Textarea
                        id="costExplanation"
                        value={formData.costExplanation}
                        onChange={(e) => handleInputChange('costExplanation', e.target.value)}
                        placeholder={t("extra_cost_info_placeholder", "Example: Screen part ($50) + protective film ($15) + rush fee ($20) = $85 extra costs")}
                        rows={4}
                        data-testid="textarea-extra-cost-info"
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
                        {t("checklist_description_new", "Select applicable checklists from Configurations to document service requirements.")}
                      </p>
                    </div>
                    
                    <div className="p-6 space-y-6">
                      {isLoadingChecklists ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {[...Array(6)].map((_, i) => (
                            <div key={i} className="flex items-start space-x-3 p-4 rounded-lg border border-slate-600/50 bg-gradient-to-br from-slate-700/40 via-slate-700/40 to-slate-600/40">
                              <Skeleton className="h-4 w-4 mt-0.5" />
                              <div className="flex-1 space-y-2">
                                <Skeleton className="h-4 w-3/4" />
                                <Skeleton className="h-3 w-1/2" />
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : activeChecklists && activeChecklists.length > 0 ? (
                        <div className="space-y-6">
                          {/* Aurora Checklists Grid - Responsive 1-3 columns */}
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {activeChecklists.map((checklist: any) => (
                              <div
                                key={checklist.id}
                                className="flex items-start space-x-3 p-4 rounded-lg border border-slate-600/50 bg-gradient-to-br from-slate-700/40 via-slate-700/40 to-slate-600/40 hover:bg-gradient-to-br hover:from-cyan-900/20 hover:via-slate-700/40 hover:to-slate-600/40 hover:border-cyan-500/50 transition-all duration-200"
                              >
                                <Checkbox
                                  id={`checklist-${checklist.id}`}
                                  checked={formData.selectedChecklists.includes(checklist.id)}
                                  onCheckedChange={(checked: boolean) => {
                                    setFormData(prev => ({
                                      ...prev,
                                      selectedChecklists: checked
                                        ? [...prev.selectedChecklists, checklist.id]
                                        : prev.selectedChecklists.filter(id => id !== checklist.id)
                                    }));
                                  }}
                                  data-testid={`checkbox-checklist-${checklist.id}`}
                                />
                                <Label 
                                  htmlFor={`checklist-${checklist.id}`} 
                                  className="flex-1 cursor-pointer leading-relaxed"
                                >
                                  <div className="font-medium text-sm text-white">
                                    {checklist.name}
                                  </div>
                                  <div className="text-xs text-cyan-200/80 mt-1">
                                    {t("device_type", "Device Type")}: {checklist.deviceType}
                                  </div>
                                </Label>
                              </div>
                            ))}
                          </div>

                          {/* Selection Summary */}
                          {formData.selectedChecklists.length > 0 && (
                            <div className="bg-[#00FFFF]/10 border border-[#00FFFF]/20 rounded-lg p-4">
                              <div className="flex items-center gap-2 text-[#00FFFF] text-sm font-medium">
                                <Check className="w-4 h-4" />
                                {formData.selectedChecklists.length} {t("checklists_selected", "checklist(s) selected")}
                              </div>
                            </div>
                          )}

                          {/* Additional Notes */}
                          <FormFieldWithTooltip
                            label={t("additional_notes", "Additional Notes")}
                            tooltip={t("additional_notes_tooltip", "Any additional observations about the device condition or specific service requirements.")}
                          >
                            <Textarea
                              id="additionalNotes"
                              value={formData.additionalNotes}
                              onChange={(e) => handleInputChange('additionalNotes', e.target.value)}
                              placeholder={t("additional_notes_placeholder", "Example: Device requires special handling due to water damage, client requested priority processing...")}
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
                            <h3 className="text-lg font-semibold">{t("no_checklists_available", "No Checklists Available")}</h3>
                            <p>{t("no_checklists_message", "No active checklists found for this device type. Please configure checklists in the Configurations page.")}</p>
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
                  {/* Aurora Card Layout - Main Container */}
                  <div className="bg-slate-800/70 rounded-xl shadow-lg border border-[#00FFFF]/20 overflow-hidden">
                    {/* Aurora Gradient Header */}
                    <div className="bg-gradient-to-r from-[#0A192F] to-[#00FFFF] px-6 py-4">
                      <h3 className="text-xl font-bold text-white flex items-center gap-3">
                        <Check className="w-5 h-5" />
                        {t("client_authorization", "Client Authorization")}
                      </h3>
                      <p className="text-cyan-100 text-sm mt-1">
                        {t("authorization_subtitle", "Final review and approval of all service details")}
                      </p>
                    </div>
                    
                    <div className="p-6 space-y-4">
                      {/* Aurora Card - Client & Device Information */}
                      <div className="bg-slate-800/50 rounded-lg border border-[#00FFFF]/20 overflow-hidden">
                        <div className="bg-gradient-to-r from-[#0A192F] to-[#00FFFF] px-4 py-3">
                          <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                            <User className="w-4 h-4" />
                            {t("client_device_info", "Client & Device Information")}
                          </h4>
                        </div>
                        <div className="p-4">
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Client Information Section */}
                            <div className="space-y-3">
                              <div className="flex items-center gap-2 mb-3">
                                <User className="w-3 h-3 text-cyan-400" />
                                <span className="text-xs font-medium text-cyan-400 uppercase tracking-wide">{t("client_information", "Client Information")}</span>
                              </div>
                              <div className="grid grid-cols-1 gap-3">
                                <div className="space-y-1">
                                  <span className="text-xs text-muted-foreground">{t("full_name", "Full Name")}</span>
                                  <p className="text-sm font-medium text-white">
                                    {selectedClient 
                                      ? `${selectedClient.firstName} ${selectedClient.lastName}`
                                      : formData.firstName && formData.lastName 
                                        ? `${formData.firstName} ${formData.lastName}`
                                        : t("not_available", "N/A")
                                    }
                                  </p>
                                </div>
                                <div className="space-y-1">
                                  <span className="text-xs text-muted-foreground">{t("cpf", "CPF")}</span>
                                  <p className="text-sm font-medium text-white">
                                    {selectedClient?.cpf || displayCPF || formData.cpf || t("not_available", "N/A")}
                                  </p>
                                </div>
                                <div className="space-y-1">
                                  <span className="text-xs text-muted-foreground">{t("email", "Email")}</span>
                                  <p className="text-sm font-medium text-white">
                                    {selectedClient?.email || formData.email || t("not_available", "N/A")}
                                  </p>
                                </div>
                                <div className="space-y-1">
                                  <span className="text-xs text-muted-foreground">{t("phone", "Phone")}</span>
                                  <p className="text-sm font-medium text-white">
                                    {selectedClient?.phone || formData.phone || t("not_available", "N/A")}
                                  </p>
                                </div>
                              </div>
                            </div>

                            {/* Device Information Section */}
                            <div className="space-y-3">
                              <div className="flex items-center gap-2 mb-3">
                                <Smartphone className="w-3 h-3 text-cyan-400" />
                                <span className="text-xs font-medium text-cyan-400 uppercase tracking-wide">{t("device_information", "Device Information")}</span>
                              </div>
                              <div className="grid grid-cols-1 gap-3">
                                <div className="space-y-1">
                                  <span className="text-xs text-muted-foreground">{t("device_type", "Device Type")}</span>
                                  <p className="text-sm font-medium text-white">{formData.deviceType || t("not_available", "N/A")}</p>
                                </div>
                                <div className="space-y-1">
                                  <span className="text-xs text-muted-foreground">{t("brand_model", "Brand & Model")}</span>
                                  <p className="text-sm font-medium text-white">
                                    {formData.deviceBrand && formData.deviceModel 
                                      ? `${formData.deviceBrand} ${formData.deviceModel}` 
                                      : t("not_available", "N/A")
                                    }
                                  </p>
                                </div>
                                <div className="space-y-1">
                                  <span className="text-xs text-muted-foreground">{t("color", "Color")}</span>
                                  <p className="text-sm font-medium text-white">{formData.deviceColor || t("not_available", "N/A")}</p>
                                </div>
                                <div className="space-y-1">
                                  <span className="text-xs text-muted-foreground">{t("memory_storage", "Memory & Storage")}</span>
                                  <p className="text-sm font-medium text-white">
                                    {(() => {
                                      const parts = [];
                                      if (formData.deviceMemory) parts.push(`${formData.deviceMemory} RAM`);
                                      if (formData.deviceStorageCapacity) parts.push(`${formData.deviceStorageCapacity} Storage`);
                                      return parts.length > 0 ? parts.join(', ') : t("not_available", "N/A");
                                    })()}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Aurora Card - Defects Summary */}
                      {(() => {
                        // Extract selected defects from issue responses
                        const selectedDefectsResponse = formData.issueResponses?.find(
                          response => response.questionId === 'selected_defects'
                        );
                        
                        let selectedDefects: string[] = [];
                        if (selectedDefectsResponse) {
                          try {
                            // Parse the defects array from stored data
                            const defectsData = selectedDefectsResponse.answer;
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
                          <div className="bg-slate-800/50 rounded-lg border border-[#00FFFF]/20 overflow-hidden">
                            <div className="bg-gradient-to-r from-[#0A192F] to-[#00FFFF] px-4 py-3">
                              <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4" />
                                {t("identified_defects", "Identified Defects")}
                                <Badge variant="secondary" className="ml-2 bg-red-500/20 text-red-300 border-red-500/30">
                                  {selectedDefects.length} {t("defects_selected", "selected")}
                                </Badge>
                              </h4>
                            </div>
                            <div className="p-4">
                              <p className="text-sm text-muted-foreground mb-3">
                                {t("defects_found_during_assessment", "Defects found during device assessment")}
                              </p>
                              
                              {/* Defects List */}
                              <DefectsList 
                                selectedDefects={selectedDefects} 
                                deviceType={formData.deviceType} 
                              />
                            </div>
                          </div>
                        );
                      })()}

                      {/* Aurora Card - Services & Timeline */}
                      <div className="bg-slate-800/50 rounded-lg border border-[#00FFFF]/20 overflow-hidden">
                        <div className="bg-gradient-to-r from-[#0A192F] to-[#00FFFF] px-4 py-3">
                          <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            {t("services_timeline", "Services & Timeline")}
                          </h4>
                        </div>
                        <div className="p-4 space-y-4">
                          {/* Timeline Overview */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="bg-gradient-to-r from-[#00FFFF]/5 to-[#0A192F]/20 rounded-md border border-[#00FFFF]/20 p-3 text-center">
                              <span className="text-xs text-muted-foreground block">{t("client_deadline", "Client Deadline")}</span>
                              <p className="text-sm font-medium text-[#00FFFF] mt-1">
                                {formData.clientDeadline 
                                  ? formatDate(formData.clientDeadline)
                                  : t("not_set", "Not set")
                                }
                              </p>
                            </div>
                            <div className="bg-gradient-to-r from-[#00FFFF]/5 to-[#0A192F]/20 rounded-md border border-[#00FFFF]/20 p-3 text-center">
                              <span className="text-xs text-muted-foreground block">{t("estimated_time", "Estimated Time")}</span>
                              <p className="text-sm font-medium text-white mt-1">
                                {(() => {
                                  const totalMinutes = formData.selectedServices.reduce((total, serviceId) => {
                                    const service = repairServices.find(s => s.id === serviceId);
                                    return service ? total + (service.estimatedCompletionTimeHours * 60) + service.estimatedCompletionTimeMinutes : total;
                                  }, 0);
                                  
                                  if (totalMinutes === 0) return t("not_available", "N/A");
                                  
                                  const hours = Math.floor(totalMinutes / 60);
                                  const minutes = totalMinutes % 60;
                                  
                                  if (hours === 0) return `${minutes}${t("minutes_short", "min")}`;
                                  if (minutes === 0) return `${hours}${t("hours_short", "h")}`;
                                  return `${hours}${t("hours_short", "h")} ${minutes}${t("minutes_short", "min")}`;
                                })()}
                              </p>
                            </div>
                            <div className="bg-gradient-to-r from-[#00FFFF]/5 to-[#0A192F]/20 rounded-md border border-[#00FFFF]/20 p-3 text-center">
                              <span className="text-xs text-muted-foreground block">{t("deadline_status", "Status")}</span>
                              <p className="text-sm font-medium mt-1">
                                {(() => {
                                  if (!formData.clientDeadline) return <span className="text-yellow-400">{t("no_deadline", "No deadline")}</span>;
                                  
                                  const deadline = new Date(formData.clientDeadline);
                                  const now = new Date();
                                  const timeDiff = deadline.getTime() - now.getTime();
                                  const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
                                  
                                  if (daysDiff < 0) return <span className="text-red-400">{t("overdue", "Overdue")}</span>;
                                  if (daysDiff <= 2) return <span className="text-yellow-400">{t("urgent", "Urgent")}</span>;
                                  return <span className="text-green-400">{t("on_time", "On time")}</span>;
                                })()}
                              </p>
                            </div>
                          </div>

                        </div>
                      </div>

                      {/* Aurora Card - Service Items */}
                      {formData.selectedItems && formData.selectedItems.length > 0 && (
                        <div className="bg-slate-800/50 rounded-lg border border-[#00FFFF]/20 overflow-hidden">
                          <div className="bg-gradient-to-r from-[#0A192F] to-[#00FFFF] px-4 py-3">
                            <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                              <Package className="w-4 h-4" />
                              {t("service_items", "Service Items")}
                              <Badge variant="secondary" className="ml-2 bg-cyan-500/20 text-cyan-300 border-cyan-500/30">
                                {formData.selectedItems.length}
                              </Badge>
                            </h4>
                          </div>
                          <div className="p-4">
                            <p className="text-sm text-muted-foreground mb-3">
                              {t("parts_materials_ticket", "Parts and materials to be used in this repair")}
                            </p>
                            <div className="space-y-2">
                              {formData.selectedItems.map((item, index) => {
                                const locale: Locale = currentLanguage.code === 'pt-BR' ? 'pt-BR' : 'en';
                                const unitPriceCents = toCents(item.unitPrice || '0', locale);
                                const itemTotalCents = unitPriceCents * item.quantity;
                                const inventoryItem = availableItems.find((inv: any) => inv.id === item.inventoryItemId);
                                const itemName = inventoryItem?.name ?? t("unnamed_item", "Unnamed Item");
                                return (
                                  <div
                                    key={index}
                                    className="flex items-center justify-between p-3 rounded-lg border border-slate-600/50 bg-gradient-to-br from-slate-700/40 via-slate-700/40 to-slate-600/40"
                                  >
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2">
                                        <Package className="w-4 h-4 text-cyan-400" />
                                        <span className="text-sm font-medium text-white">
                                          {itemName}
                                        </span>
                                      </div>
                                      <div className="text-xs text-cyan-200/80 mt-1">
                                        {t("quantity", "Quantity")}: {item.quantity} × {formatCurrencyFromUtility(unitPriceCents, locale)}
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <div className="text-sm font-bold text-cyan-400">
                                        {formatCurrencyFromUtility(itemTotalCents, locale)}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                            {/* Service Items Subtotal */}
                            <div className="mt-4 pt-3 border-t border-slate-600/50">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-muted-foreground">{t("items_subtotal", "Items Subtotal")}</span>
                                <span className="text-lg font-bold text-cyan-400">
                                  {(() => {
                                    const locale: Locale = currentLanguage.code === 'pt-BR' ? 'pt-BR' : 'en';
                                    const itemsCostsCents = formData.selectedItems.map(item => {
                                      const unitPriceCents = toCents(item.unitPrice || '0', locale);
                                      return unitPriceCents * item.quantity;
                                    });
                                    const totalItemsCents = itemsCostsCents.length > 0 ? addCents(...itemsCostsCents) : 0;
                                    return formatCurrencyFromUtility(totalItemsCents, locale);
                                  })()}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Aurora Card - Cost Summary */}
                      <div className="bg-slate-800/50 rounded-lg border border-[#00FFFF]/20 overflow-hidden">
                        <div className="bg-gradient-to-r from-[#0A192F] to-[#00FFFF] px-4 py-3">
                          <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                            <DollarSign className="w-4 h-4" />
                            {t("cost_summary", "Cost Summary")}
                          </h4>
                        </div>
                        <div className="p-4">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="bg-gradient-to-r from-[#00FFFF]/5 to-[#0A192F]/20 rounded-md border border-[#00FFFF]/20 p-3 text-center">
                              <span className="text-xs text-muted-foreground block">{t("services_cost", "Services Cost")}</span>
                              <p className="text-lg font-bold text-[#00FFFF] mt-1">
                                {(() => {
                                  const locale: Locale = currentLanguage.code === 'pt-BR' ? 'pt-BR' : 'en';
                                  const serviceCostsCents = formData.selectedServices.map(serviceId => {
                                    const service = repairServices.find(s => s.id === serviceId);
                                    return service ? toCents(service.estimatedLaborCost, locale) : 0;
                                  });
                                  const totalServicesCents = addCents(...serviceCostsCents);
                                  return formatCurrencyFromUtility(totalServicesCents, locale);
                                })()}
                              </p>
                            </div>
                            <div className="bg-gradient-to-r from-[#00FFFF]/5 to-[#0A192F]/20 rounded-md border border-[#00FFFF]/20 p-3 text-center">
                              <span className="text-xs text-muted-foreground block">{t("extra_costs", "Extra Costs")}</span>
                              <p className="text-lg font-bold text-white mt-1">
                                {(() => {
                                  const locale: Locale = currentLanguage.code === 'pt-BR' ? 'pt-BR' : 'en';
                                  const extraCostsCents = toCents(formData.costEstimation || '0', locale);
                                  return formatCurrencyFromUtility(extraCostsCents, locale);
                                })()}
                              </p>
                            </div>
                            <div className="bg-gradient-to-br from-[#00FFFF]/10 to-[#0A192F]/30 rounded-md border-2 border-[#00FFFF]/30 p-3 text-center">
                              <span className="text-xs text-muted-foreground block">{t("total_cost", "Total Cost")}</span>
                              <p className="text-xl font-bold text-[#00FFFF] mt-1">
                                {(() => {
                                  const locale: Locale = currentLanguage.code === 'pt-BR' ? 'pt-BR' : 'en';
                                  const serviceCostsCents = formData.selectedServices.map(serviceId => {
                                    const service = repairServices.find(s => s.id === serviceId);
                                    return service ? toCents(service.estimatedLaborCost, locale) : 0;
                                  });
                                  const totalServicesCents = addCents(...serviceCostsCents);
                                  
                                  // Calculate service items cost
                                  const itemsCostsCents = formData.selectedItems.map(item => {
                                    const unitPriceCents = toCents(item.unitPrice || '0', locale);
                                    return unitPriceCents * item.quantity;
                                  });
                                  const totalItemsCents = itemsCostsCents.length > 0 ? addCents(...itemsCostsCents) : 0;
                                  
                                  const extraCostsCents = toCents(formData.costEstimation || '0', locale);
                                  const grandTotalCents = addCents(totalServicesCents, totalItemsCents, extraCostsCents);
                                  
                                  return formatCurrencyFromUtility(grandTotalCents, locale);
                                })()}
                              </p>
                            </div>
                          </div>

                          {/* Extra Cost Info */}
                          {formData.costExplanation && (
                            <div className="mt-4 p-3 bg-gradient-to-r from-[#00FFFF]/5 to-[#0A192F]/20 rounded-md border border-[#00FFFF]/20">
                              <span className="text-xs text-muted-foreground block mb-2">{t("extra_cost_info", "Extra Cost Info")}</span>
                              <p className="text-sm text-white">{formData.costExplanation}</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Aurora Card - Selected Checklists */}
                      {formData.selectedChecklists && formData.selectedChecklists.length > 0 && (
                        <div className="bg-slate-800/50 rounded-lg border border-[#00FFFF]/20 overflow-hidden">
                          <div className="bg-gradient-to-r from-[#0A192F] to-[#00FFFF] px-4 py-3">
                            <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                              <Check className="w-4 h-4" />
                              {t("selected_checklists", "Selected Checklists")}
                              <Badge variant="secondary" className="ml-2 bg-cyan-500/20 text-cyan-300 border-cyan-500/30">
                                {formData.selectedChecklists.length}
                              </Badge>
                            </h4>
                          </div>
                          <div className="p-4">
                            <p className="text-sm text-muted-foreground mb-3">
                              {t("checklists_for_service", "Checklists configured for this service")}
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {(() => {
                                // Get checklist names from the activeChecklists data
                                return formData.selectedChecklists.map((checklistId) => {
                                  // Find the checklist name from activeChecklists
                                  const checklist = activeChecklists?.find(c => c.id === checklistId);
                                  const checklistName = checklist?.name || `${t("checklist", "Checklist")} ID: ${checklistId.slice(-8)}`;
                                  
                                  return (
                                    <div
                                      key={checklistId}
                                      className="flex items-center gap-3 p-3 rounded-lg border border-slate-600/50 bg-gradient-to-br from-slate-700/40 via-slate-700/40 to-slate-600/40"
                                    >
                                      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-cyan-500/20 border border-cyan-500/30">
                                        <Check className="w-3 h-3 text-cyan-400" />
                                      </div>
                                      <div className="flex-1">
                                        <div className="text-sm font-medium text-white">
                                          {checklistName}
                                        </div>
                                        <div className="text-xs text-cyan-200/80">
                                          {t("device_type", "Device Type")}: {formData.deviceType}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                });
                              })()}
                            </div>
                            {formData.additionalNotes && (
                              <div className="mt-4 p-3 bg-gradient-to-r from-[#00FFFF]/5 to-[#0A192F]/20 rounded-md border border-[#00FFFF]/20">
                                <span className="text-xs text-muted-foreground block mb-2">{t("additional_notes", "Additional Notes")}</span>
                                <p className="text-sm text-white">{formData.additionalNotes}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Aurora Card - Client Approval */}
                      <div className="bg-slate-800/50 rounded-lg border-2 border-[#00FFFF]/30 overflow-hidden">
                        <div className="bg-gradient-to-r from-[#0A192F] to-[#00FFFF] px-4 py-3">
                          <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                            <Shield className="w-4 h-4" />
                            {t("authorization_required", "Authorization Required")}
                          </h4>
                        </div>
                        <div className="p-4 space-y-4">
                          <div className="bg-gradient-to-r from-[#00FFFF]/5 to-[#0A192F]/20 rounded-md border border-[#00FFFF]/20 p-4">
                            <div className="flex items-center space-x-3">
                              <Switch
                                checked={formData.clientApproved}
                                onCheckedChange={(checked) => {
                                  setFormData(prev => ({ ...prev, clientApproved: checked }));
                                }}
                                data-testid="switch-client-approved"
                              />
                              <div className="flex-1">
                                <Label htmlFor="client-approved" className="text-sm font-medium text-white cursor-pointer">
                                  {t("client_has_approved", "Client has reviewed and approved all details")}
                                </Label>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {t("approval_confirmation", "By enabling this, you confirm the client has agreed to the service terms, cost, and timeline.")}
                                </p>
                              </div>
                              {formData.clientApproved && (
                                <div className="text-green-500">
                                  <Check className="w-5 h-5" />
                                </div>
                              )}
                            </div>
                          </div>

                          {!formData.clientApproved && (
                            <div className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/30 rounded-md p-3">
                              <div className="flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                                <p className="text-sm text-yellow-300">
                                  {t("approval_warning", "Client approval is required before creating the repair ticket.")}
                                </p>
                              </div>
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
          
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
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
                    <SelectItem key={deviceType} value={deviceType!}>
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

            {/* Archive Filter */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">{t("archive_filter", "Archive Filter")}</Label>
              <div className="flex items-center space-x-2 h-9">
                <Switch
                  id="show-archived"
                  checked={filters.showArchived}
                  onCheckedChange={(checked) => setFilters(prev => ({ ...prev, showArchived: checked }))}
                  data-testid="switch-show-archived"
                />
                <Label 
                  htmlFor="show-archived" 
                  className="text-sm cursor-pointer"
                >
                  {t("show_finalized", "Show Finalized")}
                </Label>
              </div>
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
                      className={`${ticket.status === 'finalized' ? 'cursor-not-allowed' : 'cursor-pointer hover:shadow-md'} transition-all duration-200 ${getStatusCardStyling(ticket.status)}`}
                      draggable={ticket.status !== 'finalized'}
                      onDragStart={(e) => ticket.status !== 'finalized' ? handleDragStart(e, ticket.id) : e.preventDefault()}
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
                            {ticket.status === 'finalized' && (
                              <Lock className="w-3 h-3 text-gray-500" />
                            )}
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
                                createdAt={ticket.createdAt ? new Date(ticket.createdAt).toISOString() : undefined}
                                technicianEstimatedHours={ticket.technicianEstimatedHours ?? undefined}
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
                              {formatDate(ticket.createdAt)}
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
      <TicketSummaryDialog
        ticket={selectedTicketSummary}
        isOpen={!!selectedTicketSummary}
        onClose={() => setSelectedTicketSummary(null)}
        onDelete={(ticketId) => setShowDeleteConfirmation(true)}
        getKanbanColumns={getKanbanColumns}
        getPriorityColor={getPriorityColor}
        getPriorityLabel={getPriorityLabel}
        getStatusCardStyling={getStatusCardStyling}
      />

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
                  createdAt={selectedTicketSummary.createdAt ? new Date(selectedTicketSummary.createdAt).toISOString() : undefined}
                  technicianEstimatedHours={selectedTicketSummary.technicianEstimatedHours ?? undefined}
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
                            {selectedTicketSummary.clientDeadline 
                              ? formatDate(selectedTicketSummary.clientDeadline)
                              : t("not_set", "Not set")
                            }
                          </div>
                        </div>
                        <div className="bg-slate-800/50 dark:bg-slate-900/50 p-2 rounded border border-cyan-500/20">
                          <div className="font-medium text-cyan-400">{t("estimated_time", "Estimated Time")}</div>
                          <div className="text-slate-200">
                            {(() => {
                              // Calculate time from selected services if available
                              if (selectedTicketSummary.selectedServices && Array.isArray(selectedTicketSummary.selectedServices) && selectedTicketSummary.selectedServices.length > 0) {
                                const services = selectedTicketSummary.selectedServices;
                                const totalMinutes = services.reduce((total: number, serviceId: string) => {
                                  const service = ticketRepairServices.find(s => s.id === serviceId);
                                  return service ? total + (service.estimatedCompletionTimeHours * 60) + service.estimatedCompletionTimeMinutes : total;
                                }, 0);
                                
                                if (totalMinutes === 0) return selectedTicketSummary.technicianEstimatedHours ? `${selectedTicketSummary.technicianEstimatedHours}${t("hours_short", "h")}` : t("not_available", "N/A");
                                
                                const hours = Math.floor(totalMinutes / 60);
                                const minutes = totalMinutes % 60;
                                
                                if (hours === 0) return `${minutes}${t("minutes_short", "min")}`;
                                if (minutes === 0) return `${hours}${t("hours_short", "h")}`;
                                return `${hours}${t("hours_short", "h")} ${minutes}${t("minutes_short", "min")}`;
                              }
                              return selectedTicketSummary.technicianEstimatedHours ? `${selectedTicketSummary.technicianEstimatedHours}${t("hours_short", "h")}` : t("not_available", "N/A");
                            })()}
                          </div>
                        </div>
                        <div className="bg-slate-800/50 dark:bg-slate-900/50 p-2 rounded border border-cyan-500/20">
                          <div className="font-medium text-cyan-400">{t("deadline_status", "Status")}</div>
                          <div>
                            {(() => {
                              if (!selectedTicketSummary.clientDeadline) return <span className="text-yellow-400">{t("no_deadline", "No deadline")}</span>;
                              
                              const deadline = new Date(selectedTicketSummary.clientDeadline);
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
                      {selectedTicketSummary.selectedServices && Array.isArray(selectedTicketSummary.selectedServices) && selectedTicketSummary.selectedServices.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-muted/20">
                          <div className="font-medium text-cyan-400 text-xs mb-2">{t("selected_services", "Selected Services")}</div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {ticketRepairServices
                              .filter(service => selectedTicketSummary.selectedServices.includes(service.id))
                              .map((service) => (
                                <div key={service.id} className="flex items-center gap-2 text-xs bg-slate-700/30 rounded p-2">
                                  <div className="w-1.5 h-1.5 rounded-full bg-[#00FFFF]"></div>
                                  <span className="text-slate-200 truncate">{service.name}</span>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                      
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
                              if (selectedTicketSummary.selectedServices) {
                                if (Array.isArray(selectedTicketSummary.selectedServices)) {
                                  services = selectedTicketSummary.selectedServices;
                                } else if (typeof selectedTicketSummary.selectedServices === 'string') {
                                  try {
                                    services = JSON.parse(selectedTicketSummary.selectedServices);
                                  } catch (e) {
                                    services = [];
                                  }
                                }
                              }
                              
                              const locale: Locale = currentLanguage.code === 'pt-BR' ? 'pt-BR' : 'en';
                              if (Array.isArray(services) && services.length > 0) {
                                const serviceCostsCents = services.map((serviceId: string) => {
                                  const service = ticketRepairServices.find(s => s.id === serviceId);
                                  return service ? toCents(service.estimatedLaborCost, locale) : 0;
                                });
                                const totalServicesCents = addCents(...serviceCostsCents);
                                return formatCurrency(totalServicesCents, locale);
                              }
                              return formatCurrency(0, locale);
                            })()}
                          </div>
                        </div>
                        <div className="bg-slate-800/50 dark:bg-slate-900/50 p-2 rounded border border-cyan-500/20">
                          <div className="font-medium text-cyan-400">{t("items_cost", "Items Cost")}</div>
                          <div className="font-bold text-purple-400">
                            {(() => {
                              const locale: Locale = currentLanguage.code === 'pt-BR' ? 'pt-BR' : 'en';
                              let totalItemsCents = 0;
                              if (summaryTicketItems && summaryTicketItems.length > 0) {
                                const itemsCostsCents = summaryTicketItems.map((item: any) => {
                                  const unitPriceCents = toCents(item.unitPrice || '0', locale);
                                  return unitPriceCents * item.quantity;
                                });
                                totalItemsCents = addCents(...itemsCostsCents);
                              }
                              return formatCurrency(totalItemsCents, locale);
                            })()}
                          </div>
                        </div>
                        <div className="bg-slate-800/50 dark:bg-slate-900/50 p-2 rounded border border-cyan-500/20">
                          <div className="font-medium text-cyan-400">{t("extra_costs", "Extra Costs")}</div>
                          <div className="font-bold text-white">
                            {(() => {
                              const locale: Locale = currentLanguage.code === 'pt-BR' ? 'pt-BR' : 'en';
                              const extraCostsCents = selectedTicketSummary.costEstimation 
                                ? toCents(selectedTicketSummary.costEstimation, locale)
                                : 0;
                              return formatCurrency(extraCostsCents, locale);
                            })()}
                          </div>
                        </div>
                        <div className="bg-gradient-to-br from-emerald-900/50 to-emerald-800/50 p-2 rounded border-2 border-emerald-500/30">
                          <div className="font-medium text-emerald-400">{t("total_cost", "Total Cost")}</div>
                          <div className="font-bold text-emerald-300">
                            {(() => {
                              const locale: Locale = currentLanguage.code === 'pt-BR' ? 'pt-BR' : 'en';
                              let totalServicesCents = 0;
                              if (selectedTicketSummary.selectedServices && Array.isArray(selectedTicketSummary.selectedServices) && selectedTicketSummary.selectedServices.length > 0) {
                                const services = selectedTicketSummary.selectedServices;
                                const serviceCostsCents = services.map((serviceId: string) => {
                                  const service = ticketRepairServices.find(s => s.id === serviceId);
                                  return service ? toCents(service.estimatedLaborCost, locale) : 0;
                                });
                                totalServicesCents = addCents(...serviceCostsCents);
                              }
                              
                              // Calculate service items cost
                              let totalItemsCents = 0;
                              if (summaryTicketItems && summaryTicketItems.length > 0) {
                                const itemsCostsCents = summaryTicketItems.map((item: any) => {
                                  const unitPriceCents = toCents(item.unitPrice || '0', locale);
                                  return unitPriceCents * item.quantity;
                                });
                                totalItemsCents = addCents(...itemsCostsCents);
                              }
                              
                              const extraCostsCents = toCents(selectedTicketSummary.costEstimation || '0', locale);
                              const grandTotalCents = addCents(totalServicesCents, totalItemsCents, extraCostsCents);
                              return formatCurrency(grandTotalCents, locale);
                            })()}
                          </div>
                        </div>
                      </div>

                      {/* Extra Cost Info */}
                      {selectedTicketSummary.costExplanation && (
                        <div className="mt-2 bg-slate-800/50 dark:bg-slate-900/50 p-2 rounded border border-cyan-500/20">
                          <div className="font-medium text-cyan-400 mb-1">{t("extra_cost_info", "Extra Cost Info")}</div>
                          <div className="text-xs text-slate-300">{selectedTicketSummary.costExplanation}</div>
                        </div>
                      )}

                      {/* Created Date */}
                      <div className="mt-2 bg-slate-800/50 dark:bg-slate-900/50 p-2 rounded border border-cyan-500/20">
                        <div className="font-medium text-cyan-400">{t("created_on", "Created")}</div>
                        <div className="text-slate-200">{formatDate(selectedTicketSummary.createdAt)}</div>
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
                    deviceType={selectedTicketSummary.deviceType || ''}
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
                          deviceType={selectedTicketSummary.deviceType || ''} 
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
                      const serviceChecklist = selectedTicketSummary.serviceChecklist as any;
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

                          {/* Checklists Grid */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {selectedChecklists.map((checklistItem: any, index: number) => {
                              // Backward-compatible parsing for different data formats
                              const checklistId = (() => {
                                if (typeof checklistItem === 'string') return checklistItem;
                                if (checklistItem?.id) return checklistItem.id;
                                return `checklist-${index}`;
                              })();

                              const checklistName = (() => {
                                // If checklistItem is an object with name, use it directly (legacy format)
                                if (checklistItem?.name) return checklistItem.name;
                                
                                // If checklistItem is a plain string name (not an ID), use it
                                if (typeof checklistItem === 'string' && !checklistItem.includes('-') && checklistItem.length < 50) {
                                  return checklistItem;
                                }

                                // Try to find the checklist name from the summary checklists (preferred)
                                if (summaryChecklists) {
                                  const checklist = summaryChecklists.find(c => c.id === checklistId);
                                  if (checklist?.name) return checklist.name;
                                }

                                // Fallback: try configuration checklists (ticket creation context)
                                if (configurationChecklists) {
                                  const checklist = configurationChecklists.find(c => c.id === checklistId);
                                  if (checklist?.name) return checklist.name;
                                }

                                // Last resort: show the ID or raw value for debugging
                                if (typeof checklistItem === 'string') {
                                  return checklistId.length > 30 ? `Unknown checklist (${checklistId.substring(0, 8)}...)` : `Unknown checklist (${checklistId})`;
                                }
                                
                                return `${t("checklist", "Checklist")} ${index + 1}`;
                              })();

                              return (
                                <div key={checklistId || index} className="bg-gradient-to-br from-slate-800/70 to-slate-700/70 rounded-lg p-4 border border-cyan-500/20">
                                  <div className="flex items-center gap-3">
                                    <div className="bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-full p-1.5">
                                      <Check className="w-3 h-3 text-white" />
                                    </div>
                                    <div>
                                      <h5 className="font-medium text-white text-sm">
                                        {checklistName}
                                      </h5>
                                      <p className="text-cyan-300 text-xs">
                                        {selectedTicketSummary.deviceType} {t("checklist", "Checklist")}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Summary Stats */}
                          <div className="bg-muted/5 border border-muted/20 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="font-medium text-sm">{t("checklist_summary", "Checklist Summary")}</h4>
                              <span className="text-xs text-muted-foreground">
                                {selectedChecklists.length} {t("checklists_selected", "checklists selected")}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs px-2 py-1 rounded-full font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                                {selectedChecklists.length}× {t("active_checklists", "Active Checklists")}
                              </span>
                              <span className="text-xs px-2 py-1 rounded-full font-medium bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300">
                                {selectedTicketSummary.deviceType} {t("device", "Device")}
                              </span>
                            </div>
                          </div>
                          
                          {/* Additional Notes */}
                          {serviceChecklist?.additionalNotes && serviceChecklist.additionalNotes.trim() && (
                            <div className="bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-800/50 rounded-lg p-3">
                              <div className="flex items-center gap-2 mb-2">
                                <MessageSquare className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                <h4 className="font-medium text-sm">{t("additional_notes", "Additional Notes")}</h4>
                              </div>
                              <p className="text-sm text-muted-foreground italic">"{serviceChecklist.additionalNotes}"</p>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </TabsContent>
              </Tabs>
              
              <div className="flex justify-between">
                {selectedTicketSummary.status !== 'finalized' && (
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    onClick={() => setShowDeleteConfirmation(true)}
                    data-testid="button-delete-ticket"
                  >
                    {t("delete", "Delete")}
                  </Button>
                )}
                <Button variant="outline" onClick={() => setSelectedTicketSummary(null)} data-testid="button-close-ticket-summary">
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

      {/* Ticket Deletion Confirmation Dialog */}
      <Dialog open={showDeleteConfirmation} onOpenChange={setShowDeleteConfirmation}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              {t("delete_ticket", "Delete Ticket")}
            </DialogTitle>
            <DialogDescription>
              {t("delete_warning", "Are you sure you want to delete this ticket? This action cannot be undone.")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
              <div className="text-sm space-y-1">
                <p className="font-medium text-destructive">{t("delete_permanent", "This action is permanent")}</p>
                <p className="text-muted-foreground">{t("delete_confirmation_details", "All ticket data, notes, and history will be permanently deleted.")}</p>
              </div>
            </div>

            {selectedTicketSummary && (
              <div className="bg-muted/20 p-3 rounded-md space-y-1 text-sm">
                <div><strong>{t("ticket_id", "Ticket ID")}:</strong> {selectedTicketSummary.id}</div>
                <div><strong>{t("client", "Client")}:</strong> {selectedTicketSummary.client ? `${selectedTicketSummary.client.firstName} ${selectedTicketSummary.client.lastName}` : "N/A"}</div>
                <div><strong>{t("device", "Device")}:</strong> {selectedTicketSummary.deviceType} {selectedTicketSummary.deviceModel}</div>
              </div>
            )}
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 gap-2">
            <Button variant="outline" onClick={() => setShowDeleteConfirmation(false)} data-testid="button-cancel-delete">
              {t("cancel", "Cancel")}
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteTicket}
              data-testid="button-confirm-delete"
              disabled={deleteTicketMutation.isPending}
            >
              {deleteTicketMutation.isPending ? t("deleting", "Deleting...") : t("yes_delete", "Yes, Delete")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Finalization Wizard Dialog */}
      <Dialog open={showCompletionDialog} onOpenChange={(open) => {
        setShowCompletionDialog(open);
        if (!open) resetWizard();
      }}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Check className="w-5 h-5 text-green-600" />
              {t("finalize_ticket", "Finalize Ticket")} - {t("step", "Step")} {wizardStep} / 4
            </DialogTitle>
            <DialogDescription>
              {wizardStep === 1 && t("review_details", "Review the completion details below")}
              {wizardStep === 2 && t("final_inspection", "Perform final device inspection")}
              {wizardStep === 3 && t("before_vs_after", "Before vs After Analysis")}
              {wizardStep === 4 && t("authorize_completion", "Authorize Completion")}
            </DialogDescription>
          </DialogHeader>

          {/* Progress Indicator */}
          <div className="flex items-center justify-between mb-6">
            {[
              { num: 1, name: t("step_1_name", "Summary") },
              { num: 2, name: t("step_2_name", "Checklist") },
              { num: 3, name: t("step_3_name", "Comparison") },
              { num: 4, name: t("step_4_name", "Authorization") }
            ].map((step) => (
              <div key={step.num} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div 
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      step.num === wizardStep 
                        ? 'bg-[#00FFFF] text-[#0A192F]' 
                        : step.num < wizardStep 
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-300 text-gray-600'
                    }`}
                  >
                    {step.num < wizardStep ? <Check className="w-4 h-4" /> : step.num}
                  </div>
                  <span className={`text-xs mt-1 font-medium ${
                    step.num === wizardStep ? 'text-[#00FFFF]' :
                    step.num < wizardStep ? 'text-green-600' : 'text-gray-500'
                  }`}>
                    {step.name}
                  </span>
                </div>
                {step.num < 4 && (
                  <div className={`h-0.5 w-16 mx-2 ${
                    step.num < wizardStep ? 'bg-green-600' : 'bg-gray-300'
                  }`} />
                )}
              </div>
            ))}
          </div>

          {ticketToFinalize && (
            <div className="space-y-6">
              {/* Step 1: Completion Summary */}
              {wizardStep === 1 && (
                <div className="max-w-4xl mx-auto">
                  {/* Aurora Card Layout */}
                  <div className="bg-slate-800/70 rounded-xl shadow-lg border border-[#00FFFF]/20 overflow-hidden">
                    {/* Aurora Gradient Header */}
                    <div className="bg-gradient-to-r from-[#0A192F] to-[#00FFFF] px-6 py-4">
                      <h3 className="text-xl font-bold text-white flex items-center gap-3">
                        <FileText className="w-5 h-5" />
                        {t("completion_summary", "Completion Summary")}
                      </h3>
                      <p className="text-cyan-100 text-sm mt-1">
                        {t("review_details", "Review the completion details below")}
                      </p>
                    </div>
                    
                    <div className="p-6 space-y-6">
                      {/* Ticket Information */}
                      <div className="bg-slate-800/50 rounded-lg border border-[#00FFFF]/20 overflow-hidden">
                        <div className="bg-gradient-to-r from-[#0A192F] to-[#00FFFF] px-4 py-3">
                          <h4 className="text-sm font-semibold text-white">{t("ticket_id", "Ticket ID")}: {ticketToFinalize.id}</h4>
                        </div>
                        <div className="p-4">
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <div>
                              <span className="text-xs text-cyan-400">{t("client", "Client")}</span>
                              <p className="text-sm font-medium text-white">
                                {ticketToFinalize.client ? `${ticketToFinalize.client.firstName} ${ticketToFinalize.client.lastName}` : "N/A"}
                              </p>
                            </div>
                            <div>
                              <span className="text-xs text-cyan-400">{t("device", "Device")}</span>
                              <p className="text-sm font-medium text-white">
                                {ticketToFinalize.deviceType} {ticketToFinalize.deviceModel}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Validation Errors */}
                      {validationErrors.length > 0 && (
                        <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-4">
                          <div className="flex items-start gap-3">
                            <X className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                            <div>
                              <h4 className="text-red-400 font-medium text-sm mb-2">
                                {t("validation_errors", "Please correct the following errors:")}
                              </h4>
                              <ul className="space-y-1">
                                {validationErrors.map((error, index) => (
                                  <li key={index} className="text-red-300 text-sm">• {error}</li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Service Items Confirmation - Moved to Top */}
                      {ticketItems && ticketItems.length > 0 && (
                        <div className="bg-slate-800/50 rounded-lg border border-[#00FFFF]/20 overflow-hidden">
                          <div className="bg-gradient-to-r from-[#0A192F] to-[#00FFFF] px-4 py-3">
                            <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                              <Package className="w-4 h-4" />
                              {t("service_items_used", "Service Items Used")}
                            </h4>
                          </div>
                          <div className="p-4">
                            <p className="text-xs text-cyan-300 mb-3">
                              {t("confirm_items_used", "Check the items that were actually used during this repair")}
                            </p>
                            <div className="space-y-2">
                              {ticketItems.map((item: any) => (
                                <div
                                  key={item.id}
                                  className="flex items-center justify-between p-3 rounded-lg border border-slate-600/50 bg-slate-700/40 hover:bg-slate-700/60 transition-colors"
                                >
                                  <div className="flex items-center gap-3 flex-1">
                                    <Checkbox
                                      id={`item-${item.id}`}
                                      checked={wizardData.confirmedItemIds.includes(item.id)}
                                      onCheckedChange={(checked) => {
                                        const locale: Locale = currentLanguage.code === 'pt-BR' ? 'pt-BR' : 'en';
                                        const itemTotalCents = toCents(item.totalPrice || '0', locale);
                                        
                                        setWizardData(prev => {
                                          const newConfirmedIds = checked
                                            ? [...prev.confirmedItemIds, item.id]
                                            : prev.confirmedItemIds.filter(id => id !== item.id);
                                          return {
                                            ...prev,
                                            confirmedItemIds: newConfirmedIds
                                          };
                                        });
                                        
                                        // Update final cost automatically
                                        setCompletionData(prev => {
                                          const currentCostCents = toCents(prev.finalActualCost || '0', locale);
                                          const newCostCents = checked 
                                            ? currentCostCents + itemTotalCents 
                                            : currentCostCents - itemTotalCents;
                                          return {
                                            ...prev,
                                            finalActualCost: formatCurrencyFromUtility(newCostCents, locale).replace(/[^\d.,]/g, '')
                                          };
                                        });
                                      }}
                                      className="border-cyan-400 data-[state=checked]:bg-cyan-500"
                                      data-testid={`checkbox-item-${item.id}`}
                                    />
                                    <div className="flex-1">
                                      <div className="text-sm font-medium text-white">
                                        {item.inventoryItem?.name || 'Unknown Item'}
                                      </div>
                                      <div className="text-xs text-slate-400 mt-0.5">
                                        ID: {item.inventoryItemId?.slice(-8) || item.id?.slice(-8)}
                                      </div>
                                      <div className="text-xs text-cyan-300 mt-1">
                                        {t("quantity", "Quantity")}: {item.quantity} × {currentLanguage.code === 'pt-BR' ? 'R$' : '$'}{item.unitPrice}
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <div className="text-sm font-medium text-primary">
                                        {currentLanguage.code === 'pt-BR' ? 'R$' : '$'}{item.totalPrice}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                            <p className="text-xs text-yellow-400 mt-3 flex items-start gap-2">
                              <AlertTriangle className="w-4 h-4 mt-0.5" />
                              {t("unchecked_items_returned", "Unchecked items will be returned to inventory")}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Completion Form */}
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="actual-hours" className="text-cyan-400 flex items-center gap-1">
                              {t("actual_hours", "Actual Hours")}
                              <span className="text-red-400 text-sm">*</span>
                            </Label>
                            <Input
                              id="actual-hours"
                              type="number"
                              min="0"
                              step="1"
                              placeholder={t("hours", "Hours")}
                              value={completionData.actualHours}
                              onChange={(e) => setCompletionData(prev => ({ ...prev, actualHours: e.target.value }))}
                              className="bg-slate-800/50 border-[#00FFFF]/20 text-white"
                              data-testid="input-actual-hours"
                            />
                            <p className="text-xs text-cyan-300">
                              {t("estimated", "Estimated")}: {ticketToFinalize.technicianEstimatedHours || 0}h
                            </p>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="final-cost" className="text-cyan-400 flex items-center gap-1">
                              {t("final_actual_cost", "Final Cost")}
                              <span className="text-red-400 text-sm">*</span>
                            </Label>
                            <Input
                              id="final-cost"
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="0.00"
                              value={completionData.finalActualCost}
                              onChange={(e) => setCompletionData(prev => ({ ...prev, finalActualCost: e.target.value }))}
                              className="bg-slate-800/50 border-[#00FFFF]/20 text-white"
                              data-testid="input-final-cost"
                            />
                            <p className="text-xs text-cyan-300">
                              {t("estimated", "Estimated")}: {(() => {
                                // Calculate total estimated cost (services + items + extra costs)
                                if (ticketToFinalize.selectedServices && Array.isArray(ticketToFinalize.selectedServices) && ticketToFinalize.selectedServices.length > 0) {
                                  const locale = currentLanguage.code === 'pt-BR' ? 'pt-BR' : 'en';
                                  
                                  // Calculate services cost
                                  const serviceCostsCents = (ticketToFinalize.selectedServices as string[]).map(serviceId => {
                                    const service = finalizationRepairServices.find(s => s.id === serviceId);
                                    return service ? toCents(service.estimatedLaborCost, locale) : 0;
                                  });
                                  const totalServicesCents = addCents(...serviceCostsCents);
                                  
                                  // Calculate service items cost
                                  let totalItemsCents = 0;
                                  if (ticketToFinalize.selectedItems && Array.isArray(ticketToFinalize.selectedItems) && ticketToFinalize.selectedItems.length > 0) {
                                    const itemsCostsCents = ticketToFinalize.selectedItems.map((item: any) => {
                                      const itemTotal = parseFloat(item.unitPrice || '0') * item.quantity;
                                      return toCents(String(itemTotal), locale);
                                    });
                                    totalItemsCents = addCents(...itemsCostsCents);
                                  }
                                  
                                  // Add extra costs
                                  const extraCostsCents = ticketToFinalize.costEstimation ? toCents(ticketToFinalize.costEstimation, locale) : 0;
                                  const grandTotalCents = addCents(totalServicesCents, totalItemsCents, extraCostsCents);
                                  
                                  return formatCurrencyFromUtility(grandTotalCents, locale);
                                } else if (ticketToFinalize.costEstimation) {
                                  // If no services, just show extra costs
                                  return `$${parseFloat(ticketToFinalize.costEstimation).toFixed(2)}`;
                                }
                                return "$0.00";
                              })()}
                            </p>
                          </div>
                        </div>

                        {/* Completion Notes - Moved to Bottom */}
                        <div className="space-y-2">
                          <Label htmlFor="completion-notes" className="text-cyan-400">
                            {t("completion_notes", "Completion Notes")}
                          </Label>
                          <Textarea
                            id="completion-notes"
                            placeholder={t("completion_notes_placeholder", "Describe the work completed, any issues found, and resolution...")}
                            value={completionData.completionNotes}
                            onChange={(e) => setCompletionData(prev => ({ ...prev, completionNotes: e.target.value }))}
                            className="min-h-[100px] bg-slate-800/50 border-[#00FFFF]/20 text-white"
                            data-testid="textarea-completion-notes"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Finalization Checklist */}
              {wizardStep === 2 && (
                <div className="max-w-4xl mx-auto">
                  <div className="bg-slate-800/70 rounded-xl shadow-lg border border-[#00FFFF]/20 overflow-hidden">
                    <div className="bg-gradient-to-r from-[#0A192F] to-[#00FFFF] px-6 py-4">
                      <h3 className="text-xl font-bold text-white flex items-center gap-3">
                        <CheckSquare className="w-5 h-5" />
                        {t("finalization_checklist", "Finalization Checklist")}
                      </h3>
                      <p className="text-cyan-100 text-sm mt-1">
                        {t("final_inspection", "Perform final device inspection")} - {ticketToFinalize.deviceType}
                      </p>
                    </div>
                    
                    <div className="p-6">
                      {finalizationChecklists && finalizationChecklists.length > 0 ? (
                        <div className="space-y-4">
                          <p className="text-cyan-300 text-sm mb-4">
                            {t("review_checklist_completion", "Review and confirm completion of these inspection categories:")}
                          </p>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {finalizationChecklists.map((checklist) => (
                              <div
                                key={checklist.id}
                                className="flex items-start space-x-3 p-4 rounded-lg border border-slate-600/50 bg-gradient-to-br from-slate-700/40 via-slate-700/40 to-slate-600/40 hover:bg-gradient-to-br hover:from-cyan-900/20 hover:via-slate-700/40 hover:to-slate-600/40 hover:border-cyan-500/50 transition-all duration-200"
                              >
                                <Checkbox
                                  id={`final-checklist-${checklist.id}`}
                                  checked={wizardData.finalChecklist[checklist.id] || false}
                                  onCheckedChange={(checked) => {
                                    setWizardData(prev => ({
                                      ...prev,
                                      finalChecklist: {
                                        ...prev.finalChecklist,
                                        [checklist.id]: checked as boolean
                                      }
                                    }));
                                  }}
                                  className="border-cyan-400 data-[state=checked]:bg-cyan-500 mt-0.5"
                                  data-testid={`checkbox-final-${checklist.id}`}
                                />
                                <div className="flex-1">
                                  <Label 
                                    htmlFor={`final-checklist-${checklist.id}`}
                                    className="text-sm font-medium text-white cursor-pointer block"
                                  >
                                    {checklist.name}
                                  </Label>
                                  <p className="text-xs text-cyan-300 mt-1">
                                    {t("device_type", "Device Type")}: {checklist.deviceType}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="text-center text-cyan-300 py-8">
                          <CheckSquare className="w-16 h-16 mx-auto mb-4 text-cyan-400" />
                          <p className="text-lg font-medium">{t("no_checklists", "No checklists available")}</p>
                          <p className="text-sm text-gray-400 mt-2">{t("no_checklists_found_for", "No checklists found for")} {ticketToFinalize.deviceType}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Checklist Comparison */}
              {wizardStep === 3 && (
                <div className="max-w-4xl mx-auto">
                  <div className="bg-slate-800/70 rounded-xl shadow-lg border border-[#00FFFF]/20 overflow-hidden">
                    <div className="bg-gradient-to-r from-[#0A192F] to-[#00FFFF] px-6 py-4">
                      <h3 className="text-xl font-bold text-white flex items-center gap-3">
                        <GitCompare className="w-5 h-5" />
                        {t("checklist_comparison", "Checklist Comparison")}
                      </h3>
                      <p className="text-cyan-100 text-sm mt-1">
                        {t("before_vs_after", "Before vs After Analysis")}
                      </p>
                    </div>
                    
                    <div className="p-6">
                      {finalizationChecklists && finalizationChecklists.length > 0 ? (() => {
                        // Get initial defects from ticket
                        const initialDefects = (ticketToFinalize?.serviceChecklist as any)?.selectedChecklists || [];
                        const finalDefects = Object.keys(wizardData.finalChecklist).filter(key => wizardData.finalChecklist[key]);
                        
                        // Check if any new defects were found (any final defect not in initial list)
                        const hasNewDefects = finalDefects.some(defect => !initialDefects.includes(defect));
                        const newDefectsFound = hasNewDefects;
                        
                        return (
                          <div className="space-y-6">
                            {/* Quality Check Warning */}
                            {newDefectsFound && (
                              <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-4">
                                <div className="flex items-start gap-3">
                                  <AlertTriangle className="w-6 h-6 text-red-400 mt-0.5 flex-shrink-0" />
                                  <div>
                                    <h4 className="text-red-400 font-semibold mb-2">
                                      {t("quality_check_required", "Quality Check Required")}
                                    </h4>
                                    <p className="text-red-300 text-sm">
                                      {t("new_defects_found", "Additional defects have been identified that were not present during initial inspection. This ticket requires quality review before completion.")}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            )}

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                              {/* Initial Defects */}
                              <div className="bg-slate-800/50 rounded-lg border border-[#00FFFF]/20 overflow-hidden">
                                <div className="bg-gradient-to-r from-[#0A192F] to-orange-500 px-4 py-3">
                                  <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                                    <FileText className="w-4 h-4" />
                                    {t("initial_defects", "Initial Defects")}
                                  </h4>
                                </div>
                                <div className="p-4">
                                  <p className="text-xs text-orange-300 mb-3">
                                    {t("defects_found_intake", "Defects identified during device intake:")}
                                  </p>
                                  <div className="space-y-2">
                                    {initialDefects.length > 0 ? (
                                      finalizationChecklists
                                        .filter(checklist => initialDefects.includes(checklist.id))
                                        .map((checklist) => (
                                          <div key={`initial-${checklist.id}`} className="flex items-center space-x-2">
                                            <div className="w-4 h-4 rounded-full flex items-center justify-center bg-red-500">
                                              <X className="w-3 h-3 text-white" />
                                            </div>
                                            <span className="text-sm text-gray-300">{checklist.name}</span>
                                          </div>
                                        ))
                                    ) : (
                                      <p className="text-sm text-gray-400 italic">
                                        {t("no_initial_defects", "No defects identified during intake")}
                                      </p>
                                    )}
                                  </div>
                                  <div className="mt-3 text-center">
                                    <div className="text-lg font-bold text-orange-400">{initialDefects.length}</div>
                                    <div className="text-xs text-orange-300">{t("total_defects", "Total Defects")}</div>
                                  </div>
                                </div>
                              </div>

                              {/* Final Defects */}
                              <div className="bg-slate-800/50 rounded-lg border border-[#00FFFF]/20 overflow-hidden">
                                <div className={`bg-gradient-to-r from-[#0A192F] ${newDefectsFound ? 'to-red-500' : 'to-green-500'} px-4 py-3`}>
                                  <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                                    <CheckSquare className="w-4 h-4" />
                                    {t("final_defects", "Final Defects")}
                                  </h4>
                                </div>
                                <div className="p-4">
                                  <p className={`text-xs mb-3 ${newDefectsFound ? 'text-red-300' : 'text-green-300'}`}>
                                    {t("defects_after_repair", "Defects remaining after repair work:")}
                                  </p>
                                  <div className="space-y-2">
                                    {finalDefects.length > 0 ? (
                                      finalizationChecklists
                                        .filter(checklist => finalDefects.includes(checklist.id))
                                        .map((checklist) => {
                                          const wasInitial = initialDefects.includes(checklist.id);
                                          return (
                                            <div key={`final-${checklist.id}`} className="flex items-center space-x-2">
                                              <div className={`w-4 h-4 rounded-full flex items-center justify-center ${
                                                wasInitial ? 'bg-orange-500' : 'bg-red-600'
                                              }`}>
                                                <X className="w-3 h-3 text-white" />
                                              </div>
                                              <span className="text-sm text-gray-300 flex items-center gap-2">
                                                {checklist.name}
                                                {!wasInitial && (
                                                  <span className="bg-red-600 text-white text-xs px-2 py-0.5 rounded-full">
                                                    {t("new", "NEW")}
                                                  </span>
                                                )}
                                              </span>
                                            </div>
                                          );
                                        })
                                    ) : (
                                      <p className="text-sm text-green-400 italic">
                                        {t("no_remaining_defects", "No defects remaining")}
                                      </p>
                                    )}
                                  </div>
                                  <div className="mt-3 text-center">
                                    <div className={`text-lg font-bold ${newDefectsFound ? 'text-red-400' : 'text-green-400'}`}>
                                      {finalDefects.length}
                                    </div>
                                    <div className="text-xs text-gray-300">{t("total_defects", "Total Defects")}</div>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Comparison Summary */}
                            <div className="bg-slate-800/50 rounded-lg border border-[#00FFFF]/20 p-4">
                              <h4 className="text-cyan-400 font-medium mb-4 flex items-center gap-2">
                                <GitCompare className="w-4 h-4" />
                                {t("repair_analysis", "Repair Analysis")}
                              </h4>
                              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                                <div className="text-center">
                                  <div className="text-2xl font-bold text-orange-400">{initialDefects.length}</div>
                                  <div className="text-xs text-cyan-400">{t("initial_count", "Initial")}</div>
                                </div>
                                <div className="text-center">
                                  <div className={`text-2xl font-bold ${newDefectsFound ? 'text-red-400' : 'text-green-400'}`}>
                                    {finalDefects.length}
                                  </div>
                                  <div className="text-xs text-cyan-400">{t("final_count", "Final")}</div>
                                </div>
                                <div className="text-center">
                                  <div className={`text-2xl font-bold ${
                                    newDefectsFound ? 'text-red-400' : finalDefects.length === 0 ? 'text-green-400' : 'text-yellow-400'
                                  }`}>
                                    {newDefectsFound ? t("needs_review", "Needs Review") : 
                                     finalDefects.length === 0 ? t("perfect", "Perfect") : t("acceptable", "Acceptable")}
                                  </div>
                                  <div className="text-xs text-cyan-400">{t("repair_status", "Status")}</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })() : (
                        <div className="text-center text-cyan-300 py-8">
                          <GitCompare className="w-16 h-16 mx-auto mb-4 text-cyan-400" />
                          <p className="text-lg font-medium">{t("no_comparison_data", "No comparison data available")}</p>
                          <p className="text-sm text-gray-400 mt-2">{t("complete_step_2_first", "Complete Step 2 first to see comparison")}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 4: Client Authorization */}
              {wizardStep === 4 && (
                <div className="max-w-4xl mx-auto">
                  <div className="bg-slate-800/70 rounded-xl shadow-lg border border-[#00FFFF]/20 overflow-hidden">
                    <div className="bg-gradient-to-r from-[#0A192F] to-[#00FFFF] px-6 py-4">
                      <h3 className="text-xl font-bold text-white flex items-center gap-3">
                        <Shield className="w-5 h-5" />
                        {t("client_authorization", "Client Authorization")}
                      </h3>
                      <p className="text-cyan-100 text-sm mt-1">
                        {t("final_summary", "Final Summary")} & {t("authorize_completion", "Authorize Completion")}
                      </p>
                    </div>
                    
                    <div className="p-6 space-y-6">

                      {/* Services Performed */}
                      {ticketToFinalize && ticketToFinalize.selectedServices && Array.isArray(ticketToFinalize.selectedServices) && ticketToFinalize.selectedServices.length > 0 && (
                        <div className="bg-slate-800/50 rounded-lg border border-[#00FFFF]/20 overflow-hidden">
                          <div className="bg-gradient-to-r from-[#0A192F] to-[#00FFFF] px-4 py-3">
                            <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                              <Wrench className="w-4 h-4" />
                              {t("services_performed", "Services Performed")}
                            </h4>
                          </div>
                          <div className="p-4">
                            <p className="text-xs text-cyan-300 mb-3">
                              {t("selected_services_for_repair", "Selected services for this repair")}
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {finalizationRepairServices
                                .filter(service => (ticketToFinalize.selectedServices as string[])?.includes(service.id))
                                .map((service) => (
                                  <div key={service.id} className="flex items-center gap-3 text-sm">
                                    <div className="w-2 h-2 rounded-full bg-[#00FFFF]"></div>
                                    <span className="text-gray-300 truncate">{service.name}</span>
                                  </div>
                                ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Warranty Selection */}
                      <div className="bg-slate-800/50 rounded-lg border border-[#00FFFF]/20 overflow-hidden">
                        <div className="bg-gradient-to-r from-[#0A192F] to-[#00FFFF] px-4 py-3">
                          <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                            <Shield className="w-4 h-4" />
                            {t("warranty_coverage", "Warranty Coverage")}
                          </h4>
                        </div>
                        <div className="p-4">
                          <p className="text-xs text-cyan-300 mb-3">
                            {t("select_warranty_for_repair", "Select warranty coverage for this repair")}
                          </p>
                          <div className="space-y-2">
                            {[...finalizationWarrantyTiers].sort((a, b) => a.durationMonths - b.durationMonths).map((tier) => (
                              <Label 
                                key={tier.id} 
                                htmlFor={`warranty-${tier.id}`} 
                                className="flex items-center justify-between p-2.5 rounded-md border border-slate-700 hover:border-cyan-500/50 hover:bg-slate-800/30 cursor-pointer transition-all"
                              >
                                <div className="flex items-center gap-3 flex-1">
                                  <input
                                    type="radio"
                                    id={`warranty-${tier.id}`}
                                    name="warranty-selection"
                                    value={tier.tierType}
                                    checked={wizardData.selectedWarrantyTier === tier.tierType}
                                    onChange={(e) => setWizardData(prev => ({ ...prev, selectedWarrantyTier: e.target.value }))}
                                    className="w-4 h-4 text-cyan-500 bg-slate-800 border-cyan-400 focus:ring-cyan-500"
                                    data-testid={`radio-warranty-${tier.tierType}`}
                                  />
                                  <div className="flex items-baseline gap-2">
                                    <span className="text-sm font-medium text-gray-300">
                                      {t(tier.tierType === 'standard' ? 'standard_warranty' : 'extended_warranty', 
                                        tier.tierType === 'standard' ? 'Standard' : 'Extended')}
                                    </span>
                                    <span className="text-xs text-cyan-400">
                                      {tier.durationMonths} {t("months", "months")}
                                    </span>
                                  </div>
                                </div>
                                <span className="text-sm font-semibold text-cyan-400 ml-2">
                                  {parseFloat(tier.price) === 0 ? t("free", "Free") : `$${parseFloat(tier.price).toFixed(2)}`}
                                </span>
                              </Label>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Work Summary - moved below warranty to reflect updated cost */}
                      <div className="bg-slate-800/50 rounded-lg border border-[#00FFFF]/20 overflow-hidden">
                        <div className="bg-gradient-to-r from-[#0A192F] to-[#00FFFF] px-4 py-3">
                          <h4 className="text-sm font-semibold text-white">{t("work_completed", "Work Completed")}</h4>
                        </div>
                        <div className="p-4">
                          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-sm">
                            <div>
                              <span className="text-xs text-cyan-400">{t("actual_hours", "Actual Hours")}</span>
                              <p className="text-white font-medium">{completionData.actualHours}h</p>
                            </div>
                            <div>
                              <span className="text-xs text-cyan-400">{t("final_actual_cost", "Final Cost")}</span>
                              <p className="text-white font-medium">{(() => {
                                // Calculate total final cost including warranty
                                let baseCost = parseFloat(completionData.finalActualCost || '0');
                                
                                // Add warranty cost if selected
                                const selectedTier = finalizationWarrantyTiers.find(tier => tier.tierType === wizardData.selectedWarrantyTier);
                                if (selectedTier) {
                                  baseCost += parseFloat(selectedTier.price || '0');
                                }
                                
                                return `$${baseCost.toFixed(2)}`;
                              })()}</p>
                            </div>
                            <div>
                              <span className="text-xs text-cyan-400">{t("completion_notes", "Completion Notes")}</span>
                              <p className="text-white font-medium line-clamp-2">{completionData.completionNotes}</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Authorization Switch */}
                      <div className="bg-slate-800/50 rounded-lg border border-[#00FFFF]/20 p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <Label className="text-cyan-400 font-medium">{t("authorize_completion", "Authorize Completion")}</Label>
                            <p className="text-xs text-gray-400 mt-1">{t("client_confirms_satisfactory", "Client confirms all work is satisfactory")}</p>
                          </div>
                          <Switch
                            checked={wizardData.clientAuthorized}
                            onCheckedChange={(checked) => setWizardData(prev => ({ ...prev, clientAuthorized: checked }))}
                            data-testid="switch-client-authorization"
                          />
                        </div>
                      </div>

                      {/* Warning */}
                      <div className="bg-amber-900/20 border border-amber-500/30 rounded-lg p-4">
                        <div className="text-sm text-amber-200">
                          <p className="font-medium">{t("finalization_warning", "Finalization Warning")}</p>
                          <p>{t("finalization_warning_details", "Once finalized, this ticket cannot be modified, moved, or deleted.")}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Required Fields Notice */}
          <div className="mt-6 mb-4 bg-cyan-900/20 border border-cyan-500/30 rounded-lg p-3">
            <p className="text-cyan-300 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              <span className="text-red-400">*</span>
              {t("required_fields_note", "Fields marked with an asterisk are required to proceed")}
            </p>
          </div>

          {/* Navigation Footer */}
          <div className="flex justify-between items-center pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button 
              variant="outline" 
              onClick={() => {
                if (wizardStep === 1) {
                  setShowCompletionDialog(false);
                  resetWizard();
                } else {
                  handleWizardPrevious();
                }
              }}
              data-testid="button-wizard-previous"
            >
              {wizardStep === 1 ? t("cancel", "Cancel") : t("previous", "Previous")}
            </Button>

            <div className="flex gap-3">
              {/* Quality Check Button - Show when new defects detected */}
              {(() => {
                const qualityStatus = getQualityCheckStatus();
                return qualityStatus.requiresQualityReview && (wizardStep === 3 || wizardStep === 4) && (
                  <Button 
                    onClick={() => {
                      if (ticketToFinalize) {
                        updateTicketStatus.mutate({
                          ticketId: ticketToFinalize.id,
                          status: 'quality_check' as TicketStatus
                        });
                      }
                    }}
                    disabled={updateTicketStatus.isPending}
                    className="bg-red-600 hover:bg-red-700 text-white text-lg px-6 py-3 animate-pulse-red animate-glow-red font-bold"
                    data-testid="button-quality-check"
                  >
                    {updateTicketStatus.isPending 
                      ? t("returning", "Returning...") 
                      : t("return_to_quality_check", "Return to Quality Check")
                    }
                  </Button>
                );
              })()}

              {/* Main Action Button */}
              <Button 
                onClick={() => {
                  if (wizardStep === 4) {
                    const qualityStatus = getQualityCheckStatus();
                    // Block completion if quality check is required
                    if (qualityStatus.requiresQualityReview) {
                      toast({
                        title: t("quality_check_required", "Quality Check Required"),
                        description: t("new_defects_found", "Additional defects have been identified that were not present during initial inspection. This ticket requires quality review before completion."),
                        variant: "destructive",
                      });
                      return;
                    }
                    
                    // Normal finalization
                    if (ticketToFinalize && completionData.actualHours && completionData.finalActualCost && wizardData.clientAuthorized) {
                      finalizeTicket.mutate({
                        ticketId: ticketToFinalize.id,
                        completionNotes: completionData.completionNotes || '', // Optional notes
                        actualHours: parseInt(completionData.actualHours),
                        finalActualCost: parseFloat(completionData.finalActualCost),
                        confirmedItemIds: wizardData.confirmedItemIds
                      });
                    }
                  } else {
                    handleWizardNext();
                  }
                }}
                disabled={
                  (wizardStep === 4 && (!wizardData.clientAuthorized || finalizeTicket.isPending)) ||
                  (wizardStep === 1 && (!completionData.actualHours || !completionData.finalActualCost)) ||
                  !canAdvanceWizard()
                }
                className={wizardStep === 4 ? "bg-green-600 hover:bg-green-700" : "bg-[#00FFFF] text-[#0A192F] hover:bg-[#00FFFF]/90"}
                data-testid={wizardStep === 4 ? "button-finalize-ticket" : "button-wizard-next"}
              >
                {wizardStep === 4 
                  ? (finalizeTicket.isPending ? t("finalizing", "Finalizing...") : t("complete", "Complete"))
                  : t("next", "Next")
                }
              </Button>
            </div>
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

            <div className="space-y-2">
              <Label htmlFor="edit-birthday">{t("birthday", "Birthday")}</Label>
              <Input
                id="edit-birthday"
                value={editClientData.birthday}
                onChange={(e) => setEditClientData(prev => ({ ...prev, birthday: e.target.value }))}
                placeholder={t("birthday_placeholder", currentLanguage.code === 'pt-BR' ? 'DD/MM' : 'MM/DD')}
                maxLength={5}
                data-testid="input-edit-birthday"
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
                      phone: editClientData.phone,
                      birthday: editClientData.birthday
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

      {/* Item Selection Dialog */}
      <ItemSelectionDialog
        open={showItemSelectionDialog}
        onOpenChange={setShowItemSelectionDialog}
        availableItems={availableItems}
        isLoadingItems={isLoadingItems}
        searchQuery={itemSearchQuery}
        onSearchQueryChange={setItemSearchQuery}
        onAddItem={handleAddItemToTicket}
        currentLanguage={currentLanguage}
        t={t}
        deviceType={formData.deviceType}
      />
    </TooltipProvider>
  );
}
