import UnderConstruction from "@/components/UnderConstruction";
import { Package } from "lucide-react";
import { useLocalization } from "@/contexts/LocalizationContext";

export default function Inventory() {
  const { t } = useLocalization();
  
  return (
    <UnderConstruction
      title={t("inventory_management", "Inventory Management")}
      description={t("inventory_management_desc", "Parts tracking, stock levels, automated reordering, supplier management, and usage analytics are being developed for comprehensive inventory control.")}
      icon={<Package className="w-10 h-10 text-primary" />}
    />
  );
}
