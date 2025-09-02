import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { useLocalization } from "@/contexts/LocalizationContext";
import Sidebar from "./Sidebar";
import Header from "./Header";
import { useState, useEffect } from "react";

interface LayoutProps {
  children: React.ReactNode;
}

const getPageTitleFromRoute = (pathname: string, t: (key: string, fallback?: string) => string) => {
  switch (pathname) {
    case "/":
      return t("dashboard", "Dashboard");
    case "/clients":
      return t("clients", "Clients");
    case "/kanban":
      return t("kanban_board", "Kanban Board");
    case "/inventory":
      return t("inventory", "Inventory");
    case "/pos":
      return t("pos", "Point of Sale");
    case "/support":
      return t("support", "Customer Support");
    case "/animations":
      return t("animations", "Animations");
    case "/configs":
      return t("configs", "Configurations");
    case "/users":
      return t("userManagement", "User Management");
    default:
      return t("dashboard", "Dashboard");
  }
};

export default function Layout({ children }: LayoutProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const { t } = useLocalization();
  const [location] = useLocation();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [currentPage, setCurrentPage] = useState("Dashboard");

  // Update current page based on route
  useEffect(() => {
    const pageTitle = getPageTitleFromRoute(location, t);
    setCurrentPage(pageTitle);
  }, [location, t]);

  // Don't use early return here as it can cause hook rendering issues
  // The router should handle authentication checks instead
  if (isLoading || !isAuthenticated) {
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

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <div className="flex-shrink-0">
        <Sidebar 
          isCollapsed={isSidebarCollapsed}
          onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
        />
      </div>
      <div className="flex-1 flex flex-col min-h-0 min-w-0">
        <div className="flex-shrink-0">
          <Header currentPage={currentPage} />
        </div>
        <main className="flex-1 overflow-y-auto p-6">
          <div className="h-full w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
