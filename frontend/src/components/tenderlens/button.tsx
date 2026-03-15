import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type Props = React.ComponentProps<typeof Button> & {
  leftIcon?: React.ReactNode;
  iconLeft?: React.ReactNode;
  rightIcon?: React.ReactNode;
  loading?: boolean;
};

export function TLButton({
  className,
  leftIcon,
  iconLeft,
  rightIcon,
  loading,
  children,
  ...props
}: Props) {
  const isDisabled = props.disabled || loading;
  const effectiveLeftIcon = iconLeft || leftIcon;
  return (
    <Button
      className={cn(
        "h-10 rounded-lg font-semibold",
        props.size !== "icon" && "px-4",
        "focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        isDisabled && "opacity-60 pointer-events-none",
        className,
      )}
      {...props}
      disabled={isDisabled}
    >
      {loading ? (
        <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : null}
      {!loading && effectiveLeftIcon ? (
        <span className="mr-2 inline-flex">{effectiveLeftIcon}</span>
      ) : null}
      <span
        className={cn(
          "relative inline-flex items-center justify-center",
          props.size !== "icon" && "truncate",
        )}
      >
        {children}
      </span>
      {rightIcon ? <span className="ml-2 inline-flex">{rightIcon}</span> : null}
    </Button>
  );
}
