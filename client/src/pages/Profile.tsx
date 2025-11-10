import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useLocalization } from "@/contexts/LocalizationContext";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Save, User as UserIcon, Lock, Eye, EyeOff } from "lucide-react";

export default function Profile() {
  const { user } = useAuth();
  const { t } = useLocalization();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    firstName: user?.firstName || "",
    lastName: user?.lastName || "",
    phone: user?.phone || "",
    telegram: user?.telegram || "",
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest("PUT", "/api/users/me", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: t("profile_updated", "Profile Updated"),
        description: t("profile_updated_desc", "Your profile has been updated successfully."),
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: t("error", "Error"),
        description: error.message || t("profile_update_failed", "Failed to update profile. Please try again."),
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfileMutation.mutate(formData);
  };

  const changePasswordMutation = useMutation({
    mutationFn: async (data: typeof passwordData) => {
      return apiRequest("POST", "/api/auth/change-password", {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
    },
    onSuccess: () => {
      toast({
        title: t("password_changed", "Password Changed"),
        description: t("password_changed_desc", "Your password has been updated successfully."),
      });
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: t("error", "Error"),
        description: error.message || t("password_change_failed", "Failed to change password. Please try again."),
      });
    },
  });

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast({
        variant: "destructive",
        title: t("error", "Error"),
        description: t("passwords_dont_match", "Passwords do not match"),
      });
      return;
    }

    if (passwordData.newPassword.length < 8) {
      toast({
        variant: "destructive",
        title: t("error", "Error"),
        description: t("password_too_short", "Password must be at least 8 characters long"),
      });
      return;
    }

    changePasswordMutation.mutate(passwordData);
  };

  const initials = user?.firstName && user?.lastName
    ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
    : user?.email?.[0]?.toUpperCase() || "?";

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-cyan-500 bg-clip-text text-transparent">
          {t("my_profile", "My Profile")}
        </h1>
        <p className="text-muted-foreground mt-2">
          {t("my_profile_desc", "Manage your personal information and contact details")}
        </p>
      </div>

      <Card className="border-primary/20">
        <CardHeader className="bg-gradient-to-r from-primary/10 to-cyan-500/10 border-b border-primary/20">
          <div className="flex items-center gap-4">
            <Avatar className="w-20 h-20 border-2 border-primary">
              <AvatarImage src={user?.profileImageUrl} alt={user?.firstName || user?.email} />
              <AvatarFallback className="bg-primary/20 text-primary text-2xl">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-2xl">{user?.firstName} {user?.lastName}</CardTitle>
              <CardDescription className="text-base">{user?.email}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="firstName" data-testid="label-first-name">
                  {t("first_name", "First Name")}
                </Label>
                <Input
                  id="firstName"
                  value={formData.firstName}
                  onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                  placeholder={t("first_name_placeholder", "Enter your first name")}
                  data-testid="input-first-name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="lastName" data-testid="label-last-name">
                  {t("last_name", "Last Name")}
                </Label>
                <Input
                  id="lastName"
                  value={formData.lastName}
                  onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                  placeholder={t("last_name_placeholder", "Enter your last name")}
                  data-testid="input-last-name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" data-testid="label-email">
                  {t("email", "Email")}
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={user?.email || ""}
                  disabled
                  className="bg-muted"
                  data-testid="input-email"
                />
                <p className="text-xs text-muted-foreground">
                  {t("email_readonly_note", "Email is managed by your authentication provider and cannot be changed here.")}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone" data-testid="label-phone">
                  {t("phone", "Phone")}
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder={t("phone_placeholder", "Enter your phone number")}
                  data-testid="input-phone"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="telegram" data-testid="label-telegram">
                  {t("telegram", "Telegram")}
                </Label>
                <Input
                  id="telegram"
                  value={formData.telegram}
                  onChange={(e) => setFormData(prev => ({ ...prev, telegram: e.target.value }))}
                  placeholder={t("telegram_placeholder", "Enter your Telegram username")}
                  data-testid="input-telegram"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                type="submit"
                disabled={updateProfileMutation.isPending}
                data-testid="button-save-profile"
              >
                {updateProfileMutation.isPending ? (
                  <>
                    <Save className="w-4 h-4 mr-2 animate-spin" />
                    {t("saving", "Saving")}...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    {t("save_changes", "Save Changes")}
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Password Change Card - Only for local auth users */}
      {user && (
        <Card className="border-primary/20 mt-6">
          <CardHeader className="bg-gradient-to-r from-primary/10 to-cyan-500/10 border-b border-primary/20">
            <div className="flex items-center gap-3">
              <Lock className="w-5 h-5 text-primary" />
              <div>
                <CardTitle>{t("change_password", "Change Password")}</CardTitle>
                <CardDescription>
                  {t("change_password_desc", "Update your password to keep your account secure")}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handlePasswordSubmit} className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword" data-testid="label-current-password">
                    {t("current_password", "Current Password")}
                  </Label>
                  <div className="relative">
                    <Input
                      id="currentPassword"
                      type={showCurrentPassword ? "text" : "password"}
                      value={passwordData.currentPassword}
                      onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                      placeholder={t("current_password_placeholder", "Enter your current password")}
                      data-testid="input-current-password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      data-testid="button-toggle-current-password"
                    >
                      {showCurrentPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="newPassword" data-testid="label-new-password">
                    {t("new_password", "New Password")}
                  </Label>
                  <div className="relative">
                    <Input
                      id="newPassword"
                      type={showNewPassword ? "text" : "password"}
                      value={passwordData.newPassword}
                      onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                      placeholder={t("new_password_placeholder", "Enter a new password")}
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
                  <Label htmlFor="confirmPassword" data-testid="label-confirm-password">
                    {t("confirm_password", "Confirm Password")}
                  </Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      value={passwordData.confirmPassword}
                      onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                      placeholder={t("confirm_password_placeholder", "Re-enter your new password")}
                      minLength={8}
                      data-testid="input-confirm-password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      data-testid="button-toggle-confirm-password"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button
                  type="submit"
                  disabled={changePasswordMutation.isPending}
                  data-testid="button-change-password"
                >
                  {changePasswordMutation.isPending ? (
                    <>
                      <Lock className="w-4 h-4 mr-2 animate-spin" />
                      {t("updating", "Updating")}...
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4 mr-2" />
                      {t("update_password", "Update Password")}
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
