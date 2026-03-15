"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { isSystemAdmin, useAuth } from "@/lib/auth";
import { TLCardSkeleton } from "@/components/tenderlens/skeleton-blocks";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const router = useRouter();

  React.useEffect(() => {
    if (auth.isReady && !auth.isAuthed) {
      router.replace("/auth/login");
      return;
    }

    // Redirect admins to the command center if they land on generic paths
    if (auth.isReady && auth.isAuthed && auth.me) {
      const isAdmin = isSystemAdmin(auth.me);

      const pathname = window.location.pathname;
      if (isAdmin && (pathname === "/" || pathname === "/dashboard")) {
        router.replace("/admin");
      }
    }
  }, [auth.isReady, auth.isAuthed, auth.me, router]);

  if (!auth.isReady) {
    return (
      <div className="mx-auto max-w-[1720px] px-4 py-8">
        <TLCardSkeleton />
      </div>
    );
  }

  if (!auth.isAuthed) return null;
  return children;
}
