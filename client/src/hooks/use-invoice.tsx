import { useState, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { pdf } from "@react-pdf/renderer";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocalization } from "@/contexts/LocalizationContext";

export type InvoiceType = "drop_off" | "final";

interface GenerateInvoiceParams {
  ticketId: string;
  type: InvoiceType;
  InvoiceComponent: React.ComponentType<any>;
  invoiceProps: any;
  onLoadingStart?: () => void;
  onLoadingEnd?: () => void;
}

export function useInvoice() {
  const { toast } = useToast();
  const { t } = useLocalization();
  const [isLoadingInvoice, setIsLoadingInvoice] = useState(false);
  const [loadingInvoiceType, setLoadingInvoiceType] = useState<InvoiceType | null>(null);

  const closeLoadingModal = useCallback(() => {
    setIsLoadingInvoice(false);
    setLoadingInvoiceType(null);
  }, []);

  const generateAndPrintInvoice = useMutation({
    mutationFn: async ({ ticketId, type, InvoiceComponent, invoiceProps, onLoadingStart, onLoadingEnd }: GenerateInvoiceParams) => {
      setIsLoadingInvoice(true);
      setLoadingInvoiceType(type);
      onLoadingStart?.();
      
      try {
        // Check if invoice already exists for this ticket/type (for reprinting)
        const existingResponse = await apiRequest("GET", `/api/tickets/${ticketId}/invoices`);
        const existingInvoices = await existingResponse.json();
        
        let invoice;
        const matchingInvoice = existingInvoices.find((inv: any) => inv.type === type);
        
        if (matchingInvoice) {
          // Reprint existing invoice - don't create a new one
          invoice = matchingInvoice;
        } else {
          // Create new invoice record in database
          const createResponse = await apiRequest("POST", "/api/invoices", {
            ticketId,
            type,
          });
          invoice = await createResponse.json();
        }

        // Generate PDF blob
        const blob = await pdf(<InvoiceComponent {...invoiceProps} invoiceNumber={invoice.invoiceNumber} />).toBlob();

        // Create blob URL and trigger print
        const url = URL.createObjectURL(blob);
        const printWindow = window.open(url, '_blank');
        
        if (printWindow) {
          printWindow.addEventListener('load', () => {
            printWindow.print();
          });
        }

        // Close loading modal after successful generation
        setIsLoadingInvoice(false);
        setLoadingInvoiceType(null);
        onLoadingEnd?.();

        return { invoice, url };
      } catch (error) {
        setIsLoadingInvoice(false);
        setLoadingInvoiceType(null);
        onLoadingEnd?.();
        throw error;
      }
    },
    onError: (error) => {
      console.error("Failed to generate invoice:", error);
      setIsLoadingInvoice(false);
      setLoadingInvoiceType(null);
      toast({
        title: t("error", "Error"),
        description: t("invoice_generation_failed", "Failed to generate invoice. Please try again."),
        variant: "destructive",
      });
    },
  });

  const downloadInvoice = async (InvoiceComponent: React.ComponentType<any>, invoiceProps: any, filename: string) => {
    try {
      const blob = await pdf(<InvoiceComponent {...invoiceProps} />).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to download invoice:", error);
      toast({
        title: t("error", "Error"),
        description: t("invoice_download_failed", "Failed to download invoice. Please try again."),
        variant: "destructive",
      });
    }
  };

  return {
    generateAndPrintInvoice,
    downloadInvoice,
    isLoadingInvoice,
    loadingInvoiceType,
    closeLoadingModal,
  };
}
