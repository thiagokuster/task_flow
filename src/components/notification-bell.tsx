import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  markAllNotificationsRead,
  markNotificationRead,
  notificationsQuery,
  refreshDeadlineNotifications,
} from "@/lib/tasks";
import { cn } from "@/lib/utils";

export function NotificationBell() {
  const qc = useQueryClient();
  const { data: items = [] } = useQuery(notificationsQuery);
  const unread = items.filter((n) => !n.read_at).length;

  useEffect(() => {
    void refreshDeadlineNotifications()
      .then(() => qc.invalidateQueries({ queryKey: ["notifications"] }))
      .catch(() => undefined);
  }, [qc]);

  async function markOne(id: string) {
    try {
      await markNotificationRead(id);
      await qc.invalidateQueries({ queryKey: ["notifications"] });
    } catch {
      toast.error("Não foi possível marcar a notificação.");
    }
  }

  async function markAll() {
    try {
      await markAllNotificationsRead();
      await qc.invalidateQueries({ queryKey: ["notifications"] });
    } catch {
      toast.error("Não foi possível marcar as notificações.");
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="relative rounded-full"
          aria-label={
            unread > 0
              ? `Notificações, ${unread} sem ler`
              : "Notificações"
          }
        >
          <Bell />
          {unread > 0 ? (
            <span className="absolute right-1 top-1 inline-flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-4 text-destructive-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between gap-2">
          <span>Notificações</span>
          {unread > 0 ? (
            <button
              type="button"
              className="text-xs font-medium text-primary hover:underline"
              onClick={() => void markAll()}
            >
              Marcar todas como lidas
            </button>
          ) : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">
            Nenhuma notificação ainda.
          </p>
        ) : (
          items.map((n) => (
            <DropdownMenuItem
              key={n.id}
              className="items-start whitespace-normal"
              onSelect={() => {
                if (!n.read_at) void markOne(n.id);
              }}
            >
              <span
                className={cn(
                  "mt-1 size-1.5 shrink-0 rounded-full",
                  n.read_at ? "bg-transparent" : "bg-primary",
                )}
                aria-hidden
              />
              <span className={cn("text-sm", n.read_at && "text-muted-foreground")}>
                {n.message}
              </span>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
