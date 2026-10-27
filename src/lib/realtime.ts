import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export function useRealtimeSync() {
  const qc = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel("taskflow-sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks" },
        () => {
          void qc.invalidateQueries({ queryKey: ["tasks"] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "task_comments" },
        () => {
          void qc.invalidateQueries({ queryKey: ["task-comments"] });
          void qc.invalidateQueries({ queryKey: ["tasks"] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "groups" },
        () => {
          void qc.invalidateQueries({ queryKey: ["groups"] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "group_members" },
        () => {
          void qc.invalidateQueries({ queryKey: ["groups"] });
          void qc.invalidateQueries({ queryKey: ["group-members"] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications" },
        (payload) => {
          void qc.invalidateQueries({ queryKey: ["notifications"] });
          if (payload.eventType !== "INSERT") return;
          const row = payload.new as { kind?: string; message?: string };
          if (row.kind === "assigned" && row.message) {
            toast.info(row.message);
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [qc]);
}
