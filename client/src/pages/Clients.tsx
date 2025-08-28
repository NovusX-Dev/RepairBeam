import UnderConstruction from "@/components/UnderConstruction";
import { Users } from "lucide-react";
import { useLocalization } from "@/contexts/LocalizationContext";

export default function Clients() {
  const { t } = useLocalization();
  
  return (
    <UnderConstruction
      title={t("client_management_system", "Client Management System")}
      description={t("client_management_desc", "Comprehensive CRM features including client profiles, repair history, communication logs, and automated follow-ups are currently in development.")}
      icon={<Users className="w-10 h-10 text-primary" />}
    />
  );
}
