import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import type { FilterPreset } from "@shared/schema";

export type PageType = 'kanban' | 'inventory' | 'clients' | 'purchase_orders';

interface CreatePresetData {
  name: string;
  filterConfig: Record<string, any>;
  isDefault?: boolean;
}

interface UpdatePresetData {
  name?: string;
  filterConfig?: Record<string, any>;
  isDefault?: boolean;
}

export function useSavedFilters(pageType: PageType) {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const tenantId = tenant?.id || user?.tenantId;
  
  // Wait for both user and tenant to be available
  const isReady = !!user && !!tenantId;
  
  // Fetch all filter presets for this page type
  const { data: presets = [], isLoading } = useQuery<FilterPreset[]>({
    queryKey: ['/api/filter-presets', { pageType }],
    queryFn: async () => {
      if (!isReady) {
        throw new Error('User or tenant context not ready');
      }
      
      const response = await fetch(`/api/filter-presets?pageType=${pageType}`, {
        credentials: 'include',
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to fetch filter presets: ${error}`);
      }
      
      return response.json();
    },
    enabled: isReady,
    retry: 1,
  });
  
  // Create a new filter preset
  const createPresetMutation = useMutation({
    mutationFn: async (data: CreatePresetData) => {
      if (!isReady || !user?.id) {
        throw new Error('User or tenant context not ready');
      }
      
      // Validate filter config before sending
      if (!data.filterConfig || typeof data.filterConfig !== 'object') {
        throw new Error('Invalid filter configuration');
      }
      
      const payload = {
        ...data,
        pageType,
        tenantId,
        userId: user.id,
      };
      
      const response = await apiRequest('POST', '/api/filter-presets', payload);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: ['/api/filter-presets', { pageType }] 
      });
    },
  });
  
  // Update an existing filter preset
  const updatePresetMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdatePresetData }) => {
      if (!isReady) {
        throw new Error('User or tenant context not ready');
      }
      
      // Validate filter config if provided
      if (data.filterConfig && typeof data.filterConfig !== 'object') {
        throw new Error('Invalid filter configuration');
      }
      
      const response = await apiRequest('PUT', `/api/filter-presets/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: ['/api/filter-presets', { pageType }] 
      });
    },
  });
  
  // Delete a filter preset
  const deletePresetMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!isReady) {
        throw new Error('User or tenant context not ready');
      }
      
      await apiRequest('DELETE', `/api/filter-presets/${id}`, undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: ['/api/filter-presets', { pageType }] 
      });
    },
  });
  
  // Set a preset as default (unsets other defaults)
  const setAsDefaultMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!isReady) {
        throw new Error('User or tenant context not ready');
      }
      
      const response = await apiRequest('PUT', `/api/filter-presets/${id}`, {
        isDefault: true,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: ['/api/filter-presets', { pageType }] 
      });
    },
  });
  
  // Helper function to create a preset
  const createPreset = async (name: string, filterConfig: Record<string, any>, isDefault = false) => {
    if (!isReady) {
      throw new Error('Cannot create preset: user or tenant context not ready');
    }
    return createPresetMutation.mutateAsync({ name, filterConfig, isDefault });
  };
  
  // Helper function to update a preset
  const updatePreset = async (id: string, data: UpdatePresetData) => {
    if (!isReady) {
      throw new Error('Cannot update preset: user or tenant context not ready');
    }
    return updatePresetMutation.mutateAsync({ id, data });
  };
  
  // Helper function to delete a preset
  const deletePreset = async (id: string) => {
    if (!isReady) {
      throw new Error('Cannot delete preset: user or tenant context not ready');
    }
    return deletePresetMutation.mutateAsync(id);
  };
  
  // Helper function to apply a preset (returns the filter config)
  const applyPreset = (id: string): Record<string, any> | null => {
    const preset = presets.find(p => p.id === id);
    if (!preset) return null;
    
    // Validate the filter config before returning
    if (!preset.filterConfig || typeof preset.filterConfig !== 'object') {
      console.warn(`Preset ${id} has invalid filter configuration`);
      return null;
    }
    
    return preset.filterConfig as Record<string, any>;
  };
  
  // Helper function to set a preset as default
  const setAsDefault = async (id: string) => {
    if (!isReady) {
      throw new Error('Cannot set default preset: user or tenant context not ready');
    }
    return setAsDefaultMutation.mutateAsync(id);
  };
  
  // Get the default preset for this page
  const defaultPreset = presets.find(p => p.isDefault);
  
  return {
    presets,
    isLoading,
    isReady,
    createPreset,
    updatePreset,
    deletePreset,
    applyPreset,
    setAsDefault,
    defaultPreset,
    isCreating: createPresetMutation.isPending,
    isUpdating: updatePresetMutation.isPending,
    isDeleting: deletePresetMutation.isPending,
  };
}
