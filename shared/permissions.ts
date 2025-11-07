// Permission Structure for Repair Beam RBAC System
// Format: resource:action

export const PERMISSIONS = {
  // Kanban Tickets
  TICKETS_READ: 'tickets:read',
  TICKETS_CREATE: 'tickets:create',
  TICKETS_UPDATE: 'tickets:update',
  TICKETS_DELETE: 'tickets:delete',
  TICKETS_CHANGE_STATUS: 'tickets:change_status',
  TICKETS_ASSIGN: 'tickets:assign',
  TICKETS_VIEW_COSTS: 'tickets:view_costs',
  TICKETS_UPDATE_COSTS: 'tickets:update_costs',
  
  // Inventory Management
  INVENTORY_READ: 'inventory:read',
  INVENTORY_CREATE: 'inventory:create',
  INVENTORY_UPDATE: 'inventory:update',
  INVENTORY_DELETE: 'inventory:delete',
  INVENTORY_ADJUST_QUANTITY: 'inventory:adjust_quantity',
  INVENTORY_SCAN_QR: 'inventory:scan_qr',
  INVENTORY_VIEW_ANALYTICS: 'inventory:view_analytics',
  INVENTORY_MANAGE_CATEGORIES: 'inventory:manage_categories',
  
  // Client Management
  CLIENTS_READ: 'clients:read',
  CLIENTS_CREATE: 'clients:create',
  CLIENTS_UPDATE: 'clients:update',
  CLIENTS_DELETE: 'clients:delete',
  CLIENTS_VIEW_HISTORY: 'clients:view_history',
  
  // Purchase Orders
  PURCHASE_ORDERS_READ: 'purchase_orders:read',
  PURCHASE_ORDERS_CREATE: 'purchase_orders:create',
  PURCHASE_ORDERS_UPDATE: 'purchase_orders:update',
  PURCHASE_ORDERS_DELETE: 'purchase_orders:delete',
  PURCHASE_ORDERS_APPROVE: 'purchase_orders:approve',
  PURCHASE_ORDERS_RECEIVE: 'purchase_orders:receive',
  
  // Point of Sale
  POS_ACCESS: 'pos:access',
  POS_PROCESS_SALE: 'pos:process_sale',
  POS_REFUND: 'pos:refund',
  POS_VIEW_REPORTS: 'pos:view_reports',
  
  // User Management (Admin only)
  USERS_READ: 'users:read',
  USERS_INVITE: 'users:invite',
  USERS_UPDATE: 'users:update',
  USERS_DELETE: 'users:delete',
  USERS_MANAGE_GROUPS: 'users:manage_groups',
  
  // Groups Management (Admin only)
  GROUPS_READ: 'groups:read',
  GROUPS_CREATE: 'groups:create',
  GROUPS_UPDATE: 'groups:update',
  GROUPS_DELETE: 'groups:delete',
  
  // Settings & Configuration
  SETTINGS_READ: 'settings:read',
  SETTINGS_UPDATE: 'settings:update',
  
  // Reports & Analytics
  REPORTS_READ: 'reports:read',
  REPORTS_EXPORT: 'reports:export',
  
  // Audit Logs (Admin only)
  AUDIT_LOGS_READ: 'audit_logs:read',
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];

// Permission categories for UI organization
export const PERMISSION_CATEGORIES = {
  TICKETS: {
    label: 'Kanban Tickets',
    permissions: [
      PERMISSIONS.TICKETS_READ,
      PERMISSIONS.TICKETS_CREATE,
      PERMISSIONS.TICKETS_UPDATE,
      PERMISSIONS.TICKETS_DELETE,
      PERMISSIONS.TICKETS_CHANGE_STATUS,
      PERMISSIONS.TICKETS_ASSIGN,
      PERMISSIONS.TICKETS_VIEW_COSTS,
      PERMISSIONS.TICKETS_UPDATE_COSTS,
    ],
  },
  INVENTORY: {
    label: 'Inventory',
    permissions: [
      PERMISSIONS.INVENTORY_READ,
      PERMISSIONS.INVENTORY_CREATE,
      PERMISSIONS.INVENTORY_UPDATE,
      PERMISSIONS.INVENTORY_DELETE,
      PERMISSIONS.INVENTORY_ADJUST_QUANTITY,
      PERMISSIONS.INVENTORY_SCAN_QR,
      PERMISSIONS.INVENTORY_VIEW_ANALYTICS,
      PERMISSIONS.INVENTORY_MANAGE_CATEGORIES,
    ],
  },
  CLIENTS: {
    label: 'Clients',
    permissions: [
      PERMISSIONS.CLIENTS_READ,
      PERMISSIONS.CLIENTS_CREATE,
      PERMISSIONS.CLIENTS_UPDATE,
      PERMISSIONS.CLIENTS_DELETE,
      PERMISSIONS.CLIENTS_VIEW_HISTORY,
    ],
  },
  PURCHASE_ORDERS: {
    label: 'Purchase Orders',
    permissions: [
      PERMISSIONS.PURCHASE_ORDERS_READ,
      PERMISSIONS.PURCHASE_ORDERS_CREATE,
      PERMISSIONS.PURCHASE_ORDERS_UPDATE,
      PERMISSIONS.PURCHASE_ORDERS_DELETE,
      PERMISSIONS.PURCHASE_ORDERS_APPROVE,
      PERMISSIONS.PURCHASE_ORDERS_RECEIVE,
    ],
  },
  POS: {
    label: 'Point of Sale',
    permissions: [
      PERMISSIONS.POS_ACCESS,
      PERMISSIONS.POS_PROCESS_SALE,
      PERMISSIONS.POS_REFUND,
      PERMISSIONS.POS_VIEW_REPORTS,
    ],
  },
  USER_MANAGEMENT: {
    label: 'User Management',
    permissions: [
      PERMISSIONS.USERS_READ,
      PERMISSIONS.USERS_INVITE,
      PERMISSIONS.USERS_UPDATE,
      PERMISSIONS.USERS_DELETE,
      PERMISSIONS.USERS_MANAGE_GROUPS,
    ],
  },
  GROUPS: {
    label: 'Groups',
    permissions: [
      PERMISSIONS.GROUPS_READ,
      PERMISSIONS.GROUPS_CREATE,
      PERMISSIONS.GROUPS_UPDATE,
      PERMISSIONS.GROUPS_DELETE,
    ],
  },
  SETTINGS: {
    label: 'Settings',
    permissions: [
      PERMISSIONS.SETTINGS_READ,
      PERMISSIONS.SETTINGS_UPDATE,
    ],
  },
  REPORTS: {
    label: 'Reports & Analytics',
    permissions: [
      PERMISSIONS.REPORTS_READ,
      PERMISSIONS.REPORTS_EXPORT,
    ],
  },
  AUDIT: {
    label: 'Audit Logs',
    permissions: [
      PERMISSIONS.AUDIT_LOGS_READ,
    ],
  },
} as const;

// Pre-configured role templates
export const ROLE_TEMPLATES = {
  ADMIN: {
    name: 'Administrator',
    description: 'Full system access',
    permissions: Object.values(PERMISSIONS),
  },
  MANAGER: {
    name: 'Manager',
    description: 'Manage operations, view reports, limited settings',
    permissions: [
      ...PERMISSION_CATEGORIES.TICKETS.permissions,
      ...PERMISSION_CATEGORIES.INVENTORY.permissions,
      ...PERMISSION_CATEGORIES.CLIENTS.permissions,
      ...PERMISSION_CATEGORIES.PURCHASE_ORDERS.permissions,
      PERMISSIONS.POS_ACCESS,
      PERMISSIONS.POS_PROCESS_SALE,
      PERMISSIONS.POS_VIEW_REPORTS,
      PERMISSIONS.REPORTS_READ,
      PERMISSIONS.REPORTS_EXPORT,
      PERMISSIONS.SETTINGS_READ,
    ],
  },
  TECHNICIAN: {
    name: 'Technician',
    description: 'Handle repairs, manage inventory, limited client access',
    permissions: [
      PERMISSIONS.TICKETS_READ,
      PERMISSIONS.TICKETS_UPDATE,
      PERMISSIONS.TICKETS_CHANGE_STATUS,
      PERMISSIONS.INVENTORY_READ,
      PERMISSIONS.INVENTORY_UPDATE,
      PERMISSIONS.INVENTORY_ADJUST_QUANTITY,
      PERMISSIONS.INVENTORY_SCAN_QR,
      PERMISSIONS.CLIENTS_READ,
      PERMISSIONS.CLIENTS_UPDATE,
      PERMISSIONS.CLIENTS_VIEW_HISTORY,
    ],
  },
  RECEPTIONIST: {
    name: 'Receptionist',
    description: 'Create tickets, manage clients, process sales',
    permissions: [
      PERMISSIONS.TICKETS_READ,
      PERMISSIONS.TICKETS_CREATE,
      PERMISSIONS.TICKETS_UPDATE,
      PERMISSIONS.CLIENTS_READ,
      PERMISSIONS.CLIENTS_CREATE,
      PERMISSIONS.CLIENTS_UPDATE,
      PERMISSIONS.CLIENTS_VIEW_HISTORY,
      PERMISSIONS.POS_ACCESS,
      PERMISSIONS.POS_PROCESS_SALE,
      PERMISSIONS.INVENTORY_READ,
    ],
  },
  VIEWER: {
    name: 'Viewer',
    description: 'Read-only access to tickets and inventory',
    permissions: [
      PERMISSIONS.TICKETS_READ,
      PERMISSIONS.INVENTORY_READ,
      PERMISSIONS.CLIENTS_READ,
      PERMISSIONS.PURCHASE_ORDERS_READ,
      PERMISSIONS.REPORTS_READ,
    ],
  },
} as const;

// Helper to get all permission strings as an array
export function getAllPermissions(): Permission[] {
  return Object.values(PERMISSIONS);
}

// Helper to check if a permission exists
export function isValidPermission(permission: string): permission is Permission {
  return Object.values(PERMISSIONS).includes(permission as Permission);
}
