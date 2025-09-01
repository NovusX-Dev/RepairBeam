import { useQuery, useQueryClient } from '@tanstack/react-query';

interface DeviceColorsResponse {
  colors: string[];
  fromCache: boolean;
  fallback?: boolean;
  message?: string;
  error?: string;
}

interface SaveColorResponse {
  success: boolean;
  message: string;
  colors: string[];
}

export function useDeviceColors(deviceType: string, brand: string, model: string) {
  return useQuery({
    queryKey: ['/api/device-colors', deviceType, brand, model],
    enabled: !!(deviceType && brand && model),
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
    gcTime: 7 * 24 * 60 * 60 * 1000, // 7 days (cache time)
    select: (data: DeviceColorsResponse) => ({
      colors: data.colors || [],
      fromCache: data.fromCache || false,
      fallback: data.fallback || false,
      message: data.message,
      error: data.error
    })
  });
}

export function useSaveCustomColor() {
  const queryClient = useQueryClient();
  
  return {
    saveCustomColor: async (deviceType: string, brand: string, model: string, color: string) => {
      const response = await fetch(`/api/device-colors/${deviceType}/${brand}/${model}/add-color`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ color }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to save custom color');
      }
      
      const result = await response.json() as SaveColorResponse;
      
      // Invalidate the device colors cache to refresh the data
      await queryClient.invalidateQueries({
        queryKey: ['/api/device-colors', deviceType, brand, model]
      });
      
      return result;
    }
  };
}