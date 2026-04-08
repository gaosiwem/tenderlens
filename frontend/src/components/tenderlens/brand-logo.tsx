"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

type BrandLogoProps = {
  className?: string;
  priority?: boolean;
  size?: "sidebar" | "mobile" | "auth";
};



export function BrandLogo({
  className,
  priority = false,
  size = "sidebar",
}: BrandLogoProps) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div
        className={cn(
          "relative shrink-0",
          size === "sidebar" ? "h-8 w-8" : size === "auth" ? "h-10 w-10" : "h-7 w-7",
        )}
      >
        <Image
          src="/Logo.svg"
          alt="TenderLens Icon"
          fill
          priority={priority}
          className="object-contain"
        />
      </div>
      <span
        className={cn(
          "font-extrabold tracking-tight text-foreground",
          size === "sidebar" ? "text-xl" : size === "auth" ? "text-2xl" : "text-lg",
        )}
      >
        Tender<span className="text-primary font-inherit">Lens</span>
      </span>
    </div>
  );
}
