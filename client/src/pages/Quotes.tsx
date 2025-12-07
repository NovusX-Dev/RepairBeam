import { useLocalization } from "@/contexts/LocalizationContext";
import { FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Quotes() {
  const { t } = useLocalization();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white" data-testid="text-quotes-title">
            {t("quotes", "Quotes")}
          </h1>
          <p className="text-muted-foreground mt-1" data-testid="text-quotes-description">
            {t("quotes_description", "Create and manage customer quotes")}
          </p>
        </div>
      </div>

      <Card className="bg-navy-800 border-cyan-500/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <FileText className="w-5 h-5 text-cyan-400" />
            {t("quotes", "Quotes")}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <FileText className="w-16 h-16 text-cyan-400/30 mb-4" />
          <p className="text-muted-foreground text-center" data-testid="text-quotes-placeholder">
            {t("quotes_coming_soon", "Quote management features coming soon")}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
