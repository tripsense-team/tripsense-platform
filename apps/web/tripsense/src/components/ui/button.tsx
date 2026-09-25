import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

import { Loader2 } from "lucide-react";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-control transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground font-semibold shadow-xs hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground font-semibold shadow-xs hover:bg-destructive/90",
        outline:
          "border border-border/80 bg-background font-semibold shadow-2xs hover:bg-muted hover:text-foreground",
        secondary:
          "bg-secondary text-secondary-foreground font-semibold shadow-2xs hover:bg-secondary/80",
        ghost: "hover:bg-muted hover:text-foreground font-medium",
        link: "text-primary underline-offset-4 hover:underline font-semibold",
      },
      size: {
        xs: "h-8 rounded-lg px-2.5 text-caption font-semibold [&_svg]:size-3.5",
        sm: "h-9 rounded-xl px-3.5 text-caption font-medium [&_svg]:size-4",
        default: "h-10 rounded-xl px-4 py-2 font-semibold [&_svg]:size-4.5",
        lg: "h-11 rounded-2xl px-6 font-semibold [&_svg]:size-5",
        icon: "h-10 w-10 rounded-xl [&_svg]:size-5",
        pill: "h-10 rounded-full px-5 text-sm font-semibold [&_svg]:size-4.5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
  loadingText?: React.ReactNode;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      loading = false,
      loadingText,
      disabled,
      children,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : "button";
    const isDisabled = disabled || loading;

    if (asChild) {
      return (
        <Comp
          className={cn(buttonVariants({ variant, size, className }))}
          ref={ref}
          aria-busy={loading ? true : undefined}
          {...props}
        >
          {children}
        </Comp>
      );
    }

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={isDisabled}
        aria-busy={loading ? true : undefined}
        {...props}
      >
        {loading && (
          <Loader2
            className="h-4 w-4 animate-spin shrink-0"
            aria-hidden="true"
          />
        )}
        {loading && loadingText ? loadingText : children}
      </Comp>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
