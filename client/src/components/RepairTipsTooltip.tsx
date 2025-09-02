import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Wrench, Clock, AlertTriangle, Lightbulb, Loader2, Info } from 'lucide-react';
import { useLocalization } from '@/contexts/LocalizationContext';

interface RepairTip {
  category: string;
  title: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  estimatedTime: string;
  tools?: string[];
  warnings?: string[];
}

interface RepairTipsData {
  tips: RepairTip[];
  confidence: number;
}

interface RepairTipsTooltipProps {
  deviceType: string;
  deviceModel: string;
  issueDescription?: string;
  ticketStatus?: string;
  children: React.ReactNode;
  disabled?: boolean;
}

export function RepairTipsTooltip({ 
  deviceType, 
  deviceModel, 
  issueDescription, 
  ticketStatus = 'backlog',
  children,
  disabled = false 
}: RepairTipsTooltipProps) {
  const { t } = useLocalization();
  const [isOpen, setIsOpen] = useState(false);

  const { data: repairTips, isLoading, error } = useQuery<RepairTipsData>({
    queryKey: ['/api/ai/repair-tips', deviceType, deviceModel, issueDescription, ticketStatus],
    queryFn: async () => {
      const response = await fetch('/api/ai/repair-tips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          deviceType,
          deviceModel,
          issueDescription,
          ticketStatus
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch repair tips');
      }
      
      return response.json();
    },
    enabled: isOpen && !disabled && !!deviceType && !!deviceModel,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1
  });

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'bg-green-100 text-green-800 border-green-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'hard': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case 'diagnosis': return <Info className="w-3 h-3" />;
      case 'repair': return <Wrench className="w-3 h-3" />;
      case 'tools': return <Wrench className="w-3 h-3" />;
      case 'prevention': return <AlertTriangle className="w-3 h-3" />;
      default: return <Lightbulb className="w-3 h-3" />;
    }
  };

  if (disabled) {
    return <>{children}</>;
  }

  return (
    <TooltipProvider delayDuration={500}>
      <Tooltip open={isOpen} onOpenChange={setIsOpen}>
        <TooltipTrigger asChild>
          {children}
        </TooltipTrigger>
        <TooltipContent 
          side="right" 
          className="w-80 max-w-sm p-0 bg-background border-border"
          data-testid="repair-tips-tooltip"
        >
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Wrench className="w-4 h-4 text-cyan-500" />
              <h4 className="font-semibold text-sm">
                {t("ai_repair_tips", "AI Repair Tips")}
              </h4>
              <Badge variant="outline" className="text-xs text-cyan-600 border-cyan-200">
                {deviceType}
              </Badge>
            </div>

            <div className="text-xs text-muted-foreground mb-3">
              {deviceModel}
            </div>

            {isLoading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-cyan-500" />
                <span className="ml-2 text-sm text-muted-foreground">
                  {t("generating_tips", "Generating repair tips...")}
                </span>
              </div>
            )}

            {error && (
              <div className="text-sm text-red-600 py-4">
                {t("tips_error", "Failed to load repair tips. Please try again.")}
              </div>
            )}

            {repairTips && repairTips.tips && repairTips.tips.length > 0 && (
              <div className="space-y-3">
                {repairTips.tips.map((tip, index) => (
                  <div key={index} className="border rounded-lg p-3 bg-muted/5">
                    <div className="flex items-start gap-2 mb-2">
                      <div className="flex-shrink-0 mt-0.5 text-cyan-500">
                        {getCategoryIcon(tip.category)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h5 className="font-medium text-xs text-foreground leading-tight">
                            {tip.title}
                          </h5>
                          <Badge 
                            variant="outline" 
                            className={`text-xs px-1.5 py-0.5 ${getDifficultyColor(tip.difficulty)}`}
                          >
                            {tip.difficulty}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed mb-2">
                          {tip.description}
                        </p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>{tip.estimatedTime}</span>
                          </div>
                          {tip.category && (
                            <Badge variant="secondary" className="text-xs capitalize">
                              {tip.category}
                            </Badge>
                          )}
                        </div>
                        
                        {tip.tools && tip.tools.length > 0 && (
                          <div className="mt-2">
                            <div className="text-xs font-medium text-muted-foreground mb-1">
                              {t("required_tools", "Tools needed")}:
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {tip.tools.join(', ')}
                            </div>
                          </div>
                        )}
                        
                        {tip.warnings && tip.warnings.length > 0 && (
                          <div className="mt-2">
                            <div className="flex items-center gap-1 text-xs font-medium text-amber-600 mb-1">
                              <AlertTriangle className="w-3 h-3" />
                              {t("warnings", "Warnings")}:
                            </div>
                            <div className="text-xs text-amber-600">
                              {tip.warnings.join('. ')}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                
                <Separator className="my-2" />
                
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Lightbulb className="w-3 h-3" />
                    <span>{t("ai_powered", "AI-Powered")}</span>
                  </div>
                  <div>
                    {t("confidence", "Confidence")}: {Math.round((repairTips.confidence || 0.8) * 100)}%
                  </div>
                </div>
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default RepairTipsTooltip;