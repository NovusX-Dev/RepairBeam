import { useCallback, useState } from "react";
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
  ChevronDown,
  FileText,
  Receipt,
  ArrowDownCircle,
  ArrowUpCircle,
  DollarSign,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
  currentPage: string;
  onPageChange: (page: string) => void;
}

const getNavigationItems = (t: (key: string, fallback?: string) => string) => [
  { name: t("dashboard", "Dashboard"), href: "/", icon: LayoutDashboard, id: "dashboard", translationKey: "dashboard", permission: null, section: "main" },
  { name: t("clients", "Clients"), href: "/clients", icon: Users, id: "clients", translationKey: "clients", permission: PERMISSIONS.CLIENTS_READ, section: "main" },
  { name: t("kanban", "Kanban Tickets"), href: "/kanban", icon: Kanban, id: "kanban", translationKey: "kanban", permission: PERMISSIONS.TICKETS_READ, section: "main" },
  { name: t("completed_history", "Completed History"), href: "/completed-history", icon: CheckSquare, id: "completed-history", translationKey: "completed_history", permission: PERMISSIONS.TICKETS_READ, section: "main" },
  { name: t("inventory", "Inventory"), href: "/inventory", icon: Package, id: "inventory", translationKey: "inventory", permission: PERMISSIONS.INVENTORY_READ, section: "stock" },
  { name: t("inventory_analytics", "Inventory Analytics"), href: "/inventory-analytics", icon: TrendingUp, id: "inventory-analytics", translationKey: "inventory_analytics", permission: PERMISSIONS.INVENTORY_VIEW_ANALYTICS, section: "stock" },
  { name: t("suppliers", "Suppliers"), href: "/suppliers", icon: Building2, id: "suppliers", translationKey: "suppliers", permission: PERMISSIONS.PURCHASE_ORDERS_READ, section: "stock" },
  { name: t("purchase_orders", "Purchase Orders"), href: "/purchase-orders", icon: ShoppingCart, id: "purchase-orders", translationKey: "purchase_orders", permission: PERMISSIONS.PURCHASE_ORDERS_READ, section: "stock" },
  { name: t("pos", "Point of Sale"), href: "/pos", icon: CreditCard, id: "pos", translationKey: "pos", permission: PERMISSIONS.POS_ACCESS, section: "finance" },
  { name: t("quotes", "Quotes"), href: "/quotes", icon: FileText, id: "quotes", translationKey: "quotes", permission: PERMISSIONS.QUOTES_READ, section: "finance" },
  { name: t("invoices", "Invoices"), href: "/pos-invoices", icon: Receipt, id: "pos-invoices", translationKey: "invoices", permission: PERMISSIONS.INVOICES_READ, section: "finance" },
  { name: t("accounts_receivable", "Accounts Receivable"), href: "/accounts-receivable", icon: ArrowDownCircle, id: "accounts-receivable", translationKey: "accounts_receivable", permission: PERMISSIONS.ACCOUNTS_RECEIVABLE_READ, section: "finance" },
  { name: t("accounts_payable", "Accounts Payable"), href: "/accounts-payable", icon: ArrowUpCircle, id: "accounts-payable", translationKey: "accounts_payable", permission: PERMISSIONS.ACCOUNTS_PAYABLE_READ, section: "finance" },
  { name: t("support", "Customer Support"), href: "/support", icon: HeadphonesIcon, id: "support", translationKey: "support", permission: null, section: "other" },
  { name: t("configs", "Configurations"), href: "/configs", icon: Settings, id: "configs", translationKey: "configs", permission: PERMISSIONS.SETTINGS_READ, section: "other" },
  { name: t("userManagement", "User Management"), href: "/users", icon: UserCog, id: "users", translationKey: "userManagement", permission: PERMISSIONS.USERS_READ, section: "other" },
  { name: t("audit_logs", "Audit Logs"), href: "/audit-logs", icon: ScrollText, id: "audit-logs", translationKey: "audit_logs", permission: PERMISSIONS.AUDIT_LOGS_READ, section: "other" },
];

type NavItem = ReturnType<typeof getNavigationItems>[number];

interface SectionConfig {
  key: string;
  label: string;
  items: NavItem[];
  bgClass: string;
}

function getInitialCollapsedSections(): Record<string, boolean> {
  try {
    const saved = localStorage.getItem('repairbeam-sidebar-sections');
    if (saved) return JSON.parse(saved);
  } catch {}
  return {};
}

export default function Sidebar({ isCollapsed, onToggle, currentPage, onPageChange }: SidebarProps) {
  const [location] = useLocation();
  const { user } = useAuth();
  const { tenant } = useTenant();
  const { t } = useLocalization();
  const { hasPermission } = usePermissions();
  const handleNavClick = useCallback((pageName: string) => {
    onPageChange(pageName);
  }, [onPageChange]);

  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>(getInitialCollapsedSections);
  
  const toggleSection = useCallback((sectionKey: string) => {
    setCollapsedSections(prev => {
      const next = { ...prev, [sectionKey]: !prev[sectionKey] };
      localStorage.setItem('repairbeam-sidebar-sections', JSON.stringify(next));
      return next;
    });
  }, []);
  
  const { data: storeSettings } = useQuery<any>({
    queryKey: ['/api/store-settings'],
    enabled: !!tenant,
  });
  
  const allNavigationItems = getNavigationItems(t);
  
  const navigationItems = allNavigationItems.filter(item => 
    !item.permission || hasPermission(item.permission as Permission)
  );
  
  const dashboardItem = navigationItems.find(item => item.id === "dashboard");
  const mainItems = navigationItems.filter(item => item.section === "main" && item.id !== "dashboard");
  const stockItems = navigationItems.filter(item => item.section === "stock");
  const financeItems = navigationItems.filter(item => item.section === "finance");
  const otherItems = navigationItems.filter(item => item.section === "other");

  const sections: SectionConfig[] = [
    { key: "main", label: t("operations", "Operations"), items: mainItems, bgClass: "bg-white/[0.02]" },
    { key: "stock", label: t("stock_management", "Stock Management"), items: stockItems, bgClass: "bg-cyan-500/[0.04]" },
    { key: "finance", label: t("finance_and_billing", "Finance & Billing"), items: financeItems, bgClass: "bg-white/[0.02]" },
    { key: "other", label: t("settings_and_admin", "Settings & Admin"), items: otherItems, bgClass: "bg-cyan-500/[0.04]" },
  ].filter(s => s.items.length > 0);

  const renderNavItem = (item: NavItem) => {
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
        onClick={() => handleNavClick(item.name)}
        data-testid={`link-nav-${item.id}`}
      >
        <Icon className="w-5 h-5" />
        {!isCollapsed && (
          <span className="font-medium">{item.name}</span>
        )}
      </Link>
    );
  };

  return (
    <div 
      className={cn(
        "bg-navy-900 border-r border-border transition-all duration-300 ease-in-out h-screen flex flex-col",
        isCollapsed ? "w-20" : "w-70"
      )}
    >
      <div className="flex-shrink-0 flex items-center justify-between p-6 border-b border-border">
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

      <nav className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden sidebar-nav">
        {dashboardItem && (
          <div className="px-3 pt-3 pb-1">
            {renderNavItem(dashboardItem)}
          </div>
        )}
        {sections.map((section, idx) => {
          const isSectionCollapsed = collapsedSections[section.key] ?? false;
          const hasActiveItem = section.items.some(item => location === item.href);

          return (
            <div
              key={section.key}
              className={cn(
                "transition-colors duration-200",
                section.bgClass,
                idx > 0 && "border-t border-cyan-500/20"
              )}
            >
              {!isCollapsed ? (
                <button
                  onClick={() => toggleSection(section.key)}
                  className={cn(
                    "w-full flex items-center justify-between px-4 py-3 group cursor-pointer transition-colors",
                    "hover:bg-white/[0.04]"
                  )}
                >
                  <h3 className={cn(
                    "text-xs font-semibold uppercase tracking-wider transition-colors",
                    hasActiveItem ? "text-cyan-400" : "text-cyan-400/70",
                    "group-hover:text-cyan-400"
                  )}>
                    {section.label}
                  </h3>
                  <ChevronDown
                    className={cn(
                      "w-3.5 h-3.5 text-cyan-400/50 transition-transform duration-200",
                      isSectionCollapsed && "-rotate-90"
                    )}
                  />
                </button>
              ) : (
                <div className="py-2">
                  <div className="mx-auto w-6 h-[2px] rounded-full bg-cyan-500/30" />
                </div>
              )}

              <div
                className={cn(
                  "overflow-hidden transition-all duration-200 px-3",
                  !isCollapsed && isSectionCollapsed ? "max-h-0 py-0" : "max-h-[500px] pb-2",
                  isCollapsed && "px-2"
                )}
              >
                <div className="space-y-1">
                  {section.items.map(renderNavItem)}
                </div>
              </div>
            </div>
          );
        })}
      </nav>

      {!isCollapsed && user && (
        <div className="flex-shrink-0 p-4 border-t border-border bg-navy-900">
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
