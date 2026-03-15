 "use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { isSystemAdmin, useAuth } from "@/lib/auth";
import { TLCardSkeleton } from "@/components/tenderlens/skeleton-blocks";

export default function NotificationsRedirectPage() {
  const auth = useAuth();
  const router = useRouter();

  React.useEffect(() => {
    if (!auth.isReady || !auth.isAuthed) return;

    if (isSystemAdmin(auth.me)) {
      router.replace("/admin/notifications");
      return;
    }

    router.replace("/dashboard");
  }, [auth.isAuthed, auth.isReady, auth.me, router]);

  return (
    <div className="mx-auto max-w-[1720px] px-4 py-8">
      <TLCardSkeleton />
    </div>
  );
}
