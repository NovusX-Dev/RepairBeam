import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocalization } from "@/contexts/LocalizationContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AlertCircle, Bot, RefreshCw, Clock, CheckCircle2, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { AutoGenList } from "@shared/schema";

export default function Configs() {
  const { t } = useLocalization();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [updatingList, setUpdatingList] = useState<string | null>(null);
  const [expandedLists, setExpandedLists] = useState<Record<string, boolean>>({});

  // Fetch all auto-generated lists
  const { data: autoGenLists = [], isLoading, error } = useQuery<AutoGenList[]>({
    queryKey: ['/api/auto-gen-lists'],
    retry: 2,
  });

  // Update specific list mutation
  const updateListMutation = useMutation({
    mutationFn: async (category: string) => {
      setUpdatingList(category);
      const response = await fetch(`/api/auto-gen-lists/${category}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update list');
      }
      return response.json();
    },
    onSuccess: (data, category) => {
      toast({
        title: t('list_updated', 'List Updated'),
        description: t('list_updated_desc', `${category} brand list has been updated successfully.`),
      });
      queryClient.invalidateQueries({ queryKey: ['/api/auto-gen-lists'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auto-gen-lists', category] });
    },
    onError: (error: Error, category) => {
      toast({
        title: t('update_failed', 'Update Failed'),
        description: error.message,
        variant: 'destructive',
      });
    },
    onSettled: () => {
      setUpdatingList(null);
    },
  });

  // Initialize all lists mutation
  const initializeListsMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/auto-gen-lists/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to initialize lists');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: t('lists_initialized', 'Lists Initialized'),
        description: t('lists_initialized_desc', 'All AI-generated lists have been created successfully.'),
      });
      queryClient.invalidateQueries({ queryKey: ['/api/auto-gen-lists'] });
    },
    onError: (error: Error) => {
      toast({
        title: t('initialization_failed', 'Initialization Failed'),
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const canUpdateList = (list: AutoGenList) => {
    const now = new Date();
    const nextUpdate = new Date(list.nextUpdate);
    return now >= nextUpdate;
  };

  const getTimeUntilNextUpdate = (nextUpdate: string | Date) => {
    const now = new Date();
    const next = new Date(nextUpdate);
    const diff = next.getTime() - now.getTime();
    
    if (diff <= 0) return null;
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) {
      return `${days} ${t('days', 'days')}, ${hours} ${t('hours', 'hours')}`;
    }
    return `${hours} ${t('hours', 'hours')}`;
  };

  const getRefreshIntervalLabel = (interval: string) => {
    switch (interval) {
      case 'weekly': return t('weekly', 'Weekly');
      case 'biweekly': return t('biweekly', 'Bi-weekly');
      case 'monthly': return t('monthly', 'Monthly');
      case 'quarterly': return t('quarterly', 'Quarterly');
      default: return interval;
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center gap-3 mb-6">
          <Bot className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">{t('ai_lists_management', 'AI Lists Management')}</h1>
            <p className="text-muted-foreground">
              {t('ai_lists_desc', 'Manage AI-generated brand lists for device categories')}
            </p>
          </div>
        </div>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center gap-3 mb-6">
          <Bot className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">{t('ai_lists_management', 'AI Lists Management')}</h1>
            <p className="text-muted-foreground">
              {t('ai_lists_desc', 'Manage AI-generated brand lists for device categories')}
            </p>
          </div>
        </div>
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="w-5 h-5" />
              <span>{t('loading_error', 'Failed to load AI lists')}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center gap-3 mb-6">
        <Bot className="w-8 h-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">{t('ai_lists_management', 'AI Lists Management')}</h1>
          <p className="text-muted-foreground">
            {t('ai_lists_desc', 'Manage AI-generated brand lists for device categories')}
          </p>
        </div>
      </div>

      {/* Cost Warning */}
      <Card className="mb-6 border-amber-200 bg-amber-50 dark:bg-amber-950 dark:border-amber-800">
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
            <AlertCircle className="w-5 h-5" />
            <span className="font-medium">{t('cost_warning', '💰 Cost Warning')}</span>
          </div>
          <p className="text-sm text-amber-700 dark:text-amber-300 mt-2">
            {t('cost_warning_desc', 'Updating lists uses OpenAI API and costs money. Lists are set to update quarterly to minimize costs. Only update manually when necessary.')}
          </p>
        </CardContent>
      </Card>

      {/* Initialize Button */}
      {autoGenLists.length === 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{t('no_lists_found', 'No AI Lists Found')}</CardTitle>
            <CardDescription>
              {t('no_lists_desc', 'Initialize AI-generated brand lists for device categories')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => initializeListsMutation.mutate()}
              disabled={initializeListsMutation.isPending}
              className="w-full"
              data-testid="button-initialize-lists"
            >
              {initializeListsMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t('initializing', 'Initializing...')}
                </>
              ) : (
                <>
                  <Bot className="w-4 h-4 mr-2" />
                  {t('initialize_lists', '💰 Initialize AI Lists (Costs Money)')}
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Lists Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {autoGenLists.map((list) => {
          const canUpdate = canUpdateList(list);
          const timeUntilUpdate = getTimeUntilNextUpdate(list.nextUpdate);
          const isUpdating = updatingList === list.category;
          const isExpanded = expandedLists[list.id] || false;

          const toggleExpanded = () => {
            setExpandedLists(prev => ({
              ...prev,
              [list.id]: !prev[list.id]
            }));
          };

          return (
            <Card key={list.id} className="relative" data-testid={`card-list-${list.category.toLowerCase()}`}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{list.category} {t('brands', 'Brands')}</CardTitle>
                  <Badge variant={canUpdate ? 'default' : 'secondary'}>
                    {getRefreshIntervalLabel(list.refreshInterval)}
                  </Badge>
                </div>
                <CardDescription>
                  {list.items.length} {t('brands_available', 'brands available')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* List Items Preview */}
                <div className="mb-4">
                  <div className="flex flex-wrap gap-1 mb-2">
                    {(isExpanded ? list.items : list.items.slice(0, 6)).map((brand) => (
                      <Badge key={brand} variant="outline" className="text-xs">
                        {brand}
                      </Badge>
                    ))}
                  </div>
                  
                  {/* Expand/Collapse Controls */}
                  {list.items.length > 6 && (
                    <div className="flex justify-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={toggleExpanded}
                        className="text-xs h-6 px-2"
                        data-testid={`button-${isExpanded ? 'collapse' : 'expand'}-${list.category.toLowerCase()}`}
                      >
                        {isExpanded ? (
                          <>
                            {t('show_less', 'Show Less')}
                          </>
                        ) : (
                          <>
                            +{list.items.length - 6} {t('more', 'more')} - {t('show_all', 'Show All')}
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>

                <Separator className="mb-4" />

                {/* Last Updated */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                  <Clock className="w-4 h-4" />
                  <span>
                    {t('last_updated', 'Last updated')}: {list.lastGenerated ? new Date(list.lastGenerated).toLocaleDateString() : 'Never'}
                  </span>
                </div>

                {/* Next Update */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                  <RefreshCw className="w-4 h-4" />
                  <span>
                    {t('next_update', 'Next update')}: {new Date(list.nextUpdate).toLocaleDateString()}
                  </span>
                </div>

                {/* Update Button */}
                <Button
                  onClick={() => updateListMutation.mutate(list.category)}
                  disabled={!canUpdate || isUpdating || updateListMutation.isPending}
                  className="w-full"
                  variant={canUpdate ? 'default' : 'secondary'}
                  data-testid={`button-update-${list.category.toLowerCase()}`}
                >
                  {isUpdating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {t('updating', 'Updating...')}
                    </>
                  ) : canUpdate ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      {t('update_list', '💰 Update List')}
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      {t('up_to_date', 'Up to Date')}
                    </>
                  )}
                </Button>

                {/* Time until next update error */}
                {!canUpdate && timeUntilUpdate && (
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    {t('available_in', 'Available in')}: {timeUntilUpdate}
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}