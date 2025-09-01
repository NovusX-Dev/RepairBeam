import { useQuery } from '@tanstack/react-query';

interface DeviceColorsResponse {
  colors: string[];
  fromCache: boolean;
  fallback?: boolean;
  message?: string;
  error?: string;
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