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

        // Create blob URL
        const url = URL.createObjectURL(blob);
        
        // Use iframe-based printing to avoid popup blockers
        // This works because iframes are part of the document and don't trigger popup blocking
        let printSuccessful = false;
        
        try {
          // Create a hidden iframe for printing
          const iframe = document.createElement('iframe');
          iframe.style.position = 'fixed';
          iframe.style.right = '0';
          iframe.style.bottom = '0';
          iframe.style.width = '0';
          iframe.style.height = '0';
          iframe.style.border = 'none';
          iframe.style.visibility = 'hidden';
          iframe.src = url;
          
          document.body.appendChild(iframe);
          
          // Wait for iframe to load then print
          await new Promise<void>((resolve, reject) => {
            const timeoutId = setTimeout(() => {
              reject(new Error('Print timeout'));
            }, 10000); // 10 second timeout
            
            iframe.onload = () => {
              clearTimeout(timeoutId);
              try {
                if (iframe.contentWindow) {
                  // Small delay to ensure PDF is fully rendered
                  setTimeout(() => {
                    try {
                      iframe.contentWindow?.focus();
                      iframe.contentWindow?.print();
                      printSuccessful = true;
                      resolve();
                    } catch (printError) {
                      console.error('Print error:', printError);
                      reject(printError);
                    }
                  }, 500);
                } else {
                  reject(new Error('No content window'));
                }
              } catch (error) {
                reject(error);
              }
            };
            
            iframe.onerror = () => {
              clearTimeout(timeoutId);
              reject(new Error('Failed to load PDF'));
            };
          });
          
          // Clean up iframe after a delay (user may still be printing)
          setTimeout(() => {
            if (document.body.contains(iframe)) {
              document.body.removeChild(iframe);
            }
            URL.revokeObjectURL(url);
          }, 60000); // Keep for 60 seconds for printing
          
        } catch (iframeError) {
          console.warn('Iframe printing failed, trying window.open fallback:', iframeError);
          
          // Fallback to window.open (may be blocked but worth trying)
          const printWindow = window.open(url, '_blank');
          
          if (printWindow) {
            printWindow.addEventListener('load', () => {
              printWindow.print();
            });
            printSuccessful = true;
          } else {
            // Both methods failed - notify user with download option
            console.warn('Both printing methods failed, showing download option');
            
            // Create a download link as fallback
            const downloadLink = document.createElement('a');
            downloadLink.href = url;
            downloadLink.download = `invoice-${invoice.invoiceNumber}.pdf`;
            
            toast({
              title: t("print_blocked", "Print Dialog Blocked"),
              description: t("print_blocked_download", "Your browser blocked the print dialog. Click the download button below to save the invoice."),
              variant: "default",
              duration: 10000,
              action: (
                <button
                  onClick={() => downloadLink.click()}
                  className="bg-[#00FFFF] text-[#0A192F] px-3 py-1.5 rounded text-sm font-medium hover:bg-[#00FFFF]/80"
                >
                  {t("download", "Download")}
                </button>
              ),
            });
          }
        }

        // Close loading modal after generation attempt
        setIsLoadingInvoice(false);
        setLoadingInvoiceType(null);
        onLoadingEnd?.();

        return { invoice, url, printSuccessful };
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
