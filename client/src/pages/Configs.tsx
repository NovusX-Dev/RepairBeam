import UnderConstruction from "@/components/UnderConstruction";
import { Settings } from "lucide-react";

export default function Configs() {
  return (
    <UnderConstruction
      title="System Configurations"
      description="Tenant-specific settings, business preferences, integrations, and customization options are being developed for complete system control."
      icon={<Settings className="w-10 h-10 text-primary" />}
    />
  );
}
