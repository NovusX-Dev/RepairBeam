import UnderConstruction from "@/components/UnderConstruction";
import { Settings } from "lucide-react";
import { useLocalization } from "@/contexts/LocalizationContext";

export default function Configs() {
  const { t } = useLocalization();
  
  return (
    <UnderConstruction
      title={t("system_configurations", "System Configurations")}
      description={t("system_configurations_desc", "Tenant-specific settings, business preferences, integrations, and customization options are being developed for complete system control.")}
      icon={<Settings className="w-10 h-10 text-primary" />}
    />
  );
}
