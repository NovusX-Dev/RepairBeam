import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShopImageUploader } from "@/components/ShopImageUploader";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function TenantSetup() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: "",
    alias: "",
    shopImageUrl: ""
  });

  const createTenantMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await fetch("/api/tenants", {
        method: "POST",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Shop Created",
        description: "Your repair shop has been set up successfully!",
      });
      
      // Invalidate and refetch user data
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      
      // Redirect to dashboard
      setTimeout(() => {
        window.location.href = "/";
      }, 1500);
    },
    onError: (error) => {
      toast({
        title: "Setup Failed",
        description: "Failed to create your shop. Please try again.",
        variant: "destructive",
      });
      console.error("Tenant creation error:", error);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter your shop name.",
        variant: "destructive",
      });
      return;
    }

    createTenantMutation.mutate(formData);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl font-bold text-primary-foreground">
              {user?.firstName?.[0] || user?.email?.[0]?.toUpperCase() || "U"}
            </span>
          </div>
          <CardTitle className="text-2xl" data-testid="text-setup-title">
            Set Up Your Repair Shop
          </CardTitle>
          <CardDescription>
            Welcome {user?.firstName || user?.email}! Let's customize your shop profile.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Shop Logo */}
            <div className="space-y-2">
              <Label htmlFor="shop-logo">Shop Logo</Label>
              <ShopImageUploader
                currentImageUrl={formData.shopImageUrl}
                onImageUpload={(url) => handleInputChange("shopImageUrl", url)}
                disabled={createTenantMutation.isPending}
              />
            </div>

            {/* Shop Name */}
            <div className="space-y-2">
              <Label htmlFor="shop-name">Shop Name *</Label>
              <Input
                id="shop-name"
                type="text"
                placeholder="e.g., Mike's Electronics Repair"
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                disabled={createTenantMutation.isPending}
                required
                data-testid="input-shop-name"
              />
            </div>

            {/* Shop Display Name */}
            <div className="space-y-2">
              <Label htmlFor="shop-alias">Display Name</Label>
              <Input
                id="shop-alias"
                type="text"
                placeholder="e.g., Mike's Shop (Optional)"
                value={formData.alias}
                onChange={(e) => handleInputChange("alias", e.target.value)}
                disabled={createTenantMutation.isPending}
                data-testid="input-shop-alias"
              />
              <p className="text-xs text-muted-foreground">
                This will be shown next to your name instead of the full shop name
              </p>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              <Button
                type="submit"
                className="w-full"
                disabled={createTenantMutation.isPending}
                data-testid="button-create-shop"
              >
                {createTenantMutation.isPending ? "Creating Shop..." : "Create My Shop"}
              </Button>
              
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => window.location.href = "/api/logout"}
                disabled={createTenantMutation.isPending}
                data-testid="button-logout"
              >
                Sign Out
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}