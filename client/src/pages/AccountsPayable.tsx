import { useLocalization } from "@/contexts/LocalizationContext";
import { ArrowUpCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AccountsPayable() {
  const { t } = useLocalization();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white" data-testid="text-accounts-payable-title">
            {t("accounts_payable", "Accounts Payable")}
          </h1>
          <p className="text-muted-foreground mt-1" data-testid="text-accounts-payable-description">
            {t("accounts_payable_description", "Manage outgoing payments and vendor bills")}
          </p>
        </div>
      </div>

      <Card className="bg-navy-800 border-cyan-500/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <ArrowUpCircle className="w-5 h-5 text-red-400" />
            {t("accounts_payable", "Accounts Payable")}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <ArrowUpCircle className="w-16 h-16 text-red-400/30 mb-4" />
          <p className="text-muted-foreground text-center" data-testid="text-accounts-payable-placeholder">
            {t("accounts_payable_coming_soon", "Accounts payable management features coming soon")}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
