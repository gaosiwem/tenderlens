import Link from "next/link";
import { BrandLogo } from "@/components/tenderlens/brand-logo";
import { appUrl } from "@/lib/marketing";

export function MarketingFooter() {
  return (
    <footer className="border-t border-border/70 bg-card/40">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div className="space-y-2">
          <BrandLogo size="mobile" />
          <p className="text-sm text-muted-foreground">
            Built for South African tender teams.
          </p>
        </div>

        <nav className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold text-muted-foreground">
          <Link href="/#how-it-works" className="hover:text-foreground">
            How It Works
          </Link>
          <Link href="/#features" className="hover:text-foreground">
            Benefits
          </Link>
          <Link href="/blog" className="hover:text-foreground">
            Blog
          </Link>
          <a href={`${appUrl}/auth/login`} className="hover:text-foreground">
            Sign In
          </a>
          <a href={`${appUrl}/auth/register`} className="hover:text-foreground">
            Register
          </a>
        </nav>

        <div className="text-sm text-muted-foreground">
          &copy; 2026 TenderLens
        </div>
      </div>
    </footer>
  );
}
