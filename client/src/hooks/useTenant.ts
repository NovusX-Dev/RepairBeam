import { useQuery } from "@tanstack/react-query";
import type { Tenant } from "@shared/schema";
import { useAuth } from "./useAuth";

export function useTenant() {
  const { isAuthenticated } = useAuth();
  
  const { data: tenant, isLoading } = useQuery<Tenant>({
    queryKey: ["/api/tenants/current"],
    enabled: isAuthenticated,
    retry: false,
  });

  return {
    tenant,
    isLoading,
    hasValidTenant: tenant && tenant.name !== 'Default Organization',
  };
}