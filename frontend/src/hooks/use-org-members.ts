"use client";

import * as React from "react";
import { listOrgMembers } from "@/lib/org.api";
import type { OrgMember } from "@/lib/org.types";

export function useOrgMembers() {
  const [loading, setLoading] = React.useState(true);
  const [items, setItems] = React.useState<OrgMember[]>([]);

  async function load() {
    setLoading(true);
    const res = await listOrgMembers();
    setLoading(false);
    if (res.ok) setItems(res.data.items);
    else setItems([]);
  }

  React.useEffect(() => {
    load();
  }, []);

  return { loading, items, reload: load };
}
