import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useLocalization } from "@/contexts/LocalizationContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle, HelpCircle, AlertTriangle, MessageSquare, Wrench } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { PossibleDefect } from "@shared/schema";

interface IssueQuestion {
  id: string;
  deviceType: string;
  questionOrder: number;
  questionKey: string;
  questionType: 'boolean' | 'text' | 'single_choice' | 'multiple_choice';
  isConditional: boolean;
  isRequired: boolean;
  options?: string[];
}

interface IssueAssessmentProps {
  deviceType: string;
  ticketId?: string;
  onComplete?: (responses: IssueResponse[], selectedDefects?: string[]) => void;
  readOnly?: boolean;
  shouldComplete?: boolean;
}

interface IssueResponse {
  questionId: string;
  answer: any;
}

interface IssueAssessmentResponse extends IssueResponse {
  selectedDefects?: string[]; // Array of defect IDs
}

export function IssueAssessment({ 
  deviceType, 
  ticketId, 
  onComplete, 
  readOnly = false,
  shouldComplete = false
}: IssueAssessmentProps) {
  const { t } = useLocalization();
  const queryClient = useQueryClient();
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [noComments, setNoComments] = useState<Record<string, string>>({});
  const [additionalComments, setAdditionalComments] = useState("");
  const [deviceTurnsOn, setDeviceTurnsOn] = useState<boolean | null>(null);
  const [selectedDefects, setSelectedDefects] = useState<string[]>([]);

  // Fetch issue questions for the device type
  const { data: questions = [], isLoading: questionsLoading } = useQuery<IssueQuestion[]>({
    queryKey: ['/api/issue-questions', deviceType],
    enabled: !!deviceType,
  });

  // Fetch possible defects for the device type (only when device doesn't turn on)
  const { 
    data: possibleDefects = [], 
    isLoading: defectsLoading,
    error: defectsError,
    refetch: refetchDefects
  } = useQuery<PossibleDefect[]>({
    queryKey: ['/api/possible-defects/device', deviceType],
    enabled: !!deviceType && deviceTurnsOn === false,
    retry: (failureCount, error: any) => {
      // Don't retry on authentication/authorization errors
      if (error?.message?.includes('401') || error?.message?.includes('403')) {
        return false;
      }
      // Retry up to 2 times for other errors
      return failureCount < 2;
    },
    select: (data: PossibleDefect[]) => {
      // Ensure alphabetical sorting as fallback
      return data.sort((a, b) => a.name.localeCompare(b.name));
    }
  });

  // Fetch existing responses if editing
  const { data: existingResponses = [] } = useQuery<any[]>({
    queryKey: ['/api/issue-responses', ticketId],
    enabled: !!ticketId && readOnly,
  });

  // Load existing responses into state
  useEffect(() => {
    if (existingResponses && existingResponses.length > 0) {
      const responseMap: Record<string, any> = {};
      (existingResponses as any[]).forEach((response: any) => {
        try {
          responseMap[response.questionId] = JSON.parse(response.response);
        } catch {
          responseMap[response.questionId] = response.response;
        }
      });
      setResponses(responseMap);
      
      // Set device turns on status (should only be one question now)
      const firstQuestion = (questions as IssueQuestion[]).find((q: IssueQuestion) => q.questionOrder === 1);
      if (firstQuestion && responseMap[firstQuestion.id] !== undefined) {
        setDeviceTurnsOn(responseMap[firstQuestion.id]);
      }
      
      // Load selected defects if they exist
      const defectsResponse = existingResponses.find((r: any) => r.questionId === 'selected_defects');
      if (defectsResponse) {
        try {
          let defects = JSON.parse(defectsResponse.response);
          
          // Handle double-serialized data (legacy format)
          if (typeof defects === 'string') {
            defects = JSON.parse(defects);
          }
          
          if (Array.isArray(defects)) {
            setSelectedDefects(defects);
          }
        } catch {
          // Ignore parsing errors for malformed data
        }
      }
    }
  }, [existingResponses, questions]);

  // Trigger completion when shouldComplete is set to true
  useEffect(() => {
    if (shouldComplete && onComplete) {
      handleCompleteAssessment();
    }
  }, [shouldComplete]);

  // Save responses mutation
  const saveResponsesMutation = useMutation({
    mutationFn: (data: { ticketId: string; responses: IssueResponse[] }) =>
      apiRequest('POST', '/api/issue-responses', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/issue-responses', ticketId] });
      if (onComplete) {
        const formattedResponses = Object.entries(responses).map(([questionId, answer]) => {
          // If answer is false and there's a comment, include it in the response
          const comment = noComments[questionId];
          const responseValue = answer === false && comment ? 
            { answer: false, comment } : 
            answer;
          
          return {
            questionId,
            answer: responseValue,
          };
        });
        onComplete(formattedResponses, selectedDefects.length > 0 ? selectedDefects : undefined);
      }
    },
  });

  // Handle response change
  const handleResponseChange = (questionId: string, value: any) => {
    setResponses(prev => ({ ...prev, [questionId]: value }));
    
    // Update device turns on status (should only be one question)
    setDeviceTurnsOn(value);
  };
  
  // Handle comment change for "No" responses
  const handleNoCommentChange = (questionId: string, comment: string) => {
    setNoComments(prev => ({ ...prev, [questionId]: comment }));
  };

  // Handle defect selection
  const handleDefectToggle = (defectId: string) => {
    setSelectedDefects(prev => 
      prev.includes(defectId)
        ? prev.filter(id => id !== defectId)
        : [...prev, defectId]
    );
  };

  // Handle save responses (for existing tickets)
  const handleSaveResponses = () => {
    if (!ticketId) return;
    
    const formattedResponses = Object.entries(responses).map(([questionId, answer]) => {
      // If answer is false and there's a comment, include it in the response
      const comment = noComments[questionId];
      const responseValue = answer === false && comment ? 
        { answer: false, comment } : 
        answer;
      
      return {
        questionId,
        answer: responseValue,
      };
    });

    // Add additional comments as a special response entry if they exist
    if (additionalComments.trim()) {
      formattedResponses.push({
        questionId: 'additional_comments', // Special identifier for additional comments
        answer: additionalComments.trim(),
      });
    }

    // Add selected defects as a special response entry if they exist
    if (selectedDefects.length > 0) {
      formattedResponses.push({
        questionId: 'selected_defects', // Special identifier for selected defects
        answer: selectedDefects, // Send as array - server will handle serialization
      });
    }

    saveResponsesMutation.mutate({
      ticketId,
      responses: formattedResponses,
    });
  };

  // Handle complete assessment (for new ticket creation)
  const handleCompleteAssessment = () => {
    if (onComplete) {
      const formattedResponses = Object.entries(responses).map(([questionId, answer]) => {
        // If answer is false and there's a comment, include it in the response
        const comment = noComments[questionId];
        const responseValue = answer === false && comment ? 
          { answer: false, comment } : 
          answer;
        
        return {
          questionId,
          answer: responseValue,
        };
      });

      // Add additional comments as a special response entry if they exist
      if (additionalComments.trim()) {
        formattedResponses.push({
          questionId: 'additional_comments', // Special identifier for additional comments
          answer: additionalComments.trim(),
        });
      }

      // Add selected defects as a special response entry if they exist
      if (selectedDefects.length > 0) {
        formattedResponses.push({
          questionId: 'selected_defects', // Special identifier for selected defects
          answer: selectedDefects, // Send as array - server will handle serialization
        });
      }

      onComplete(formattedResponses, selectedDefects.length > 0 ? selectedDefects : undefined);
    }
  };

  // With simplified assessment, show all questions (should only be one per device)
  const visibleQuestions = questions as IssueQuestion[];

  // Get response status for a question
  const getResponseStatus = (questionId: string) => {
    const hasResponse = responses[questionId] !== undefined && responses[questionId] !== "";
    return hasResponse;
  };

  // Render question based on type
  const renderQuestion = (question: IssueQuestion) => {
    const value = responses[question.id];
    const hasResponse = getResponseStatus(question.id);

    const questionText = t(question.questionKey, question.questionKey);
    const tooltipText = t(`${question.questionKey}_tooltip`, "");

    return (
      <Card key={question.id} className={`bg-gradient-to-br from-slate-800 via-slate-800 to-slate-700 border border-slate-600 shadow-lg transition-all duration-200 hover:border-cyan-500/50 ${hasResponse ? 'ring-2 ring-cyan-500/30 border-cyan-500/50' : ''}`}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-start justify-between text-base">
            <div className="flex items-start gap-3 flex-1">
              <Badge variant="outline" className="text-xs px-2 py-1 min-w-fit">
                {question.questionOrder}
              </Badge>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium leading-relaxed">
                    {questionText}
                    {question.isRequired && <span className="text-red-500 ml-1">*</span>}
                  </span>
                  {tooltipText && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs">{tooltipText}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 ml-2">
              {hasResponse ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : question.isRequired ? (
                <AlertCircle className="h-5 w-5 text-orange-500" />
              ) : (
                <div className="h-5 w-5" />
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {question.questionType === 'boolean' && (
            <div className="space-y-3">
              <RadioGroup
                value={value?.toString() || ""}
                onValueChange={(val) => handleResponseChange(question.id, val === "true")}
                disabled={readOnly}
                data-testid={`question-${question.questionOrder}`}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="true" id={`${question.id}-yes`} />
                  <Label htmlFor={`${question.id}-yes`} className="cursor-pointer">
                    {t("yes", "Yes")}
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="false" id={`${question.id}-no`} />
                  <Label htmlFor={`${question.id}-no`} className="cursor-pointer">
                    {t("no", "No")}
                  </Label>
                </div>
              </RadioGroup>
              
            </div>
          )}

          {question.questionType === 'single_choice' && question.options && (
            <RadioGroup
              value={value || ""}
              onValueChange={(val) => handleResponseChange(question.id, val)}
              disabled={readOnly}
              data-testid={`question-${question.questionOrder}`}
            >
              {question.options.map((option) => (
                <div key={option} className="flex items-center space-x-2">
                  <RadioGroupItem value={option} id={`${question.id}-${option}`} />
                  <Label htmlFor={`${question.id}-${option}`} className="cursor-pointer">
                    {t(option, option)}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          )}

          {question.questionType === 'text' && (
            <Textarea
              value={value || ""}
              onChange={(e) => handleResponseChange(question.id, e.target.value)}
              placeholder={t("enter_details", "Please provide details...")}
              disabled={readOnly}
              data-testid={`question-${question.questionOrder}`}
            />
          )}
        </CardContent>
      </Card>
    );
  };

  if (questionsLoading) {
    return (
      <div className="space-y-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">{t("loading_questions", "Loading diagnostic questions...")}</p>
        </div>
      </div>
    );
  }

  if (!(questions as IssueQuestion[]).length) {
    return (
      <div className="text-center py-8">
        <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">{t("no_questions", "No Questions Available")}</h3>
        <p className="text-muted-foreground">
          {t("no_questions_desc", "No diagnostic questions are available for this device type.")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Aurora Header */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-900 to-cyan-600 rounded-lg p-4 border border-slate-700">
        <div className="flex items-center gap-3 text-white">
          <MessageSquare className="w-6 h-6 text-cyan-100" />
          <div>
            <h3 className="text-xl font-bold">
              {t("issue_assessment", "Issue Assessment")}
            </h3>
            <p className="text-cyan-100 opacity-80 text-sm">
              {t("issue_assessment_desc", "Answer these questions to help us diagnose the problem")}
            </p>
          </div>
        </div>
      </div>

      {/* Progress indicator */}
      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <span>{t("questions", "Questions")}:</span>
        <span className="font-medium">
          {Object.keys(responses).length} / {visibleQuestions.length}
        </span>
        <span>{t("answered", "answered")}</span>
      </div>

      {/* Questions */}
      <div className="space-y-4">
        {visibleQuestions.map(renderQuestion)}
      </div>

      {/* Aurora Defects Section - Only shown when device doesn't turn on */}
      {deviceTurnsOn === false && (
        <Card className="bg-gradient-to-br from-slate-800 via-slate-800 to-slate-700 border border-slate-600 shadow-lg transition-all duration-200 hover:border-cyan-500/50">
          <CardHeader className="pb-3">
            <div className="bg-gradient-to-r from-slate-900 via-blue-900 to-cyan-600 rounded-lg p-4 -mx-6 -mt-6 mb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-white">
                  <Wrench className="w-6 h-6 text-cyan-100" />
                  <div>
                    <h4 className="text-lg font-semibold">
                      {t("select_defects", "Select visible defects or issues")}
                    </h4>
                    <p className="text-cyan-100 opacity-80 text-sm">
                      {t("defects_description", "Check all that apply to help us understand the device condition")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {selectedDefects.length > 0 && (
                    <Badge variant="secondary" className="text-xs bg-cyan-600/20 border-cyan-500/50 text-cyan-100">
                      {selectedDefects.length}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {defectsLoading ? (
              <div className="flex items-center justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mr-2"></div>
                <span className="text-sm text-muted-foreground">
                  {t("loading_defects", "Loading possible defects...")}
                </span>
              </div>
            ) : defectsError ? (
              <div className="flex flex-col items-center justify-center py-4 space-y-3">
                <div className="flex items-center text-red-500">
                  <AlertTriangle className="h-5 w-5 mr-2" />
                  <span className="text-sm font-medium">
                    {(defectsError as any)?.message?.includes('401') || (defectsError as any)?.message?.includes('403')
                      ? t("defects_auth_error", "Authentication error loading defects")
                      : (defectsError as any)?.message?.includes('404')
                      ? t("defects_not_found", "No defects configured for this device type")
                      : t("defects_load_error", "Failed to load possible defects")
                    }
                  </span>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => refetchDefects()}
                  className="text-xs bg-cyan-600/20 border-cyan-500/50 text-cyan-100 hover:bg-cyan-600/30 transition-colors"
                  data-testid="retry-defects"
                >
                  {t("retry", "Try Again")}
                </Button>
              </div>
            ) : possibleDefects.length === 0 ? (
              <div className="text-center py-4">
                <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  {t("no_defects_available", "No defects configured for this device type")}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {possibleDefects.map((defect) => (
                  <div
                    key={defect.id}
                    className="flex items-center space-x-3 p-3 rounded-lg border border-slate-600/50 bg-gradient-to-br from-slate-700/40 via-slate-700/40 to-slate-600/40 hover:bg-gradient-to-br hover:from-cyan-900/20 hover:via-slate-700/40 hover:to-slate-600/40 hover:border-cyan-500/50 transition-all duration-200"
                  >
                    <Checkbox
                      id={`defect-${defect.id}`}
                      checked={selectedDefects.includes(defect.id)}
                      onCheckedChange={() => handleDefectToggle(defect.id)}
                      disabled={readOnly}
                      data-testid={`checkbox-defect-${defect.name.toLowerCase().replace(/\s+/g, '-')}`}
                    />
                    <Label
                      htmlFor={`defect-${defect.id}`}
                      className="flex-1 text-sm cursor-pointer leading-relaxed"
                    >
                      {defect.name}
                    </Label>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Aurora Additional Comments */}
      <Card className="bg-gradient-to-br from-slate-800 via-slate-800 to-slate-700 border border-slate-600 shadow-lg transition-all duration-200 hover:border-cyan-500/50">
        <CardHeader>
          <div className="bg-gradient-to-r from-slate-900 via-blue-900 to-cyan-600 rounded-lg p-4 -mx-6 -mt-6 mb-4">
            <div className="flex items-center gap-3 text-white">
              <MessageSquare className="w-5 h-5 text-cyan-100" />
              <div>
                <h4 className="text-lg font-semibold">
                  {t("additional_comments", "Additional Comments")}
                </h4>
                <p className="text-cyan-100 opacity-80 text-sm">
                  {t("additional_comments_desc", "Provide any additional details about the device condition")}
                </p>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Textarea
            value={additionalComments}
            onChange={(e) => setAdditionalComments(e.target.value)}
            placeholder={t("additional_comments_placeholder", "Please describe any other problems or details...")}
            disabled={readOnly}
            rows={4}
            data-testid="textarea-additional-comments"
          />
        </CardContent>
      </Card>

      {/* Save button for editing mode only */}
      {!readOnly && ticketId && (
        <div className="flex justify-end">
          <Button
            onClick={handleSaveResponses}
            disabled={saveResponsesMutation.isPending}
            className="bg-cyan-600 border-cyan-500 text-white hover:bg-cyan-700 transition-colors"
            data-testid="button-save-assessment"
          >
            {saveResponsesMutation.isPending
              ? t("saving", "Saving...")
              : t("save_assessment", "Save Assessment")}
          </Button>
        </div>
      )}
    </div>
  );
}