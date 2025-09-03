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
import { AlertCircle, CheckCircle, HelpCircle, AlertTriangle, MessageSquare } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
  onComplete?: (responses: IssueResponse[]) => void;
  readOnly?: boolean;
  shouldComplete?: boolean;
}

interface IssueResponse {
  questionId: string;
  answer: any;
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

  // Fetch issue questions for the device type
  const { data: questions = [], isLoading: questionsLoading } = useQuery<IssueQuestion[]>({
    queryKey: ['/api/issue-questions', deviceType],
    enabled: !!deviceType,
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
        onComplete(formattedResponses);
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

      onComplete(formattedResponses);
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
      <Card key={question.id} className={`bg-slate-800/70 border border-[#00FFFF]/20 shadow-lg transition-all duration-200 ${hasResponse ? 'ring-2 ring-[#00FFFF]/30 bg-slate-700/70' : ''}`}>
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
      {/* Header */}
      <div className="text-center">
        <h3 className="text-xl font-semibold mb-2">
          {t("issue_assessment", "Issue Assessment")}
        </h3>
        <p className="text-muted-foreground">
          {t("issue_assessment_desc", "Answer these questions to help us diagnose the problem")}
        </p>
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

      {/* Additional Comments */}
      <Card className="bg-slate-800/70 border border-[#00FFFF]/20 shadow-lg">
        <CardHeader>
          <CardTitle className="text-base">
            {t("additional_comments", "Additional Comments")}
          </CardTitle>
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