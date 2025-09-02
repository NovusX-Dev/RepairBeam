import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useLocalization } from '@/contexts/LocalizationContext';
import { ChevronRight, Clock, CheckCircle, Circle, ArrowRight, ChevronDown, ChevronUp, Maximize2, Minimize2 } from 'lucide-react';

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
  collapsible?: boolean;
  defaultExpanded?: boolean;
  showAdvanceButton?: boolean;
  headerStyle?: 'simple' | 'detailed';
}

export default function ProgressVisualization({
  currentStatus,
  ticketId,
  createdAt,
  technicianEstimatedHours,
  onAdvanceStatus,
  isAdvancing = false,
  compact = false,
  collapsible = false,
  defaultExpanded = true,
  showAdvanceButton = true,
  headerStyle = 'detailed'
}: ProgressVisualizationProps) {
  const { t } = useLocalization();
  const stages = getProgressStages(t);
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [renderKey, setRenderKey] = useState(0);
  
  // Force re-render when status changes
  useEffect(() => {
    setRenderKey(prev => prev + 1);
  }, [currentStatus]);
  
  // Recalculate everything when status changes
  const currentIndex = stages.findIndex(stage => stage.id === currentStatus);
  const nextStage = currentIndex < stages.length - 1 ? stages[currentIndex + 1] : null;
  
  // Calculate progress percentage - force recalculation
  const progressPercentage = React.useMemo(() => {
    const index = stages.findIndex(stage => stage.id === currentStatus);
    return index >= 0 ? ((index + 1) / stages.length) * 100 : 0;
  }, [currentStatus, stages, renderKey]);
  
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

  // Smart header component for always-visible progress
  const ProgressHeader = () => (
    <div className="flex items-center justify-between">
      <div className="flex items-center space-x-3 flex-1">
        {/* Progress bar */}
        <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2 relative min-w-[120px]">
          <div 
            className="bg-gradient-to-r from-[#00FFFF] to-cyan-400 h-2 rounded-full transition-all duration-500"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
        
        {/* Current stage badge */}
        <Badge 
          variant="outline" 
          className="text-xs font-medium whitespace-nowrap"
          style={{ 
            backgroundColor: stages[currentIndex]?.color + '20', 
            color: stages[currentIndex]?.color,
            borderColor: stages[currentIndex]?.color 
          }}
        >
          {stages[currentIndex]?.shortTitle}
        </Badge>
        
        {/* Progress percentage */}
        <span className="text-sm font-mono text-muted-foreground whitespace-nowrap">
          {Math.round(progressPercentage)}%
        </span>

        {/* Estimated completion */}
        {estimatedCompletion && headerStyle === 'detailed' && (
          <div className="hidden md:flex items-center text-xs text-muted-foreground space-x-1">
            <Clock className="h-3 w-3" />
            <span className="whitespace-nowrap">
              {estimatedCompletion.toLocaleDateString()}
            </span>
          </div>
        )}
      </div>
      
      <div className="flex items-center space-x-2 ml-3">
        {/* Quick advance button */}
        {nextStage && showAdvanceButton && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs"
                  onClick={() => onAdvanceStatus(ticketId, nextStage.id)}
                  disabled={isAdvancing}
                  data-testid={`quick-advance-${ticketId}`}
                >
                  {isAdvancing ? (
                    <Clock className="h-3 w-3 animate-spin" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{t('advance_to', 'Advance to')} {nextStage.shortTitle}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {/* Collapsible toggle */}
        {collapsible && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            onClick={() => setIsExpanded(!isExpanded)}
            data-testid={`toggle-progress-details-${ticketId}`}
          >
            {isExpanded ? (
              <Minimize2 className="h-3 w-3" />
            ) : (
              <Maximize2 className="h-3 w-3" />
            )}
          </Button>
        )}
      </div>
    </div>
  );

  // Compact version for Kanban cards
  if (compact) {
    return <ProgressHeader />;
  }

  // Smart collapsible version for detailed views
  if (collapsible) {
    return (
      <div className="space-y-3">
        <ProgressHeader />
        
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CollapsibleContent className="space-y-4 pt-4 border-t border-border">
            {/* Modern Stepper Timeline */}
            <div className="relative py-2">
              {/* Main stepper container with absolute positioning for perfect alignment */}
              <div className="relative h-16">
                {/* Background connection line */}
                <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-gray-200 dark:bg-gray-700 -translate-y-1/2 z-0" />
                
                {/* Active progress line */}
                <div 
                  className="absolute top-1/2 left-0 h-0.5 bg-gradient-to-r from-[#00FFFF] to-cyan-400 -translate-y-1/2 z-10 transition-all duration-700 ease-out"
                  style={{ width: `${progressPercentage}%` }}
                />

                {/* Stage indicators with absolute positioning */}
                {stages.map((stage, index) => {
                  // Recalculate states based on current status
                  const currentIdx = stages.findIndex(s => s.id === currentStatus);
                  const isPast = index < currentIdx;
                  const isCurrent = index === currentIdx;
                  const isFuture = index > currentIdx;
                  const StageIcon = stage.icon;

                  const leftPercentage = (index / (stages.length - 1)) * 100;
                  
                  return (
                    <TooltipProvider key={stage.id}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div 
                            className="absolute flex flex-col items-center space-y-2 cursor-help"
                            style={{ 
                              left: `${leftPercentage}%`, 
                              top: '50%',
                              transform: 'translate(-50%, -50%)'
                            }}
                          >
                            {/* Clean stage circle with perfect alignment */}
                            <div
                              className={`
                                w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all duration-300 relative z-20
                                ${isPast 
                                  ? 'bg-[#00FFFF] border-[#00FFFF] text-[#0A192F]' 
                                  : ''
                                }
                                ${isCurrent 
                                  ? 'bg-white dark:bg-slate-800 border-[#00FFFF] text-[#00FFFF] ring-2 ring-[#00FFFF]/15 -translate-y-1' 
                                  : ''
                                }
                                ${isFuture 
                                  ? 'bg-white dark:bg-slate-800 border-gray-300 dark:border-gray-600 text-gray-400' 
                                  : ''
                                }
                              `}
                            >
                              {isPast ? (
                                <CheckCircle className="h-4 w-4" />
                              ) : (
                                <StageIcon className="h-4 w-4" />
                              )}
                            </div>
                            
                            {/* Stage label */}
                            <div className="text-center">
                              <div className={`text-xs font-medium ${isCurrent ? 'text-[#00FFFF]' : 'text-gray-600 dark:text-gray-400'}`}>
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
            {nextStage && showAdvanceButton && (
              <div className="flex items-center justify-between p-3 bg-gradient-to-r from-cyan-50 to-blue-50 dark:from-cyan-950 dark:to-blue-950 rounded-md border border-cyan-200 dark:border-cyan-800">
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2">
                    <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
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
              <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 rounded-lg border border-green-200 dark:border-green-800">
                <div className="flex items-center space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <div>
                    <div className="font-medium text-green-800 dark:text-green-200">
                      {t('repair_completed', 'Repair Completed!')}
                    </div>
                    <div className="text-sm text-green-600 dark:text-green-300">
                      {t('repair_completed_message', 'This repair has been successfully completed and finalized.')}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      </div>
    );
  }

  // Full version (non-collapsible detailed view)
  return (
    <div className="space-y-4">
      <ProgressHeader />
      
      {/* Modern Full Timeline */}
      <div className="relative py-3">
        {/* Main stepper container with absolute positioning for perfect alignment */}
        <div className="relative h-20">
          {/* Background connection line */}
          <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-gray-200 dark:bg-gray-700 -translate-y-1/2 z-0" />
          
          {/* Active progress line */}
          <div 
            className="absolute top-1/2 left-0 h-0.5 bg-gradient-to-r from-[#00FFFF] to-cyan-400 -translate-y-1/2 z-10 transition-all duration-700 ease-out"
            style={{ width: `${progressPercentage}%` }}
          />

          {/* Stage indicators with absolute positioning */}
          {stages.map((stage, index) => {
            // Recalculate states based on current status
            const currentIdx = stages.findIndex(s => s.id === currentStatus);
            const isPast = index < currentIdx;
            const isCurrent = index === currentIdx;
            const isFuture = index > currentIdx;
            const StageIcon = stage.icon;

            const leftPercentage = (index / (stages.length - 1)) * 100;
            
            return (
              <TooltipProvider key={stage.id}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div 
                      className="absolute flex flex-col items-center space-y-2 cursor-help"
                      style={{ 
                        left: `${leftPercentage}%`, 
                        top: '50%',
                        transform: 'translate(-50%, -50%)'
                      }}
                    >
                      {/* Clean stage circle for full view */}
                      <div
                        className={`
                          w-12 h-12 rounded-full border-2 flex items-center justify-center transition-all duration-300 relative z-20
                          ${isPast 
                            ? 'bg-[#00FFFF] border-[#00FFFF] text-[#0A192F]' 
                            : ''
                          }
                          ${isCurrent 
                            ? 'bg-white dark:bg-slate-800 border-[#00FFFF] text-[#00FFFF] ring-2 ring-[#00FFFF]/15 -translate-y-1' 
                            : ''
                          }
                          ${isFuture 
                            ? 'bg-white dark:bg-slate-800 border-gray-300 dark:border-gray-600 text-gray-400' 
                            : ''
                          }
                        `}
                      >
                        {isPast ? (
                          <CheckCircle className="h-5 w-5" />
                        ) : (
                          <StageIcon className="h-5 w-5" />
                        )}
                      </div>
                      
                      {/* Stage label */}
                      <div className="text-center">
                        <div className={`text-xs font-medium ${isCurrent ? 'text-[#00FFFF]' : 'text-gray-600 dark:text-gray-400'}`}>
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
      {nextStage && showAdvanceButton && (
        <div className="flex items-center justify-between p-3 bg-gradient-to-r from-cyan-50 to-blue-50 dark:from-cyan-950 dark:to-blue-950 rounded-md border border-cyan-200 dark:border-cyan-800">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
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
        <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 rounded-lg border border-green-200 dark:border-green-800">
          <div className="flex items-center space-x-3">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <div>
              <div className="font-medium text-green-800 dark:text-green-200">
                {t('repair_completed', 'Repair Completed!')}
              </div>
              <div className="text-sm text-green-600 dark:text-green-300">
                {t('repair_completed_message', 'This repair has been successfully completed and finalized.')}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}