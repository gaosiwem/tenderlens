"use client";

import * as React from "react";

/**
 * This hook expects you already have a notifications feed state somewhere.
 * If you do not, keep it simple:
 * - fetch notifications list periodically
 * - filter items where meta.kind === "ENTITLEMENT_WARNING"
 */
export function useEntitlementWarnings(notifications: any[]) {
  return React.useMemo(() => {
    const warns = (notifications ?? []).filter(
      (n) => n?.meta?.kind === "ENTITLEMENT_WARNING",
    );
    // show newest first
    warns.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    return warns.slice(0, 3);
  }, [notifications]);
}
