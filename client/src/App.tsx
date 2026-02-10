import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LocalizationProvider } from "@/contexts/LocalizationContext";
import { PermissionProvider } from "@/contexts/PermissionContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import Layout from "@/components/Layout";
import Landing from "@/pages/Landing";
import TenantSetup from "@/pages/TenantSetup";
import Dashboard from "@/pages/Dashboard";
import Clients from "@/pages/Clients";
import KanbanTickets from "@/pages/Kanban";
import CompletedHistory from "@/pages/CompletedHistory";
import Inventory from "@/pages/Inventory";
import InventoryAnalytics from "@/pages/InventoryAnalytics";
import Suppliers from "@/pages/Suppliers";
import PurchaseOrders from "@/pages/PurchaseOrders";
import POS from "@/pages/POS";
import Quotes from "@/pages/Quotes";
import PosInvoices from "@/pages/PosInvoices";
import AccountsReceivable from "@/pages/AccountsReceivable";
import AccountsPayable from "@/pages/AccountsPayable";
import Support from "@/pages/Support";
import Configs from "@/pages/Configs";
import Users from "@/pages/Users";
import AuditLogs from "@/pages/AuditLogs";
import AcceptInvite from "@/pages/AcceptInvite";
import Profile from "@/pages/Profile";
import SignaturePage from "@/pages/SignaturePage";
import NotFound from "@/pages/not-found";

function AuthenticatedRoutes() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/clients" component={Clients} />
        <Route path="/kanban" component={KanbanTickets} />
        <Route path="/completed-history" component={CompletedHistory} />
        <Route path="/inventory" component={Inventory} />
        <Route path="/inventory-analytics" component={InventoryAnalytics} />
        <Route path="/suppliers" component={Suppliers} />
        <Route path="/purchase-orders" component={PurchaseOrders} />
        <Route path="/pos" component={POS} />
        <Route path="/quotes" component={Quotes} />
        <Route path="/pos-invoices" component={PosInvoices} />
        <Route path="/accounts-receivable" component={AccountsReceivable} />
        <Route path="/accounts-payable" component={AccountsPayable} />
        <Route path="/support" component={Support} />
        <Route path="/configs" component={Configs} />
        <Route path="/users" component={Users} />
        <Route path="/audit-logs" component={AuditLogs} />
        <Route path="/profile" component={Profile} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function Router() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { tenant, isLoading: tenantLoading, hasValidTenant } = useTenant();

  if (isLoading || (isAuthenticated && tenantLoading)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-lg flex items-center justify-center mx-auto mb-4">
            <img 
              src="/repair-beam-logo.png" 
              alt="Repair Beam Logo" 
              className="w-16 h-16 object-contain animate-pulse"
            />
          </div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Check if user needs to set up their tenant
  const needsTenantSetup = isAuthenticated && user && !hasValidTenant;

  return (
    <ErrorBoundary>
      <Switch>
        {/* Public route for accepting invitations */}
        <Route path="/accept-invite/:token" component={AcceptInvite} />
        
        {/* Public route for digital signatures */}
        <Route path="/sign/:token" component={SignaturePage} />
        
        {!isAuthenticated ? (
          <Route path="/" component={Landing} />
        ) : needsTenantSetup ? (
          <Route path="/" component={TenantSetup} />
        ) : (
          <Route>
            <AuthenticatedRoutes />
          </Route>
        )}
        <Route component={NotFound} />
      </Switch>
    </ErrorBoundary>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <LocalizationProvider>
          <PermissionProvider>
            <Toaster />
            <Router />
          </PermissionProvider>
        </LocalizationProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
