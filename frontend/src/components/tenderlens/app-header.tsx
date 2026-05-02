"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Menu, Search, LogOut } from "lucide-react";
import { TenderLensSidebar } from "./sidebar";
import { isSystemAdmin, useAuth } from "@/lib/auth";
import { ModeToggle } from "@/components/mode-toggle";
import { BrandLogo } from "./brand-logo";

export function TenderLensAppHeader(props: {
  title?: React.ReactNode;
  subtitle?: string;
  description?: string;
  badges?: React.ReactNode[];
  actions?: React.ReactNode;
  showSearch?: boolean;
}) {
  const [q, setQ] = React.useState("");
  const router = useRouter();
  const auth = useAuth();

  const isAdmin = isSystemAdmin(auth.me);
  const activeOrgId =
    typeof window !== "undefined"
      ? window.localStorage.getItem("tl_active_org_id")
      : null;
  const currentOrgMembership =
    auth.me?.orgs.find((membership) => membership.org.id === activeOrgId) ??
    auth.me?.orgs[0] ??
    null;
  const createdAtLabel = auth.me?.user.createdAt
    ? new Date(auth.me.user.createdAt).toLocaleDateString()
    : "-";
  const verificationLabel = auth.me?.user.emailVerifiedAt
    ? "Verified"
    : "Pending";

  return (
    <div className="tl-surface px-4 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <div className="lg:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <button
                  aria-label="Open navigation"
                  className="inline-flex size-10 items-center justify-center rounded-lg border border-border bg-card hover:bg-accent"
                >
                  <Menu className="size-4" />
                </button>
              </SheetTrigger>
              <SheetContent side="left" className="p-4 pt-10">
                <TenderLensSidebar />
              </SheetContent>
            </Sheet>
          </div>

          <Link
            href={isAdmin ? "/admin" : "/dashboard"}
            className="lg:hidden"
          >
            <BrandLogo size="mobile" priority />
          </Link>

          <div className="hidden lg:block">
            <div className="flex items-center gap-2">
              <div className="font-display text-sm font-extrabold tracking-tight">
                {props.title ?? "Overview"}
              </div>
              {props.badges && <div className="flex gap-1">{props.badges}</div>}
            </div>
            <div className="truncate text-xs text-muted-foreground">
              {props.subtitle ||
                props.description ||
                (isAdmin ? "Command Center" : "Dashboard")}
            </div>
          </div>
        </div>
        <div className="flex flex-1 items-center gap-2 sm:justify-end">
          {props.actions && (
            <div className="flex items-center gap-2 mr-2">{props.actions}</div>
          )}

          <div className="block">
            <ModeToggle />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-2 py-1.5 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40">
                <Avatar className="size-8">
                  <AvatarFallback className="bg-primary/15 text-primary">
                    {auth.me?.user.email?.slice(0, 2) ?? "tl"}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden text-sm font-semibold xl:block max-w-[100px] truncate">
                  {auth.me?.user.name ?? "Account"}
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <div className="mx-2 mt-2 mb-1 rounded-md border border-border/60 bg-muted/20 p-3">
                <div className="text-[10px] font-bold tracking-[0.18em] text-muted-foreground">
                  User Profile
                </div>
                <div className="mt-2 text-sm font-semibold text-foreground">
                  {auth.me?.user.name ?? "Account"}
                </div>
                <div className="text-xs text-muted-foreground break-all">
                  {auth.me?.user.email ?? "-"}
                </div>
                <div className="mt-3 grid grid-cols-[auto_1fr] items-start gap-x-3 gap-y-1 text-xs">
                  <span className="text-muted-foreground">Organization</span>
                  <span className="text-right font-medium text-foreground">
                    {currentOrgMembership?.org.name ?? "-"}
                  </span>
                  <span className="text-muted-foreground">Role</span>
                  <span className="text-right font-medium text-foreground">
                    {currentOrgMembership?.role ?? "-"}
                  </span>
                  <span className="text-muted-foreground">Created</span>
                  <span className="text-right font-medium text-foreground">
                    {createdAtLabel}
                  </span>
                  <span className="text-muted-foreground">Email Status</span>
                  <span className="text-right font-medium text-foreground">
                    {verificationLabel}
                  </span>
                </div>
              </div>
              <DropdownMenuItem onClick={() => router.push("/orgs")}>
                Organizations
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={async () => {
                  await auth.logout();
                }}
                className="text-red-400 focus:text-red-400"
              >
                <LogOut className="size-4 mr-2" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
