import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Clock, User, DollarSign } from "lucide-react";
import type { Ticket, Client, TicketStatus, TicketPriority } from "@shared/schema";

// Kanban column configuration
const kanbanColumns = [
  { id: 'backlog', title: 'Backlog', color: 'bg-gray-100' },
  { id: 'waiting_diagnostics', title: 'Waiting on Diagnostics', color: 'bg-yellow-100' },
  { id: 'waiting_client_approval', title: 'Waiting on Client Approval', color: 'bg-orange-100' },
  { id: 'approved', title: 'Approved', color: 'bg-green-100' },
  { id: 'servicing', title: 'Servicing', color: 'bg-blue-100' },
  { id: 'quality_check', title: 'Quality Check', color: 'bg-purple-100' },
  { id: 'final_customer_check', title: 'Final Customer Check', color: 'bg-pink-100' },
  { id: 'finalized', title: 'Finalized / Done', color: 'bg-emerald-100' },
] as const;

type TicketWithClient = Ticket & { client?: Client };

export default function KanbanTickets() {
  const [draggedTicket, setDraggedTicket] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Fetch tickets with client information
  const { data: tickets = [], isLoading } = useQuery<TicketWithClient[]>({
    queryKey: ["/api/tickets"],
    retry: false,
  });

  // Update ticket status mutation
  const updateTicketStatus = useMutation({
    mutationFn: async ({ ticketId, status }: { ticketId: string; status: TicketStatus }) => {
      return await apiRequest(`/api/tickets/${ticketId}/status`, "PUT", { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tickets"] });
    },
  });

  // Group tickets by status
  const ticketsByStatus = kanbanColumns.reduce((acc, column) => {
    acc[column.id] = tickets.filter(ticket => ticket.status === column.id);
    return acc;
  }, {} as Record<string, TicketWithClient[]>);

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, ticketId: string) => {
    setDraggedTicket(ticketId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, newStatus: TicketStatus) => {
    e.preventDefault();
    if (draggedTicket) {
      const ticket = tickets.find(t => t.id === draggedTicket);
      if (ticket && ticket.status !== newStatus) {
        updateTicketStatus.mutate({ ticketId: draggedTicket, status: newStatus });
      }
    }
    setDraggedTicket(null);
  };

  const getPriorityColor = (priority: TicketPriority) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-muted-foreground">Loading tickets...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground" data-testid="text-kanban-title">
            Kanban Board
          </h1>
          <p className="text-muted-foreground">
            Manage and track repair tickets through your workflow stages
          </p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button data-testid="button-create-ticket">
              <Plus className="w-4 h-4 mr-2" />
              New Ticket
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Ticket</DialogTitle>
            </DialogHeader>
            <div className="p-4 text-center text-muted-foreground">
              Ticket creation form coming soon...
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto">
        <div className="flex gap-4 min-w-max pb-4" style={{ minHeight: '600px' }}>
          {kanbanColumns.map((column) => (
            <div
              key={column.id}
              className={`w-80 ${column.color} rounded-lg p-4 flex flex-col`}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, column.id as TicketStatus)}
              data-testid={`column-${column.id}`}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-800">{column.title}</h3>
                <Badge variant="secondary" className="bg-white/80">
                  {ticketsByStatus[column.id]?.length || 0}
                </Badge>
              </div>

              {/* Tickets */}
              <div className="flex-1 space-y-3 min-h-[200px]">
                {ticketsByStatus[column.id]?.map((ticket) => (
                  <Card
                    key={ticket.id}
                    className="cursor-move hover:shadow-md transition-shadow bg-white border border-gray-200"
                    draggable
                    onDragStart={(e) => handleDragStart(e, ticket.id)}
                    data-testid={`ticket-${ticket.id}`}
                  >
                    <CardContent className="p-4">
                      {/* Priority indicator */}
                      <div className="flex items-center justify-between mb-2">
                        <div
                          className={`w-3 h-3 rounded-full ${getPriorityColor(ticket.priority as TicketPriority)}`}
                          title={`Priority: ${ticket.priority}`}
                        ></div>
                        <span className="text-xs text-muted-foreground">
                          #{ticket.id.slice(-6).toUpperCase()}
                        </span>
                      </div>

                      {/* Ticket title */}
                      <h4 className="font-medium text-sm mb-2 line-clamp-2">
                        {ticket.title}
                      </h4>

                      {/* Device info */}
                      {(ticket.deviceType || ticket.deviceModel) && (
                        <p className="text-xs text-muted-foreground mb-2">
                          {[ticket.deviceType, ticket.deviceModel].filter(Boolean).join(' - ')}
                        </p>
                      )}

                      {/* Client info */}
                      {ticket.client && (
                        <div className="flex items-center text-xs text-muted-foreground mb-2">
                          <User className="w-3 h-3 mr-1" />
                          {ticket.client.firstName} {ticket.client.lastName}
                        </div>
                      )}

                      {/* Cost info */}
                      {ticket.estimatedCost && (
                        <div className="flex items-center text-xs text-muted-foreground mb-2">
                          <DollarSign className="w-3 h-3 mr-1" />
                          Est: ${ticket.estimatedCost}
                        </div>
                      )}

                      {/* Created date */}
                      <div className="flex items-center text-xs text-muted-foreground">
                        <Clock className="w-3 h-3 mr-1" />
                        {new Date(ticket.createdAt!).toLocaleDateString()}
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {/* Empty state */}
                {(!ticketsByStatus[column.id] || ticketsByStatus[column.id].length === 0) && (
                  <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
                    No tickets in this stage
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
