import UnderConstruction from "@/components/UnderConstruction";
import { UserCog } from "lucide-react";
import { useLocalization } from "@/contexts/LocalizationContext";

export default function Users() {
  const { t } = useLocalization();
  
  return (
    <UnderConstruction
      title={t("user_management", "User Management")}
      description={t("user_management_desc", "Role-based access control, team management, permissions system, and multi-tenant user administration features are currently being built.")}
      icon={<UserCog className="w-10 h-10 text-primary" />}
    />
  );
}
