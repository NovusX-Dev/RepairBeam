import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import UnderConstruction from "@/components/UnderConstruction";
import { GamificationTracker } from "@/components/GamificationTracker";
import { useLocalization } from "@/contexts/LocalizationContext";
import { 
  LayoutDashboard, 
  ClipboardList, 
  DollarSign, 
  Package, 
  Users 
} from "lucide-react";

interface DashboardStats {
  openTickets: number;
  monthlyRevenue: string;
  lowStockItems: number;
  activeClients: number;
}

export default function Dashboard() {
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
    retry: false,
  });
  
  const { t } = useLocalization();

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm font-medium">{t("open_tickets", "Open Tickets")}</p>
                {isLoading ? (
                  <Skeleton className="h-8 w-16 mt-1" />
                ) : (
                  <p className="text-3xl font-bold text-primary" data-testid="text-stat-tickets">
                    {stats?.openTickets || 0}
                  </p>
                )}
              </div>
              <div className="p-3 bg-primary/10 rounded-lg">
                <ClipboardList className="w-6 h-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm font-medium">{t("monthly_revenue", "Monthly Revenue")}</p>
                {isLoading ? (
                  <Skeleton className="h-8 w-20 mt-1" />
                ) : (
                  <p className="text-3xl font-bold text-white" data-testid="text-stat-revenue">
                    ${stats?.monthlyRevenue || '0.00'}
                  </p>
                )}
              </div>
              <div className="p-3 bg-green-500/10 rounded-lg">
                <DollarSign className="w-6 h-6 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm font-medium">{t("low_stock_items", "Low Stock Items")}</p>
                {isLoading ? (
                  <Skeleton className="h-8 w-12 mt-1" />
                ) : (
                  <p className="text-3xl font-bold text-yellow-500" data-testid="text-stat-inventory">
                    {stats?.lowStockItems || 0}
                  </p>
                )}
              </div>
              <div className="p-3 bg-yellow-500/10 rounded-lg">
                <Package className="w-6 h-6 text-yellow-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm font-medium">{t("active_clients", "Active Clients")}</p>
                {isLoading ? (
                  <Skeleton className="h-8 w-16 mt-1" />
                ) : (
                  <p className="text-3xl font-bold text-white" data-testid="text-stat-clients">
                    {stats?.activeClients || 0}
                  </p>
                )}
              </div>
              <div className="p-3 bg-blue-500/10 rounded-lg">
                <Users className="w-6 h-6 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gamification and Additional Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <GamificationTracker />
        </div>
        <div>
          <UnderConstruction
            title={t("dashboard_under_construction", "Dashboard Under Construction")}
            description={t("dashboard_construction_desc", "Advanced analytics and reporting tools coming soon.")}
            icon={<LayoutDashboard className="w-10 h-10 text-primary" />}
          />
        </div>
      </div>
    </div>
  );
}
