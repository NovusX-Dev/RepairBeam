import { useState, useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Camera, Keyboard, Loader2, Check, AlertTriangle, X } from "lucide-react";
import { useLocalization } from "@/contexts/LocalizationContext";

interface QRCodeScannerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScan: (unitTag: string) => void;
  title?: string;
  description?: string;
}

type ScanMode = "camera" | "manual";

export default function QRCodeScanner({
  open,
  onOpenChange,
  onScan,
  title,
  description,
}: QRCodeScannerProps) {
  const { t } = useLocalization();
  const [mode, setMode] = useState<ScanMode>("camera");
  const [manualInput, setManualInput] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isMountedRef = useRef(false);

  const resetState = () => {
    setManualInput("");
    setError(null);
    setSuccess(false);
  };

  const stopScanning = async () => {
    if (scannerRef.current && isScanning) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch (err) {
        console.error("Error stopping scanner:", err);
      }
      setIsScanning(false);
    }
  };

  const startScanning = async () => {
    if (!isMountedRef.current) return;

    setError(null);
    setSuccess(false);

    try {
      const scanner = new Html5Qrcode("qr-reader");
      scannerRef.current = scanner;

      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
      };

      await scanner.start(
        { facingMode: "environment" },
        config,
        (decodedText) => {
          if (!isMountedRef.current) return;
          setSuccess(true);
          stopScanning();
          setTimeout(() => {
            if (isMountedRef.current) {
              onScan(decodedText);
              onOpenChange(false);
            }
          }, 500);
        },
        (errorMessage) => {
          // Ignore error messages during normal scanning
        }
      );

      setIsScanning(true);
    } catch (err: any) {
      console.error("Error starting scanner:", err);
      if (err.name === "NotAllowedError") {
        setError(t("camera_access_denied", "Camera access was denied. Please enable camera permissions in your browser."));
      } else if (err.name === "NotFoundError") {
        setError(t("camera_not_available", "Camera not available"));
      } else {
        setError(t("camera_not_available", "Camera not available"));
      }
      setIsScanning(false);
    }
  };

  useEffect(() => {
    isMountedRef.current = true;

    if (open && mode === "camera") {
      const timer = setTimeout(() => {
        startScanning();
      }, 300);
      return () => {
        clearTimeout(timer);
        isMountedRef.current = false;
        stopScanning();
      };
    } else {
      isMountedRef.current = false;
      stopScanning();
    }

    return () => {
      isMountedRef.current = false;
      stopScanning();
    };
  }, [open, mode]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualInput.trim()) {
      onScan(manualInput.trim());
      onOpenChange(false);
      resetState();
    }
  };

  const handleModeSwitch = async (newMode: ScanMode) => {
    if (newMode === mode) return;
    await stopScanning();
    setMode(newMode);
    resetState();
  };

  const handleClose = () => {
    onOpenChange(false);
    resetState();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl">
        {/* Aurora Gradient Header */}
        <div className="bg-gradient-to-r from-[#0A192F] to-[#00FFFF] px-6 py-4 -mx-6 -mt-6 mb-4">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-white flex items-center gap-3">
              {mode === "camera" ? <Camera className="w-5 h-5" /> : <Keyboard className="w-5 h-5" />}
              {title || t("scan_qr_code", "Scan QR Code")}
            </DialogTitle>
            <DialogDescription className="text-cyan-100 text-sm mt-1">
              {description || t("scan_or_enter_manually", "Scan QR code or enter unit tag manually")}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-4">
          {/* Mode Switcher */}
          <div className="flex gap-2">
            <Button
              type="button"
              variant={mode === "camera" ? "default" : "outline"}
              onClick={() => handleModeSwitch("camera")}
              className="flex-1"
              data-testid="button-camera-mode"
            >
              <Camera className="w-4 h-4 mr-2" />
              {t("switch_to_camera", "Switch to Camera")}
            </Button>
            <Button
              type="button"
              variant={mode === "manual" ? "default" : "outline"}
              onClick={() => handleModeSwitch("manual")}
              className="flex-1"
              data-testid="button-manual-mode"
            >
              <Keyboard className="w-4 h-4 mr-2" />
              {t("switch_to_manual", "Switch to Manual Entry")}
            </Button>
          </div>

          {/* Camera Mode */}
          {mode === "camera" && (
            <div className="space-y-4">
              {/* Scanner Container */}
              <div className="relative bg-slate-800/50 rounded-lg border-2 border-cyan-500/20 overflow-hidden">
                {!isScanning && !error && (
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 z-10">
                    <div className="text-center space-y-3">
                      <Loader2 className="w-12 h-12 text-cyan-400 animate-spin mx-auto" />
                      <p className="text-white text-sm">{t("scanning_qr_code", "Scanning QR Code...")}</p>
                    </div>
                  </div>
                )}
                {success && (
                  <div className="absolute inset-0 flex items-center justify-center bg-green-600/90 z-20">
                    <div className="text-center space-y-3">
                      <Check className="w-16 h-16 text-white mx-auto" />
                      <p className="text-white text-lg font-semibold">{t("qr_code_detected", "QR Code Detected")}</p>
                    </div>
                  </div>
                )}
                <div id="qr-reader" className="w-full min-h-[300px]"></div>
              </div>

              {/* Instructions */}
              {!error && !success && (
                <Alert className="bg-cyan-500/10 border-cyan-500/30">
                  <Camera className="h-4 w-4 text-cyan-400" />
                  <AlertDescription className="text-sm text-cyan-100">
                    {t("point_camera_at_qr", "Point camera at QR code")}
                  </AlertDescription>
                </Alert>
              )}

              {/* Error Message */}
              {error && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* Manual Entry Mode */}
          {mode === "manual" && (
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="unit-tag" className="text-sm font-medium text-foreground">
                  {t("unit_tag", "Unit Tag")}
                </label>
                <Input
                  id="unit-tag"
                  type="text"
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  placeholder={t("enter_unit_id", "Enter Unit ID")}
                  className="font-mono"
                  autoFocus
                  data-testid="input-unit-tag"
                />
                <p className="text-xs text-muted-foreground">
                  {t("usb_scanner_supported", "USB scanner supported - scan directly into this field")}
                </p>
              </div>

              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-700 hover:to-cyan-600"
                disabled={!manualInput.trim()}
                data-testid="button-submit-manual"
              >
                {t("verify", "Verify")}
              </Button>
            </form>
          )}

          {/* Cancel Button */}
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            className="w-full"
            data-testid="button-cancel-scan"
          >
            <X className="w-4 h-4 mr-2" />
            {t("cancel", "Cancel")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
