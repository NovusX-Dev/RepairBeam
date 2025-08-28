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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Clock, User, DollarSign, Check } from "lucide-react";
import type { Ticket, Client, TicketStatus, TicketPriority } from "@shared/schema";

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
}

type TicketWithClient = Ticket & { client?: Client };

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
  });
  const [formErrors, setFormErrors] = useState<Partial<TicketFormData>>({});
  
  const queryClient = useQueryClient();
  const { t } = useLocalization();
  
  const kanbanColumns = getKanbanColumns(t);
  const ticketSteps = getTicketSteps(t);

  // Fetch tickets with client information
  const { data: tickets = [], isLoading } = useQuery<TicketWithClient[]>({
    queryKey: ["/api/tickets"],
    retry: false,
  });

  // Update ticket status mutation
  const updateTicketStatus = useMutation({
    mutationFn: async ({ ticketId, status }: { ticketId: string; status: TicketStatus }) => {
      return await apiRequest(`/api/tickets/${ticketId}/status`, "PUT", { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tickets"] });
    },
  });

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
  const handleInputChange = (field: keyof TicketFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (formErrors[field]) {
      setFormErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  // Handle next step
  const handleNextStep = () => {
    if (currentStep === 0 && !validateClientInfo()) {
      return;
    }
    if (currentStep < ticketSteps.length - 1) {
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
      });
      setFormErrors({});
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-muted-foreground">{t("loading_tickets", "Loading tickets...")}</div>
      </div>
    );
  }

  return (
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
            </DialogHeader>
            
            {/* Progress Stepper */}
            <div className="py-6">
              <div className="flex items-center justify-between relative">
                {/* Connection Line */}
                <div className="absolute top-4 left-8 right-8 h-0.5 bg-muted-foreground/20 z-0"></div>
                <div 
                  className="absolute top-4 left-8 h-0.5 bg-primary transition-all duration-300 z-0"
                  style={{ width: `${(currentStep / (ticketSteps.length - 1)) * 100}%` }}
                ></div>
                
                {/* Step Indicators */}
                {ticketSteps.map((step, index) => {
                  const Icon = step.icon;
                  const isCompleted = index < currentStep;
                  const isCurrent = index === currentStep;
                  
                  return (
                    <div key={step.id} className="flex flex-col items-center relative z-10">
                      <div className={`
                        w-8 h-8 rounded-full flex items-center justify-center border-2 bg-background
                        ${isCompleted ? 'bg-primary border-primary text-primary-foreground' : 
                          isCurrent ? 'border-primary text-primary' : 'border-muted-foreground/30 text-muted-foreground'}
                      `}>
                        {isCompleted ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <Icon className="w-4 h-4" />
                        )}
                      </div>
                      <div className={`mt-2 text-xs text-center max-w-16 ${
                        isCurrent ? 'text-primary font-medium' : 'text-muted-foreground'
                      }`}>
                        {step.title}
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
                  <h3 className="text-lg font-semibold">{t("client_information", "Client Information")}</h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    {/* First Name */}
                    <div className="space-y-2">
                      <Label htmlFor="firstName">
                        {t("first_name", "First Name")} <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="firstName"
                        value={formData.firstName}
                        onChange={(e) => handleInputChange('firstName', e.target.value)}
                        className={formErrors.firstName ? 'border-red-500' : ''}
                        data-testid="input-first-name"
                      />
                    </div>

                    {/* Last Name */}
                    <div className="space-y-2">
                      <Label htmlFor="lastName">
                        {t("last_name", "Last Name")} <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="lastName"
                        value={formData.lastName}
                        onChange={(e) => handleInputChange('lastName', e.target.value)}
                        className={formErrors.lastName ? 'border-red-500' : ''}
                        data-testid="input-last-name"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* CPF */}
                    <div className="space-y-2">
                      <Label htmlFor="cpf">
                        {t("cpf", "CPF")} <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="cpf"
                        value={formData.cpf}
                        onChange={(e) => handleInputChange('cpf', e.target.value)}
                        placeholder="000.000.000-00"
                        className={formErrors.cpf ? 'border-red-500' : ''}
                        data-testid="input-cpf"
                      />
                    </div>

                    {/* Email */}
                    <div className="space-y-2">
                      <Label htmlFor="email">
                        {t("email", "Email")} <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => handleInputChange('email', e.target.value)}
                        className={formErrors.email ? 'border-red-500' : ''}
                        placeholder={t("email_placeholder", "e.g., joao@exemplo.com")}
                        data-testid="input-email"
                      />
                      {formErrors.email === 'invalid_email_format' && (
                        <div className="text-sm text-red-500" data-testid="error-email-format">
                          {t("email_format_error", "Please enter a valid email address (e.g., name@example.com)")}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Address Fields */}
                  <div className="grid grid-cols-2 gap-4">
                    {/* Street Address */}
                    <div className="space-y-2">
                      <Label htmlFor="streetAddress">
                        {t("street_address", "Street Address")} <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="streetAddress"
                        value={formData.streetAddress}
                        onChange={(e) => handleInputChange('streetAddress', e.target.value)}
                        className={formErrors.streetAddress ? 'border-red-500' : ''}
                        placeholder={t("street_address_placeholder", "e.g., Rua das Flores")}
                        data-testid="input-street-address"
                      />
                    </div>

                    {/* Street Number */}
                    <div className="space-y-2">
                      <Label htmlFor="streetNumber">
                        {t("street_number", "Street Number")} <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="streetNumber"
                        value={formData.streetNumber}
                        onChange={(e) => handleInputChange('streetNumber', e.target.value)}
                        className={formErrors.streetNumber ? 'border-red-500' : ''}
                        placeholder={t("street_number_placeholder", "e.g., 123")}
                        data-testid="input-street-number"
                      />
                    </div>
                  </div>

                  {/* Apartment/Unit */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="apartment">
                        {t("apartment_unit", "Apartment/Unit")} <span className="text-muted-foreground text-sm">({t("complemento", "Complemento")})</span>
                      </Label>
                      <Input
                        id="apartment"
                        value={formData.apartment}
                        onChange={(e) => handleInputChange('apartment', e.target.value)}
                        placeholder={t("apartment_placeholder", "e.g., Apt 4B, Block C")}
                        data-testid="input-apartment"
                      />
                    </div>
                    <div></div>
                  </div>

                  {/* Birthday */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="birthday">
                        {t("birthday", "Birthday")} <span className="text-muted-foreground text-sm">({t("optional", "Optional")})</span>
                      </Label>
                      <Input
                        id="birthday"
                        type="date"
                        value={formData.birthday}
                        onChange={(e) => handleInputChange('birthday', e.target.value)}
                        data-testid="input-birthday"
                      />
                    </div>
                    <div></div>
                  </div>

                  {/* Required Field Legend */}
                  <div className="text-sm text-muted-foreground flex items-center gap-1">
                    <span className="text-red-500">*</span>
                    {t("required_field", "Required field")}
                  </div>
                </div>
              )}

              {/* Other steps - Under Construction */}
              {currentStep > 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <div className="space-y-4">
                    <div className="text-6xl">🚧</div>
                    <h3 className="text-lg font-semibold">{t("under_construction", "Under Construction")}</h3>
                    <p>{t("step_under_development", "This step is currently under development")}</p>
                  </div>
                </div>
              )}
            </div>

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
                    className="btn-next-hover"
                    data-testid="button-next-step"
                  >
                    {t("next", "Next")}
                  </Button>
                ) : (
                  <Button 
                    onClick={() => {/* TODO: Submit ticket */}}
                    className="btn-next-hover"
                    data-testid="button-create-ticket-final"
                  >
                    {t("create_ticket", "Create Ticket")}
                  </Button>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
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
  );
}
