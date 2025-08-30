import { useQuery } from "@tanstack/react-query";
import type { AutoGenList } from "@shared/schema";

export function useDeviceModels(category: string, brand: string) {
  return useQuery<AutoGenList>({
    queryKey: ['/api/auto-gen-lists', category, brand, 'models'],
    enabled: !!(category && brand),
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });
}