import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useLocalization } from "@/contexts/LocalizationContext";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  AlertCircle, 
  Bot, 
  Lightbulb, 
  RefreshCw, 
  Home, 
  ArrowLeft,
  Loader2
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface RoutingSuggestion {
  type: 'route' | 'action' | 'info';
  title: string;
  description: string;
  path?: string;
  action?: () => void;
  confidence: number;
}

interface AIRoutingAssistantProps {
  error?: Error;
  resetError?: () => void;
}

export function AIRoutingAssistant({ error, resetError }: AIRoutingAssistantProps) {
  const [location, navigate] = useLocation();
  const { t } = useLocalization();
  const [suggestions, setSuggestions] = useState<RoutingSuggestion[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [debugInfo, setDebugInfo] = useState<any>(null);

  // Available routes in the app
  const availableRoutes = [
    { path: '/', name: 'Dashboard', description: t('routing.dashboard_desc', 'Main dashboard with business overview') },
    { path: '/clients', name: 'Clients', description: t('routing.clients_desc', 'Client management system') },
    { path: '/kanban', name: 'Kanban', description: t('routing.kanban_desc', 'Repair ticket management board') },
    { path: '/inventory', name: 'Inventory', description: t('routing.inventory_desc', 'Parts and stock management') },
    { path: '/pos', name: 'POS', description: t('routing.pos_desc', 'Point of sale system') },
    { path: '/support', name: 'Support', description: t('routing.support_desc', 'Customer support center') },
    { path: '/configs', name: 'AI Lists', description: t('routing.configs_desc', 'AI-generated device lists management') },
    { path: '/users', name: 'Users', description: t('routing.users_desc', 'User and team management') },
  ];

  useEffect(() => {
    if (error || location.includes('404') || location.includes('not-found')) {
      analyzeRoutingProblem();
    }
  }, [error, location]);

  const analyzeRoutingProblem = async () => {
    setIsAnalyzing(true);
    
    // Collect diagnostic information
    const diagnosticInfo = {
      currentPath: location,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
      referrer: document.referrer,
      errorMessage: error?.message,
      errorStack: error?.stack,
      availableRoutes: availableRoutes.map(r => r.path),
    };
    
    setDebugInfo(diagnosticInfo);
    
    // Generate AI-powered suggestions
    try {
      const generatedSuggestions = await generateRoutingSuggestions(diagnosticInfo);
      setSuggestions(generatedSuggestions);
    } catch (err) {
      console.error('Failed to generate routing suggestions:', err);
      // Fallback to basic suggestions
      setSuggestions(generateFallbackSuggestions());
    }
    
    setIsAnalyzing(false);
  };

  const generateRoutingSuggestions = async (diagnosticInfo: any): Promise<RoutingSuggestion[]> => {
    // Send diagnostic info to AI service for analysis
    const response = await fetch('/api/ai/analyze-routing-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(diagnosticInfo),
    });
    
    if (!response.ok) {
      throw new Error('Failed to get AI suggestions');
    }
    
    const result = await response.json();
    return result.suggestions || [];
  };

  const generateFallbackSuggestions = (): RoutingSuggestion[] => {
    const suggestions: RoutingSuggestion[] = [];
    
    // Suggest going home
    suggestions.push({
      type: 'route',
      title: t('routing.suggestion_home', 'Go to Dashboard'),
      description: t('routing.suggestion_home_desc', 'Return to the main dashboard'),
      path: '/',
      confidence: 0.9
    });

    // Find similar routes based on current path
    const currentPath = location.toLowerCase();
    const similarRoutes = availableRoutes.filter(route => {
      const routeName = route.name.toLowerCase();
      const routePath = route.path.toLowerCase();
      return currentPath.includes(routeName) || 
             routeName.includes(currentPath.replace('/', '')) ||
             routePath.includes(currentPath);
    });

    similarRoutes.forEach(route => {
      suggestions.push({
        type: 'route',
        title: t('routing.suggestion_similar', 'Try {name}').replace('{name}', route.name),
        description: route.description,
        path: route.path,
        confidence: 0.7
      });
    });

    // Add action suggestions
    suggestions.push({
      type: 'action',
      title: t('routing.suggestion_refresh', 'Refresh Page'),
      description: t('routing.suggestion_refresh_desc', 'Sometimes a simple refresh resolves the issue'),
      action: () => window.location.reload(),
      confidence: 0.5
    });

    // Add info suggestion
    suggestions.push({
      type: 'info',
      title: t('routing.suggestion_check_url', 'Check URL'),
      description: t('routing.suggestion_check_url_desc', 'Verify the URL is correct and complete'),
      confidence: 0.6
    });

    return suggestions.slice(0, 4); // Limit to 4 suggestions
  };

  const handleSuggestionClick = (suggestion: RoutingSuggestion) => {
    if (suggestion.path) {
      navigate(suggestion.path);
    } else if (suggestion.action) {
      suggestion.action();
    }
  };

  const getSuggestionIcon = (type: string) => {
    switch (type) {
      case 'route': return <Home className="w-4 h-4" />;
      case 'action': return <RefreshCw className="w-4 h-4" />;
      case 'info': return <Lightbulb className="w-4 h-4" />;
      default: return <Bot className="w-4 h-4" />;
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
    if (confidence >= 0.6) return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
    return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-2xl space-y-6">
        {/* Main Error Card */}
        <Card className="border-destructive/50 bg-destructive/5">
          <CardHeader>
            <div className="flex items-center gap-3">
              <AlertCircle className="w-8 h-8 text-destructive" />
              <div>
                <CardTitle className="text-xl">
                  {t('routing.error_title', 'Routing Error Detected')}
                </CardTitle>
                <CardDescription>
                  {t('routing.error_desc', 'The page you\'re looking for cannot be found')}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="bg-muted p-3 rounded-lg">
                <p className="text-sm font-mono text-muted-foreground">
                  {t('routing.current_path', 'Current path')}: <span className="text-foreground">{location}</span>
                </p>
              </div>
              
              {error && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>{t('routing.error_details', 'Error details')}:</strong> {error.message}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </CardContent>
        </Card>

        {/* AI Assistant Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Bot className="w-6 h-6 text-primary" />
              <div>
                <CardTitle>
                  {t('routing.ai_assistant_title', 'AI Routing Assistant')}
                </CardTitle>
                <CardDescription>
                  {t('routing.ai_assistant_desc', 'Smart suggestions to help you get back on track')}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isAnalyzing ? (
              <div className="flex items-center justify-center py-8">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>{t('routing.analyzing', 'Analyzing routing problem...')}</span>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {suggestions.length > 0 ? (
                  <>
                    <h4 className="font-medium text-sm text-muted-foreground mb-3">
                      {t('routing.suggestions_title', 'Suggested Actions')}
                    </h4>
                    <div className="grid gap-3">
                      {suggestions.map((suggestion, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group"
                          onClick={() => handleSuggestionClick(suggestion)}
                        >
                          <div className="flex items-center gap-3 flex-1">
                            <div className="text-primary">
                              {getSuggestionIcon(suggestion.type)}
                            </div>
                            <div className="flex-1">
                              <h5 className="font-medium text-sm group-hover:text-primary transition-colors">
                                {suggestion.title}
                              </h5>
                              <p className="text-xs text-muted-foreground">
                                {suggestion.description}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={getConfidenceColor(suggestion.confidence)}>
                              {Math.round(suggestion.confidence * 100)}%
                            </Badge>
                            <ArrowLeft className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors rotate-180" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Bot className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>{t('routing.no_suggestions', 'No suggestions available at the moment')}</p>
                  </div>
                )}

                {/* Quick Actions */}
                <div className="flex gap-2 pt-4 border-t">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => navigate('/')}
                    data-testid="button-go-home"
                  >
                    <Home className="w-4 h-4 mr-2" />
                    {t('routing.go_home', 'Go Home')}
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => window.history.back()}
                    data-testid="button-go-back"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    {t('routing.go_back', 'Go Back')}
                  </Button>
                  
                  {resetError && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={resetError}
                      data-testid="button-try-again"
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      {t('routing.try_again', 'Try Again')}
                    </Button>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}