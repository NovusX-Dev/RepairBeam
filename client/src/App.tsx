import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import Layout from "@/components/Layout";
import Landing from "@/pages/Landing";
import Dashboard from "@/pages/Dashboard";
import Clients from "@/pages/Clients";
import KanbanTickets from "@/pages/Kanban";
import Inventory from "@/pages/Inventory";
import POS from "@/pages/POS";
import Support from "@/pages/Support";
import Configs from "@/pages/Configs";
import Users from "@/pages/Users";
import NotFound from "@/pages/not-found";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-primary rounded-lg flex items-center justify-center mx-auto mb-4 glow-effect">
            <svg className="w-10 h-10 text-navy-900 animate-spin" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
          </div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <Switch>
      {!isAuthenticated ? (
        <Route path="/" component={Landing} />
      ) : (
        <>
          <Route path="/" component={() => <Layout><Dashboard /></Layout>} />
          <Route path="/clients" component={() => <Layout><Clients /></Layout>} />
          <Route path="/kanban" component={() => <Layout><KanbanTickets /></Layout>} />
          <Route path="/inventory" component={() => <Layout><Inventory /></Layout>} />
          <Route path="/pos" component={() => <Layout><POS /></Layout>} />
          <Route path="/support" component={() => <Layout><Support /></Layout>} />
          <Route path="/configs" component={() => <Layout><Configs /></Layout>} />
          <Route path="/users" component={() => <Layout><Users /></Layout>} />
        </>
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
