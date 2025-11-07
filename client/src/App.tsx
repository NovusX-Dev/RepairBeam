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
import Support from "@/pages/Support";
import Configs from "@/pages/Configs";
import Users from "@/pages/Users";
import AcceptInvite from "@/pages/AcceptInvite";
import NotFound from "@/pages/not-found";

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
        
        {!isAuthenticated ? (
          <Route path="/" component={Landing} />
        ) : needsTenantSetup ? (
          <Route path="/" component={TenantSetup} />
        ) : (
          <>
            <Route path="/" component={() => <Layout><Dashboard /></Layout>} />
            <Route path="/clients" component={() => <Layout><Clients /></Layout>} />
            <Route path="/kanban" component={() => <Layout><KanbanTickets /></Layout>} />
            <Route path="/completed-history" component={() => <Layout><CompletedHistory /></Layout>} />
            <Route path="/inventory" component={() => <Layout><Inventory /></Layout>} />
            <Route path="/inventory-analytics" component={() => <Layout><InventoryAnalytics /></Layout>} />
            <Route path="/suppliers" component={() => <Layout><Suppliers /></Layout>} />
            <Route path="/purchase-orders" component={() => <Layout><PurchaseOrders /></Layout>} />
            <Route path="/pos" component={() => <Layout><POS /></Layout>} />
            <Route path="/support" component={() => <Layout><Support /></Layout>} />
            <Route path="/configs" component={() => <Layout><Configs /></Layout>} />
            <Route path="/users" component={() => <Layout><Users /></Layout>} />
          </>
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
