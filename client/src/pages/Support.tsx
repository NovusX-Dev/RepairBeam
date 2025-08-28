import UnderConstruction from "@/components/UnderConstruction";
import { HeadphonesIcon } from "lucide-react";
import { useLocalization } from "@/contexts/LocalizationContext";

export default function Support() {
  const { t } = useLocalization();
  
  return (
    <UnderConstruction
      title={t("customer_support_center", "Customer Support Center")}
      description={t("support_center_desc", "Integrated help desk, ticketing system, knowledge base, and customer communication tools are being crafted for exceptional support experiences.")}
      icon={<HeadphonesIcon className="w-10 h-10 text-primary" />}
    />
  );
}
