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
import { Save, User as UserIcon } from "lucide-react";

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
    </div>
  );
}
