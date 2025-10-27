import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatTicketId(ticketId: string): string {
  return `TK-${ticketId.slice(-6).toUpperCase()}`;
}
