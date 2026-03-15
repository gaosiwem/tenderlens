import * as React from "react";
import { cn } from "@/lib/utils";

interface HeadingProps extends React.HTMLAttributes<HTMLHeadingElement> {
  level?: 1 | 2 | 3 | 4;
}

const Heading = React.forwardRef<HTMLHeadingElement, HeadingProps>(
  ({ className, level = 1, ...props }, ref) => {
    const Comp = `h${level}` as React.ElementType;
    const styles = {
      1: "text-4xl md:text-5xl font-black tracking-tight lg:text-6xl",
      2: "text-3xl font-bold tracking-tight first:mt-0",
      3: "text-2xl font-bold tracking-tight",
      4: "text-xl font-bold tracking-tight",
    };

    return (
      <Comp
        ref={ref}
        className={cn("scroll-m-20 font-display", styles[level], className)}
        {...props}
      />
    );
  },
);
Heading.displayName = "Heading";

const Text = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("leading-7 [&:not(:first-child)]:mt-6", className)}
    {...props}
  />
));
Text.displayName = "Text";

export { Heading, Text };
