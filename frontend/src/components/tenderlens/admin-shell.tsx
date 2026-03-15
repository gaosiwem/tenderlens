"use client";

import * as React from "react";
import { TenderLensAppShell } from "./app-shell";

interface AdminShellProps {
  children: React.ReactNode;
  title?: string;
}

export function TLAdminShell({
  children,
  title = "Admin Portal",
}: AdminShellProps) {
  return (
    <TenderLensAppShell title={title} subtitle="System Command Center">
      {children}
    </TenderLensAppShell>
  );
}
