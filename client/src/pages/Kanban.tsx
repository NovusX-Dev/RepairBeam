import { useState, useEffect } from "react";
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
import { Plus, Clock, User, DollarSign, Check, AlertTriangle, Info } from "lucide-react";
import type { Ticket, Client, TicketStatus, TicketPriority } from "@shared/schema";
import { useDeviceBrands, useValidateBrand } from "@/hooks/useDeviceBrands";

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
  { id: 'service_checklist', title: t('service_checklist', 'Service Checklist'), icon: Check },
  { id: 'time_estimation', title: t('time_estimation', 'Time Estimation'), icon: Clock },
  { id: 'warranty_verification', title: t('warranty_verification', 'Warranty Verification'), icon: User },
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
  // Device Information
  deviceType: string;
  deviceBrand: string;
  deviceModel: string;
  serialNumber: string;
}

type TicketWithClient = Ticket & { client?: Client };

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
                sideOffset={5}
                alignOffset={0}
                avoidCollisions={true}
                sticky="always"
                className="max-w-xs bg-[#0A192F] border-[#00FFFF] text-white shadow-lg shadow-[#00FFFF]/20 z-50 animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
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
    deviceType: '',
    deviceBrand: '',
    deviceModel: '',
    serialNumber: '',
  });
  const [displayCPF, setDisplayCPF] = useState('');
  const [formErrors, setFormErrors] = useState<Partial<TicketFormData>>({});
  const [fieldValidation, setFieldValidation] = useState<Record<string, { isValid: boolean; hasError: boolean }>>({});
  
  // Client search state
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showClientForm, setShowClientForm] = useState(false);
  
  // CPF conflict state
  const [showCPFConflict, setShowCPFConflict] = useState(false);
  const [conflictClient, setConflictClient] = useState<Client | null>(null);
  
  const queryClient = useQueryClient();
  const { t, currentLanguage } = useLocalization();
  
  const kanbanColumns = getKanbanColumns(t);
  const ticketSteps = getTicketSteps(t);

  // Fetch tickets with client information
  const { data: tickets = [], isLoading } = useQuery<TicketWithClient[]>({
    queryKey: ["/api/tickets"],
    retry: false,
  });

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

  // Brand validation hook
  const { validateBrand } = useValidateBrand();

  // Update ticket status mutation
  const updateTicketStatus = useMutation({
    mutationFn: async ({ ticketId, status }: { ticketId: string; status: TicketStatus }) => {
      return await apiRequest("PUT", `/api/tickets/${ticketId}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tickets"] });
    },
  });

  // Create client mutation
  const createClientMutation = useMutation({
    mutationFn: async (clientData: Omit<Client, 'id' | 'createdAt' | 'updatedAt' | 'tenantId'>) => {
      return await apiRequest("POST", "/api/clients", clientData) as Client;
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
        deviceType: '',
        deviceBrand: '',
        deviceModel: '',
        serialNumber: '',
      });
      setDisplayCPF('');
      setFormErrors({});
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

  // Group tickets by status
  const ticketsByStatus = kanbanColumns.reduce((acc, column) => {
    acc[column.id] = tickets.filter(ticket => ticket.status === column.id);
    return acc;
  }, {} as Record<string, TicketWithClient[]>);

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, ticketId: string) => {
    setDraggedTicket(ticketId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
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
  };

  const getPriorityColor = (priority: TicketPriority) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
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
      case 'serialNumber':
        isValid = value.trim().length > 0;
        break;
      default:
        isValid = value.length > 0;
    }
    
    return isValid;
  };
  
  const handleInputChange = (field: keyof TicketFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear error when user starts typing
    if (formErrors[field]) {
      setFormErrors(prev => ({ ...prev, [field]: undefined }));
    }
    
    // Real-time validation for micro-interactions
    const isValid = validateField(field, value);
    setFieldValidation(prev => ({
      ...prev,
      [field]: { isValid, hasError: false }
    }));
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
      phone: null,
      streetAddress: formData.streetAddress,
      streetNumber: formData.streetNumber,
      apartment: formData.apartment || null,
      birthday: formData.birthday || null,
      notes: null,
    };
    
    createClientMutation.mutate(clientData);
  };

  // Handle next step
  const handleNextStep = () => {
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
    } else if (currentStep < ticketSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  // Handle previous step
  const handlePreviousStep = () => {
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
        deviceType: '',
        deviceBrand: '',
        deviceModel: '',
        serialNumber: '',
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
    <div className="h-full w-full flex flex-col overflow-hidden">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6 flex-shrink-0">
        <div>
          <h1 className="text-3xl font-bold text-foreground" data-testid="text-kanban-title">
            {t("kanban_board", "Kanban Board")}
          </h1>
          <p className="text-muted-foreground">
            {t("kanban_description", "Manage and track repair tickets through your workflow stages")}
          </p>
        </div>
        <div className="p-2">
          <Dialog open={isTicketDialogOpen} onOpenChange={handleDialogChange}>
            <DialogTrigger asChild>
              <Button className="btn-next-hover" data-testid="button-create-ticket">
                <Plus className="w-4 h-4 mr-2" />
                {t("new_ticket", "New Ticket")}
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t("create_new_ticket", "Create New Ticket")}</DialogTitle>
              <DialogDescription>
                {t("create_ticket_description", "Follow the steps to create a new repair ticket for your client.")}
              </DialogDescription>
            </DialogHeader>
            
            {/* Gamified Progress Stepper */}
            <div className="py-6">
              {/* Progress Percentage Display with Motivational Messages */}
              <div className="mb-6 text-center space-y-3">
                <div className="inline-flex items-center gap-3">
                  <div className="text-2xl font-bold text-white bg-transparent" style={{color: '#ffffff'}}>
                    {Math.round((currentStep / (ticketSteps.length - 1)) * 100)}%
                  </div>
                  <div className="text-sm text-muted-foreground">
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
            <div className="py-6">
              {currentStep === 0 && (
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold">
                    {showClientForm ? t("add_new_client", "Add New Client") : t("client_search", "Find Client")}
                  </h3>
                  
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
                    <div className="border rounded-lg p-4 bg-green-50 border-green-200">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h4 className="font-semibold text-green-800">
                            {t("selected_client", "Selected Client")}
                          </h4>
                          <div className="mt-2 space-y-1 text-green-700">
                            <div className="font-medium">
                              {selectedClient.firstName} {selectedClient.lastName}
                            </div>
                            {selectedClient.cpf && (
                              <div>CPF: {selectedClient.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")}</div>
                            )}
                            {selectedClient.email && <div>{selectedClient.email}</div>}
                            {selectedClient.streetAddress && selectedClient.streetNumber && (
                              <div>{selectedClient.streetAddress}, {selectedClient.streetNumber}</div>
                            )}
                          </div>
                        </div>
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
              )}

              {/* Device Specifications Step */}
              {currentStep === 1 && (
                <div className="space-y-6">
                  <div className="text-center pb-6 border-b border-border">
                    <h3 className="text-xl font-semibold text-foreground mb-2">
                      {ticketSteps[1].title}
                    </h3>
                    <p className="text-muted-foreground">
                      {t("device_specs_description", "Enter details about the device that needs repair")}
                    </p>
                  </div>
                  
                  {/* Device Type Selection - Primary Field */}
                  <div className="mb-8">
                    <Label htmlFor="deviceType" className="text-base font-medium">
                      {t("device_type", "Device Type")} *
                    </Label>
                    <Select
                      value={formData.deviceType}
                      onValueChange={(value) => handleInputChange('deviceType', value)}
                      data-testid="select-device-type"
                    >
                      <SelectTrigger className={`mt-2 ${formErrors.deviceType ? 'border-red-500' : ''}`}>
                        <SelectValue placeholder={t("select_device_type", "Select device type...")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Phone">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">📱</span>
                            {t("device_type_phone", "Phone")}
                          </div>
                        </SelectItem>
                        <SelectItem value="Laptop">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">💻</span>
                            {t("device_type_laptop", "Laptop")}
                          </div>
                        </SelectItem>
                        <SelectItem value="Desktop">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">🖥️</span>
                            {t("device_type_desktop", "Desktop")}
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    {formErrors.deviceType && (
                      <div className="text-sm text-red-500 mt-1">
                        {t("device_type_required", "Please select a device type")}
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
                            onValueChange={(value) => handleInputChange('deviceBrand', value)}
                            onCustomValue={async (brandName) => {
                              try {
                                console.log(`💰 Validating custom brand: ${brandName}`);
                                const result = await validateBrand(formData.deviceType, brandName);
                                
                                if (result.correctedName) {
                                  handleInputChange('deviceBrand', result.correctedName);
                                  if (result.added) {
                                    // Optionally refresh the brand list to include the new brand
                                    console.log(`✅ Added new brand: ${result.correctedName}`);
                                  }
                                } else {
                                  // Still allow the user to use the brand even if validation failed
                                  handleInputChange('deviceBrand', brandName);
                                }
                              } catch (error) {
                                console.error('Brand validation failed:', error);
                                // Allow user to proceed even if validation fails
                                handleInputChange('deviceBrand', brandName);
                              }
                            }}
                            data-testid="select-device-brand"
                          />
                        </FormFieldWithTooltip>
                        
                        <FormFieldWithTooltip
                          label={t("device_model", "Model")}
                          tooltip={t("device_model_tooltip", "Enter the specific model number or name of the device. Be as specific as possible (e.g., iPhone 13 Pro, Galaxy S21 Ultra, MacBook Pro 16-inch). This helps with accurate parts identification and repair procedures.")}
                          required
                          hasError={!!formErrors.deviceModel}
                          isValid={fieldValidation.deviceModel?.isValid && formData.deviceModel.length > 0}
                        >
                          <Input
                            id="deviceModel"
                            value={formData.deviceModel || ''}
                            onChange={(e) => handleInputChange('deviceModel', e.target.value)}
                            placeholder={t("device_model_placeholder", "e.g., iPhone 13, Galaxy S21")}
                            data-testid="input-device-model"
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
              )}

              {/* Other steps - Under Construction */}
              {currentStep > 1 && (
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
                    {`${currentStep} of ${ticketSteps.length} steps completed`}
                  </span>
                </div>
              </div>
            )}
            
            {/* Navigation Buttons */}
            <div className="flex justify-between pt-6 border-t">
              <Button 
                variant="outline" 
                onClick={handlePreviousStep}
                disabled={currentStep === 0}
                data-testid="button-previous-step"
              >
                {t("previous", "Previous")}
              </Button>
              
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => handleDialogChange(false)}
                  data-testid="button-cancel"
                >
                  {t("cancel", "Cancel")}
                </Button>
                
                {currentStep < ticketSteps.length - 1 ? (
                  <Button 
                    onClick={handleNextStep}
                    disabled={currentStep === 0 && !selectedClient && !showClientForm}
                    className="btn-next-hover relative overflow-hidden group"
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
                    onClick={() => {/* TODO: Submit ticket */}}
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

      {/* Kanban Board Container - Constrained to parent width */}
      <div className="flex-1 min-h-0 w-full overflow-hidden">
        <div 
          className="h-full w-full overflow-x-auto overflow-y-hidden border border-border rounded-lg bg-muted/20"
        >
          <div className="flex gap-4 p-4 h-full" style={{ width: 'fit-content' }}>
          {kanbanColumns.map((column) => (
            <div
              key={column.id}
              className={`w-80 ${column.color} rounded-lg p-4 flex flex-col flex-shrink-0`}
              style={{ height: 'calc(100% - 0.5rem)' }}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, column.id as TicketStatus)}
              data-testid={`column-${column.id}`}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-800">{column.title}</h3>
                <Badge variant="secondary" className="bg-white/80">
                  {ticketsByStatus[column.id]?.length || 0}
                </Badge>
              </div>

              {/* Tickets */}
              <div className="flex-1 space-y-3 min-h-[200px]">
                {ticketsByStatus[column.id]?.map((ticket) => (
                  <Card
                    key={ticket.id}
                    className="cursor-move hover:shadow-md transition-shadow bg-white border border-gray-200"
                    draggable
                    onDragStart={(e) => handleDragStart(e, ticket.id)}
                    data-testid={`ticket-${ticket.id}`}
                  >
                    <CardContent className="p-4">
                      {/* Priority indicator */}
                      <div className="flex items-center justify-between mb-2">
                        <div
                          className={`w-3 h-3 rounded-full ${getPriorityColor(ticket.priority as TicketPriority)}`}
                          title={`${t("priority", "Priority")}: ${ticket.priority}`}
                        ></div>
                        <span className="text-xs text-muted-foreground">
                          #{ticket.id.slice(-6).toUpperCase()}
                        </span>
                      </div>

                      {/* Ticket title */}
                      <h4 className="font-medium text-sm mb-2 line-clamp-2">
                        {ticket.title}
                      </h4>

                      {/* Device info */}
                      {(ticket.deviceType || ticket.deviceModel) && (
                        <p className="text-xs text-muted-foreground mb-2">
                          {[ticket.deviceType, ticket.deviceModel].filter(Boolean).join(' - ')}
                        </p>
                      )}

                      {/* Client info */}
                      {ticket.client && (
                        <div className="flex items-center text-xs text-muted-foreground mb-2">
                          <User className="w-3 h-3 mr-1" />
                          {ticket.client.firstName} {ticket.client.lastName}
                        </div>
                      )}

                      {/* Cost info */}
                      {ticket.estimatedCost && (
                        <div className="flex items-center text-xs text-muted-foreground mb-2">
                          <DollarSign className="w-3 h-3 mr-1" />
                          {t("estimated_cost_abbrev", "Est")}: ${ticket.estimatedCost}
                        </div>
                      )}

                      {/* Created date */}
                      <div className="flex items-center text-xs text-muted-foreground">
                        <Clock className="w-3 h-3 mr-1" />
                        {new Date(ticket.createdAt!).toLocaleDateString()}
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {/* Empty state */}
                {(!ticketsByStatus[column.id] || ticketsByStatus[column.id].length === 0) && (
                  <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
                    {t("no_tickets_stage", "No tickets in this stage")}
                  </div>
                )}
              </div>
            </div>
          ))}
          </div>
        </div>
      </div>
    </div>
    </TooltipProvider>
  );
}
