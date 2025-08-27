import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Bell, LogOut } from "lucide-react";

interface HeaderProps {
  currentPage: string;
}

export default function Header({ currentPage }: HeaderProps) {
  const { user } = useAuth();
  const { tenant } = useTenant();

  return (
    <header className="bg-card border-b border-border px-6 py-4 flex items-center justify-between">
      <div className="flex items-center space-x-4">
        <h2 className="text-2xl font-bold text-foreground" data-testid="text-page-title">
          {currentPage}
        </h2>
      </div>
      <div className="flex items-center space-x-4">
        {/* Notifications Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <div 
              className="p-2 rounded-lg hover:bg-accent transition-colors relative cursor-pointer"
              data-testid="dropdown-notifications"
            >
              <Bell className="w-5 h-5 text-muted-foreground" />
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full pulse-neon"></span>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <div className="p-3 text-sm text-muted-foreground text-center">
              No Notifications Available
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
        
        {/* User Avatar Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <div 
              className="flex items-center space-x-2 p-2 rounded-lg hover:bg-accent transition-colors cursor-pointer"
              data-testid="dropdown-user-menu"
            >
              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-navy-900 font-semibold text-sm overflow-hidden">
                {tenant?.shopImageUrl ? (
                  <img 
                    src={tenant.shopImageUrl} 
                    alt="Shop Logo" 
                    className="w-8 h-8 object-cover rounded-full"
                  />
                ) : (
                  <span>
                    {user?.firstName && user?.lastName 
                      ? `${user.firstName[0]}${user.lastName[0]}` 
                      : user?.email?.[0]?.toUpperCase() || "U"}
                  </span>
                )}
              </div>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem
              onClick={() => window.location.href = '/api/logout'}
              className="cursor-pointer"
              data-testid="menuitem-sign-out"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
