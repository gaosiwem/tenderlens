"use client";

import * as React from "react";
import Link from "next/link";
import { Menu, Moon, Sun, X } from "lucide-react";
import { useTheme } from "next-themes";
import { BrandLogo } from "@/components/tenderlens/brand-logo";
import { Button } from "@/components/ui/button";
import { appUrl } from "@/lib/marketing";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/#how-it-works", label: "How It Works" },
  { href: "/#features", label: "Benefits" },
  { href: "/#latest-tenders", label: "Latest Tenders" },
  { href: "/blog", label: "Blog" },
];

function ThemeButton() {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme !== "light";

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="rounded-full border border-border/70 bg-background/50"
      aria-label="Toggle theme"
    >
      <Sun className="size-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute size-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
    </Button>
  );
}

export function MarketingHeader() {
  const [open, setOpen] = React.useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" aria-label="TenderLens home">
          <BrandLogo size="mobile" priority />
        </Link>

        <nav className="hidden items-center gap-2 rounded-full border border-border/70 bg-background/80 p-1 text-sm font-semibold text-muted-foreground lg:flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-full px-4 py-2 transition hover:bg-muted hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <ThemeButton />
          <Button variant="ghost" asChild>
            <a href={`${appUrl}/auth/login`}>Sign In</a>
          </Button>
          <Button className="shadow-lg shadow-primary/20" asChild>
            <a href={`${appUrl}/auth/register`}>Start Free Tracking</a>
          </Button>
        </div>

        <div className="flex items-center gap-2 lg:hidden">
          <ThemeButton />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setOpen((value) => !value)}
            aria-label="Toggle menu"
            aria-expanded={open}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </Button>
        </div>
      </div>

      <div
        className={cn(
          "border-t border-border/70 bg-background/95 px-4 py-4 backdrop-blur lg:hidden",
          open ? "block" : "hidden",
        )}
      >
        <nav className="mx-auto grid max-w-7xl gap-2">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
          <div className="mt-2 grid gap-2 border-t border-border/70 pt-4">
            <Button variant="outline" asChild>
              <a href={`${appUrl}/auth/login`}>Sign In</a>
            </Button>
            <Button asChild>
              <a href={`${appUrl}/auth/register`}>Start Free Tracking</a>
            </Button>
          </div>
        </nav>
      </div>
    </header>
  );
}
