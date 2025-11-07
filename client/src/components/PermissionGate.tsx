import type { Permission } from "@shared/permissions";
import { usePermissions } from "@/contexts/PermissionContext";

interface PermissionGateProps {
  children: React.ReactNode;
  permission?: Permission;
  anyPermissions?: Permission[];
  allPermissions?: Permission[];
  fallback?: React.ReactNode;
  loading?: React.ReactNode;
}

/**
 * PermissionGate component - Conditionally renders children based on user permissions
 * 
 * Usage Examples:
 * 
 * Single permission check:
 * <PermissionGate permission={PERMISSIONS.TICKETS_CREATE}>
 *   <Button>Create Ticket</Button>
 * </PermissionGate>
 * 
 * Any of multiple permissions (OR logic):
 * <PermissionGate anyPermissions={[PERMISSIONS.TICKETS_CREATE, PERMISSIONS.TICKETS_UPDATE]}>
 *   <Button>Edit Ticket</Button>
 * </PermissionGate>
 * 
 * All of multiple permissions (AND logic):
 * <PermissionGate allPermissions={[PERMISSIONS.TICKETS_DELETE, PERMISSIONS.USERS_UPDATE]}>
 *   <Button>Delete & Notify</Button>
 * </PermissionGate>
 * 
 * With fallback content:
 * <PermissionGate permission={PERMISSIONS.USERS_READ} fallback={<p>Access denied</p>}>
 *   <UserList />
 * </PermissionGate>
 */
export function PermissionGate({
  children,
  permission,
  anyPermissions,
  allPermissions,
  fallback = null,
  loading = null,
}: PermissionGateProps) {
  const {
    hasPermission,
    hasAnyPermission: checkAnyPermission,
    hasAllPermissions: checkAllPermissions,
    isLoading,
  } = usePermissions();

  // Show loading state while permissions are being fetched
  if (isLoading) {
    return <>{loading}</>;
  }

  // Check permissions based on props
  let hasAccess = false;

  if (permission) {
    hasAccess = hasPermission(permission);
  } else if (anyPermissions && anyPermissions.length > 0) {
    hasAccess = checkAnyPermission(anyPermissions);
  } else if (allPermissions && allPermissions.length > 0) {
    hasAccess = checkAllPermissions(allPermissions);
  } else {
    // If no permissions specified, default to showing children
    hasAccess = true;
  }

  return hasAccess ? <>{children}</> : <>{fallback}</>;
}
