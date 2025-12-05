import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, X, FileText } from "lucide-react";
import { useLocalization } from "@/contexts/LocalizationContext";

interface InvoiceLoadingModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'drop_off' | 'final';
}

export function InvoiceLoadingModal({ isOpen, onClose, type }: InvoiceLoadingModalProps) {
  const { t } = useLocalization();
  
  const title = type === 'drop_off' 
    ? t("generating_dropoff_receipt", "Generating Drop-Off Receipt")
    : t("generating_final_invoice", "Generating Final Invoice");
    
  const description = t("invoice_loading_description", "Please wait while we prepare your document. This may take a few moments.");

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent 
        className="sm:max-w-md bg-gradient-to-br from-[#0A1628] to-[#1a2942] border-cyan-500/30"
        data-testid="modal-invoice-loading"
      >
        <DialogHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-cyan-500/20 border border-cyan-500/30">
            <FileText className="h-8 w-8 text-cyan-400 animate-pulse" />
          </div>
          <DialogTitle className="text-xl font-semibold text-white text-center">
            {title}
          </DialogTitle>
          <DialogDescription className="text-cyan-100/70 text-center mt-2">
            {description}
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-col items-center justify-center py-6 space-y-4">
          <div className="relative">
            <Loader2 className="h-12 w-12 text-cyan-400 animate-spin" />
            <div className="absolute inset-0 h-12 w-12 rounded-full border-2 border-cyan-500/20 animate-pulse" />
          </div>
          <p className="text-sm text-cyan-100/60">
            {t("please_wait", "Please wait...")}
          </p>
        </div>

        <div className="flex justify-center pt-2">
          <Button 
            variant="outline" 
            onClick={onClose}
            className="border-cyan-500/30 text-cyan-100 hover:bg-cyan-500/10 hover:border-cyan-400/50"
            data-testid="button-close-invoice-loading"
          >
            <X className="h-4 w-4 mr-2" />
            {t("close", "Close")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
