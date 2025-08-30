import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useLocalization } from "@/contexts/LocalizationContext";
import {
  LayoutDashboard,
  Users,
  Kanban,
  Package,
  CreditCard,
  HeadphonesIcon,
  Settings,
  UserCog,
  ChevronLeft,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
  currentPage: string;
  onPageChange: (page: string) => void;
}

const getNavigationItems = (t: (key: string, fallback?: string) => string) => [
  { name: t("dashboard", "Dashboard"), href: "/", icon: LayoutDashboard, id: "dashboard", translationKey: "dashboard" },
  { name: t("clients", "Clients"), href: "/clients", icon: Users, id: "clients", translationKey: "clients" },
  { name: t("kanban", "Kanban Tickets"), href: "/kanban", icon: Kanban, id: "kanban", translationKey: "kanban" },
  { name: t("inventory", "Inventory"), href: "/inventory", icon: Package, id: "inventory", translationKey: "inventory" },
  { name: t("pos", "Point of Sale"), href: "/pos", icon: CreditCard, id: "pos", translationKey: "pos" },
  { name: t("support", "Customer Support"), href: "/support", icon: HeadphonesIcon, id: "support", translationKey: "support" },
  { name: t("animations", "Animations"), href: "/animations", icon: Sparkles, id: "animations", translationKey: "animations" },
  { name: t("configs", "Configurations"), href: "/configs", icon: Settings, id: "configs", translationKey: "configs" },
  { name: t("user_management", "User Management"), href: "/users", icon: UserCog, id: "users", translationKey: "user_management" },
];

export default function Sidebar({ isCollapsed, onToggle, currentPage, onPageChange }: SidebarProps) {
  const [location] = useLocation();
  const { user } = useAuth();
  const { tenant } = useTenant();
  const { t } = useLocalization();
  
  const navigationItems = getNavigationItems(t);

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
            <img 
              src="/repair-beam-logo.png" 
              alt="Repair Beam Logo" 
              className="w-10 h-10 object-contain"
            />
          </div>
          {!isCollapsed && (
            <div>
              <h1 className="text-xl font-bold text-white">
                Repair Beam
              </h1>
              <p className="text-xs text-muted-foreground">{t("repair_shop_management", "Professional Repair Management")}</p>
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
        {navigationItems.map((item) => {
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
              {tenant?.shopImageUrl ? (
                <img 
                  src={tenant.shopImageUrl} 
                  alt="Shop Logo" 
                  className="w-8 h-8 object-cover rounded-full"
                />
              ) : (
                <span>
                  {user.firstName && user.lastName 
                    ? `${user.firstName[0]}${user.lastName[0]}` 
                    : user.email?.[0]?.toUpperCase() || "U"}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {tenant?.alias || tenant?.name || "Shop"}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {user.role === 'admin' ? t("administrator", "Administrator") : t("user", "User")} • {tenant?.name || t("shop", "Shop")}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
