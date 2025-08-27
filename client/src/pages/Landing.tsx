import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
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

            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Streamline your repair business with comprehensive tools for client management, 
                inventory tracking, and point-of-sale operations.
              </p>
              
              <Button 
                onClick={() => window.location.href = '/api/login'}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                data-testid="button-login"
              >
                Sign In to Your Account
              </Button>
            </div>

            <div className="text-xs text-muted-foreground">
              Multi-tenant • Secure • Scalable
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
