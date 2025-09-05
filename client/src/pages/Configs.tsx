import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocalization } from "@/contexts/LocalizationContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, Bot, RefreshCw, Clock, CheckCircle2, Loader2, Smartphone, RotateCcw, AlertTriangle, Store, Shield, Settings, Upload, Plus, Edit, Trash2, ImageIcon, Wrench } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { GenerationProgressDialog } from "@/components/GenerationProgressDialog";
import { FileUpload } from "@/components/FileUpload";
import type { AutoGenList, StoreSettings, WarrantyTier, RepairService } from "@shared/schema";

export default function Configs() {
  const { t, currentLanguage } = useLocalization();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // AI Lists state
  const [updatingList, setUpdatingList] = useState<string | null>(null);
  const [expandedLists, setExpandedLists] = useState<Record<string, boolean>>({});
  const [generatingModels, setGeneratingModels] = useState<string | null>(null);
  const [showProgressDialog, setShowProgressDialog] = useState(false);
  const [progressCategory, setProgressCategory] = useState<string>("");
  const [progressError, setProgressError] = useState<string>("");

  // Store settings state
  const [storeFormData, setStoreFormData] = useState<Partial<StoreSettings>>({});
  const [originalFormData, setOriginalFormData] = useState<Partial<StoreSettings>>({});
  const [isEditingStore, setIsEditingStore] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Warranty tiers state
  const [editingTier, setEditingTier] = useState<string | null>(null);
  const [newTier, setNewTier] = useState<Partial<WarrantyTier>>({});
  const [showAddTier, setShowAddTier] = useState(false);

  // Repair services state
  const [editingService, setEditingService] = useState<string | null>(null);
  const [newService, setNewService] = useState<Partial<RepairService>>({});
  const [showAddService, setShowAddService] = useState(false);
  
  // Shop identity edit state
  const [tempLogoUrl, setTempLogoUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [tempShopName, setTempShopName] = useState('');
  const [tempShopAlias, setTempShopAlias] = useState('');

  // Device types for warranty configuration
  const deviceTypes = ["Phone", "Laptop", "Desktop"];

  // Fetch store settings
  const { data: storeSettings } = useQuery<StoreSettings | null>({
    queryKey: ['/api/store-settings'],
  });
  
  // Get tenant data for fallback values
  const { data: tenantData } = useQuery<any>({
    queryKey: ['/api/tenants/current'],
  });

  // Fetch warranty tiers
  const { data: warrantyTiers = [] } = useQuery<WarrantyTier[]>({
    queryKey: ['/api/warranty-tiers'],
  });

  // Fetch repair services
  const { data: repairServices = [] } = useQuery<RepairService[]>({
    queryKey: ['/api/repair-services'],
  });

  // Fetch auto-generated lists
  const { data: autoGenLists = [], isLoading: isLoadingLists } = useQuery<AutoGenList[]>({
    queryKey: ['/api/auto-gen-lists'],
    retry: 2,
  });

  // Helper function for currency formatting
  const formatCurrency = (amount: number) => {
    const locale = currentLanguage.code === 'pt-BR' ? 'pt-BR' : 'en-US';
    const currency = currentLanguage.code === 'pt-BR' ? 'BRL' : 'USD';
    
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
    }).format(amount);
  };

  // Store settings mutations
  const storeSettingsMutation = useMutation({
    mutationFn: async (data: Partial<StoreSettings>) => {
      const method = storeSettings ? 'PUT' : 'POST';
      // Remove timestamp fields to avoid the toISOString error
      const { createdAt, updatedAt, id, ...cleanData } = data;
      const response = await fetch('/api/store-settings', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cleanData),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || `Failed to ${method.toLowerCase()} store settings`);
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: t('settings_saved', 'Settings Saved'),
        description: t('store_settings_saved', 'Store settings have been saved successfully.'),
      });
      queryClient.invalidateQueries({ queryKey: ['/api/store-settings'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tenants/current'] });
      setIsEditingStore(false);
      setHasUnsavedChanges(false);
    },
    onError: (error: Error) => {
      toast({
        title: t('save_failed', 'Save Failed'),
        description: error.message,
        variant: 'destructive',
      });
    },
  });


  // Warranty tier mutations
  const createTierMutation = useMutation({
    mutationFn: async (data: Partial<WarrantyTier>) => {
      const response = await apiRequest('POST', '/api/warranty-tiers', data);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: t('tier_created', 'Tier Created'),
        description: t('warranty_tier_created', 'Warranty tier has been created successfully.'),
      });
      queryClient.invalidateQueries({ queryKey: ['/api/warranty-tiers'] });
      setShowAddTier(false);
      setNewTier({});
    },
    onError: (error: Error) => {
      toast({
        title: t('create_failed', 'Create Failed'),
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const updateTierMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<WarrantyTier> }) => {
      const response = await apiRequest('PUT', `/api/warranty-tiers/${id}`, data);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: t('tier_updated', 'Tier Updated'),
        description: t('warranty_tier_updated', 'Warranty tier has been updated successfully.'),
      });
      queryClient.invalidateQueries({ queryKey: ['/api/warranty-tiers'] });
      setEditingTier(null);
    },
    onError: (error: Error) => {
      toast({
        title: t('update_failed', 'Update Failed'),
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const deleteTierMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest('DELETE', `/api/warranty-tiers/${id}`);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: t('tier_deleted', 'Tier Deleted'),
        description: t('warranty_tier_deleted', 'Warranty tier has been deleted successfully.'),
      });
      queryClient.invalidateQueries({ queryKey: ['/api/warranty-tiers'] });
    },
    onError: (error: Error) => {
      toast({
        title: t('delete_failed', 'Delete Failed'),
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Repair service mutations
  const createServiceMutation = useMutation({
    mutationFn: async (data: Partial<RepairService>) => {
      const response = await apiRequest('POST', '/api/repair-services', data);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: t('service_created', 'Service Created'),
        description: t('repair_service_created', 'Repair service has been created successfully.'),
      });
      queryClient.invalidateQueries({ queryKey: ['/api/repair-services'] });
      setShowAddService(false);
      setNewService({});
    },
    onError: (error: Error) => {
      toast({
        title: t('create_failed', 'Create Failed'),
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const updateServiceMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<RepairService> }) => {
      const response = await apiRequest('PUT', `/api/repair-services/${id}`, data);
      return await response.json();
    },
    onSuccess: () => {
      // Don't show toast for individual field updates to avoid spam
      queryClient.invalidateQueries({ queryKey: ['/api/repair-services'] });
      // Don't automatically exit edit mode - let user decide when they're done
    },
    onError: (error: Error) => {
      toast({
        title: t('update_failed', 'Update Failed'),
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const deleteServiceMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest('DELETE', `/api/repair-services/${id}`);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: t('service_deleted', 'Service Deleted'),
        description: t('repair_service_deleted', 'Repair service has been deleted successfully.'),
      });
      queryClient.invalidateQueries({ queryKey: ['/api/repair-services'] });
    },
    onError: (error: Error) => {
      toast({
        title: t('delete_failed', 'Delete Failed'),
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Initialize store settings form
  useEffect(() => {
    if (storeSettings && !isEditingStore) {
      const formData = { ...storeSettings };
      setStoreFormData(formData);
      setOriginalFormData(formData);
      setHasUnsavedChanges(false);
    } else if (!storeSettings && !isEditingStore) {
      // Initialize with empty form data when no store settings exist
      const emptyData = {};
      setStoreFormData(emptyData);
      setOriginalFormData(emptyData);
      setHasUnsavedChanges(false);
    }
  }, [storeSettings, isEditingStore]);

  // Check for unsaved changes
  useEffect(() => {
    const hasChanges = JSON.stringify(storeFormData) !== JSON.stringify(originalFormData);
    setHasUnsavedChanges(hasChanges);
  }, [storeFormData, originalFormData]);

  // AI Lists mutations (existing functionality)
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

  // Models generation mutation
  const generateModelsMutation = useMutation({
    mutationFn: async (category: string) => {
      setGeneratingModels(category);
      setShowProgressDialog(true);
      setProgressCategory(category);
      setProgressError("");
      
      const response = await fetch(`/api/auto-gen-lists/${category}/generate-models`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to generate models');
      }
      return response.json();
    },
    onSuccess: (data, category) => {
      toast({
        title: t('models_generated', 'Models Generated'),
        description: t('models_generated_desc', `Model lists for ${category} brands have been generated successfully.`),
      });
      queryClient.invalidateQueries({ queryKey: ['/api/auto-gen-lists'] });
    },
    onError: (error: Error, category) => {
      setProgressError(error.message);
      toast({
        title: t('generation_failed', 'Generation Failed'),
        description: error.message,
        variant: 'destructive',
      });
    },
    onSettled: () => {
      setGeneratingModels(null);
    },
  });

  // Handle model generation
  const handleGenerateModels = (category: string) => {
    generateModelsMutation.mutate(category);
  };

  // Helper functions for dates and refresh intervals (existing functionality)
  const canUpdateList = (list: AutoGenList): boolean => {
    if (!list.nextUpdate) return true;
    return new Date() >= new Date(list.nextUpdate);
  };

  const getTimeUntilNextUpdate = (nextUpdate: string): string => {
    const now = new Date();
    const next = new Date(nextUpdate);
    const diff = next.getTime() - now.getTime();
    
    if (diff <= 0) return t('can_update_now', 'Can update now');
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    
    if (days > 0) return t('days_until_update', `${days} days until next update`);
    return t('hours_until_update', `${hours} hours until next update`);
  };

  const getRefreshIntervalLabel = (interval: string): string => {
    const intervals: Record<string, string> = {
      'quarterly': t('quarterly', 'Quarterly'),
      'monthly': t('monthly', 'Monthly'),
      'weekly': t('weekly', 'Weekly'),
      'daily': t('daily', 'Daily'),
    };
    return intervals[interval] || interval;
  };

  const handleStoreSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    storeSettingsMutation.mutate(storeFormData);
  };

  // Shop identity change handlers
  const handleShopNameChange = () => {
    if (tempShopName.trim()) {
      storeSettingsMutation.mutate({ 
        shopName: tempShopName.trim() 
      });
      setTempShopName('');
    }
  };

  const handleShopAliasChange = () => {
    const aliasValue = tempShopAlias.trim() || null;
    
    // Update store settings only (single source of truth)
    storeSettingsMutation.mutate({ 
      shopAlias: aliasValue
    });
    
    setTempShopAlias('');
  };

  const handleLogoChange = async () => {
    if (selectedFile) {
      // Handle file upload
      try {
        setUploadingLogo(true);
        
        // Get upload URL from backend
        const uploadResponse = await fetch('/api/objects/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        if (!uploadResponse.ok) {
          throw new Error('Failed to get upload URL');
        }
        const uploadData = await uploadResponse.json() as { uploadURL: string };
        
        // Upload file to object storage
        await fetch(uploadData.uploadURL, {
          method: 'PUT',
          body: selectedFile,
        });
        
        // Normalize the upload URL to an object path
        const normalizeResponse = await fetch('/api/objects/normalize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uploadURL: uploadData.uploadURL }),
        });
        if (!normalizeResponse.ok) {
          throw new Error('Failed to normalize upload URL');
        }
        const normalizeData = await normalizeResponse.json() as { objectPath: string };
        
        // Update store settings with the normalized object path
        storeSettingsMutation.mutate({ 
          shopLogoUrl: normalizeData.objectPath
        });
        
        // Clear temporary states
        setSelectedFile(null);
        setPreviewUrl(null);
        setTempLogoUrl('');
        
      } catch (error) {
        console.error('Logo upload failed:', error);
        toast({
          title: t('upload_failed', 'Upload Failed'),
          description: t('logo_upload_error', 'Failed to upload logo. Please try again.'),
          variant: 'destructive',
        });
      } finally {
        setUploadingLogo(false);
      }
    } else {
      // Handle URL input (fallback)
      storeSettingsMutation.mutate({ 
        shopLogoUrl: tempLogoUrl.trim() || null
      });
      setTempLogoUrl('');
    }
  };

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    // Create preview URL
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setTempLogoUrl(''); // Clear URL input when file is selected
  };

  const handleClearPreview = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setSelectedFile(null);
  };

  const handleTierSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (showAddTier) {
      createTierMutation.mutate(newTier);
    }
  };

  const handleEditTier = (tier: WarrantyTier) => {
    setEditingTier(tier.id);
  };

  const handleUpdateTier = (tier: WarrantyTier, field: string, value: any) => {
    const updatedData = { [field]: value };
    updateTierMutation.mutate({ id: tier.id, data: updatedData });
  };

  const handleDeleteTier = (tierId: string) => {
    if (confirm(t('confirm_delete_tier', 'Are you sure you want to delete this warranty tier?'))) {
      deleteTierMutation.mutate(tierId);
    }
  };

  // Repair service handlers
  const handleServiceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (showAddService) {
      createServiceMutation.mutate(newService);
    }
  };

  const handleEditService = (service: RepairService) => {
    setEditingService(service.id);
  };

  const handleUpdateService = (service: RepairService, field: string, value: any) => {
    const updatedData = { [field]: value };
    updateServiceMutation.mutate({ id: service.id, data: updatedData });
  };

  const handleDeleteService = (serviceId: string) => {
    if (confirm(t('confirm_delete_service', 'Are you sure you want to delete this repair service?'))) {
      deleteServiceMutation.mutate(serviceId);
    }
  };

  // Helper function for time formatting
  const formatCompletionTime = (hours: number, minutes: number): string => {
    const parts = [];
    
    if (hours > 0) {
      parts.push(`${hours} ${hours === 1 ? t('hour', 'hour') : t('hours', 'hours')}`);
    }
    
    if (minutes > 0) {
      parts.push(`${minutes} ${minutes === 1 ? t('minute', 'minute') : t('minutes', 'minutes')}`);
    }
    
    if (parts.length === 0) {
      return `0 ${t('minutes', 'minutes')}`;
    }
    
    return parts.join(', ');
  };

  // Group warranty tiers by device type
  const tiersByDeviceType = warrantyTiers.reduce((acc, tier) => {
    if (!acc[tier.deviceType]) {
      acc[tier.deviceType] = [];
    }
    acc[tier.deviceType].push(tier);
    return acc;
  }, {} as Record<string, WarrantyTier[]>);

  // Group repair services by device type
  const servicesByDeviceType = repairServices.reduce((acc, service) => {
    if (!acc[service.deviceType]) {
      acc[service.deviceType] = [];
    }
    acc[service.deviceType].push(service);
    return acc;
  }, {} as Record<string, RepairService[]>);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Page Header with Aurora Card Design - Compact */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-900 to-cyan-600 rounded-lg p-4 mb-6 border border-slate-700">
        <div className="flex items-center gap-3 text-white">
          <Settings className="w-6 h-6 text-cyan-100" />
          <div>
            <h1 className="text-xl font-bold">{t('system_configurations', 'System Configurations')}</h1>
            <p className="text-cyan-100 opacity-80 text-sm">{t('config_description', 'Manage your shop settings, warranty policies, and AI-powered features')}</p>
          </div>
        </div>
      </div>

      {/* Tabbed Configuration Sections */}
      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5 max-w-2xl">
          <TabsTrigger value="general" className="flex items-center gap-2" data-testid="tab-general">
            <Store className="w-4 h-4" />
            {t('general', 'General')}
          </TabsTrigger>
          <TabsTrigger value="warranty" className="flex items-center gap-2" data-testid="tab-warranty">
            <Shield className="w-4 h-4" />
            {t('warranty', 'Warranty')}
          </TabsTrigger>
          <TabsTrigger value="repair-services" className="flex items-center gap-2" data-testid="tab-repair-services">
            <Wrench className="w-4 h-4" />
            {t('repair_services', 'Services')}
          </TabsTrigger>
          <TabsTrigger value="ai-lists" className="flex items-center gap-2" data-testid="tab-ai-lists">
            <Bot className="w-4 h-4" />
            {t('ai_lists', 'AI Lists')}
          </TabsTrigger>
          <TabsTrigger value="advanced" className="flex items-center gap-2" data-testid="tab-advanced">
            <Settings className="w-4 h-4" />
            {t('advanced', 'Advanced')}
          </TabsTrigger>
        </TabsList>

        {/* General Store Information Tab */}
        <TabsContent value="general" className="space-y-6">
          <Card className="bg-slate-800/70 border-slate-700">
            <CardHeader>
              <div className="bg-gradient-to-r from-slate-900 via-blue-900 to-cyan-600 rounded-lg p-4 -mx-6 -mt-6 mb-4">
                <div className="flex items-center gap-3 text-white">
                  <Store className="w-6 h-6 text-cyan-100" />
                  <div>
                    <CardTitle className="text-lg">{t('general_store_info', 'General Store Information')}</CardTitle>
                    <CardDescription className="text-cyan-100 opacity-80">
                      {t('store_info_desc', 'Configure your shop\'s basic information and branding')}
                    </CardDescription>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <form onSubmit={handleStoreSubmit} className="space-y-6">
                {/* Shop Identity Section */}
                <div className="space-y-4">
                  <h4 className="text-lg font-semibold text-cyan-100 border-b border-slate-600 pb-2">
                    {t('shop_identity', 'Shop Identity')}
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Shop Name */}
                    <div className="space-y-2">
                      <Label>{t('shop_name', 'Shop Name')}</Label>
                      <div className="p-3 bg-slate-700/50 rounded-lg border border-slate-600">
                        <div className="font-medium text-sm text-cyan-100">
                          {storeSettings?.shopName || tenantData?.name || t('not_set', 'Not set')}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {t('shop_name_help', 'Full legal name of your repair business')}
                        </p>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm" className="mt-2">
                              <Edit className="w-4 h-4 mr-2" />
                              {t('change', 'Change')}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>{t('change_shop_name', 'Change Shop Name')}</AlertDialogTitle>
                              <AlertDialogDescription>
                                {t('change_shop_name_desc', 'Enter the new legal name for your repair business.')}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <div className="space-y-2">
                              <Input
                                value={tempShopName}
                                onChange={(e) => setTempShopName(e.target.value)}
                                placeholder={t('enter_shop_name', 'Enter your shop name')}
                                data-testid="input-new-shop-name"
                              />
                            </div>
                            <AlertDialogFooter>
                              <AlertDialogCancel onClick={() => setTempShopName('')}>
                                {t('cancel', 'Cancel')}
                              </AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleShopNameChange()}
                                disabled={!tempShopName.trim()}
                              >
                                {t('save_changes', 'Save Changes')}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                    
                    {/* Display Name */}
                    <div className="space-y-2">
                      <Label>{t('shop_alias', 'Display Name')}</Label>
                      <div className="p-3 bg-slate-700/50 rounded-lg border border-slate-600">
                        <div className="font-medium text-sm text-cyan-100">
                          {storeSettings?.shopAlias || tenantData?.alias || t('not_set', 'Not set')}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {t('shop_alias_help', 'Short name shown in user interface')}
                        </p>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm" className="mt-2">
                              <Edit className="w-4 h-4 mr-2" />
                              {t('change', 'Change')}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>{t('change_display_name', 'Change Display Name')}</AlertDialogTitle>
                              <AlertDialogDescription>
                                {t('change_display_name_desc', 'Enter the short name to display in the user interface.')}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <div className="space-y-2">
                              <Input
                                value={tempShopAlias}
                                onChange={(e) => setTempShopAlias(e.target.value)}
                                placeholder={t('enter_shop_alias', 'Enter display name')}
                                data-testid="input-new-shop-alias"
                              />
                            </div>
                            <AlertDialogFooter>
                              <AlertDialogCancel onClick={() => setTempShopAlias('')}>
                                {t('cancel', 'Cancel')}
                              </AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleShopAliasChange()}
                              >
                                {t('save_changes', 'Save Changes')}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </div>
                  
                  {/* Shop Logo Section */}
                  <div className="space-y-2">
                    <Label>{t('shop_logo', 'Shop Logo')}</Label>
                    <div className="p-3 bg-slate-700/50 rounded-lg border border-slate-600">
                      <div className="flex gap-4 items-start">
                        {/* Current Logo Display */}
                        {(storeSettings?.shopLogoUrl || tenantData?.shopImageUrl) ? (
                          <div className="flex-shrink-0">
                            <img 
                              src={storeSettings?.shopLogoUrl || tenantData?.shopImageUrl} 
                              alt="Current shop logo" 
                              className="w-16 h-16 object-contain rounded-lg border border-slate-500 bg-slate-600/50"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          </div>
                        ) : (
                          <div className="flex-shrink-0 w-16 h-16 bg-slate-600 rounded-lg border border-slate-500 flex items-center justify-center">
                            <ImageIcon className="w-8 h-8 text-slate-400" />
                          </div>
                        )}
                        
                        <div className="flex-1">
                          <div className="font-medium text-sm text-cyan-100 mb-1">
                            {(storeSettings?.shopLogoUrl || tenantData?.shopImageUrl) ? t('logo_set', 'Logo URL set') : t('no_logo', 'No logo set')}
                          </div>
                          <p className="text-xs text-muted-foreground mb-2">
                            {t('logo_help', 'Upload an image or provide a URL for your shop logo')}
                          </p>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="outline" size="sm">
                                <Edit className="w-4 h-4 mr-2" />
                                {(storeSettings?.shopLogoUrl || tenantData?.shopImageUrl) ? t('change_logo', 'Change Logo') : t('add_logo', 'Add Logo')}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  {(storeSettings?.shopLogoUrl || tenantData?.shopImageUrl) ? t('change_logo', 'Change Logo') : t('add_logo', 'Add Logo')}
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  {t('logo_upload_desc', 'Upload an image file (PNG, JPEG, JPG) or provide a URL for your shop logo.')}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <div className="space-y-4">
                                {/* File Upload Component */}
                                <FileUpload
                                  onFileSelect={handleFileSelect}
                                  maxSize={5}
                                  acceptedTypes={['image/png', 'image/jpeg', 'image/jpg']}
                                  preview={previewUrl}
                                  onClearPreview={handleClearPreview}
                                />
                                
                                {/* Divider */}
                                <div className="flex items-center space-x-2">
                                  <div className="flex-1 border-t border-slate-600"></div>
                                  <span className="text-xs text-muted-foreground px-2">OR</span>
                                  <div className="flex-1 border-t border-slate-600"></div>
                                </div>
                                
                                {/* URL Input (Alternative) */}
                                <div className="space-y-2">
                                  <Label htmlFor="logo-url" className="text-sm text-slate-300">
                                    {t('logo_url_option', 'Enter logo URL')}
                                  </Label>
                                  <Input
                                    id="logo-url"
                                    value={tempLogoUrl}
                                    onChange={(e) => setTempLogoUrl(e.target.value)}
                                    placeholder={t('enter_logo_url', 'https://example.com/logo.png')}
                                    data-testid="input-new-logo-url"
                                    disabled={!!selectedFile}
                                  />
                                  {tempLogoUrl && !selectedFile && (
                                    <div className="mt-2">
                                      <p className="text-sm text-muted-foreground mb-2">{t('preview', 'Preview')}:</p>
                                      <img 
                                        src={tempLogoUrl} 
                                        alt="Logo preview" 
                                        className="w-16 h-16 object-contain rounded-lg border border-slate-500 bg-slate-600/50"
                                        onError={(e) => {
                                          e.currentTarget.style.display = 'none';
                                        }}
                                      />
                                    </div>
                                  )}
                                </div>
                              </div>
                              <AlertDialogFooter>
                                <AlertDialogCancel onClick={() => {
                                  setTempLogoUrl('');
                                  handleClearPreview();
                                }}>
                                  {t('cancel', 'Cancel')}
                                </AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleLogoChange()}
                                  disabled={uploadingLogo || (!selectedFile && !tempLogoUrl.trim())}
                                  data-testid="button-save-logo"
                                >
                                  {uploadingLogo ? (
                                    <>
                                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                      {t('uploading', 'Uploading...')}
                                    </>
                                  ) : (
                                    t('save_changes', 'Save Changes')
                                  )}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>


                {/* Business Details Section */}
                <div className="space-y-4">
                  <h4 className="text-lg font-semibold text-cyan-100 border-b border-slate-600 pb-2">
                    {t('business_details', 'Business Details')}
                  </h4>
                  
                  <div className="space-y-2">
                    <Label htmlFor="shopDescription">{t('shop_description', 'Shop Description')}</Label>
                    <Textarea
                      id="shopDescription"
                      value={storeFormData.shopDescription || ''}
                      onChange={(e) => setStoreFormData(prev => ({ ...prev, shopDescription: e.target.value }))}
                      placeholder={t('enter_shop_description', 'Describe your shop and services')}
                      rows={3}
                      data-testid="textarea-shop-description"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="address">{t('shop_address', 'Shop Address')}</Label>
                    <Textarea
                      id="address"
                      value={storeFormData.address || ''}
                      onChange={(e) => setStoreFormData(prev => ({ ...prev, address: e.target.value }))}
                      placeholder={t('enter_shop_address', 'Enter complete shop address')}
                      rows={2}
                      data-testid="textarea-shop-address"
                    />
                  </div>
                </div>

                <div className="flex justify-between items-center pt-4">
                  {hasUnsavedChanges && (
                    <div className="flex items-center gap-2 text-amber-400 text-sm">
                      <AlertCircle className="w-4 h-4" />
                      {t('unsaved_changes', 'You have unsaved changes')}
                    </div>
                  )}
                  <div className="flex justify-end gap-3 ml-auto">
                    <Button
                      type="submit"
                      disabled={storeSettingsMutation.isPending || !hasUnsavedChanges}
                      data-testid="button-save-store-settings"
                    >
                      {storeSettingsMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          {t('saving', 'Saving...')}
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                          {t('save_settings', 'Save Settings')}
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Warranty Tiers Management Tab */}
        <TabsContent value="warranty" className="space-y-6">
          <Card className="bg-slate-800/70 border-slate-700">
            <CardHeader>
              <div className="bg-gradient-to-r from-slate-900 via-blue-900 to-cyan-600 rounded-lg p-4 -mx-6 -mt-6 mb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-white">
                    <Shield className="w-6 h-6 text-cyan-100" />
                    <div>
                      <CardTitle className="text-lg">{t('warranty_management', 'Warranty Management')}</CardTitle>
                      <CardDescription className="text-cyan-100 opacity-80">
                        {t('warranty_desc', 'Configure warranty tiers and pricing for each device type')}
                      </CardDescription>
                    </div>
                  </div>
                  <Button
                    onClick={() => setShowAddTier(!showAddTier)}
                    variant="outline"
                    size="sm"
                    className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                    data-testid="button-add-warranty-tier"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    {t('add_tier', 'Add Tier')}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Add New Tier Form */}
              {showAddTier && (
                <Card className="bg-slate-700/50 border-slate-600">
                  <CardHeader>
                    <CardTitle className="text-lg text-white">{t('add_warranty_tier', 'Add Warranty Tier')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleTierSubmit} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="deviceType">{t('device_type', 'Device Type')}</Label>
                          <Select
                            value={newTier.deviceType || ''}
                            onValueChange={(value) => setNewTier(prev => ({ ...prev, deviceType: value }))}
                          >
                            <SelectTrigger data-testid="select-device-type">
                              <SelectValue placeholder={t('select_device_type', 'Select device type')} />
                            </SelectTrigger>
                            <SelectContent>
                              {deviceTypes.map(type => (
                                <SelectItem key={type} value={type}>{type}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="tierType">{t('tier_type', 'Tier Type')}</Label>
                          <Select
                            value={newTier.tierType || ''}
                            onValueChange={(value) => setNewTier(prev => ({ ...prev, tierType: value }))}
                          >
                            <SelectTrigger data-testid="select-tier-type">
                              <SelectValue placeholder={t('select_tier_type', 'Select tier type')} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="standard">{t('standard', 'Standard')}</SelectItem>
                              <SelectItem value="extended">{t('extended', 'Extended')}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="duration">{t('duration_months', 'Duration (Months)')}</Label>
                          <Input
                            id="duration"
                            type="number"
                            value={newTier.durationMonths || ''}
                            onChange={(e) => setNewTier(prev => ({ ...prev, durationMonths: parseInt(e.target.value) }))}
                            placeholder={t('enter_duration', 'Enter duration')}
                            data-testid="input-duration-months"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="price">{t('price', 'Price')}</Label>
                          <Input
                            id="price"
                            type="number"
                            step="0.01"
                            value={newTier.price || ''}
                            onChange={(e) => setNewTier(prev => ({ ...prev, price: e.target.value }))}
                            placeholder={t('enter_price', 'Enter price')}
                            data-testid="input-tier-price"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="description">{t('description', 'Description')}</Label>
                        <Textarea
                          id="description"
                          value={newTier.description || ''}
                          onChange={(e) => setNewTier(prev => ({ ...prev, description: e.target.value }))}
                          placeholder={t('enter_tier_description', 'Describe what this warranty tier covers')}
                          rows={2}
                          data-testid="textarea-tier-description"
                        />
                      </div>

                      <div className="flex justify-end gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setShowAddTier(false);
                            setNewTier({});
                          }}
                        >
                          {t('cancel', 'Cancel')}
                        </Button>
                        <Button
                          type="submit"
                          disabled={createTierMutation.isPending}
                          data-testid="button-save-warranty-tier"
                        >
                          {createTierMutation.isPending ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              {t('creating', 'Creating...')}
                            </>
                          ) : (
                            <>
                              <Plus className="w-4 h-4 mr-2" />
                              {t('create_tier', 'Create Tier')}
                            </>
                          )}
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              )}

              {/* Existing Warranty Tiers by Device Type */}
              <div className="space-y-4">
                {deviceTypes.map(deviceType => {
                  const deviceTiers = tiersByDeviceType[deviceType] || [];
                  const standardTier = deviceTiers.find(t => t.tierType === 'standard');
                  const extendedTier = deviceTiers.find(t => t.tierType === 'extended');

                  return (
                    <Card key={deviceType} className="bg-slate-700/30 border-slate-600" data-testid={`card-device-${deviceType.toLowerCase()}`}>
                      <CardHeader>
                        <CardTitle className="text-white flex items-center gap-2">
                          <Smartphone className="w-5 h-5 text-cyan-400" />
                          {deviceType} {t('warranty_tiers', 'Warranty Tiers')}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Standard Tier */}
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <Badge variant="outline" className="bg-green-100 text-green-800">
                                {t('standard', 'Standard')}
                              </Badge>
                              {standardTier && (
                                <div className="flex gap-1">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleEditTier(standardTier)}
                                    data-testid={`button-edit-standard-${deviceType.toLowerCase()}`}
                                  >
                                    <Edit className="w-3 h-3" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleDeleteTier(standardTier.id)}
                                    className="text-red-400 hover:text-red-300"
                                    data-testid={`button-delete-standard-${deviceType.toLowerCase()}`}
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </div>
                              )}
                            </div>
                            {standardTier ? (
                              <div className="space-y-2 text-sm">
                                <p className="text-white">
                                  <span className="font-medium">{t('duration', 'Duration')}:</span> {standardTier.durationMonths} {t('months', 'months')}
                                </p>
                                <p className="text-white">
                                  <span className="font-medium">{t('price', 'Price')}:</span> {formatCurrency(parseFloat(standardTier.price))}
                                </p>
                                {standardTier.description && (
                                  <p className="text-gray-300 text-xs">{standardTier.description}</p>
                                )}
                              </div>
                            ) : (
                              <p className="text-gray-400 text-sm">{t('no_standard_tier', 'No standard tier configured')}</p>
                            )}
                          </div>

                          {/* Extended Tier */}
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <Badge variant="outline" className="bg-blue-100 text-blue-800">
                                {t('extended', 'Extended')}
                              </Badge>
                              {extendedTier && (
                                <div className="flex gap-1">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleEditTier(extendedTier)}
                                    data-testid={`button-edit-extended-${deviceType.toLowerCase()}`}
                                  >
                                    <Edit className="w-3 h-3" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleDeleteTier(extendedTier.id)}
                                    className="text-red-400 hover:text-red-300"
                                    data-testid={`button-delete-extended-${deviceType.toLowerCase()}`}
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </div>
                              )}
                            </div>
                            {extendedTier ? (
                              <div className="space-y-2 text-sm">
                                <p className="text-white">
                                  <span className="font-medium">{t('duration', 'Duration')}:</span> {extendedTier.durationMonths} {t('months', 'months')}
                                </p>
                                <p className="text-white">
                                  <span className="font-medium">{t('price', 'Price')}:</span> {formatCurrency(parseFloat(extendedTier.price))}
                                </p>
                                {extendedTier.description && (
                                  <p className="text-gray-300 text-xs">{extendedTier.description}</p>
                                )}
                              </div>
                            ) : (
                              <p className="text-gray-400 text-sm">{t('no_extended_tier', 'No extended tier configured')}</p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Repair Services Management Tab */}
        <TabsContent value="repair-services" className="space-y-6">
          <Card className="bg-slate-800/70 border-slate-700">
            <CardHeader>
              <div className="bg-gradient-to-r from-slate-900 via-blue-900 to-cyan-600 rounded-lg p-4 -mx-6 -mt-6 mb-4">
                <div className="flex items-center gap-3 text-white">
                  <Wrench className="w-6 h-6 text-cyan-100" />
                  <div>
                    <CardTitle className="text-lg">{t('repair_services_management', 'Repair Services Management')}</CardTitle>
                    <CardDescription className="text-cyan-100 opacity-80">
                      {t('repair_services_desc', 'Configure available repair services for each device type')}
                    </CardDescription>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Add Service Button */}
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-semibold text-white">{t('repair_services', 'Repair Services')}</h3>
                <Button
                  onClick={() => setShowAddService(!showAddService)}
                  variant="outline"
                  size="sm"
                  className="bg-cyan-600 border-cyan-500 text-white hover:bg-cyan-700"
                  data-testid="button-add-repair-service"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {t('add_service', 'Add Service')}
                </Button>
              </div>

              {/* Add Service Form */}
              {showAddService && (
                <Card className="mb-6 bg-gradient-to-r from-slate-900 via-blue-900 to-cyan-600 border border-slate-700">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-lg text-white font-semibold flex items-center gap-2">
                      <Plus className="w-5 h-5 text-cyan-100" />
                      {t('add_new_service', 'Add New Repair Service')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleServiceSubmit} className="space-y-4">
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Device Type */}
                          <div className="space-y-2">
                            <Label htmlFor="deviceType" className="text-white font-medium">{t('device_type', 'Device Type')}</Label>
                            <Select
                              value={newService.deviceType || ''}
                              onValueChange={(value) => setNewService({ ...newService, deviceType: value })}
                            >
                              <SelectTrigger data-testid="select-device-type">
                                <SelectValue placeholder={t('select_device_type', 'Select device type')} />
                              </SelectTrigger>
                              <SelectContent>
                                {deviceTypes.map((type) => (
                                  <SelectItem key={type} value={type}>
                                    {type}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Service Name */}
                          <div className="space-y-2">
                            <Label htmlFor="serviceName" className="text-white font-medium">{t('service_name', 'Service Name')}</Label>
                            <Input
                              id="serviceName"
                              value={newService.name || ''}
                              onChange={(e) => setNewService({ ...newService, name: e.target.value })}
                              placeholder={t('enter_service_name', 'Enter service name')}
                              data-testid="input-service-name"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {/* Labor Cost */}
                          <div className="space-y-2">
                            <Label htmlFor="laborCost" className="text-white font-medium">{t('estimated_labor_cost', 'Estimated Labor Cost')}</Label>
                            <Input
                              id="laborCost"
                              type="number"
                              step="0.01"
                              value={newService.estimatedLaborCost || ''}
                              onChange={(e) => setNewService({ ...newService, estimatedLaborCost: e.target.value })}
                              placeholder={currentLanguage.code === 'pt-BR' ? '0,00' : '0.00'}
                              data-testid="input-labor-cost"
                            />
                          </div>

                          {/* Completion Time Hours */}
                          <div className="space-y-2">
                            <Label htmlFor="completionTimeHours" className="text-white font-medium">{t('estimated_hours', 'Hours')}</Label>
                            <Input
                              id="completionTimeHours"
                              type="number"
                              min="0"
                              max="100"
                              value={newService.estimatedCompletionTimeHours || ''}
                              onChange={(e) => setNewService({ ...newService, estimatedCompletionTimeHours: parseInt(e.target.value) || 0 })}
                              placeholder="0"
                              data-testid="input-completion-time-hours"
                            />
                          </div>

                          {/* Completion Time Minutes */}
                          <div className="space-y-2">
                            <Label htmlFor="completionTimeMinutes" className="text-white font-medium">{t('estimated_minutes', 'Minutes')}</Label>
                            <Select
                              value={newService.estimatedCompletionTimeMinutes?.toString() || '30'}
                              onValueChange={(value) => setNewService({ ...newService, estimatedCompletionTimeMinutes: parseInt(value) })}
                            >
                              <SelectTrigger data-testid="select-completion-time-minutes">
                                <SelectValue placeholder={t('select_minutes', 'Select minutes')} />
                              </SelectTrigger>
                              <SelectContent>
                                {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((minutes) => (
                                  <SelectItem key={minutes} value={minutes.toString()}>
                                    {minutes.toString().padStart(2, '0')} {t('minutes', 'minutes')}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>

                      {/* Description */}
                      <div className="space-y-2">
                        <Label htmlFor="description" className="text-white font-medium">{t('description', 'Description')}</Label>
                        <Textarea
                          id="description"
                          value={newService.description || ''}
                          onChange={(e) => setNewService({ ...newService, description: e.target.value })}
                          placeholder={t('service_description_placeholder', 'Describe what this service includes')}
                          rows={3}
                          data-testid="textarea-service-description"
                        />
                      </div>

                      {/* Form Actions */}
                      <div className="flex gap-2 pt-2">
                        <Button
                          type="submit"
                          disabled={
                            !newService.deviceType || 
                            !newService.name || 
                            ((newService.estimatedCompletionTimeHours || 0) === 0 && (newService.estimatedCompletionTimeMinutes || 0) === 0) ||
                            createServiceMutation.isPending
                          }
                          className="bg-cyan-600 hover:bg-cyan-700 text-white border-cyan-500"
                          size="sm"
                          data-testid="button-create-service"
                        >
                          {createServiceMutation.isPending ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              {t('creating', 'Creating...')}
                            </>
                          ) : (
                            <>
                              <Plus className="w-4 h-4 mr-2" />
                              {t('create_service', 'Create Service')}
                            </>
                          )}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setShowAddService(false);
                            setNewService({});
                          }}
                          className="border-slate-600 text-white hover:bg-slate-700"
                          data-testid="button-cancel-service"
                        >
                          {t('cancel', 'Cancel')}
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              )}

              {/* Services by Device Type */}
              <div className="space-y-6">
                {deviceTypes.map(deviceType => {
                  const deviceServices = servicesByDeviceType[deviceType] || [];

                  return (
                    <Card key={deviceType} className="bg-slate-800/60 border-slate-600" data-testid={`card-services-${deviceType.toLowerCase()}`}>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-white flex items-center gap-2 text-lg">
                          <Wrench className="w-5 h-5 text-cyan-400" />
                          {deviceType} {t('repair_services', 'Repair Services')}
                          <Badge variant="secondary" className="ml-auto bg-cyan-600/20 text-cyan-300 border-cyan-500/50">
                            {deviceServices.length} {t('services', 'services')}
                          </Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {deviceServices.length === 0 ? (
                          <div className="text-center py-8">
                            <Wrench className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                            <p className="text-gray-400 mb-2">{t('no_services_for_device', `No repair services configured for ${deviceType}`)}</p>
                            <Button
                              onClick={() => {
                                setNewService({ deviceType });
                                setShowAddService(true);
                              }}
                              variant="outline"
                              size="sm"
                              data-testid={`button-add-service-${deviceType.toLowerCase()}`}
                            >
                              <Plus className="w-4 h-4 mr-2" />
                              {t('add_first_service', 'Add First Service')}
                            </Button>
                          </div>
                        ) : (
                          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {deviceServices.map((service) => (
                              <Card key={service.id} className="bg-slate-700/50 border-slate-600 hover:bg-slate-700/70 transition-colors" data-testid={`card-service-${service.id}`}>
                                {editingService === service.id ? (
                                  /* Edit Mode */
                                  <div className="p-4 space-y-3">
                                    <div className="space-y-2">
                                      <Label className="text-white text-xs">{t('service_name', 'Service Name')}</Label>
                                      <Input
                                        value={service.name}
                                        onChange={(e) => handleUpdateService(service, 'name', e.target.value)}
                                        className="h-8 text-sm"
                                        data-testid={`input-edit-name-${service.id}`}
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <Label className="text-white text-xs">{t('description', 'Description')}</Label>
                                      <Textarea
                                        value={service.description || ''}
                                        onChange={(e) => handleUpdateService(service, 'description', e.target.value)}
                                        className="h-16 text-sm resize-none"
                                        data-testid={`textarea-edit-description-${service.id}`}
                                      />
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                      <div className="space-y-2">
                                        <Label className="text-white text-xs">{t('labor_cost', 'Labor Cost')}</Label>
                                        <Input
                                          type="number"
                                          step="0.01"
                                          value={service.estimatedLaborCost}
                                          onChange={(e) => handleUpdateService(service, 'estimatedLaborCost', e.target.value)}
                                          className="h-8 text-sm"
                                          data-testid={`input-edit-cost-${service.id}`}
                                        />
                                      </div>
                                      <div className="space-y-2">
                                        <Label className="text-white text-xs">{t('status', 'Status')}</Label>
                                        <Select
                                          value={service.isActive ? 'true' : 'false'}
                                          onValueChange={(value) => handleUpdateService(service, 'isActive', value === 'true')}
                                        >
                                          <SelectTrigger className="h-8 text-sm">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="true">{t('active', 'Active')}</SelectItem>
                                            <SelectItem value="false">{t('inactive', 'Inactive')}</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                      <div className="space-y-2">
                                        <Label className="text-white text-xs">{t('estimated_hours', 'Hours')}</Label>
                                        <Input
                                          type="number"
                                          min="0"
                                          max="100"
                                          value={service.estimatedCompletionTimeHours || 0}
                                          onChange={(e) => handleUpdateService(service, 'estimatedCompletionTimeHours', parseInt(e.target.value) || 0)}
                                          className="h-8 text-sm"
                                          data-testid={`input-edit-hours-${service.id}`}
                                        />
                                      </div>
                                      <div className="space-y-2">
                                        <Label className="text-white text-xs">{t('estimated_minutes', 'Minutes')}</Label>
                                        <Select
                                          value={service.estimatedCompletionTimeMinutes?.toString() || '30'}
                                          onValueChange={(value) => handleUpdateService(service, 'estimatedCompletionTimeMinutes', parseInt(value))}
                                        >
                                          <SelectTrigger className="h-8 text-sm">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((minutes) => (
                                              <SelectItem key={minutes} value={minutes.toString()}>
                                                {minutes.toString().padStart(2, '0')} {t('minutes', 'minutes')}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </div>
                                    </div>
                                    <div className="flex gap-2 pt-2">
                                      <Button
                                        size="sm"
                                        onClick={() => {
                                          setEditingService(null);
                                          toast({
                                            title: t('service_updated', 'Service Updated'),
                                            description: t('repair_service_updated', 'Repair service has been updated successfully.'),
                                          });
                                        }}
                                        className="bg-cyan-600 hover:bg-cyan-700 text-white h-7 text-xs"
                                        data-testid={`button-save-service-${service.id}`}
                                      >
                                        {t('done', 'Done')}
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setEditingService(null)}
                                        className="border-slate-600 text-white hover:bg-slate-700 h-7 text-xs"
                                        data-testid={`button-cancel-edit-service-${service.id}`}
                                      >
                                        {t('cancel', 'Cancel')}
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  /* Display Mode */
                                  <>
                                    <CardHeader className="pb-2">
                                      <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                          <CardTitle className="text-base text-white font-semibold">{service.name}</CardTitle>
                                          {service.description && (
                                            <p className="text-slate-300 text-xs mt-1 line-clamp-2">{service.description}</p>
                                          )}
                                        </div>
                                        <div className="flex gap-1 ml-2">
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => handleEditService(service)}
                                            className="h-7 w-7 p-0 text-slate-400 hover:text-white hover:bg-slate-600"
                                            data-testid={`button-edit-service-${service.id}`}
                                          >
                                            <Edit className="w-3 h-3" />
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => handleDeleteService(service.id)}
                                            className="h-7 w-7 p-0 text-red-400 hover:text-red-300 hover:bg-red-900/20"
                                            data-testid={`button-delete-service-${service.id}`}
                                          >
                                            <Trash2 className="w-3 h-3" />
                                          </Button>
                                        </div>
                                      </div>
                                    </CardHeader>
                                    <CardContent className="pt-2 space-y-1.5">
                                      <div className="flex justify-between items-center text-xs">
                                        <span className="text-slate-400">{t('labor_cost', 'Labor Cost')}:</span>
                                        <span className="text-cyan-300 font-semibold">
                                          {formatCurrency(parseFloat(service.estimatedLaborCost))}
                                        </span>
                                      </div>
                                      <div className="flex justify-between items-center text-xs">
                                        <span className="text-slate-400">{t('completion_time', 'Completion Time')}:</span>
                                        <span className="text-white font-medium">
                                          {formatCompletionTime(service.estimatedCompletionTimeHours, service.estimatedCompletionTimeMinutes)}
                                        </span>
                                      </div>
                                      <div className="flex justify-between items-center text-xs pt-1">
                                        <span className="text-slate-400">{t('status', 'Status')}:</span>
                                        <Badge 
                                          variant={service.isActive ? 'default' : 'secondary'}
                                          className={service.isActive ? 'bg-green-600/20 text-green-300 border-green-500/50' : 'bg-slate-600/50 text-slate-300 border-slate-500'}
                                        >
                                          {service.isActive ? t('active', 'Active') : t('inactive', 'Inactive')}
                                        </Badge>
                                      </div>
                                    </CardContent>
                                  </>
                                )}
                              </Card>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* AI Lists Management Tab */}
        <TabsContent value="ai-lists" className="space-y-6">
          <Card className="bg-slate-800/70 border-slate-700">
            <CardHeader>
              <div className="bg-gradient-to-r from-slate-900 via-blue-900 to-cyan-600 rounded-lg p-4 -mx-6 -mt-6 mb-4">
                <div className="flex items-center gap-3 text-white">
                  <Bot className="w-6 h-6 text-cyan-100" />
                  <div>
                    <CardTitle className="text-lg">{t('ai_lists_management', 'AI Lists Management')}</CardTitle>
                    <CardDescription className="text-cyan-100 opacity-80">
                      {t('ai_lists_desc', 'Manage AI-generated device brands and models for accurate identification')}
                    </CardDescription>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
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

              {/* Initialize Lists (if empty) */}
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

              {/* Existing AI Lists Display (simplified) */}
              {autoGenLists.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-white">{t('device_brands', 'Device Brands')}</h3>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {autoGenLists.filter(list => list.listType.includes('Brands')).map((list) => {
                      const canUpdate = canUpdateList(list);
                      const timeUntilUpdate = getTimeUntilNextUpdate(
                        typeof list.nextUpdate === 'string' 
                          ? list.nextUpdate 
                          : list.nextUpdate instanceof Date 
                            ? list.nextUpdate.toISOString() 
                            : new Date(list.nextUpdate || '').toISOString()
                      );
                      const isUpdating = updatingList === list.category;

                      return (
                        <Card key={list.id} className="bg-slate-700/30 border-slate-600" data-testid={`card-list-${list.category.toLowerCase()}`}>
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-lg text-white">{list.category} {t('brands', 'Brands')}</CardTitle>
                              <Badge variant={canUpdate ? 'default' : 'secondary'}>
                                {getRefreshIntervalLabel(list.refreshInterval)}
                              </Badge>
                            </div>
                            <CardDescription className="text-gray-300">
                              {list.items.length} {t('brands_available', 'brands available')}
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <div className="flex flex-wrap gap-1">
                              {list.items.slice(0, 6).map((brand) => (
                                <Badge key={brand} variant="outline" className="text-xs">
                                  {brand}
                                </Badge>
                              ))}
                              {list.items.length > 6 && (
                                <Badge variant="outline" className="text-xs">
                                  +{list.items.length - 6} {t('more', 'more')}
                                </Badge>
                              )}
                            </div>

                            <div className="space-y-2 text-sm">
                              <p className="text-gray-400">
                                <span className="font-medium">{t('last_updated', 'Last updated')}:</span> {' '}
                                {list.lastGenerated ? new Date(list.lastGenerated).toLocaleDateString() : t('never', 'Never')}
                              </p>
                              <p className="text-gray-400">
                                <span className="font-medium">{t('next_update', 'Next update')}:</span> {' '}
                                {timeUntilUpdate}
                              </p>
                            </div>

                            <Button
                              onClick={() => updateListMutation.mutate(list.category)}
                              disabled={!canUpdate || isUpdating}
                              variant="outline"
                              size="sm"
                              className="w-full"
                              data-testid={`button-update-${list.category.toLowerCase()}`}
                            >
                              {isUpdating ? (
                                <>
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  {t('updating', 'Updating...')}
                                </>
                              ) : (
                                <>
                                  <RefreshCw className="w-4 h-4 mr-2" />
                                  {canUpdate ? t('update_list', '💰 Update List') : t('cannot_update_yet', 'Cannot Update Yet')}
                                </>
                              )}
                            </Button>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>

                  {/* Model Generation Section */}
                  <div className="space-y-4 mt-8">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-white">{t('device_models', 'Device Models')}</h3>
                      <div className="text-sm text-gray-400">
                        {t('models_desc', 'Generate model lists for all brands in each category')}
                      </div>
                    </div>
                    
                    <div className="grid gap-4 md:grid-cols-3">
                      {['Phone', 'Laptop', 'Desktop'].map((category) => {
                        const brandList = autoGenLists.find(list => list.category === category && list.listType.includes('Brands'));
                        const isGenerating = generatingModels === category;
                        
                        return (
                          <Card key={category} className="bg-slate-700/30 border-slate-600" data-testid={`card-models-${category.toLowerCase()}`}>
                            <CardHeader className="pb-3">
                              <CardTitle className="text-lg text-white">{category} {t('models', 'Models')}</CardTitle>
                              <CardDescription className="text-gray-300">
                                {brandList ? `${brandList.items.length} brands available` : 'No brands found'}
                              </CardDescription>
                            </CardHeader>
                            <CardContent>
                              <Button
                                onClick={() => handleGenerateModels(category)}
                                disabled={!brandList || isGenerating || brandList.items.length === 0}
                                variant="outline"
                                size="sm"
                                className="w-full"
                                data-testid={`button-generate-models-${category.toLowerCase()}`}
                              >
                                {isGenerating ? (
                                  <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    {t('generating_models', 'Generating Models...')}
                                  </>
                                ) : (
                                  <>
                                    <Bot className="w-4 h-4 mr-2" />
                                    {t('generate_models', '💰 Generate All Models')}
                                  </>
                                )}
                              </Button>
                              {!brandList && (
                                <p className="text-xs text-gray-400 mt-2 text-center">
                                  {t('brands_needed', 'Brand list needed first')}
                                </p>
                              )}
                              {brandList && brandList.items.length === 0 && (
                                <p className="text-xs text-gray-400 mt-2 text-center">
                                  {t('no_brands', 'No brands available')}
                                </p>
                              )}
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Advanced Settings Tab */}
        <TabsContent value="advanced" className="space-y-6">
          <Card className="bg-slate-800/70 border-slate-700">
            <CardHeader>
              <div className="bg-gradient-to-r from-slate-900 via-blue-900 to-cyan-600 rounded-lg p-4 -mx-6 -mt-6 mb-4">
                <div className="flex items-center gap-3 text-white">
                  <Settings className="w-6 h-6 text-cyan-100" />
                  <div>
                    <CardTitle className="text-lg">{t('advanced_settings', 'Advanced Settings')}</CardTitle>
                    <CardDescription className="text-cyan-100 opacity-80">
                      {t('advanced_desc', 'System configurations and advanced options')}
                    </CardDescription>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <Settings className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">{t('coming_soon', 'Coming Soon')}</h3>
                <p className="text-gray-400">{t('advanced_coming_soon', 'Advanced configuration options will be available in future updates.')}</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Generation Progress Dialog */}
      <GenerationProgressDialog
        isOpen={showProgressDialog}
        onOpenChange={setShowProgressDialog}
        category={progressCategory}
        isGenerating={generatingModels !== null}
        errorMessage={progressError}
      />
    </div>
  );
}