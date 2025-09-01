import { useEffect, useState } from "react";
import { useLocalization } from "@/contexts/LocalizationContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Bot, Loader2 } from "lucide-react";

interface GenerationProgressDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  category: string;
  isGenerating: boolean;
  errorMessage?: string;
}

export function GenerationProgressDialog({
  isOpen,
  onOpenChange,
  category,
  isGenerating,
  errorMessage
}: GenerationProgressDialogProps) {
  const { t } = useLocalization();
  const [isCheckingCompletion, setIsCheckingCompletion] = useState(false);

  // Poll for completion by checking the generation status
  useEffect(() => {
    if (!isGenerating || !isOpen || errorMessage) return;

    const checkCompletion = async () => {
      try {
        const response = await fetch(`/api/auto-gen-lists/${category}/status`, {
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          }
        });
        
        if (response.ok) {
          const status = await response.json();
          // Check if generation is actually completed
          if (status && (status.status === 'completed' || status.status === 'failed')) {
            setIsCheckingCompletion(true);
            // Small delay to allow UI to update and user to see completion
            setTimeout(() => {
              onOpenChange(false);
              setIsCheckingCompletion(false);
            }, 1500);
          }
        }
      } catch (error) {
        // Continue checking - network errors shouldn't stop the check
        console.log('Status check failed, continuing...');
      }
    };

    // Check every 2 seconds during generation
    const interval = setInterval(checkCompletion, 2000);
    
    return () => clearInterval(interval);
  }, [isGenerating, isOpen, category, onOpenChange, errorMessage]);

  // Additional check: Listen for the isGenerating state change to detect completion
  useEffect(() => {
    // When isGenerating changes from true to false, it means generation completed
    // BUT only close if we also confirm via API that it's actually done
    if (!isGenerating && isOpen && !errorMessage) {
      // Double-check completion via API before closing
      const verifyCompletion = async () => {
        try {
          const response = await fetch(`/api/auto-gen-lists/${category}/status`, {
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            }
          });
          
          if (response.ok) {
            const status = await response.json();
            // Only close if generation is actually completed
            if (status && status.status === 'completed') {
              setIsCheckingCompletion(true);
              setTimeout(() => {
                onOpenChange(false);
                setIsCheckingCompletion(false);
              }, 1500);
            }
          }
        } catch (error) {
          console.log('Completion verification failed, keeping dialog open');
        }
      };
      
      // Small delay before checking to ensure backend has time to update
      setTimeout(verifyCompletion, 2000);
    }
  }, [isGenerating, isOpen, errorMessage, onOpenChange, category]);

  // Auto-close on error after delay
  useEffect(() => {
    if (errorMessage && isOpen) {
      const timer = setTimeout(() => {
        onOpenChange(false);
      }, 5000); // 5 seconds for error reading
      
      return () => clearTimeout(timer);
    }
  }, [errorMessage, isOpen, onOpenChange]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-primary" />
            <DialogTitle>
              {t('generation_dialog.title', 'Generating AI Models')}
            </DialogTitle>
          </div>
          <DialogDescription>
            {t('generation_dialog.description', 'Generating device models for {category}').replace('{category}', t(`category.${category.toLowerCase()}`, category))}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Error Alert */}
          {errorMessage && (
            <Alert className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950">
              <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
              <AlertDescription className="text-red-800 dark:text-red-200">
                <strong>{t('generation_dialog.error_title', 'Error:')}</strong>{' '}
                {errorMessage}
              </AlertDescription>
            </Alert>
          )}

          {/* Warning Alert */}
          {!errorMessage && (
            <Alert className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <AlertDescription className="text-amber-800 dark:text-amber-200">
                <strong>{t('generation_dialog.warning_title', 'Important:')}</strong>{' '}
                {t('generation_dialog.warning_message', 'Do not refresh the page or navigate away during generation. This will stop the process and require starting over.')}
              </AlertDescription>
            </Alert>
          )}

          {/* Simple Generation Status */}
          {!errorMessage && (
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-3 py-8">
                {isCheckingCompletion ? (
                  <>
                    <div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-lg font-medium text-green-600 dark:text-green-400">
                      {t('generation_dialog.completing', 'Completing...')}
                    </span>
                  </>
                ) : (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    <span className="text-lg font-medium">
                      {t('generation_dialog.generating', 'Generating models, please wait...')}
                    </span>
                  </>
                )}
              </div>
              
              <div className="text-center text-sm text-muted-foreground">
                {t('generation_dialog.processing_message', 'This may take 2-3 minutes to complete')}
              </div>
            </div>
          )}

          {/* Cost Info */}
          <Alert>
            <Bot className="h-4 w-4" />
            <AlertDescription>
              {t('generation_dialog.cost_info', 'This process uses OpenAI API calls. Each brand requires a separate API request to generate accurate model lists.')}
            </AlertDescription>
          </Alert>
        </div>
      </DialogContent>
    </Dialog>
  );
}