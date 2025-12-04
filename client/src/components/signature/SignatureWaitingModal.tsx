import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useSignatureStatus, resendSignatureRequest, type SignatureStatus } from '@/hooks/useSignatureStatus';
import { Loader2, CheckCircle, XCircle, Clock, RefreshCw, MessageSquare, AlertTriangle } from 'lucide-react';
import { useLocalization } from '@/contexts/LocalizationContext';

interface SignatureWaitingModalProps {
  isOpen: boolean;
  onClose: () => void;
  signatureRequestId: string | null;
  type: 'dropoff' | 'pickup';
  clientName: string;
  onSigned: () => void;
  onCancel?: () => void;
  onManualApproval?: () => void;
}

export default function SignatureWaitingModal({
  isOpen,
  onClose,
  signatureRequestId,
  type,
  clientName,
  onSigned,
  onCancel,
  onManualApproval,
}: SignatureWaitingModalProps) {
  const { currentLanguage } = useLocalization();
  const language = currentLanguage.code;
  const [isResending, setIsResending] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [manualApprovalCountdown, setManualApprovalCountdown] = useState(60);
  const [isManualApprovalEnabled, setIsManualApprovalEnabled] = useState(false);

  const {
    data,
    isPolling,
    startPolling,
    stopPolling,
  } = useSignatureStatus({
    signatureRequestId,
    enabled: isOpen,
    pollingInterval: 5000,
    onSigned: () => {
      onSigned();
    },
  });

  useEffect(() => {
    if (isOpen && signatureRequestId) {
      startPolling();
    } else {
      stopPolling();
    }
  }, [isOpen, signatureRequestId, startPolling, stopPolling]);

  // Reset countdown when modal opens
  useEffect(() => {
    if (isOpen) {
      setManualApprovalCountdown(60);
      setIsManualApprovalEnabled(false);
    }
  }, [isOpen]);

  // Countdown timer for manual approval button
  useEffect(() => {
    if (!isOpen || isManualApprovalEnabled) return;
    
    const timer = setInterval(() => {
      setManualApprovalCountdown((prev) => {
        if (prev <= 1) {
          setIsManualApprovalEnabled(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, isManualApprovalEnabled]);

  const handleResend = async () => {
    if (!signatureRequestId) return;
    
    setIsResending(true);
    setResendError(null);
    setResendSuccess(false);
    
    try {
      await resendSignatureRequest(signatureRequestId, language as 'en' | 'pt-BR');
      setResendSuccess(true);
      setTimeout(() => setResendSuccess(false), 3000);
    } catch (err) {
      setResendError((err as Error).message);
    } finally {
      setIsResending(false);
    }
  };

  const handleCancel = () => {
    stopPolling();
    onCancel?.();
    onClose();
  };

  const handleManualApproval = () => {
    stopPolling();
    onManualApproval?.();
    onClose();
  };

  const getManualApprovalLabel = () => {
    const labels = {
      en: isManualApprovalEnabled 
        ? 'Approve Manually' 
        : `Manual Approval (${manualApprovalCountdown}s)`,
      'pt-BR': isManualApprovalEnabled 
        ? 'Aprovar Manualmente' 
        : `Aprovação Manual (${manualApprovalCountdown}s)`,
    };
    const lang = language === 'pt-BR' ? 'pt-BR' : 'en';
    return labels[lang];
  };

  const getStatusIcon = (status?: SignatureStatus) => {
    switch (status) {
      case 'signed':
        return <CheckCircle className="w-12 h-12 text-green-400" />;
      case 'expired':
        return <Clock className="w-12 h-12 text-amber-400" />;
      case 'failed':
        return <XCircle className="w-12 h-12 text-red-400" />;
      default:
        return <Loader2 className="w-12 h-12 text-cyan-400 animate-spin" />;
    }
  };

  const getStatusMessage = (status?: SignatureStatus) => {
    const messages = {
      en: {
        pending: 'Preparing to send SMS...',
        sent: 'SMS sent! Waiting for signature...',
        signed: 'Signature received!',
        expired: 'The signature link has expired',
        failed: 'Failed to send SMS',
      },
      'pt-BR': {
        pending: 'Preparando para enviar SMS...',
        sent: 'SMS enviado! Aguardando assinatura...',
        signed: 'Assinatura recebida!',
        expired: 'O link de assinatura expirou',
        failed: 'Falha ao enviar SMS',
      },
    };
    
    const lang = language === 'pt-BR' ? 'pt-BR' : 'en';
    return messages[lang][status || 'pending'];
  };

  const getTitle = () => {
    const titles = {
      en: {
        dropoff: 'Waiting for Client Authorization',
        pickup: 'Waiting for Pickup Confirmation',
      },
      'pt-BR': {
        dropoff: 'Aguardando Autorização do Cliente',
        pickup: 'Aguardando Confirmação de Retirada',
      },
    };
    
    const lang = language === 'pt-BR' ? 'pt-BR' : 'en';
    return titles[lang][type];
  };

  const getDescription = () => {
    const descriptions = {
      en: {
        dropoff: `An SMS has been sent to ${clientName} with a link to authorize the repair.`,
        pickup: `An SMS has been sent to ${clientName} with a link to confirm device pickup.`,
      },
      'pt-BR': {
        dropoff: `Um SMS foi enviado para ${clientName} com um link para autorizar o reparo.`,
        pickup: `Um SMS foi enviado para ${clientName} com um link para confirmar a retirada.`,
      },
    };
    
    const lang = language === 'pt-BR' ? 'pt-BR' : 'en';
    return descriptions[lang][type];
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleCancel()}>
      <DialogContent className="sm:max-w-md bg-[#0f1a2e] border-[#1e3a5f]">
        <DialogHeader className="border-b border-[#1e3a5f] pb-4">
          <div className="flex items-center gap-3">
            <MessageSquare className="w-6 h-6 text-cyan-400" />
            <div>
              <DialogTitle className="text-white">{getTitle()}</DialogTitle>
              <DialogDescription className="text-gray-400 mt-1">
                {getDescription()}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="py-8 flex flex-col items-center gap-4">
          {getStatusIcon(data?.status)}
          <p className="text-gray-300 text-center">{getStatusMessage(data?.status)}</p>
          
          {data?.expiresAt && data.status === 'sent' && (
            <p className="text-gray-500 text-sm">
              {language === 'pt-BR' ? 'Expira em:' : 'Expires at:'}{' '}
              {new Date(data.expiresAt).toLocaleTimeString()}
            </p>
          )}

          {resendSuccess && (
            <div className="flex items-center gap-2 text-green-400 text-sm">
              <CheckCircle className="w-4 h-4" />
              <span>{language === 'pt-BR' ? 'SMS reenviado!' : 'SMS resent!'}</span>
            </div>
          )}

          {resendError && (
            <div className="flex items-center gap-2 text-red-400 text-sm">
              <AlertTriangle className="w-4 h-4" />
              <span>{resendError}</span>
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-col gap-3 sm:flex-row sm:gap-2">
          <div className="flex gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              onClick={handleCancel}
              className="flex-1 sm:flex-none border-[#2a3f5f] text-gray-300 hover:bg-[#1a2744]"
              data-testid="button-cancel-signature"
            >
              {language === 'pt-BR' ? 'Cancelar' : 'Cancel'}
            </Button>
            
            {(data?.status === 'sent' || data?.status === 'expired' || data?.status === 'failed') && (
              <Button
                onClick={handleResend}
                disabled={isResending}
                variant="outline"
                className="flex-1 sm:flex-none border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 gap-2"
                data-testid="button-resend-signature"
              >
                {isResending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                {language === 'pt-BR' ? 'Reenviar SMS' : 'Resend SMS'}
              </Button>
            )}
          </div>
          
          {onManualApproval && (
            <Button
              onClick={handleManualApproval}
              disabled={!isManualApprovalEnabled}
              variant="outline"
              className={`w-full sm:w-auto gap-2 transition-all ${
                isManualApprovalEnabled 
                  ? 'border-amber-500/50 text-amber-400 hover:bg-amber-500/10' 
                  : 'border-[#2a3f5f] text-gray-500 cursor-not-allowed opacity-60'
              }`}
              data-testid="button-manual-approval"
            >
              <AlertTriangle className="w-4 h-4" />
              {getManualApprovalLabel()}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
