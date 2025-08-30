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
import { AlertTriangle, Bot, Loader2, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface GenerationProgressDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  category: string;
  totalBrands: number;
  isGenerating: boolean;
}

export function GenerationProgressDialog({
  isOpen,
  onOpenChange,
  category,
  totalBrands,
  isGenerating
}: GenerationProgressDialogProps) {
  const { t } = useLocalization();
  const [currentBrand, setCurrentBrand] = useState(0);
  const [progressPercentage, setProgressPercentage] = useState(0);
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState("");

  // Simulate progress tracking (in real implementation, this would come from server events)
  useEffect(() => {
    if (!isGenerating || !isOpen) {
      setCurrentBrand(0);
      setProgressPercentage(0);
      return;
    }

    // Estimate progress based on time (rough approximation)
    const startTime = Date.now();
    const estimatedTotalTime = totalBrands * 30000; // ~30 seconds per brand
    
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min((elapsed / estimatedTotalTime) * 100, 95); // Cap at 95% until complete
      
      setProgressPercentage(progress);
      setCurrentBrand(Math.floor((progress / 100) * totalBrands));
      
      const remaining = Math.max(0, estimatedTotalTime - elapsed);
      const remainingMinutes = Math.ceil(remaining / 60000);
      
      if (remainingMinutes > 1) {
        setEstimatedTimeRemaining(t('progress.estimated_time_minutes', '{minutes} minutes remaining').replace('{minutes}', remainingMinutes.toString()));
      } else {
        setEstimatedTimeRemaining(t('progress.estimated_time_soon', 'Almost complete...'));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isGenerating, isOpen, totalBrands, t]);

  // Reset when generation completes
  useEffect(() => {
    if (!isGenerating && progressPercentage > 0) {
      setProgressPercentage(100);
      setCurrentBrand(totalBrands);
      setEstimatedTimeRemaining(t('progress.completed', 'Completed!'));
      
      // Auto-close after a short delay
      setTimeout(() => {
        onOpenChange(false);
      }, 2000);
    }
  }, [isGenerating, progressPercentage, totalBrands, t, onOpenChange]);

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
          {/* Warning Alert */}
          <Alert className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <AlertDescription className="text-amber-800 dark:text-amber-200">
              <strong>{t('progress.warning_title', 'Important:')}</strong>{' '}
              {t('progress.warning_message', 'Do not refresh the page or navigate away during generation. This will stop the process and require starting over.')}
            </AlertDescription>
          </Alert>

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