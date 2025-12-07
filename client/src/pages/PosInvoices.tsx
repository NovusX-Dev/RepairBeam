import { useLocalization } from "@/contexts/LocalizationContext";
import { Receipt } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function PosInvoices() {
  const { t } = useLocalization();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white" data-testid="text-invoices-title">
            {t("invoices", "Invoices")}
          </h1>
          <p className="text-muted-foreground mt-1" data-testid="text-invoices-description">
            {t("invoices_description", "Manage your sales invoices and billing")}
          </p>
        </div>
      </div>

      <Card className="bg-navy-800 border-cyan-500/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Receipt className="w-5 h-5 text-cyan-400" />
            {t("invoices", "Invoices")}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Receipt className="w-16 h-16 text-cyan-400/30 mb-4" />
          <p className="text-muted-foreground text-center" data-testid="text-invoices-placeholder">
            {t("invoices_coming_soon", "Invoice management features coming soon")}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
