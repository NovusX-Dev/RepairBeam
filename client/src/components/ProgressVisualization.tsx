import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useLocalization } from '@/contexts/LocalizationContext';
import { ChevronRight, Clock, CheckCircle, Circle, ArrowRight } from 'lucide-react';

// Import the same status definitions as Kanban
const getProgressStages = (t: (key: string, fallback?: string) => string) => [
  { 
    id: 'backlog', 
    title: t('backlog', 'Backlog'), 
    shortTitle: t('backlog_short', 'Backlog'),
    color: '#6B7280',
    icon: Circle,
    estimatedHours: 0
  },
  { 
    id: 'waiting_diagnostics', 
    title: t('waiting_diagnostics', 'Waiting on Diagnostics'), 
    shortTitle: t('diagnostics_short', 'Diagnostics'),
    color: '#F59E0B',
    icon: Clock,
    estimatedHours: 2
  },
  { 
    id: 'waiting_client_approval', 
    title: t('waiting_client_approval', 'Waiting on Client Approval'), 
    shortTitle: t('approval_short', 'Approval'),
    color: '#F97316',
    icon: Clock,
    estimatedHours: 0
  },
  { 
    id: 'approved', 
    title: t('approved', 'Approved'), 
    shortTitle: t('approved_short', 'Approved'),
    color: '#10B981',
    icon: CheckCircle,
    estimatedHours: 0
  },
  { 
    id: 'servicing', 
    title: t('servicing', 'Servicing'), 
    shortTitle: t('servicing_short', 'Servicing'),
    color: '#3B82F6',
    icon: Circle,
    estimatedHours: 8
  },
  { 
    id: 'quality_check', 
    title: t('quality_check', 'Quality Check'), 
    shortTitle: t('quality_short', 'QC'),
    color: '#8B5CF6',
    icon: CheckCircle,
    estimatedHours: 1
  },
  { 
    id: 'final_customer_check', 
    title: t('final_customer_check', 'Final Customer Check'), 
    shortTitle: t('final_check_short', 'Final Check'),
    color: '#EC4899',
    icon: CheckCircle,
    estimatedHours: 0
  },
  { 
    id: 'finalized', 
    title: t('finalized', 'Finalized / Done'), 
    shortTitle: t('finalized_short', 'Done'),
    color: '#059669',
    icon: CheckCircle,
    estimatedHours: 0
  },
];

interface ProgressVisualizationProps {
  currentStatus: string;
  ticketId: string;
  createdAt?: string;
  technicianEstimatedHours?: number;
  onAdvanceStatus: (ticketId: string, nextStatus: string) => void;
  isAdvancing?: boolean;
  compact?: boolean;
}

export default function ProgressVisualization({
  currentStatus,
  ticketId,
  createdAt,
  technicianEstimatedHours,
  onAdvanceStatus,
  isAdvancing = false,
  compact = false
}: ProgressVisualizationProps) {
  const { t } = useLocalization();
  const stages = getProgressStages(t);
  
  const currentIndex = stages.findIndex(stage => stage.id === currentStatus);
  const nextStage = currentIndex < stages.length - 1 ? stages[currentIndex + 1] : null;
  
  // Calculate progress percentage
  const progressPercentage = currentIndex >= 0 ? ((currentIndex + 1) / stages.length) * 100 : 0;
  
  // Calculate estimated completion time
  const calculateEstimatedCompletion = () => {
    if (!createdAt) return null;
    
    const totalEstimatedHours = technicianEstimatedHours || 
      stages.slice(currentIndex + 1).reduce((sum, stage) => sum + stage.estimatedHours, 0);
    
    const createdDate = new Date(createdAt);
    const estimatedCompletion = new Date(createdDate.getTime() + (totalEstimatedHours * 60 * 60 * 1000));
    
    return estimatedCompletion;
  };

  const estimatedCompletion = calculateEstimatedCompletion();

  if (compact) {
    return (
      <div className="flex items-center space-x-2">
        {/* Compact progress bar */}
        <div className="flex-1 bg-gray-200 rounded-full h-2 relative">
          <div 
            className="bg-gradient-to-r from-[#00FFFF] to-cyan-400 h-2 rounded-full transition-all duration-500"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
        
        {/* Current stage badge */}
        <Badge 
          variant="secondary" 
          className="text-xs"
          style={{ backgroundColor: stages[currentIndex]?.color + '20', color: stages[currentIndex]?.color }}
        >
          {stages[currentIndex]?.shortTitle}
        </Badge>
        
        {/* Quick advance button */}
        {nextStage && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0"
                  onClick={() => onAdvanceStatus(ticketId, nextStage.id)}
                  disabled={isAdvancing}
                  data-testid={`advance-${ticketId}`}
                >
                  <ChevronRight className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{t('advance_to', 'Advance to')} {nextStage.shortTitle}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with progress percentage and estimated completion */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <h3 className="text-lg font-semibold">{t('repair_progress', 'Repair Progress')}</h3>
          <Badge variant="outline" className="font-mono">
            {Math.round(progressPercentage)}%
          </Badge>
        </div>
        
        {estimatedCompletion && (
          <div className="text-sm text-muted-foreground flex items-center space-x-1">
            <Clock className="h-4 w-4" />
            <span>
              {t('estimated_completion', 'Est. completion')}: {estimatedCompletion.toLocaleDateString()}
            </span>
          </div>
        )}
      </div>

      {/* Visual timeline */}
      <div className="relative">
        {/* Progress line */}
        <div className="absolute top-6 left-6 right-6 h-0.5 bg-gray-200">
          <div 
            className="h-full bg-gradient-to-r from-[#00FFFF] to-cyan-400 transition-all duration-700"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>

        {/* Stage indicators */}
        <div className="flex justify-between relative">
          {stages.map((stage, index) => {
            const isPast = index < currentIndex;
            const isCurrent = index === currentIndex;
            const isFuture = index > currentIndex;
            const StageIcon = stage.icon;

            return (
              <TooltipProvider key={stage.id}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex flex-col items-center space-y-2 cursor-help">
                      {/* Stage circle */}
                      <div
                        className={`
                          w-12 h-12 rounded-full border-2 flex items-center justify-center transition-all duration-300
                          ${isPast ? 'bg-[#00FFFF] border-[#00FFFF] text-[#0A192F]' : ''}
                          ${isCurrent ? 'bg-white border-[#00FFFF] text-[#00FFFF] ring-4 ring-[#00FFFF]/20' : ''}
                          ${isFuture ? 'bg-gray-100 border-gray-300 text-gray-400' : ''}
                        `}
                      >
                        <StageIcon className="h-5 w-5" />
                      </div>
                      
                      {/* Stage label */}
                      <div className="text-center">
                        <div className={`text-xs font-medium ${isCurrent ? 'text-[#00FFFF]' : 'text-gray-600'}`}>
                          {stage.shortTitle}
                        </div>
                        {stage.estimatedHours > 0 && (
                          <div className="text-xs text-gray-400">
                            {stage.estimatedHours}h
                          </div>
                        )}
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="text-center">
                      <p className="font-medium">{stage.title}</p>
                      {stage.estimatedHours > 0 && (
                        <p className="text-xs text-gray-400">
                          {t('estimated_time', 'Estimated time')}: {stage.estimatedHours} {t('hours', 'hours')}
                        </p>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          })}
        </div>
      </div>

      {/* One-click advance section */}
      {nextStage && (
        <div className="flex items-center justify-between p-4 bg-gradient-to-r from-cyan-50 to-blue-50 rounded-lg border border-cyan-200">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <div className="text-sm font-medium text-gray-700">
                {t('ready_to_advance', 'Ready to advance?')}
              </div>
              <ArrowRight className="h-4 w-4 text-gray-400" />
              <Badge
                variant="outline"
                style={{ backgroundColor: nextStage.color + '20', color: nextStage.color, borderColor: nextStage.color }}
              >
                {nextStage.shortTitle}
              </Badge>
            </div>
          </div>
          
          <Button
            onClick={() => onAdvanceStatus(ticketId, nextStage.id)}
            disabled={isAdvancing}
            className="bg-gradient-to-r from-[#00FFFF] to-cyan-400 hover:from-cyan-400 hover:to-[#00FFFF] text-[#0A192F] font-medium"
            data-testid={`advance-to-${nextStage.id}`}
          >
            {isAdvancing ? (
              <>
                <Clock className="h-4 w-4 mr-2 animate-spin" />
                {t('advancing', 'Advancing...')}
              </>
            ) : (
              <>
                <ChevronRight className="h-4 w-4 mr-2" />
                {t('advance_to', 'Advance to')} {nextStage.shortTitle}
              </>
            )}
          </Button>
        </div>
      )}

      {/* Completion message */}
      {currentStatus === 'finalized' && (
        <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
          <div className="flex items-center space-x-3">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <div>
              <div className="font-medium text-green-800">
                {t('repair_completed', 'Repair Completed!')}
              </div>
              <div className="text-sm text-green-600">
                {t('repair_completed_message', 'This repair has been successfully completed and finalized.')}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}