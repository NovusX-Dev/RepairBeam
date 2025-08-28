import UnderConstruction from "@/components/UnderConstruction";
import { CreditCard } from "lucide-react";
import { useLocalization } from "@/contexts/LocalizationContext";

export default function POS() {
  const { t } = useLocalization();
  
  return (
    <UnderConstruction
      title={t("point_of_sale_system", "Point of Sale System")}
      description={t("pos_system_desc", "Professional POS interface with payment processing, receipt generation, tax calculations, and integrated accounting features in development.")}
      icon={<CreditCard className="w-10 h-10 text-primary" />}
    />
  );
}
