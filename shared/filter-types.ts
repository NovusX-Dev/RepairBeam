// Filter type definitions for all pages
// These define the shape and default values for each page's filters

export interface KanbanFilters {
  search: string;
  status: string;
  priority: string;
  assignedTo: string;
  deviceType: string;
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
}

export const defaultKanbanFilters: KanbanFilters = {
  search: "",
  status: "",
  priority: "",
  assignedTo: "",
  deviceType: "",
  dateFrom: undefined,
  dateTo: undefined,
};

export interface InventoryFilters {
  search: string;
  category: string;
  location: string;
  workflow: string;
  stockStatus: string;
  minQuantity: number | undefined;
  maxQuantity: number | undefined;
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
}

export const defaultInventoryFilters: InventoryFilters = {
  search: "",
  category: "",
  location: "",
  workflow: "",
  stockStatus: "",
  minQuantity: undefined,
  maxQuantity: undefined,
  dateFrom: undefined,
  dateTo: undefined,
};

export interface ClientFilters {
  search: string;
  status: string;
  hasActiveTickets: boolean | undefined;
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
}

export const defaultClientFilters: ClientFilters = {
  search: "",
  status: "",
  hasActiveTickets: undefined,
  dateFrom: undefined,
  dateTo: undefined,
};

export interface PurchaseOrderFilters {
  search: string;
  status: string;
  supplier: string;
  category: string;
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
  minTotal: number | undefined;
  maxTotal: number | undefined;
}

export const defaultPurchaseOrderFilters: PurchaseOrderFilters = {
  search: "",
  status: "",
  supplier: "",
  category: "",
  dateFrom: undefined,
  dateTo: undefined,
  minTotal: undefined,
  maxTotal: undefined,
};
