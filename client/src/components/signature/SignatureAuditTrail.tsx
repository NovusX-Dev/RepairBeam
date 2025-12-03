import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocalization } from '@/contexts/LocalizationContext';
import { 
  MessageSquare, 
  ExternalLink, 
  PenTool, 
  CheckCircle, 
  XCircle, 
  RefreshCw,
  Clock,
  AlertTriangle,
  Smartphone,
  Monitor,
  Globe,
  MapPin,
  ChevronDown,
  ChevronUp,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { format } from 'date-fns';

interface SignatureAuditEvent {
  id: string;
  signatureRequestId: string;
  tenantId: string;
  eventType: string;
  ipAddress: string | null;
  userAgent: string | null;
  deviceMeta: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  occurredAt: string;
  createdAt: string;
}

interface SignatureAuditTrailProps {
  signatureRequestId: string;
  className?: string;
}

const eventTypeConfig: Record<string, { 
  icon: typeof MessageSquare; 
  colorClass: string; 
  labelKey: string;
}> = {
  sms_sent: { 
    icon: MessageSquare, 
    colorClass: 'text-blue-500 bg-blue-500/10', 
    labelKey: 'audit.events.smsSent' 
  },
  sms_failed: { 
    icon: XCircle, 
    colorClass: 'text-red-500 bg-red-500/10', 
    labelKey: 'audit.events.smsFailed' 
  },
  sms_resent: { 
    icon: RefreshCw, 
    colorClass: 'text-orange-500 bg-orange-500/10', 
    labelKey: 'audit.events.smsResent' 
  },
  link_opened: { 
    icon: ExternalLink, 
    colorClass: 'text-purple-500 bg-purple-500/10', 
    labelKey: 'audit.events.linkOpened' 
  },
  signature_started: { 
    icon: PenTool, 
    colorClass: 'text-cyan-500 bg-cyan-500/10', 
    labelKey: 'audit.events.signatureStarted' 
  },
  signature_completed: { 
    icon: CheckCircle, 
    colorClass: 'text-green-500 bg-green-500/10', 
    labelKey: 'audit.events.signatureCompleted' 
  },
  signature_expired: { 
    icon: Clock, 
    colorClass: 'text-gray-500 bg-gray-500/10', 
    labelKey: 'audit.events.signatureExpired' 
  },
  signature_cancelled: { 
    icon: AlertTriangle, 
    colorClass: 'text-yellow-500 bg-yellow-500/10', 
    labelKey: 'audit.events.signatureCancelled' 
  },
};

function parseUserAgent(userAgent: string | null): { browser: string; platform: string } {
  if (!userAgent) return { browser: 'Unknown', platform: 'Unknown' };
  
  let browser = 'Unknown';
  let platform = 'Unknown';
  
  if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) browser = 'Chrome';
  else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) browser = 'Safari';
  else if (userAgent.includes('Firefox')) browser = 'Firefox';
  else if (userAgent.includes('Edg')) browser = 'Edge';
  else if (userAgent.includes('MSIE') || userAgent.includes('Trident')) browser = 'IE';
  
  if (userAgent.includes('Windows')) platform = 'Windows';
  else if (userAgent.includes('Mac OS')) platform = 'macOS';
  else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) platform = 'iOS';
  else if (userAgent.includes('Android')) platform = 'Android';
  else if (userAgent.includes('Linux')) platform = 'Linux';
  
  return { browser, platform };
}

function DeviceInfo({ event }: { event: SignatureAuditEvent }) {
  const { t } = useLocalization();
  const [isOpen, setIsOpen] = useState(false);
  const { browser, platform } = parseUserAgent(event.userAgent);
  const deviceMeta = event.deviceMeta || {};
  
  const isMobile = deviceMeta.touchSupport || 
    (event.userAgent?.toLowerCase().includes('mobile')) ||
    (event.userAgent?.toLowerCase().includes('android')) ||
    (event.userAgent?.toLowerCase().includes('iphone'));

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
          data-testid={`btn-device-info-${event.id}`}
        >
          {isMobile ? <Smartphone className="h-3 w-3 mr-1" /> : <Monitor className="h-3 w-3 mr-1" />}
          {browser} / {platform}
          {isOpen ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 pl-4 border-l-2 border-border/50 text-xs space-y-1 text-muted-foreground">
        {event.ipAddress && (
          <div className="flex items-center gap-1">
            <Globe className="h-3 w-3" />
            <span>{t('audit_device_ip', 'IP Address')}:</span>
            <code className="bg-muted px-1 rounded">{event.ipAddress}</code>
          </div>
        )}
        {deviceMeta.timezone && (
          <div className="flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            <span>{t('audit_device_timezone', 'Timezone')}:</span>
            <span>{String(deviceMeta.timezone)}</span>
          </div>
        )}
        {deviceMeta.screenWidth && deviceMeta.screenHeight && (
          <div className="flex items-center gap-1">
            <Monitor className="h-3 w-3" />
            <span>{t('audit_device_screen', 'Screen')}:</span>
            <span>{String(deviceMeta.screenWidth)}x{String(deviceMeta.screenHeight)}</span>
          </div>
        )}
        {deviceMeta.language && (
          <div className="flex items-center gap-1">
            <Globe className="h-3 w-3" />
            <span>{t('audit_device_language', 'Language')}:</span>
            <span>{String(deviceMeta.language)}</span>
          </div>
        )}
        {event.userAgent && (
          <div className="text-[10px] opacity-70 break-all mt-2">
            {event.userAgent}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

const eventTypeLabels: Record<string, { en: string; 'pt-BR': string }> = {
  sms_sent: { en: 'SMS Sent', 'pt-BR': 'SMS Enviado' },
  sms_failed: { en: 'SMS Failed', 'pt-BR': 'Falha no SMS' },
  sms_resent: { en: 'SMS Resent', 'pt-BR': 'SMS Reenviado' },
  link_opened: { en: 'Link Opened', 'pt-BR': 'Link Aberto' },
  signature_started: { en: 'Signature Started', 'pt-BR': 'Assinatura Iniciada' },
  signature_completed: { en: 'Signature Completed', 'pt-BR': 'Assinatura Concluída' },
  signature_expired: { en: 'Signature Expired', 'pt-BR': 'Assinatura Expirada' },
  signature_cancelled: { en: 'Signature Cancelled', 'pt-BR': 'Assinatura Cancelada' },
  unknown: { en: 'Unknown Event', 'pt-BR': 'Evento Desconhecido' },
};

function AuditEventItem({ event }: { event: SignatureAuditEvent }) {
  const { currentLanguage } = useLocalization();
  const config = eventTypeConfig[event.eventType] || {
    icon: AlertTriangle,
    colorClass: 'text-gray-500 bg-gray-500/10',
    labelKey: 'unknown',
  };
  
  const Icon = config.icon;
  const eventDate = new Date(event.occurredAt);
  const formattedDate = format(eventDate, 'MMM d, yyyy');
  const formattedTime = format(eventDate, 'HH:mm:ss');
  
  const lang = currentLanguage.code as 'en' | 'pt-BR';
  const eventLabel = eventTypeLabels[event.eventType]?.[lang] || eventTypeLabels.unknown[lang];

  return (
    <div 
      className="flex items-start gap-3 py-3 border-b border-border/50 last:border-0"
      data-testid={`audit-event-${event.id}`}
    >
      <div className={`flex-shrink-0 p-2 rounded-full ${config.colorClass}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-grow min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium text-sm">
            {eventLabel}
          </span>
          <Badge variant="outline" className="text-[10px] px-1.5">
            {formattedTime}
          </Badge>
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">
          {formattedDate}
        </div>
        {(event.ipAddress || event.userAgent || event.deviceMeta) && (
          <div className="mt-2">
            <DeviceInfo event={event} />
          </div>
        )}
        {event.metadata && Object.keys(event.metadata).length > 0 && (
          <div className="mt-2 text-xs bg-muted/50 p-2 rounded">
            {event.metadata.error && (
              <div className="text-red-500">
                {currentLanguage.code === 'pt-BR' ? 'Erro' : 'Error'}: {String(event.metadata.error)}
              </div>
            )}
            {event.metadata.detectedVia && (
              <div className="text-muted-foreground">
                {currentLanguage.code === 'pt-BR' ? 'Detectado via' : 'Detected via'}: {String(event.metadata.detectedVia)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function SignatureAuditTrail({ signatureRequestId, className = '' }: SignatureAuditTrailProps) {
  const { t, currentLanguage } = useLocalization();
  
  const { data: events, isLoading, error } = useQuery<SignatureAuditEvent[]>({
    queryKey: ['/api/signature-requests', signatureRequestId, 'audit'],
    queryFn: async () => {
      const response = await fetch(`/api/signature-requests/${signatureRequestId}/audit`);
      if (!response.ok) {
        throw new Error('Failed to load audit trail');
      }
      return response.json();
    },
    enabled: !!signatureRequestId,
  });

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center py-8 ${className}`} data-testid="audit-trail-loading">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">{t('loading', 'Loading...')}</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`text-center py-8 text-muted-foreground ${className}`} data-testid="audit-trail-error">
        <AlertTriangle className="h-5 w-5 mx-auto mb-2 text-yellow-500" />
        <p className="text-sm">{currentLanguage.code === 'pt-BR' ? 'Erro ao carregar trilha de auditoria' : 'Failed to load audit trail'}</p>
      </div>
    );
  }

  if (!events || events.length === 0) {
    return (
      <div className={`text-center py-8 text-muted-foreground ${className}`} data-testid="audit-trail-empty">
        <Clock className="h-5 w-5 mx-auto mb-2 opacity-50" />
        <p className="text-sm">{currentLanguage.code === 'pt-BR' ? 'Nenhum evento registrado' : 'No events recorded'}</p>
      </div>
    );
  }

  return (
    <div className={`${className}`} data-testid="signature-audit-trail">
      <div className="space-y-0">
        {events.map((event) => (
          <AuditEventItem key={event.id} event={event} />
        ))}
      </div>
    </div>
  );
}
