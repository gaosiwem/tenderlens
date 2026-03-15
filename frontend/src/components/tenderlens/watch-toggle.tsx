"use client";

import * as React from "react";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";
import { TLButton } from "@/components/tenderlens/button";
import { getWatched, watchTender, unwatchTender } from "@/lib/watchlist.api";

export function TLWatchToggle(props: { tenderId: string }) {
  const [loading, setLoading] = React.useState(true);
  const [watched, setWatched] = React.useState(false);
  const inFlightRef = React.useRef(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    const res = await getWatched(props.tenderId);
    setLoading(false);
    if (!res.ok) return;
    setWatched(Boolean(res.data.watched));
  }, [props.tenderId]);

  React.useEffect(() => {
    load();
  }, [load]);

  async function toggle() {
    if (loading || inFlightRef.current) return;
    inFlightRef.current = true;
    const prev = watched;
    setLoading(true);

    try {
      if (!prev) {
        const res = await watchTender(props.tenderId);
        if (!res.ok) {
          const isPlanLimit =
            res.error.code === "PLAN_LIMIT_REACHED" ||
            res.error.code === "PLAN_UPGRADE_REQUIRED";
          toast.error("Failed to watch", { description: res.error.message });
          if (isPlanLimit) {
            toast.message("Upgrade required", {
              description: "You reached the watchlist limit for your plan.",
              action: {
                label: "View plans",
                onClick: () => {
                  window.location.href = "/pricing";
                },
              },
            });
          }
          return;
        }
        setWatched(true);
        toast.success("Watching tender", {
          description: `Added to template: ${res.data.template.name}`,
        });
        return;
      }
  
      const res = await unwatchTender(props.tenderId);
      if (!res.ok) {
        toast.error("Failed to unwatch", { description: res.error.message });
        return;
      }
      setWatched(false);
      toast.info("Unwatched");
    } finally {
      setLoading(false);
      inFlightRef.current = false;
    }
  }

  return (
    <TLButton
      variant={watched ? "secondary" : "default"}
      onClick={toggle}
      loading={loading}
      iconLeft={
        watched ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />
      }
    >
      {watched ? "Watching" : "Watch"}
    </TLButton>
  );
}
