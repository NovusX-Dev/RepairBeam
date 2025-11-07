import { createContext, useContext, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Permission } from "@shared/permissions";
import { hasPermission, hasAnyPermission, hasAllPermissions } from "@shared/permissions";

interface PermissionContextType {
  permissions: Permission[];
  isLoading: boolean;
  hasPermission: (permission: Permission) => boolean;
  hasAnyPermission: (permissions: Permission[]) => boolean;
  hasAllPermissions: (permissions: Permission[]) => boolean;
  refetch: () => void;
}

const PermissionContext = createContext<PermissionContextType | undefined>(undefined);

export function PermissionProvider({ children }: { children: React.ReactNode }) {
  const [permissions, setPermissions] = useState<Permission[]>([]);

  // Fetch current user's permissions
  // Note: queryClient has default queryFn configured that uses queryKey as URL path
  const { data, isLoading, refetch, isError } = useQuery<{ permissions: Permission[] }>({
    queryKey: ["/api/auth/me/permissions"],
    retry: 1,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (data?.permissions) {
      setPermissions(data.permissions);
    } else if (isError) {
      // If query fails (e.g., user not authenticated), set empty permissions
      setPermissions([]);
    }
  }, [data, isError]);

  const checkPermission = (permission: Permission): boolean => {
    return hasPermission(permissions, permission);
  };

  const checkAnyPermission = (requiredPermissions: Permission[]): boolean => {
    return hasAnyPermission(permissions, requiredPermissions);
  };

  const checkAllPermissions = (requiredPermissions: Permission[]): boolean => {
    return hasAllPermissions(permissions, requiredPermissions);
  };

  const value: PermissionContextType = {
    permissions,
    isLoading,
    hasPermission: checkPermission,
    hasAnyPermission: checkAnyPermission,
    hasAllPermissions: checkAllPermissions,
    refetch,
  };

  return (
    <PermissionContext.Provider value={value}>
      {children}
    </PermissionContext.Provider>
  );
}

export function usePermissions() {
  const context = useContext(PermissionContext);
  if (context === undefined) {
    throw new Error("usePermissions must be used within a PermissionProvider");
  }
  return context;
}
