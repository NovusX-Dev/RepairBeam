import { useLocalization } from "@/contexts/LocalizationContext";
import { ArrowDownCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AccountsReceivable() {
  const { t } = useLocalization();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white" data-testid="text-accounts-receivable-title">
            {t("accounts_receivable", "Accounts Receivable")}
          </h1>
          <p className="text-muted-foreground mt-1" data-testid="text-accounts-receivable-description">
            {t("accounts_receivable_description", "Track incoming payments and outstanding invoices")}
          </p>
        </div>
      </div>

      <Card className="bg-navy-800 border-cyan-500/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <ArrowDownCircle className="w-5 h-5 text-green-400" />
            {t("accounts_receivable", "Accounts Receivable")}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <ArrowDownCircle className="w-16 h-16 text-green-400/30 mb-4" />
          <p className="text-muted-foreground text-center" data-testid="text-accounts-receivable-placeholder">
            {t("accounts_receivable_coming_soon", "Accounts receivable management features coming soon")}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
