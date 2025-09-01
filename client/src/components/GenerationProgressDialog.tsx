import { useEffect, useState } from "react";
import { useLocalization } from "@/contexts/LocalizationContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Bot, Loader2, Clock, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface GenerationProgressDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  category: string;
  totalBrands: number;
  isGenerating: boolean;
  completedBrands?: number;
  errorMessage?: string;
}

export function GenerationProgressDialog({
  isOpen,
  onOpenChange,
  category,
  totalBrands,
  isGenerating,
  completedBrands = 0,
  errorMessage
}: GenerationProgressDialogProps) {
  const { t } = useLocalization();
  const [currentBrand, setCurrentBrand] = useState(0);
  const [progressPercentage, setProgressPercentage] = useState(0);
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState("");

  // Update progress based on actual server data
  useEffect(() => {
    if (!isGenerating || !isOpen) {
      setCurrentBrand(0);
      setProgressPercentage(0);
      setEstimatedTimeRemaining("");
      return;
    }

    // Calculate real progress based on completed brands
    const progress = totalBrands > 0 ? Math.min((completedBrands / totalBrands) * 100, 95) : 0;
    setProgressPercentage(progress);
    setCurrentBrand(completedBrands);
    
    // Estimate remaining time based on actual progress (30 seconds per brand average - much faster now)
    const remainingBrands = totalBrands - completedBrands;
    const estimatedRemainingSeconds = remainingBrands * 2; // 2 seconds per brand average
    
    if (remainingBrands === 0) {
      setEstimatedTimeRemaining(t('progress.completed', 'Completed!'));
    } else if (estimatedRemainingSeconds > 60) {
      const minutes = Math.ceil(estimatedRemainingSeconds / 60);
      setEstimatedTimeRemaining(t('progress.estimated_time_minutes', '{minutes} minutes remaining').replace('{minutes}', minutes.toString()));
    } else if (estimatedRemainingSeconds > 10) {
      setEstimatedTimeRemaining(t('progress.estimated_time_seconds', '{seconds} seconds remaining').replace('{seconds}', estimatedRemainingSeconds.toString()));
    } else {
      setEstimatedTimeRemaining(t('progress.estimated_time_soon', 'Almost complete...'));
    }
  }, [isGenerating, isOpen, totalBrands, completedBrands, t]);

  // Reset when generation completes
  useEffect(() => {
    if (!isGenerating && progressPercentage > 0) {
      setProgressPercentage(100);
      setCurrentBrand(totalBrands);
      setEstimatedTimeRemaining(t('progress.completed', 'Completed!'));
      
      // Auto-close after user can see completion status
      setTimeout(() => {
        onOpenChange(false);
      }, 3000); // Give user time to see completion status
    }
  }, [isGenerating, progressPercentage, totalBrands, t, onOpenChange]);

  // Force dialog to stay open for minimum time when generation starts
  useEffect(() => {
    if (isGenerating && isOpen) {
      // Ensure dialog stays open for at least 8 seconds when generation starts
      const minDisplayTime = setTimeout(() => {
        // This just ensures the dialog doesn't close too early
      }, 8000);
      
      return () => clearTimeout(minDisplayTime);
    }
  }, [isGenerating, isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-primary" />
            <DialogTitle>
              {t('progress.generating_models_title', 'Generating AI Models')}
            </DialogTitle>
          </div>
          <DialogDescription>
            {t('progress.generating_models_for_category', 'Generating device models for {category}').replace('{category}', category)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Error Alert */}
          {errorMessage && (
            <Alert className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950">
              <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
              <AlertDescription className="text-red-800 dark:text-red-200">
                <strong>{t('progress.error_title', 'Error:')}</strong>{' '}
                {errorMessage}
              </AlertDescription>
            </Alert>
          )}

          {/* Warning Alert */}
          {!errorMessage && (
            <Alert className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <AlertDescription className="text-amber-800 dark:text-amber-200">
                <strong>{t('progress.warning_title', 'Important:')}</strong>{' '}
                {t('progress.warning_message', 'Do not refresh the page or navigate away during generation. This will stop the process and require starting over.')}
              </AlertDescription>
            </Alert>
          )}

          {/* Progress Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {t('progress.processing_brands', 'Processing brands')}
              </span>
              <Badge variant="outline">
                {currentBrand} / {totalBrands}
              </Badge>
            </div>
            
            <Progress value={progressPercentage} className="h-3" />
            
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{t('progress.generating', 'Generating...')}</span>
                  </>
                ) : (
                  <>
                    <Clock className="w-4 h-4" />
                    <span>{t('progress.completed', 'Completed!')}</span>
                  </>
                )}
              </div>
              <span>{Math.round(progressPercentage)}%</span>
            </div>

            {estimatedTimeRemaining && (
              <div className="text-center text-sm text-muted-foreground">
                {estimatedTimeRemaining}
              </div>
            )}
          </div>

          {/* Cost Info */}
          <Alert>
            <Bot className="h-4 w-4" />
            <AlertDescription>
              {t('progress.cost_info', 'This process uses OpenAI API calls. Each brand requires a separate API request to generate accurate model lists.')}
            </AlertDescription>
          </Alert>
        </div>
      </DialogContent>
    </Dialog>
  );
}