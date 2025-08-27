import UnderConstruction from "@/components/UnderConstruction";
import { Package } from "lucide-react";

export default function Inventory() {
  return (
    <UnderConstruction
      title="Inventory Management"
      description="Parts tracking, stock levels, automated reordering, supplier management, and usage analytics are being developed for comprehensive inventory control."
      icon={<Package className="w-10 h-10 text-primary" />}
    />
  );
}
