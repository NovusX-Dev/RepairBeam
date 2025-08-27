import UnderConstruction from "@/components/UnderConstruction";
import { UserCog } from "lucide-react";

export default function Users() {
  return (
    <UnderConstruction
      title="User Management"
      description="Role-based access control, team management, permissions system, and multi-tenant user administration features are currently being built."
      icon={<UserCog className="w-10 h-10 text-primary" />}
    />
  );
}
