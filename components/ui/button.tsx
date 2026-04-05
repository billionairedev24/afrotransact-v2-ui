import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

/**
 * Central button config — change variants here to update every button in the app.
 * Colors derive from CSS variables (globals.css) so theme changes propagate automatically.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold ring-offset-background transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
  {
    variants: {
      variant: {
        // Primary CTA — uses theme primary colour
        default:
          "bg-primary text-primary-foreground shadow-sm shadow-primary/20 hover:brightness-110 hover:-translate-y-px",
        // Destructive / danger actions
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        // Bordered, transparent background
        outline:
          "border border-input bg-background hover:bg-muted hover:text-foreground",
        // Muted secondary actions
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        // Success / confirm actions — colour set via --success in globals.css
        success:
          "bg-success text-success-foreground shadow-sm shadow-success/20 hover:bg-success/90 hover:-translate-y-px",
        // Warning — colour set via --warning in globals.css
        warning:
          "bg-warning text-warning-foreground shadow-sm shadow-warning/20 hover:bg-warning/90",
        // No background, looks like a link
        ghost:
          "hover:bg-muted hover:text-foreground",
        // Underlined link style
        link:
          "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm:      "h-8 rounded-lg px-3 text-xs",
        lg:      "h-12 rounded-xl px-8 text-base",
        icon:    "h-10 w-10",
        "icon-sm": "h-8 w-8 rounded-lg",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props}
    />
  ),
)
Button.displayName = "Button"

export { Button, buttonVariants }
