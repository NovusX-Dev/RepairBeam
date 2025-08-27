import UnderConstruction from "@/components/UnderConstruction";
import { CreditCard } from "lucide-react";

export default function POS() {
  return (
    <UnderConstruction
      title="Point of Sale System"
      description="Professional POS interface with payment processing, receipt generation, tax calculations, and integrated accounting features in development."
      icon={<CreditCard className="w-10 h-10 text-primary" />}
    />
  );
}
