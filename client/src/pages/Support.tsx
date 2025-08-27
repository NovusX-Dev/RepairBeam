import UnderConstruction from "@/components/UnderConstruction";
import { HeadphonesIcon } from "lucide-react";

export default function Support() {
  return (
    <UnderConstruction
      title="Customer Support Center"
      description="Integrated help desk, ticketing system, knowledge base, and customer communication tools are being crafted for exceptional support experiences."
      icon={<HeadphonesIcon className="w-10 h-10 text-primary" />}
    />
  );
}
