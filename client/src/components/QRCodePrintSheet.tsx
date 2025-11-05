import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, X } from "lucide-react";
import { useLocalization } from "@/contexts/LocalizationContext";

interface InventoryUnit {
  id: string;
  uniqueTag: string;
  inventoryItem?: {
    name: string;
  };
}

interface QRCodePrintSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  units: InventoryUnit[];
  purchaseOrderId?: string;
  receivedDate?: string;
}

export default function QRCodePrintSheet({
  open,
  onOpenChange,
  units,
  purchaseOrderId,
  receivedDate,
}: QRCodePrintSheetProps) {
  const { t, formatDate } = useLocalization();
  const [qrCodes, setQrCodes] = useState<{ [key: string]: string }>({});
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && units.length > 0) {
      generateQRCodes();
    }
  }, [open, units]);

  const generateQRCodes = async () => {
    const codes: { [key: string]: string } = {};
    
    for (const unit of units) {
      try {
        const qrCodeDataURL = await QRCode.toDataURL(unit.uniqueTag, {
          width: 200,
          margin: 1,
          color: {
            dark: '#000000',
            light: '#FFFFFF',
          },
        });
        codes[unit.id] = qrCodeDataURL;
      } catch (error) {
        console.error(`Error generating QR code for unit ${unit.uniqueTag}:`, error);
      }
    }
    
    setQrCodes(codes);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-6xl max-h-[90vh] overflow-y-auto">
        {/* Aurora Gradient Header */}
        <div className="bg-gradient-to-r from-[#0A192F] to-[#00FFFF] px-6 py-4 -mx-6 -mt-6 mb-4 no-print">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-white flex items-center gap-3">
              <Printer className="w-5 h-5" />
              {t("qr_code_print_sheet", "QR Code Print Sheet")}
            </DialogTitle>
          </DialogHeader>
        </div>

        {/* Preview Information */}
        <div className="mb-4 p-4 bg-slate-800/50 rounded-lg border border-cyan-500/20 no-print">
          <h3 className="font-semibold text-cyan-400 mb-2">
            {t("qr_codes_for_units", "QR Codes for Inventory Units")}
          </h3>
          <div className="text-sm text-muted-foreground space-y-1">
            {purchaseOrderId && (
              <p>
                <strong>{t("purchase_order", "Purchase Order")}:</strong> {purchaseOrderId}
              </p>
            )}
            {receivedDate && (
              <p>
                <strong>{t("received_on", "Received on")}:</strong> {formatDate(receivedDate)}
              </p>
            )}
            <p>
              <strong>{t("total_units", "Total Units")}:</strong> {units.length}
            </p>
          </div>
        </div>

        {/* Print Content */}
        <div ref={printRef} className="print-content">
          {/* Print Header (only visible when printing) */}
          <div className="print-only mb-6 pb-4 border-b border-gray-300">
            <h1 className="text-2xl font-bold mb-2">{t("qr_codes_for_units", "QR Codes for Inventory Units")}</h1>
            {purchaseOrderId && (
              <p className="text-sm">
                <strong>{t("purchase_order", "Purchase Order")}:</strong> {purchaseOrderId}
              </p>
            )}
            {receivedDate && (
              <p className="text-sm">
                <strong>{t("received_on", "Received on")}:</strong> {formatDate(receivedDate)}
              </p>
            )}
          </div>

          {/* QR Code Grid */}
          <div className="qr-grid">
            {units.map((unit) => (
              <div key={unit.id} className="qr-item">
                <div className="qr-container">
                  {qrCodes[unit.id] && (
                    <img
                      src={qrCodes[unit.id]}
                      alt={`QR Code for ${unit.uniqueTag}`}
                      className="qr-image"
                    />
                  )}
                </div>
                <div className="qr-info">
                  <div className="unit-tag">{unit.uniqueTag}</div>
                  {unit.inventoryItem && (
                    <div className="item-name">{unit.inventoryItem.name}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 mt-4 no-print">
          <Button
            onClick={handlePrint}
            className="flex-1 bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-700 hover:to-cyan-600"
            data-testid="button-print-qr-codes"
          >
            <Printer className="w-4 h-4 mr-2" />
            {t("print", "Print")}
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-close-print">
            <X className="w-4 h-4 mr-2" />
            {t("close", "Close")}
          </Button>
        </div>

        {/* Print Styles */}
        <style>{`
          /* Screen styles */
          .qr-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 1rem;
            padding: 1rem 0;
          }

          .qr-item {
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 1rem;
            background: rgb(30 41 59 / 0.5);
            border: 1px solid rgb(6 182 212 / 0.2);
            border-radius: 0.5rem;
          }

          .qr-container {
            width: 150px;
            height: 150px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: white;
            border-radius: 0.25rem;
            padding: 0.5rem;
          }

          .qr-image {
            width: 100%;
            height: 100%;
            object-fit: contain;
          }

          .qr-info {
            margin-top: 0.5rem;
            text-align: center;
            width: 100%;
          }

          .unit-tag {
            font-family: monospace;
            font-size: 0.875rem;
            font-weight: 600;
            color: rgb(34 211 238);
            word-break: break-all;
          }

          .item-name {
            font-size: 0.75rem;
            color: rgb(148 163 184);
            margin-top: 0.25rem;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .print-only {
            display: none;
          }

          /* Print styles */
          @media print {
            @page {
              size: A4;
              margin: 1cm;
            }

            /* Hide EVERYTHING */
            body * {
              visibility: hidden !important;
            }

            /* Show the dialog portal that contains our print content */
            [data-radix-portal],
            [data-radix-portal] * {
              visibility: visible !important;
            }

            /* Show only the print content and its children */
            .print-content,
            .print-content * {
              visibility: visible !important;
            }

            /* Position print content at top left of page */
            .print-content {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              background: white !important;
            }

            body {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
              background: white !important;
            }

            /* Hide dialog chrome elements */
            .no-print,
            [data-radix-dialog-overlay],
            button[aria-label="Close"] {
              display: none !important;
              visibility: hidden !important;
            }

            .print-only {
              display: block !important;
              visibility: visible !important;
            }

            .qr-grid {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 0.5cm;
              page-break-inside: avoid;
            }

            .qr-item {
              display: flex;
              flex-direction: column;
              align-items: center;
              padding: 0.3cm;
              border: 1px solid #ddd;
              border-radius: 0.2cm;
              background: white !important;
              page-break-inside: avoid;
            }

            .qr-container {
              width: 2.5cm;
              height: 2.5cm;
              max-width: 2.5cm;
              max-height: 2.5cm;
              min-width: 2.5cm;
              min-height: 2.5cm;
              display: flex;
              align-items: center;
              justify-content: center;
              background: white;
              padding: 0;
              overflow: hidden;
            }

            .qr-image {
              width: 2.5cm !important;
              height: 2.5cm !important;
              max-width: 2.5cm !important;
              max-height: 2.5cm !important;
              object-fit: contain;
            }

            .qr-info {
              margin-top: 0.2cm;
              text-align: center;
              width: 100%;
            }

            .unit-tag {
              font-family: monospace;
              font-size: 9pt;
              font-weight: 600;
              color: #000 !important;
              word-break: break-all;
            }

            .item-name {
              font-size: 7pt;
              color: #666 !important;
              margin-top: 0.1cm;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            }
          }
        `}</style>
      </DialogContent>
    </Dialog>
  );
}
