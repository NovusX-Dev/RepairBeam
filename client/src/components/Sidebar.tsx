import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { usePermissions } from "@/contexts/PermissionContext";
import { useQuery } from "@tanstack/react-query";
import { useLocalization } from "@/contexts/LocalizationContext";
import { PERMISSIONS } from "@shared/permissions";
import type { Permission } from "@shared/permissions";
import {
  LayoutDashboard,
  Users,
  Kanban,
  CheckSquare,
  Package,
  TrendingUp,
  Building2,
  ShoppingCart,
  CreditCard,
  HeadphonesIcon,
  Settings,
  UserCog,
  ScrollText,
  ChevronLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
  currentPage: string;
  onPageChange: (page: string) => void;
}

const getNavigationItems = (t: (key: string, fallback?: string) => string) => [
  { name: t("dashboard", "Dashboard"), href: "/", icon: LayoutDashboard, id: "dashboard", translationKey: "dashboard", permission: null },
  { name: t("clients", "Clients"), href: "/clients", icon: Users, id: "clients", translationKey: "clients", permission: PERMISSIONS.CLIENTS_READ },
  { name: t("kanban", "Kanban Tickets"), href: "/kanban", icon: Kanban, id: "kanban", translationKey: "kanban", permission: PERMISSIONS.TICKETS_READ },
  { name: t("completed_history", "Completed History"), href: "/completed-history", icon: CheckSquare, id: "completed-history", translationKey: "completed_history", permission: PERMISSIONS.TICKETS_READ },
  { name: t("inventory", "Inventory"), href: "/inventory", icon: Package, id: "inventory", translationKey: "inventory", permission: PERMISSIONS.INVENTORY_READ },
  { name: t("inventory_analytics", "Inventory Analytics"), href: "/inventory-analytics", icon: TrendingUp, id: "inventory-analytics", translationKey: "inventory_analytics", permission: PERMISSIONS.INVENTORY_VIEW_ANALYTICS },
  { name: t("suppliers", "Suppliers"), href: "/suppliers", icon: Building2, id: "suppliers", translationKey: "suppliers", permission: PERMISSIONS.PURCHASE_ORDERS_READ },
  { name: t("purchase_orders", "Purchase Orders"), href: "/purchase-orders", icon: ShoppingCart, id: "purchase-orders", translationKey: "purchase_orders", permission: PERMISSIONS.PURCHASE_ORDERS_READ },
  { name: t("pos", "Point of Sale"), href: "/pos", icon: CreditCard, id: "pos", translationKey: "pos", permission: PERMISSIONS.POS_ACCESS },
  { name: t("support", "Customer Support"), href: "/support", icon: HeadphonesIcon, id: "support", translationKey: "support", permission: null },
  { name: t("configs", "Configurations"), href: "/configs", icon: Settings, id: "configs", translationKey: "configs", permission: PERMISSIONS.SETTINGS_READ },
  { name: t("userManagement", "User Management"), href: "/users", icon: UserCog, id: "users", translationKey: "userManagement", permission: PERMISSIONS.USERS_READ },
  { name: t("audit_logs", "Audit Logs"), href: "/audit-logs", icon: ScrollText, id: "audit-logs", translationKey: "audit_logs", permission: PERMISSIONS.AUDIT_LOGS_READ },
];

export default function Sidebar({ isCollapsed, onToggle, currentPage, onPageChange }: SidebarProps) {
  const [location] = useLocation();
  const { user } = useAuth();
  const { tenant } = useTenant();
  const { t } = useLocalization();
  const { hasPermission } = usePermissions();
  
  // Fetch store settings to get shop name and logo
  const { data: storeSettings } = useQuery<any>({
    queryKey: ['/api/store-settings'],
    enabled: !!tenant,
  });
  
  const allNavigationItems = getNavigationItems(t);
  
  // Filter navigation items based on permissions
  const navigationItems = allNavigationItems.filter(item => 
    !item.permission || hasPermission(item.permission as Permission)
  );

  return (
    <div 
      className={cn(
        "bg-navy-900 border-r border-border transition-all duration-300 ease-in-out",
        isCollapsed ? "w-20" : "w-70"
      )}
    >
      {/* Brand Header */}
      <div className="flex items-center justify-between p-6 border-b border-border">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center overflow-hidden bg-background">
            {storeSettings?.shopLogoUrl ? (
              <img 
                src={storeSettings.shopLogoUrl} 
                alt={storeSettings.shopName || "Shop Logo"}
                className="w-10 h-10 object-cover rounded-lg"
              />
            ) : (
              <img 
                src="/repair-beam-logo.png" 
                alt="Repair Beam Logo" 
                className="w-10 h-10 object-contain"
              />
            )}
          </div>
          {!isCollapsed && (
            <div>
              <h1 className="text-xl font-bold text-white">
                {storeSettings?.shopName || "Repair Beam"}
              </h1>
              <p className="text-xs text-muted-foreground">
                {storeSettings?.shopAlias || t("repair_shop_management", "Professional Repair Management")}
              </p>
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggle}
          className="p-2 rounded-lg hover:bg-accent transition-colors"
          data-testid="button-sidebar-toggle"
        >
          <ChevronLeft className={cn("w-5 h-5 text-muted-foreground transition-transform", isCollapsed && "rotate-180")} />
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {navigationItems.slice(0, 4).map((item) => {
          const Icon = item.icon;
          const isActive = location === item.href;
          
          return (
            <Link 
              key={item.id} 
              href={item.href}
              className={cn(
                "flex items-center space-x-3 p-3 rounded-lg border-l-4 border-transparent transition-all duration-200",
                "hover:bg-accent hover:border-l-primary",
                isActive && "bg-accent border-l-primary text-primary"
              )}
              onClick={() => onPageChange(item.name)}
              data-testid={`link-nav-${item.id}`}
            >
              <Icon className="w-5 h-5" />
              {!isCollapsed && (
                <span className="font-medium">{item.name}</span>
              )}
            </Link>
          );
        })}

        {/* Divider before Stock Management */}
        <div className="border-t border-cyan-500/20 my-3"></div>

        {/* Stock Management Section */}
        {!isCollapsed && (
          <div className="pb-2">
            <h3 className="px-3 text-xs font-semibold text-cyan-400/70 uppercase tracking-wider">
              {t("stock_management", "Stock Management")}
            </h3>
          </div>
        )}
        
        {navigationItems.slice(4, 8).map((item) => {
          const Icon = item.icon;
          const isActive = location === item.href;
          
          return (
            <Link 
              key={item.id} 
              href={item.href}
              className={cn(
                "flex items-center space-x-3 p-3 rounded-lg border-l-4 border-transparent transition-all duration-200",
                "hover:bg-accent hover:border-l-primary",
                isActive && "bg-accent border-l-primary text-primary"
              )}
              onClick={() => onPageChange(item.name)}
              data-testid={`link-nav-${item.id}`}
            >
              <Icon className="w-5 h-5" />
              {!isCollapsed && (
                <span className="font-medium">{item.name}</span>
              )}
            </Link>
          );
        })}

        {/* Divider after Stock Management */}
        <div className="border-t border-cyan-500/20 my-3"></div>

        {/* Remaining items */}
        {navigationItems.slice(8).map((item) => {
          const Icon = item.icon;
          const isActive = location === item.href;
          
          return (
            <Link 
              key={item.id} 
              href={item.href}
              className={cn(
                "flex items-center space-x-3 p-3 rounded-lg border-l-4 border-transparent transition-all duration-200",
                "hover:bg-accent hover:border-l-primary",
                isActive && "bg-accent border-l-primary text-primary"
              )}
              onClick={() => onPageChange(item.name)}
              data-testid={`link-nav-${item.id}`}
            >
              <Icon className="w-5 h-5" />
              {!isCollapsed && (
                <span className="font-medium">{item.name}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User Profile */}
      {!isCollapsed && user && (
        <div className="p-4 border-t border-border">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-navy-900 font-semibold text-sm overflow-hidden">
              {storeSettings?.shopLogoUrl ? (
                <img 
                  src={storeSettings.shopLogoUrl} 
                  alt="Shop Logo" 
                  className="w-8 h-8 object-cover rounded-full"
                />
              ) : (
                <span>
                  {storeSettings?.shopName?.[0]?.toUpperCase() || storeSettings?.shopAlias?.[0]?.toUpperCase() || "S"}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {storeSettings?.shopName || "Shop"}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {user.role === 'admin' ? t("administrator", "Administrator") : t("user", "User")} • {storeSettings?.shopAlias || "Shop"}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
