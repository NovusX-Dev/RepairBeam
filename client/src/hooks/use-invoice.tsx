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
}

export function useInvoice() {
  const { toast } = useToast();
  const { t } = useLocalization();

  const generateAndPrintInvoice = useMutation({
    mutationFn: async ({ ticketId, type, InvoiceComponent, invoiceProps }: GenerateInvoiceParams) => {
      // Create invoice record in database
      const response = await apiRequest("POST", "/api/invoices", {
        ticketId,
        type,
      });
      const invoice = await response.json();

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

      return { invoice, url };
    },
    onError: (error) => {
      console.error("Failed to generate invoice:", error);
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
  };
}
