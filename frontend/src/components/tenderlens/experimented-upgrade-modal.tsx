"use client";

import * as React from "react";
import { TLUpgradeModal } from "@/components/tenderlens/upgrade-modal";

function copyFor(bucket: string, feature: string) {
  if (bucket === "B") {
    return {
      title: "Unlock Pro to move faster",
      description: `This action requires Pro. Teams using Pro submit faster bids with ${feature}.`,
    };
  }
  return {
    title: "Upgrade required",
    description: `This feature requires Pro. Upgrade to continue using ${feature}.`,
  };
}

export function TLExperimentedUpgradeModal(props: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  bucket: string;
  featureLabel: string;
}) {
  const text = copyFor(props.bucket, props.featureLabel);
  return (
    <TLUpgradeModal
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={text.title}
      description={text.description}
      onUpgrade={() => {
        window.location.href = "/pricing";
      }}
    />
  );
}
