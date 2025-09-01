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
import { Plus, Clock, User, DollarSign, Check, AlertTriangle, Info, CalendarIcon, Shield, Smartphone } from "lucide-react";
import { format } from "date-fns";
import type { Ticket, Client, TicketStatus, TicketPriority } from "@shared/schema";
import { useDeviceBrands, useValidateBrand, useValidateModel } from "@/hooks/useDeviceBrands";
import { useDeviceColors, useSaveCustomColor } from '@/hooks/useDeviceColors';
import { useDeviceModels } from "@/hooks/useDeviceModels";
import { useToast } from "@/hooks/use-toast";

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
  // Client Authorization
  clientApproved: boolean;
}

type TicketWithClient = Ticket & { client?: Client };

// Currency formatting utility
const formatCurrency = (amount: number, language: string = 'en') => {
  const currency = language === 'pt-BR' ? 'R$' : '$';
  return `${currency}${amount.toFixed(2)}`;
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
  
  // CPF conflict state
  const [showCPFConflict, setShowCPFConflict] = useState(false);
  const [conflictClient, setConflictClient] = useState<Client | null>(null);
  
  const queryClient = useQueryClient();
  const { t, currentLanguage } = useLocalization();
  const { toast } = useToast();

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
    onSuccess: () => {
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
        // Client Authorization defaults
        clientApproved: false,
      });
      setDisplayCPF('');
      setFormErrors({});
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
      phone: null,
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
    const confirmed = window.confirm(
      t("confirm_ticket_creation", "Are you sure you want to create this repair ticket?\n\nThis will:\n• Create a new ticket in the Backlog\n• Lock in the agreed service details and cost\n• Begin the repair process\n\nClient: {clientName}\nDevice: {deviceInfo}\nTotal Cost: ${totalCost}")
        .replace('{clientName}', `${formData.firstName} ${formData.lastName}`)
        .replace('{deviceInfo}', `${formData.deviceType} ${formData.deviceBrand} ${formData.deviceModel}`)
        .replace('{totalCost}', formData.totalCost)
    );

    if (!confirmed) return;

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
        clientId: selectedClient.id,
        title: `${formData.deviceType} ${formData.deviceBrand} ${formData.deviceModel} - ${formData.deviceColor}`,
        description: `Device repair request for ${formData.deviceType} ${formData.deviceBrand} ${formData.deviceModel} in ${formData.deviceColor}`,
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
        warrantyType: formData.warrantyType as 'standard' | 'extended',
        costEstimation: formData.costEstimation || null,
        costExplanation: formData.costExplanation || null,
        // Service Checklist data
        serviceChecklist: {
          components: formData.deviceComponents,
          additionalNotes: formData.additionalNotes
        },
      };
      
      createTicketMutation.mutate(ticketData);
    };
    
    // Execute the ticket creation
    createTicketWithUniqueId();
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
    } else if (currentStep === 1) {
      // Validate device info before proceeding
      if (!validateDeviceInfo()) return;
      setCurrentStep(currentStep + 1);
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
              )}

              {/* Issue Assessment Step */}
              {currentStep === 2 && (
                <div className="space-y-6">
                  <IssueAssessment 
                    deviceType={formData.deviceType}
                    onComplete={() => {
                      // Auto-proceed to next step after completion
                      setCurrentStep(currentStep + 1);
                    }}
                  />
                </div>
              )}

              {/* Service Timeline & Coverage Step */}
              {currentStep === 3 && (
                <div className="space-y-6">
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
                                ? format(new Date(formData.clientDeadline), "PPP")
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
              )}

              {/* Price Estimation Step */}
              {currentStep === 4 && (
                <div className="space-y-6">
                  <div className="text-center">
                    <h3 className="text-xl font-semibold text-primary mb-2">
                      {t("price_estimation_title", "Price Estimation")}
                    </h3>
                    <p className="text-muted-foreground">
                      {t("price_estimation_desc", "Provide cost estimates and breakdown for this repair")}
                    </p>
                  </div>
                  
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
              )}

              {/* Service Checklist Step */}
              {currentStep === 5 && (
                <div className="space-y-6">
                  <div className="text-center mb-6">
                    <h3 className="text-xl font-semibold text-[#00FFFF] mb-2">{t("service_checklist", "Service Checklist")}</h3>
                    <p className="text-muted-foreground">
                      {t("checklist_description", "Document the current condition of each component to ensure accountability when returning the device to the client.")}
                    </p>
                  </div>

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
                              {component.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
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
              )}

              {/* Client Authorization Step */}
              {currentStep === 6 && (
                <div className="space-y-6">
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
                          <p className="text-white font-medium">{formData.firstName} {formData.lastName}</p>
                        </div>
                        <div>
                          <span className="text-sm text-muted-foreground">{t("cpf", "CPF")}:</span>
                          <p className="text-white font-medium">{displayCPF}</p>
                        </div>
                        <div>
                          <span className="text-sm text-muted-foreground">{t("email", "Email")}:</span>
                          <p className="text-white font-medium">{formData.email}</p>
                        </div>
                        <div>
                          <span className="text-sm text-muted-foreground">{t("address", "Address")}:</span>
                          <p className="text-white font-medium">
                            {formData.streetAddress}, {formData.streetNumber}
                            {formData.apartment && `, ${formData.apartment}`}
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
                          <p className="text-white font-medium">{formData.deviceColor || 'N/A'}</p>
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
                          <p className="text-white font-medium">${formData.costEstimation}</p>
                        </div>
                        <div>
                          <span className="text-sm text-muted-foreground">{t("warranty_type", "Warranty")}:</span>
                          <p className="text-white font-medium">
                            {formData.warrantyType === 'extended' 
                              ? `${t("extended_warranty", "Extended")} (+$${formData.warrantyCost})`
                              : t("standard_warranty", "Standard (Free)")
                            }
                          </p>
                        </div>
                        <div>
                          <span className="text-sm text-muted-foreground">{t("total_cost", "Total Cost")}:</span>
                          <p className="text-2xl font-bold text-[#00FFFF]">${formData.totalCost}</p>
                        </div>
                        <div>
                          <span className="text-sm text-muted-foreground">{t("estimated_hours", "Est. Hours")}:</span>
                          <p className="text-white font-medium">{formData.technicianEstimatedHours}h</p>
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
