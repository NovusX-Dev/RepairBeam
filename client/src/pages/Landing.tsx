import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Plus, User } from "lucide-react";

interface RecentUser {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  profileImageUrl: string | null;
  tenantAlias: string;
}

export default function Landing() {
  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRecentUsers = async () => {
      try {
        const response = await fetch('/api/auth/recent-users');
        if (response.ok) {
          const users = await response.json();
          setRecentUsers(users);
        }
      } catch (error) {
        console.error('Failed to fetch recent users:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRecentUsers();
  }, []);

  const handleUserLogin = (userId: string) => {
    // For quick login, we'll redirect with a user hint parameter
    window.location.href = `/api/login?user_hint=${userId}`;
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        {/* Main App Card */}
        <Card>
          <CardContent className="pt-6">
            <div className="text-center space-y-6">
              {/* Logo */}
              <div className="w-16 h-16 rounded-lg flex items-center justify-center mx-auto">
                <img 
                  src="/repair-beam-logo.png" 
                  alt="Repair Beam Logo" 
                  className="w-16 h-16 object-contain"
                />
              </div>
              
              <div>
                <h1 className="text-3xl font-bold text-foreground mb-2" data-testid="text-app-title">
                  Repair Beam
                </h1>
                <p className="text-muted-foreground" data-testid="text-app-subtitle">
                  Professional Repair Shop Management Platform
                </p>
              </div>

              <p className="text-sm text-muted-foreground">
                Streamline your repair business with comprehensive tools for client management, 
                inventory tracking, and point-of-sale operations.
              </p>

              <div className="text-xs text-muted-foreground">
                Multi-tenant • Secure • Scalable
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Login / Create Tenant Card */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg text-center">Get Started</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Recent Users Section */}
            {!loading && recentUsers.length > 0 && (
              <>
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-muted-foreground">Recent Repair Shops</h3>
                  <div className="space-y-2">
                    {recentUsers.map((user) => (
                      <Button
                        key={user.id}
                        variant="outline"
                        className="w-full justify-start"
                        onClick={() => handleUserLogin(user.id)}
                        data-testid={`button-quick-login-${user.id}`}
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground text-sm font-medium">
                            {user.profileImageUrl ? (
                              <img 
                                src={user.profileImageUrl} 
                                alt="Profile" 
                                className="w-8 h-8 rounded-full object-cover"
                              />
                            ) : (
                              <span>
                                {user.firstName && user.lastName 
                                  ? `${user.firstName[0]}${user.lastName[0]}` 
                                  : user.email?.[0]?.toUpperCase() || "U"}
                              </span>
                            )}
                          </div>
                          <div className="text-left">
                            <p className="font-medium">
                              {user.tenantName || 'Shop'}
                            </p>
                            <p className="text-xs text-muted-foreground">{user.tenantAlias}</p>
                          </div>
                        </div>
                      </Button>
                    ))}
                  </div>
                </div>
                <Separator />
              </>
            )}

            {/* Create New Tenant/Shop */}
            <div className="space-y-2">
              <Button 
                onClick={() => window.location.href = '/api/login'}
                className="w-full"
                data-testid="button-create-new-shop"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create New Repair Shop
              </Button>
              
              <Button 
                variant="outline"
                onClick={() => window.location.href = '/api/login'}
                className="w-full"
                data-testid="button-sign-in"
              >
                <User className="w-4 h-4 mr-2" />
                Sign In to Existing Account
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
