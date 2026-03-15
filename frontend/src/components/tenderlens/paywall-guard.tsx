"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { trackBillingEvent } from "@/lib/billing-analytics.api";
import { useExperimentConfigs } from "@/hooks/use-experiment-configs";
import { useResolvedExperiments } from "@/hooks/use-resolved-experiments";
import { TLExperimentV2PaywallModal } from "@/components/tenderlens/experiment-v2-paywall-modal";
import { TLUpgradeModal } from "@/components/tenderlens/upgrade-modal";

type GuardContext = {
  run: (
    fn: () => Promise<void>,
    meta: { title: string; description: string },
  ) => Promise<void>;
};

export function TLPaywallGuard(props: {
  children: (guard: GuardContext) => React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const [title, setTitle] = React.useState("Upgrade Required");
  const [description, setDescription] = React.useState(
    "This feature is available on our Pro plan.",
  );
  const [variant, setVariant] = React.useState<"upgrade" | "seats">("upgrade");
  const router = useRouter();
  const { map: experimentsV2 } = useExperimentConfigs();
  const { map: resolvedExperiments } = useResolvedExperiments();

  const experiments = React.useMemo(() => {
    return { ...experimentsV2, ...resolvedExperiments };
  }, [experimentsV2, resolvedExperiments]);

  const handleAction = () => {
    if (variant === "seats") {
      router.push("/settings/billing");
    } else {
      router.push("/pricing");
    }
    setOpen(false);
  };

  async function run(
    fn: () => Promise<void>,
    meta: { title: string; description: string },
  ) {
    try {
      await fn();
    } catch (e: any) {
      const code = e?.code || e?.error?.code;
      const upgradeFlag = e?.upgrade || e?.error?.upgrade;

      const isSeatLimit =
        code === "SEAT_LIMIT_REACHED" || code === "MEMBER_LIMIT_REACHED";

      if (
        upgradeFlag ||
        code === "PLAN_UPGRADE_REQUIRED" ||
        code === "USAGE_LIMIT_REACHED" ||
        code === "TRIAL_EXPIRED" ||
        code === "PLAN_REQUIRED" ||
        isSeatLimit
      ) {
        if (isSeatLimit) {
          setTitle("Seat limit reached");
          setDescription(
            "You have used all purchased seats. Please buy more seats in the billing portal to add more members.",
          );
          setVariant("seats");
        } else {
          setTitle(meta.title);
          setDescription(meta.description);
          setVariant("upgrade");
        }

        trackBillingEvent("paywall_shown", {
          code,
          title: isSeatLimit ? "seat_limit" : meta.title,
        });
        setOpen(true);
        return;
      }

      // If it's not a paywall error, rethrow it
      throw e;
    }
  }

  // Experiment-driven modal if variant is upgrade
  if (variant === "upgrade" && experiments["upgrade_prompt_v2"]) {
    return (
      <>
        {props.children({ run })}
        <TLExperimentV2PaywallModal
          open={open}
          onOpenChange={setOpen}
          featureLabel={title}
          experiment={experiments["upgrade_prompt_v2"]}
        />
      </>
    );
  }

  return (
    <>
      {props.children({ run })}
      <TLUpgradeModal
        open={open}
        onOpenChange={setOpen}
        title={title}
        description={description}
        onUpgrade={handleAction}
        variant={variant}
      />
    </>
  );
}
