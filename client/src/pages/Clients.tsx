import UnderConstruction from "@/components/UnderConstruction";
import { Users } from "lucide-react";

export default function Clients() {
  return (
    <UnderConstruction
      title="Client Management System"
      description="Comprehensive CRM features including client profiles, repair history, communication logs, and automated follow-ups are currently in development."
      icon={<Users className="w-10 h-10 text-primary" />}
    />
  );
}
