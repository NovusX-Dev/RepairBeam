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
    description: 'Manage repair tickets, statuses, and assignments',
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
    description: 'Manage inventory items, quantities, and analytics',
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
    description: 'Manage client information and history',
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
    description: 'Create and manage purchase orders',
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
    description: 'Process sales and manage transactions',
    permissions: [
      PERMISSIONS.POS_ACCESS,
      PERMISSIONS.POS_PROCESS_SALE,
      PERMISSIONS.POS_REFUND,
      PERMISSIONS.POS_VIEW_REPORTS,
    ],
  },
  USER_MANAGEMENT: {
    label: 'User Management',
    description: 'Invite and manage team members',
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
    description: 'Create and manage permission groups',
    permissions: [
      PERMISSIONS.GROUPS_READ,
      PERMISSIONS.GROUPS_CREATE,
      PERMISSIONS.GROUPS_UPDATE,
      PERMISSIONS.GROUPS_DELETE,
    ],
  },
  SETTINGS: {
    label: 'Settings',
    description: 'Modify system settings and configuration',
    permissions: [
      PERMISSIONS.SETTINGS_READ,
      PERMISSIONS.SETTINGS_UPDATE,
    ],
  },
  REPORTS: {
    label: 'Reports & Analytics',
    description: 'View and export business reports',
    permissions: [
      PERMISSIONS.REPORTS_READ,
      PERMISSIONS.REPORTS_EXPORT,
    ],
  },
  AUDIT: {
    label: 'Audit Logs',
    description: 'View system audit logs and user activity',
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

// ============================================================================
// Permission Checking Utilities
// ============================================================================

/**
 * Check if a user has a specific permission
 * @param userPermissions - Array of permissions the user has
 * @param requiredPermission - The permission to check
 * @returns true if user has the permission
 */
export function hasPermission(
  userPermissions: Permission[],
  requiredPermission: Permission
): boolean {
  if (!userPermissions || userPermissions.length === 0) {
    return false;
  }
  
  return userPermissions.includes(requiredPermission);
}

/**
 * Check if a user has any of the specified permissions
 * @param userPermissions - Array of permissions the user has
 * @param requiredPermissions - Array of permissions to check (OR logic)
 * @returns true if user has at least one of the permissions
 */
export function hasAnyPermission(
  userPermissions: Permission[],
  requiredPermissions: Permission[]
): boolean {
  if (!userPermissions || userPermissions.length === 0) {
    return false;
  }
  
  return requiredPermissions.some(permission => 
    hasPermission(userPermissions, permission)
  );
}

/**
 * Check if a user has all of the specified permissions
 * @param userPermissions - Array of permissions the user has
 * @param requiredPermissions - Array of permissions to check (AND logic)
 * @returns true if user has all of the permissions
 */
export function hasAllPermissions(
  userPermissions: Permission[],
  requiredPermissions: Permission[]
): boolean {
  if (!userPermissions || userPermissions.length === 0) {
    return false;
  }
  
  return requiredPermissions.every(permission => 
    hasPermission(userPermissions, permission)
  );
}

// ============================================================================
// Permission Label Localization
// ============================================================================

export const PERMISSION_LABELS: Record<Permission, { en: string; 'pt-BR': string }> = {
  // Tickets
  [PERMISSIONS.TICKETS_READ]: { en: 'View Tickets', 'pt-BR': 'Visualizar Chamados' },
  [PERMISSIONS.TICKETS_CREATE]: { en: 'Create Tickets', 'pt-BR': 'Criar Chamados' },
  [PERMISSIONS.TICKETS_UPDATE]: { en: 'Edit Tickets', 'pt-BR': 'Editar Chamados' },
  [PERMISSIONS.TICKETS_DELETE]: { en: 'Delete Tickets', 'pt-BR': 'Excluir Chamados' },
  [PERMISSIONS.TICKETS_CHANGE_STATUS]: { en: 'Change Ticket Status', 'pt-BR': 'Alterar Status do Chamado' },
  [PERMISSIONS.TICKETS_ASSIGN]: { en: 'Assign Technicians', 'pt-BR': 'Atribuir Técnicos' },
  [PERMISSIONS.TICKETS_VIEW_COSTS]: { en: 'View Ticket Costs', 'pt-BR': 'Ver Custos do Chamado' },
  [PERMISSIONS.TICKETS_UPDATE_COSTS]: { en: 'Update Ticket Costs', 'pt-BR': 'Atualizar Custos do Chamado' },
  
  // Inventory
  [PERMISSIONS.INVENTORY_READ]: { en: 'View Inventory', 'pt-BR': 'Visualizar Estoque' },
  [PERMISSIONS.INVENTORY_CREATE]: { en: 'Add Items', 'pt-BR': 'Adicionar Itens' },
  [PERMISSIONS.INVENTORY_UPDATE]: { en: 'Edit Items', 'pt-BR': 'Editar Itens' },
  [PERMISSIONS.INVENTORY_DELETE]: { en: 'Delete Items', 'pt-BR': 'Excluir Itens' },
  [PERMISSIONS.INVENTORY_ADJUST_QUANTITY]: { en: 'Adjust Quantities', 'pt-BR': 'Ajustar Quantidades' },
  [PERMISSIONS.INVENTORY_SCAN_QR]: { en: 'Scan QR Codes', 'pt-BR': 'Escanear QR Codes' },
  [PERMISSIONS.INVENTORY_VIEW_ANALYTICS]: { en: 'View Analytics', 'pt-BR': 'Ver Análises' },
  [PERMISSIONS.INVENTORY_MANAGE_CATEGORIES]: { en: 'Manage Categories', 'pt-BR': 'Gerenciar Categorias' },
  
  // Clients
  [PERMISSIONS.CLIENTS_READ]: { en: 'View Clients', 'pt-BR': 'Visualizar Clientes' },
  [PERMISSIONS.CLIENTS_CREATE]: { en: 'Add Clients', 'pt-BR': 'Adicionar Clientes' },
  [PERMISSIONS.CLIENTS_UPDATE]: { en: 'Edit Clients', 'pt-BR': 'Editar Clientes' },
  [PERMISSIONS.CLIENTS_DELETE]: { en: 'Delete Clients', 'pt-BR': 'Excluir Clientes' },
  [PERMISSIONS.CLIENTS_VIEW_HISTORY]: { en: 'View Client History', 'pt-BR': 'Ver Histórico do Cliente' },
  
  // Purchase Orders
  [PERMISSIONS.PURCHASE_ORDERS_READ]: { en: 'View Purchase Orders', 'pt-BR': 'Visualizar Ordens de Compra' },
  [PERMISSIONS.PURCHASE_ORDERS_CREATE]: { en: 'Create Purchase Orders', 'pt-BR': 'Criar Ordens de Compra' },
  [PERMISSIONS.PURCHASE_ORDERS_UPDATE]: { en: 'Edit Purchase Orders', 'pt-BR': 'Editar Ordens de Compra' },
  [PERMISSIONS.PURCHASE_ORDERS_DELETE]: { en: 'Delete Purchase Orders', 'pt-BR': 'Excluir Ordens de Compra' },
  [PERMISSIONS.PURCHASE_ORDERS_APPROVE]: { en: 'Approve Orders', 'pt-BR': 'Aprovar Ordens' },
  [PERMISSIONS.PURCHASE_ORDERS_RECEIVE]: { en: 'Receive Orders', 'pt-BR': 'Receber Ordens' },
  
  // POS
  [PERMISSIONS.POS_ACCESS]: { en: 'Access Point of Sale', 'pt-BR': 'Acessar Ponto de Venda' },
  [PERMISSIONS.POS_PROCESS_SALE]: { en: 'Process Sales', 'pt-BR': 'Processar Vendas' },
  [PERMISSIONS.POS_REFUND]: { en: 'Issue Refunds', 'pt-BR': 'Emitir Reembolsos' },
  [PERMISSIONS.POS_VIEW_REPORTS]: { en: 'View POS Reports', 'pt-BR': 'Ver Relatórios de PDV' },
  
  // Users
  [PERMISSIONS.USERS_READ]: { en: 'View Users', 'pt-BR': 'Visualizar Usuários' },
  [PERMISSIONS.USERS_INVITE]: { en: 'Invite Users', 'pt-BR': 'Convidar Usuários' },
  [PERMISSIONS.USERS_UPDATE]: { en: 'Edit Users', 'pt-BR': 'Editar Usuários' },
  [PERMISSIONS.USERS_DELETE]: { en: 'Delete Users', 'pt-BR': 'Excluir Usuários' },
  [PERMISSIONS.USERS_MANAGE_GROUPS]: { en: 'Manage User Groups', 'pt-BR': 'Gerenciar Grupos de Usuários' },
  
  // Groups
  [PERMISSIONS.GROUPS_READ]: { en: 'View Groups', 'pt-BR': 'Visualizar Grupos' },
  [PERMISSIONS.GROUPS_CREATE]: { en: 'Create Groups', 'pt-BR': 'Criar Grupos' },
  [PERMISSIONS.GROUPS_UPDATE]: { en: 'Edit Groups', 'pt-BR': 'Editar Grupos' },
  [PERMISSIONS.GROUPS_DELETE]: { en: 'Delete Groups', 'pt-BR': 'Excluir Grupos' },
  
  // Settings
  [PERMISSIONS.SETTINGS_READ]: { en: 'View Settings', 'pt-BR': 'Visualizar Configurações' },
  [PERMISSIONS.SETTINGS_UPDATE]: { en: 'Update Settings', 'pt-BR': 'Atualizar Configurações' },
  
  // Reports
  [PERMISSIONS.REPORTS_READ]: { en: 'View Reports', 'pt-BR': 'Visualizar Relatórios' },
  [PERMISSIONS.REPORTS_EXPORT]: { en: 'Export Reports', 'pt-BR': 'Exportar Relatórios' },
  
  // Audit
  [PERMISSIONS.AUDIT_LOGS_READ]: { en: 'View Audit Logs', 'pt-BR': 'Visualizar Logs de Auditoria' },
};

/**
 * Get permission label for display
 * @param permission - The permission to get label for
 * @param lang - Language code (en or pt-BR)
 * @returns Human-readable permission label
 */
export function getPermissionLabel(
  permission: Permission,
  lang: 'en' | 'pt-BR' = 'en'
): string {
  return PERMISSION_LABELS[permission]?.[lang] || permission;
}

// ============================================================================
// Express Middleware Types (for backend use)
// ============================================================================

export interface UserWithPermissions {
  id: string;
  tenantId: string | null;
  permissions: Permission[];
  isMasterUser?: boolean;
}
