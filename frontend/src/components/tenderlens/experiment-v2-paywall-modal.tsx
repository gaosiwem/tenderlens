"use client";

import { TLUpgradeModal } from "@/components/tenderlens/upgrade-modal";

export function TLExperimentV2PaywallModal(props: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  featureLabel: string;
  experiment?: { bucket: string; config: any } | null;
}) {
  const bucket = props.experiment?.bucket ?? "A";
  const variants = props.experiment?.config?.variants ?? {};
  const variant = variants[bucket] ?? variants["A"] ?? {};

  const title = variant.title ?? "Upgrade required";
  const cta = variant.cta ?? "Upgrade";
  const desc =
    variant.description ??
    `This feature requires Pro. Upgrade to continue using ${props.featureLabel}.`;

  return (
    <TLUpgradeModal
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={title}
      description={desc}
      onUpgrade={() => {
        window.location.href = "/pricing";
      }}
      ctaLabel={cta}
    />
  );
}
