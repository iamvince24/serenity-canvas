import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

// Shared button style map used across app features.
const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-[6px] text-sm font-medium transition-tidal focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-sage text-white hover:bg-sage-dark active:scale-[0.98]",
        secondary:
          "border-[1.5px] border-border-strong bg-transparent text-foreground hover:bg-surface",
        ghost:
          "bg-transparent text-foreground-muted hover:bg-sage-lighter hover:text-sage-dark",
      },
      size: {
        default: "h-9 px-5",
        sm: "h-8 px-3 text-xs",
        lg: "h-11 px-7",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

// Thin wrapper around native button to keep variant API consistent.
function Button({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants>) {
  return (
    <button
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button };
