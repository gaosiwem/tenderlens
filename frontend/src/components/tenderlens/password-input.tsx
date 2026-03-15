"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface TLPasswordInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  className?: string;
}

export const TLPasswordInput = React.forwardRef<
  HTMLInputElement,
  TLPasswordInputProps
>(({ className, ...props }, ref) => {
  const [showPassword, setShowPassword] = React.useState(false);

  return (
    <div className="relative group">
      <Input
        type={showPassword ? "text" : "password"}
        className={cn("pr-10 h-10 rounded-xl", className)}
        ref={ref}
        {...props}
      />
      <button
        type="button"
        onClick={() => setShowPassword(!showPassword)}
        className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground hover:text-primary transition-colors focus:outline-none"
      >
        {showPassword ? (
          <EyeOff className="h-4 w-4" />
        ) : (
          <Eye className="h-4 w-4" />
        )}
      </button>
    </div>
  );
});

TLPasswordInput.displayName = "TLPasswordInput";
