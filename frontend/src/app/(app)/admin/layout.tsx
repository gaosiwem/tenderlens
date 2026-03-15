"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { isSystemAdmin, useAuth } from "@/lib/auth";
import { TLAdminShell } from "@/components/tenderlens/admin-shell";
import { TLCardSkeleton } from "@/components/tenderlens/skeleton-blocks";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const auth = useAuth();
  const router = useRouter();

  const isAdmin = React.useMemo(() => isSystemAdmin(auth.me), [auth.me]);

  React.useEffect(() => {
    if (auth.isReady && !isAdmin) {
      router.replace("/dashboard");
    }
  }, [auth.isReady, isAdmin, router]);

  if (!auth.isReady) {
    return (
      <div className="mx-auto max-w-[1720px] px-4 py-8">
        <TLCardSkeleton />
      </div>
    );
  }

  if (!isAdmin) return null;

  return <TLAdminShell title="System Center">{children}</TLAdminShell>;
}
