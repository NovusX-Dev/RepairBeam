import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  const [printContainer, setPrintContainer] = useState<HTMLDivElement | null>(null);

  // Create dedicated print container on mount
  useEffect(() => {
    let container = document.getElementById('qr-print-root') as HTMLDivElement;
    if (!container) {
      container = document.createElement('div');
      container.id = 'qr-print-root';
      container.style.display = 'none';
      document.body.appendChild(container);
    }
    setPrintContainer(container);

    return () => {
      // Clean up on unmount
      if (container && container.parentNode) {
        container.parentNode.removeChild(container);
      }
    };
  }, []);

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

  // Render print content for the QR code grid
  const renderPrintContent = () => (
    <div style={{ padding: '20px', background: 'white' }}>
      {/* Print Header */}
      <div style={{ marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid #ccc' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px', color: '#000' }}>
          {t("qr_codes_for_units", "QR Codes for Inventory Units")}
        </h1>
        {purchaseOrderId && (
          <p style={{ fontSize: '14px', color: '#000' }}>
            <strong>{t("purchase_order", "Purchase Order")}:</strong> {purchaseOrderId}
          </p>
        )}
        {receivedDate && (
          <p style={{ fontSize: '14px', color: '#000' }}>
            <strong>{t("received_on", "Received on")}:</strong> {formatDate(receivedDate)}
          </p>
        )}
      </div>

      {/* QR Code Grid */}
      <div className="qr-print-grid">
        {units.map((unit) => (
          <div key={unit.id} className="qr-print-item">
            <div className="qr-print-container">
              {qrCodes[unit.id] && (
                <img
                  src={qrCodes[unit.id]}
                  alt={`QR Code for ${unit.uniqueTag}`}
                  className="qr-print-image"
                />
              )}
            </div>
            <div className="qr-print-info">
              <div className="qr-print-tag">{unit.uniqueTag}</div>
              {unit.inventoryItem && (
                <div className="qr-print-name">{unit.inventoryItem.name}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-6xl max-h-[90vh] overflow-y-auto">
          {/* Aurora Gradient Header */}
          <div className="bg-gradient-to-r from-[#0A192F] to-[#00FFFF] px-6 py-4 -mx-6 -mt-6 mb-4">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-white flex items-center gap-3">
                <Printer className="w-5 h-5" />
                {t("qr_code_print_sheet", "QR Code Print Sheet")}
              </DialogTitle>
            </DialogHeader>
          </div>

          {/* Preview Information */}
          <div className="mb-4 p-4 bg-slate-800/50 rounded-lg border border-cyan-500/20">
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

          {/* Action Buttons */}
          <div className="flex gap-2 mb-4">
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

          {/* Preview Grid (same layout as print) */}
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

          {/* Print Styles */}
          <style>{`
            /* Screen styles for preview */
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

            /* Print-specific styles for dedicated print container */
            .qr-print-grid {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 0.5cm;
            }

            .qr-print-item {
              display: flex;
              flex-direction: column;
              align-items: center;
              padding: 0.3cm;
              border: 1px solid #ddd;
              border-radius: 0.2cm;
              background: white;
              page-break-inside: avoid;
            }

            .qr-print-container {
              width: 2.5cm;
              height: 2.5cm;
              display: flex;
              align-items: center;
              justify-content: center;
              background: white;
            }

            .qr-print-image {
              width: 2.5cm;
              height: 2.5cm;
              object-fit: contain;
            }

            .qr-print-info {
              margin-top: 0.2cm;
              text-align: center;
              width: 100%;
            }

            .qr-print-tag {
              font-family: monospace;
              font-size: 9pt;
              font-weight: 600;
              color: #000;
              word-break: break-all;
            }

            .qr-print-name {
              font-size: 7pt;
              color: #666;
              margin-top: 0.1cm;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            }

            /* Hide print container on screen, show only during print */
            @media screen {
              #qr-print-root {
                display: none !important;
              }
            }

            @media print {
              @page {
                size: A4;
                margin: 1cm;
              }

              body {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }

              /* Hide everything except the print container */
              body > *:not(#qr-print-root) {
                display: none !important;
              }

              /* Show the print container */
              #qr-print-root {
                display: block !important;
              }
            }
          `}</style>
        </DialogContent>
      </Dialog>

      {/* Portal to render print content outside dialog */}
      {printContainer && open && createPortal(renderPrintContent(), printContainer)}
    </>
  );
}
