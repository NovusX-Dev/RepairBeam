import UnderConstruction from "@/components/UnderConstruction";
import { Kanban } from "lucide-react";

export default function KanbanTickets() {
  return (
    <UnderConstruction
      title="Kanban Ticket Board"
      description="Visual workflow management with drag-and-drop functionality, custom stages, time tracking, and progress monitoring features coming soon."
      icon={<Kanban className="w-10 h-10 text-primary" />}
    />
  );
}
