import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface AutoGenList {
  id: string;
  listType: string;
  category: string;
  items: string[];
  lastGenerated: string;
  nextUpdate: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export function useDeviceBrands(deviceType: string | null) {
  return useQuery<AutoGenList>({
    queryKey: ['/api/auto-gen-lists', deviceType],
    queryFn: async () => {
      if (!deviceType) {
        throw new Error('Device type is required');
      }
      
      const response = await fetch(`/api/auto-gen-lists/${deviceType}`);
      
      // If the list doesn't exist (404), provide fallback brands
      if (response.status === 404) {
        const fallbackBrands = getFallbackBrands(deviceType);
        return {
          id: 'fallback',
          listType: `AutoGen-List-Brands-${deviceType}`,
          category: deviceType,
          items: fallbackBrands,
          lastGenerated: new Date().toISOString(),
          nextUpdate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      }
      
      if (!response.ok) {
        throw new Error('Failed to fetch device brands');
      }
      return response.json();
    },
    enabled: !!deviceType, // Only run query when deviceType is not null/undefined
    staleTime: 30 * 60 * 1000, // Consider data fresh for 30 minutes
    gcTime: 60 * 60 * 1000, // Keep in cache for 1 hour
    retry: 2,
  });
}

// Fallback brand lists if AI generation hasn't happened yet
function getFallbackBrands(deviceType: string): string[] {
  const fallbackBrands: Record<string, string[]> = {
    Phone: [
      'Apple', 'Samsung', 'Google', 'OnePlus', 'Xiaomi', 'Huawei', 'Oppo', 'Vivo',
      'LG', 'Sony', 'Motorola', 'Nokia', 'Honor', 'Realme', 'Nothing', 'Fairphone'
    ],
    Laptop: [
      'Apple', 'Dell', 'HP', 'Lenovo', 'Asus', 'Acer', 'MSI', 'Razer',
      'Microsoft', 'Alienware', 'Thinkpad', 'MacBook', 'Surface', 'Chromebook'
    ],
    Desktop: [
      'Dell', 'HP', 'Lenovo', 'Asus', 'MSI', 'Alienware', 'Origin PC', 'Corsair',
      'NZXT', 'CyberPowerPC', 'iBuyPower', 'Falcon Northwest', 'Maingear'
    ]
  };

  return fallbackBrands[deviceType] || [];
}

export function useInitializeBrandLists() {
  return useQuery<{ message: string }>({
    queryKey: ['/api/auto-gen-lists/initialize'],
    queryFn: async () => {
      const response = await fetch('/api/auto-gen-lists/initialize', {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error('Failed to initialize brand lists');
      }
      return response.json();
    },
    enabled: false, // Only run when manually triggered
    retry: 1,
  });
}

export function useValidateBrand() {
  return {
    validateBrand: async (deviceType: string, brandName: string) => {
      const response = await fetch(`/api/auto-gen-lists/${deviceType}/validate-brand`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ brandName }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to validate brand');
      }
      
      return response.json() as Promise<{
        isValid: boolean;
        correctedName?: string;
        added: boolean;
      }>;
    }
  };
}