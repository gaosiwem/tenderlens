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
          {props.showSearch !== false && !isAdmin ? (
            <div className="relative w-full max-w-[320px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && q.trim())
                    router.push(`/search?q=${encodeURIComponent(q)}`);
                }}
                placeholder="Search..."
                className="h-10 pl-9"
              />
            </div>
          ) : null}

          <div className="hidden sm:block">
            <ModeToggle />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-2 py-1.5 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40">
                <Avatar className="size-8">
                  <AvatarFallback className="bg-primary/15 text-primary">
                    {auth.me?.user.email?.slice(0, 2).toUpperCase() ?? "TL"}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden text-sm font-semibold xl:block max-w-[100px] truncate">
                  {auth.me?.user.name ?? "Account"}
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
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
