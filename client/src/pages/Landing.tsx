import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, User, Lock, Eye, EyeOff } from "lucide-react";
import { useLocalization, LANGUAGES } from "@/contexts/LocalizationContext";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface RecentUser {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  profileImageUrl: string | null;
  tenantAlias: string;
  tenantName: string;
}

export default function Landing() {
  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPasswordLogin, setShowPasswordLogin] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [tempUserId, setTempUserId] = useState<string | null>(null);

  const { t, currentLanguage, setCurrentLanguage } = useLocalization();
  const { toast } = useToast();

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
    window.location.href = `/api/login?user_hint=${userId}`;
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);

    try {
      const response = await apiRequest("POST", "/api/auth/login", { email, password });

      if (response.mustChangePassword) {
        setTempUserId(response.user.id);
        setShowChangePasswordModal(true);
        setShowPasswordLogin(false);
      } else {
        window.location.href = '/';
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: t("login_failed", "Login Failed"),
        description: error.message || t("invalid_credentials", "Invalid email or password. Please try again."),
      });
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmNewPassword) {
      toast({
        variant: "destructive",
        title: t("error", "Error"),
        description: t("passwords_dont_match", "Passwords do not match"),
      });
      return;
    }

    if (newPassword.length < 8) {
      toast({
        variant: "destructive",
        title: t("error", "Error"),
        description: t("password_too_short", "Password must be at least 8 characters long"),
      });
      return;
    }

    try {
      await apiRequest("POST", "/api/auth/change-password", {
        currentPassword: password,
        newPassword,
      });

      toast({
        title: t("password_changed", "Password Changed"),
        description: t("password_changed_desc", "Your password has been successfully updated. Redirecting..."),
      });

      setTimeout(() => {
        window.location.href = '/';
      }, 1500);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: t("error", "Error"),
        description: error.message || t("password_change_failed", "Failed to change password. Please try again."),
      });
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      {/* Language Selector - Fixed Position */}
      <div className="fixed top-4 right-4 z-50">
        <div className="flex gap-2">
          {LANGUAGES.map((lang) => (
            <Button
              key={lang.code}
              variant={currentLanguage.code === lang.code ? "default" : "outline"}
              size="sm"
              onClick={() => setCurrentLanguage(lang)}
              className="h-8 px-2"
              data-testid={`button-language-${lang.code}`}
            >
              <span className="text-lg">
                {lang.countryCode === 'US' ? '🇺🇸' : lang.countryCode === 'BR' ? '🇧🇷' : '🌐'}
              </span>
              <span className="ml-1 text-xs hidden sm:inline">
                {lang.code === 'en' ? 'EN' : 'PT'}
              </span>
            </Button>
          ))}
        </div>
      </div>
      
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
                  {t("repair_shop_management", "Professional Repair Shop Management Platform")}
                </p>
              </div>

              <p className="text-sm text-muted-foreground">
                {t("streamline_operations", "Streamline your repair business with comprehensive tools for client management, inventory tracking, and point-of-sale operations.")}
              </p>

              <div className="text-xs text-muted-foreground">
                {t("multi_tenant_features", "Multi-tenant • Secure • Scalable")}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Login Card */}
        {!showPasswordLogin ? (
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg text-center">{t("get_started", "Get Started")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Recent Users Section */}
              {!loading && recentUsers.length > 0 && (
                <>
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium text-muted-foreground">{t("recent_repair_shops", "Recent Repair Shops")}</h3>
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

              {/* Login Options */}
              <div className="space-y-2">
                <Button 
                  onClick={() => setShowPasswordLogin(true)}
                  className="w-full"
                  data-testid="button-employee-login"
                >
                  <Lock className="w-4 h-4 mr-2" />
                  {t("employee_login", "Employee Login")}
                </Button>
                
                <Separator className="my-4" />
                
                <p className="text-xs text-center text-muted-foreground mb-2">
                  {t("admin_owner_login", "Admin & Owner Login")}
                </p>

                <Button 
                  onClick={() => window.location.href = '/api/login'}
                  className="w-full"
                  variant="outline"
                  data-testid="button-create-new-shop"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {t("create_new_repair_shop", "Create New Repair Shop")}
                </Button>
                
                <Button 
                  variant="outline"
                  onClick={() => window.location.href = '/api/login'}
                  className="w-full"
                  data-testid="button-sign-in"
                >
                  <User className="w-4 h-4 mr-2" />
                  {t("sign_in_existing", "Sign In to Existing Account")}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>{t("employee_login", "Employee Login")}</CardTitle>
              <CardDescription>
                {t("employee_login_desc", "Enter your email and password to continue")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePasswordLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" data-testid="label-email">
                    {t("email", "Email")}
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t("email_placeholder", "your.email@example.com")}
                    required
                    data-testid="input-email"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" data-testid="label-password">
                    {t("password", "Password")}
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={t("password_placeholder", "Enter your password")}
                      required
                      data-testid="input-password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                      data-testid="button-toggle-password"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isLoggingIn}
                    data-testid="button-submit-login"
                  >
                    {isLoggingIn ? t("signing_in", "Signing In...") : t("sign_in", "Sign In")}
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full"
                    onClick={() => {
                      setShowPasswordLogin(false);
                      setEmail("");
                      setPassword("");
                    }}
                    data-testid="button-back"
                  >
                    {t("back", "Back")}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Force Change Password Modal */}
      <Dialog open={showChangePasswordModal} onOpenChange={setShowChangePasswordModal}>
        <DialogContent data-testid="dialog-change-password">
          <DialogHeader>
            <DialogTitle>{t("change_password_required", "Password Change Required")}</DialogTitle>
            <DialogDescription>
              {t("change_password_required_desc", "For security reasons, you must change your temporary password before continuing.")}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password" data-testid="label-new-password">
                {t("new_password", "New Password")}
              </Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={t("new_password_placeholder", "Enter a new password")}
                  required
                  minLength={8}
                  data-testid="input-new-password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  data-testid="button-toggle-new-password"
                >
                  {showNewPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("password_requirements", "At least 8 characters with uppercase, lowercase, and numbers")}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password" data-testid="label-confirm-password">
                {t("confirm_password", "Confirm Password")}
              </Label>
              <Input
                id="confirm-password"
                type={showNewPassword ? "text" : "password"}
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                placeholder={t("confirm_password_placeholder", "Re-enter your new password")}
                required
                minLength={8}
                data-testid="input-confirm-password"
              />
            </div>

            <Button type="submit" className="w-full" data-testid="button-submit-change-password">
              {t("change_password", "Change Password")}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
