"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

type BrandLogoProps = {
  className?: string;
  priority?: boolean;
  size?: "sidebar" | "mobile" | "auth";
};

const sizeClasses: Record<NonNullable<BrandLogoProps["size"]>, string> = {
  sidebar: "w-28 xl:w-32",
  mobile: "w-20 sm:w-24",
  auth: "w-32 sm:w-40",
};

export function BrandLogo({
  className,
  priority = false,
  size = "sidebar",
}: BrandLogoProps) {
  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden",
        "aspect-[3/2]",
        sizeClasses[size],
        className,
      )}
    >
      <Image
        src="/Logo.png"
        alt="TenderLens"
        fill
        priority={priority}
        sizes="(max-width: 640px) 96px, (max-width: 1024px) 112px, 128px"
        className="object-contain"
      />
    </div>
  );
}
