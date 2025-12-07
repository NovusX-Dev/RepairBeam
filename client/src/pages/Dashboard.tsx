import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { GamificationTracker } from "@/components/GamificationTracker";
import { useLocalization } from "@/contexts/LocalizationContext";
import { useLocation } from "wouter";
import { 
  ClipboardList, 
  DollarSign, 
  Package, 
  Users,
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Plus,
  ArrowRight,
  Activity,
  Smartphone,
  CreditCard,
  Target,
  BarChart3,
  Wrench,
  Info
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  AreaChart,
  Area
} from "recharts";

interface StatusBreakdown {
  status: string;
  count: number;
  percentage: number;
}

interface DailyTrend {
  date: string;
  revenue: number;
  ticketCount: number;
}

interface RecentActivity {
  id: string;
  type: string;
  description: string;
  timestamp: string;
  metadata?: {
    deviceType?: string;
    deviceModel?: string;
    status?: string;
    finalCost?: string;
    paymentMethod?: string;
    total?: string;
  };
}

interface DashboardStats {
  openTickets: number;
  monthlyRevenue: string;
  lowStockItems: number;
  activeClients: number;
  completionRate: number;
  completedTickets: number;
  totalTickets: number;
  avgAccuracyScore: number;
  completionRevenue: string;
  avgTimeVariance: number;
  avgCostVariance: number;
  recentCompletions: number;
  ticketStatusBreakdown: StatusBreakdown[];
  dailyRevenueTrend: DailyTrend[];
  recentActivity: RecentActivity[];
  revenueChange: number;
  ticketChange: number;
  currentMonthTickets: number;
  inventoryTotalValue: string;
  totalInventoryItems: number;
}

const STATUS_COLORS: Record<string, string> = {
  intake: '#00BFFF',
  diagnosed: '#9370DB',
  parts_ordered: '#FFD700',
  in_repair: '#FF8C00',
  quality_check: '#00CED1',
  ready: '#32CD32',
  finalized: '#228B22',
  archived: '#6B7280'
};

const STATUS_LABELS: Record<string, { en: string; pt: string }> = {
  intake: { en: 'Intake', pt: 'Entrada' },
  diagnosed: { en: 'Diagnosed', pt: 'Diagnosticado' },
  parts_ordered: { en: 'Parts Ordered', pt: 'Peças Pedidas' },
  in_repair: { en: 'In Repair', pt: 'Em Reparo' },
  quality_check: { en: 'Quality Check', pt: 'Controle de Qualidade' },
  ready: { en: 'Ready', pt: 'Pronto' },
  finalized: { en: 'Completed', pt: 'Concluído' },
  archived: { en: 'Archived', pt: 'Arquivado' }
};

function InfoTooltip({ text }: { text: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button 
            className="ml-1 inline-flex items-center justify-center" 
            type="button"
            aria-label={text}
          >
            <Info className="w-3.5 h-3.5 text-slate-500 hover:text-slate-300 transition-colors cursor-help" aria-hidden="true" />
          </button>
        </TooltipTrigger>
        <TooltipContent 
          side="top" 
          className="max-w-xs bg-slate-800 border-cyan-500/30 text-slate-200 text-sm"
        >
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function TrendIndicator({ value, suffix = '%' }: { value: number; suffix?: string }) {
  if (value > 0) {
    return (
      <span className="inline-flex items-center text-xs text-green-400 font-medium">
        <TrendingUp className="w-3 h-3 mr-1" />
        +{value.toFixed(1)}{suffix}
      </span>
    );
  } else if (value < 0) {
    return (
      <span className="inline-flex items-center text-xs text-red-400 font-medium">
        <TrendingDown className="w-3 h-3 mr-1" />
        {value.toFixed(1)}{suffix}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center text-xs text-slate-400 font-medium">
      <Minus className="w-3 h-3 mr-1" />
      0{suffix}
    </span>
  );
}

function getActivityIcon(type: string) {
  switch (type) {
    case 'ticket_created':
      return <Plus className="w-4 h-4 text-cyan-400" />;
    case 'ticket_completed':
      return <CheckCircle2 className="w-4 h-4 text-green-400" />;
    case 'payment_received':
      return <CreditCard className="w-4 h-4 text-yellow-400" />;
    default:
      return <Activity className="w-4 h-4 text-slate-400" />;
  }
}

function formatTimeAgo(timestamp: string, t: (key: string, fallback: string) => string): string {
  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return t('just_now', 'Just now');
  if (diffMins < 60) return `${diffMins} ${t('minutes_ago', 'min ago')}`;
  if (diffHours < 24) return `${diffHours} ${t('hours_ago', 'hours ago')}`;
  return `${diffDays} ${t('days_ago', 'days ago')}`;
}

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
    retry: false,
    refetchInterval: 30000,
  });
  
  const { t, currentLanguage, formatCurrency } = useLocalization();

  const getStatusLabel = (status: string) => {
    const labels = STATUS_LABELS[status];
    if (!labels) return status;
    return currentLanguage.code === 'pt-BR' ? labels.pt : labels.en;
  };

  const formatDayLabel = (dateStr: string) => {
    const date = new Date(dateStr);
    const days = currentLanguage.code === 'pt-BR' 
      ? ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
      : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days[date.getDay()];
  };

  return (
    <div className="space-y-6 p-1">
      {/* KPI Cards Row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Open Tickets */}
        <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-cyan-500/30 hover:border-cyan-400/50 transition-all">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm font-medium mb-1 flex items-center">
                  {t("open_tickets", "Open Tickets")}
                  <InfoTooltip text={t("kpi_info_open_tickets", "Number of repair tickets currently in progress that have not been completed or archived.")} />
                </p>
                {isLoading ? (
                  <Skeleton className="h-9 w-16" />
                ) : (
                  <div className="flex items-baseline gap-2">
                    <p className="text-3xl font-bold text-cyan-400" data-testid="text-stat-tickets">
                      {stats?.openTickets || 0}
                    </p>
                    <TrendIndicator value={stats?.ticketChange || 0} />
                  </div>
                )}
                <p className="text-xs text-slate-500 mt-1">
                  {t("vs_last_month", "vs last month")}
                </p>
              </div>
              <div className="p-3 bg-cyan-500/20 rounded-xl">
                <ClipboardList className="w-6 h-6 text-cyan-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Monthly Revenue */}
        <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-green-500/30 hover:border-green-400/50 transition-all">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm font-medium mb-1 flex items-center">
                  {t("monthly_revenue", "Monthly Revenue")}
                  <InfoTooltip text={t("kpi_info_monthly_revenue", "Total revenue from completed repairs this month. Includes all payments received.")} />
                </p>
                {isLoading ? (
                  <Skeleton className="h-9 w-24" />
                ) : (
                  <div className="flex items-baseline gap-2">
                    <p className="text-3xl font-bold text-green-400" data-testid="text-stat-revenue">
                      {formatCurrency(stats?.monthlyRevenue || '0')}
                    </p>
                    <TrendIndicator value={stats?.revenueChange || 0} />
                  </div>
                )}
                <p className="text-xs text-slate-500 mt-1">
                  {t("vs_last_month", "vs last month")}
                </p>
              </div>
              <div className="p-3 bg-green-500/20 rounded-xl">
                <DollarSign className="w-6 h-6 text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Completion Rate */}
        <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-purple-500/30 hover:border-purple-400/50 transition-all">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm font-medium mb-1 flex items-center">
                  {t("completion_rate", "Completion Rate")}
                  <InfoTooltip text={t("kpi_info_completion_rate", "Percentage of tickets that have been completed out of total tickets created.")} />
                </p>
                {isLoading ? (
                  <Skeleton className="h-9 w-20" />
                ) : (
                  <div className="flex items-baseline gap-2">
                    <p className="text-3xl font-bold text-purple-400" data-testid="text-stat-completion">
                      {(stats?.completionRate || 0).toFixed(1)}%
                    </p>
                  </div>
                )}
                <p className="text-xs text-slate-500 mt-1">
                  {stats?.completedTickets || 0} / {stats?.totalTickets || 0} {t("tickets", "tickets")}
                </p>
              </div>
              <div className="p-3 bg-purple-500/20 rounded-xl">
                <Target className="w-6 h-6 text-purple-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Active Clients */}
        <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-blue-500/30 hover:border-blue-400/50 transition-all">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm font-medium mb-1 flex items-center">
                  {t("active_clients", "Active Clients")}
                  <InfoTooltip text={t("kpi_info_active_clients", "Total number of registered customers in your database.")} />
                </p>
                {isLoading ? (
                  <Skeleton className="h-9 w-16" />
                ) : (
                  <p className="text-3xl font-bold text-blue-400" data-testid="text-stat-clients">
                    {stats?.activeClients || 0}
                  </p>
                )}
                <p className="text-xs text-slate-500 mt-1">
                  {t("registered_clients", "Registered clients")}
                </p>
              </div>
              <div className="p-3 bg-blue-500/20 rounded-xl">
                <Users className="w-6 h-6 text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* KPI Cards Row 2 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Low Stock Alert */}
        <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-yellow-500/30 hover:border-yellow-400/50 transition-all">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm font-medium mb-1 flex items-center">
                  {t("low_stock_items", "Low Stock Items")}
                  <InfoTooltip text={t("kpi_info_low_stock", "Number of inventory items below their minimum quantity threshold. These items need to be reordered.")} />
                </p>
                {isLoading ? (
                  <Skeleton className="h-9 w-12" />
                ) : (
                  <p className={`text-3xl font-bold ${(stats?.lowStockItems || 0) > 0 ? 'text-yellow-400' : 'text-green-400'}`} data-testid="text-stat-inventory">
                    {stats?.lowStockItems || 0}
                  </p>
                )}
                <p className="text-xs text-slate-500 mt-1">
                  {t("items_need_reorder", "Items need reorder")}
                </p>
              </div>
              <div className={`p-3 rounded-xl ${(stats?.lowStockItems || 0) > 0 ? 'bg-yellow-500/20' : 'bg-green-500/20'}`}>
                {(stats?.lowStockItems || 0) > 0 ? (
                  <AlertTriangle className="w-6 h-6 text-yellow-400" />
                ) : (
                  <CheckCircle2 className="w-6 h-6 text-green-400" />
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Inventory Value */}
        <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-orange-500/30 hover:border-orange-400/50 transition-all">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm font-medium mb-1 flex items-center">
                  {t("inventory_value", "Inventory Value")}
                  <InfoTooltip text={t("kpi_info_inventory_value", "Total value of all parts and items currently in your inventory, based on cost price.")} />
                </p>
                {isLoading ? (
                  <Skeleton className="h-9 w-24" />
                ) : (
                  <p className="text-3xl font-bold text-orange-400" data-testid="text-stat-inventory-value">
                    {formatCurrency(stats?.inventoryTotalValue || '0')}
                  </p>
                )}
                <p className="text-xs text-slate-500 mt-1">
                  {stats?.totalInventoryItems || 0} {t("total_items", "total items")}
                </p>
              </div>
              <div className="p-3 bg-orange-500/20 rounded-xl">
                <Package className="w-6 h-6 text-orange-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Accuracy Score */}
        <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-teal-500/30 hover:border-teal-400/50 transition-all">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm font-medium mb-1 flex items-center">
                  {t("accuracy_score", "Accuracy Score")}
                  <InfoTooltip text={t("kpi_info_accuracy_score", "How close your repair estimates are to final costs. Higher percentage means more accurate quotes to customers.")} />
                </p>
                {isLoading ? (
                  <Skeleton className="h-9 w-16" />
                ) : (
                  <p className="text-3xl font-bold text-teal-400" data-testid="text-stat-accuracy">
                    {(stats?.avgAccuracyScore || 0).toFixed(1)}%
                  </p>
                )}
                <p className="text-xs text-slate-500 mt-1">
                  {t("estimate_accuracy", "Estimate accuracy")}
                </p>
              </div>
              <div className="p-3 bg-teal-500/20 rounded-xl">
                <BarChart3 className="w-6 h-6 text-teal-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* This Month Tickets */}
        <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-indigo-500/30 hover:border-indigo-400/50 transition-all">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm font-medium mb-1 flex items-center">
                  {t("tickets_this_month", "Tickets This Month")}
                  <InfoTooltip text={t("kpi_info_tickets_month", "Total number of new repair tickets created during the current month.")} />
                </p>
                {isLoading ? (
                  <Skeleton className="h-9 w-16" />
                ) : (
                  <p className="text-3xl font-bold text-indigo-400" data-testid="text-stat-month-tickets">
                    {stats?.currentMonthTickets || 0}
                  </p>
                )}
                <p className="text-xs text-slate-500 mt-1">
                  {t("new_repairs", "New repairs")}
                </p>
              </div>
              <div className="p-3 bg-indigo-500/20 rounded-xl">
                <Wrench className="w-6 h-6 text-indigo-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Trend Chart */}
        <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-cyan-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-cyan-400" />
              {t("revenue_trend", "Revenue Trend")}
              <span className="text-xs text-slate-400 font-normal ml-2">
                {t("last_7_days", "Last 7 days")}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={stats?.dailyRevenueTrend || []}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00FFFF" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#00FFFF" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis 
                    dataKey="date" 
                    stroke="#64748b"
                    fontSize={12}
                    tickFormatter={formatDayLabel}
                  />
                  <YAxis 
                    stroke="#64748b"
                    fontSize={12}
                    tickFormatter={(value) => `$${value}`}
                  />
                  <RechartsTooltip 
                    contentStyle={{ 
                      backgroundColor: '#1e293b', 
                      border: '1px solid #00FFFF33',
                      borderRadius: '8px'
                    }}
                    labelFormatter={(label: string) => formatDayLabel(label)}
                    formatter={(value: number) => [`$${value.toFixed(2)}`, t("revenue", "Revenue")]}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="revenue" 
                    stroke="#00FFFF" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#colorRevenue)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Ticket Status Distribution */}
        <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-cyan-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-cyan-400" />
              {t("ticket_distribution", "Ticket Distribution")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : stats?.ticketStatusBreakdown && stats.ticketStatusBreakdown.length > 0 ? (
              <div className="flex items-center">
                <ResponsiveContainer width="50%" height={200}>
                  <PieChart>
                    <Pie
                      data={stats.ticketStatusBreakdown}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="count"
                    >
                      {stats.ticketStatusBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.status] || '#6B7280'} />
                      ))}
                    </Pie>
                    <RechartsTooltip 
                      contentStyle={{ 
                        backgroundColor: '#1e293b', 
                        border: '1px solid #00FFFF33',
                        borderRadius: '8px'
                      }}
                      formatter={(value: number, name: string, props: any) => [
                        `${value} (${props.payload.percentage}%)`,
                        getStatusLabel(props.payload.status)
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-2">
                  {stats.ticketStatusBreakdown.map((item) => (
                    <div key={item.status} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: STATUS_COLORS[item.status] || '#6B7280' }}
                        />
                        <span className="text-slate-300">{getStatusLabel(item.status)}</span>
                      </div>
                      <span className="text-slate-400 font-medium">
                        {item.count} ({item.percentage}%)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-slate-400">
                {t("no_tickets_yet", "No tickets yet")}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-cyan-500/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold text-white">
              {t("quick_actions", "Quick Actions")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button 
              className="w-full justify-between bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 border border-cyan-500/30"
              variant="outline"
              onClick={() => setLocation('/kanban')}
              data-testid="button-quick-new-ticket"
            >
              <span className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                {t("create_new_ticket", "Create New Ticket")}
              </span>
              <ArrowRight className="w-4 h-4" />
            </Button>
            <Button 
              className="w-full justify-between bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/30"
              variant="outline"
              onClick={() => setLocation('/pos')}
              data-testid="button-quick-pos"
            >
              <span className="flex items-center gap-2">
                <CreditCard className="w-4 h-4" />
                {t("point_of_sale", "Point of Sale")}
              </span>
              <ArrowRight className="w-4 h-4" />
            </Button>
            <Button 
              className="w-full justify-between bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 border border-orange-500/30"
              variant="outline"
              onClick={() => setLocation('/inventory')}
              data-testid="button-quick-inventory"
            >
              <span className="flex items-center gap-2">
                <Package className="w-4 h-4" />
                {t("manage_inventory", "Manage Inventory")}
              </span>
              <ArrowRight className="w-4 h-4" />
            </Button>
            <Button 
              className="w-full justify-between bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/30"
              variant="outline"
              onClick={() => setLocation('/clients')}
              data-testid="button-quick-clients"
            >
              <span className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                {t("view_clients", "View Clients")}
              </span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="lg:col-span-2 bg-gradient-to-br from-slate-900 to-slate-800 border-cyan-500/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-cyan-400" />
              {t("recent_activity", "Recent Activity")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : stats?.recentActivity && stats.recentActivity.length > 0 ? (
              <div className="space-y-3 max-h-[280px] overflow-y-auto pr-2">
                {stats.recentActivity.map((activity) => (
                  <div 
                    key={activity.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/50 hover:bg-slate-800/80 transition-colors"
                  >
                    <div className="p-2 rounded-lg bg-slate-700/50">
                      {getActivityIcon(activity.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white font-medium truncate">
                        {activity.description}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        {activity.metadata?.deviceType && (
                          <span className="flex items-center gap-1">
                            <Smartphone className="w-3 h-3" />
                            {activity.metadata.deviceType}
                          </span>
                        )}
                        {activity.metadata?.paymentMethod && (
                          <span className="capitalize">{activity.metadata.paymentMethod}</span>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-slate-500 whitespace-nowrap">
                      {formatTimeAgo(activity.timestamp, t)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-40 flex items-center justify-center text-slate-400">
                {t("no_recent_activity", "No recent activity")}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Gamification Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GamificationTracker />
        
        {/* Performance Metrics Card */}
        <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-cyan-500/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-cyan-400" />
              {t("performance_metrics", "Performance Metrics")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Time Variance */}
            <div className="p-4 rounded-lg bg-slate-800/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-300">{t("time_variance", "Time Variance")}</span>
                <span className={`text-lg font-bold ${(stats?.avgTimeVariance || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {(stats?.avgTimeVariance || 0) >= 0 ? '+' : ''}{(stats?.avgTimeVariance || 0).toFixed(1)}%
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {(stats?.avgTimeVariance || 0) >= 0 
                  ? t("under_estimated_time", "On average, work completed faster than estimated")
                  : t("over_estimated_time", "On average, work took longer than estimated")
                }
              </p>
            </div>

            {/* Cost Variance */}
            <div className="p-4 rounded-lg bg-slate-800/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-300">{t("cost_variance", "Cost Variance")}</span>
                <span className={`text-lg font-bold ${(stats?.avgCostVariance || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {(stats?.avgCostVariance || 0) >= 0 ? '+' : ''}{(stats?.avgCostVariance || 0).toFixed(1)}%
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {(stats?.avgCostVariance || 0) >= 0 
                  ? t("under_estimated_cost", "On average, actual cost was under estimate")
                  : t("over_estimated_cost", "On average, actual cost exceeded estimate")
                }
              </p>
            </div>

            {/* Recent Completions */}
            <div className="p-4 rounded-lg bg-slate-800/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-300">{t("recent_completions", "Recent Completions")}</span>
                <span className="text-lg font-bold text-cyan-400">
                  {stats?.recentCompletions || 0}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {t("completions_analyzed", "Completions analyzed for accuracy")}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
