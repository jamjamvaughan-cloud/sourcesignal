import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-sm border border-white/10 bg-clip-padding text-sm font-inter font-medium whitespace-nowrap transition-all duration-300 ease-out outline-none select-none active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-[#E5E5EA] text-[#09090b] hover:bg-zinc-200",
        outline:
          "border-white/10 bg-transparent text-[#E5E5EA] hover:bg-white/5 hover:border-white/20",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "bg-transparent border-white/10 text-[#E5E5EA] hover:bg-white/5 hover:border-white/20",
        destructive:
          "bg-[#7F1D1D]/10 text-[#7F1D1D] hover:bg-[#7F1D1D]/20 focus-visible:border-[#7F1D1D]/40 focus-visible:ring-[#7F1D1D]/20 dark:bg-[#7F1D1D]/20 dark:hover:bg-[#7F1D1D]/30 dark:focus-visible:ring-[#7F1D1D]/40",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-10 gap-1.5 px-4 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-7 gap-1 rounded-sm px-2 text-xs in-data-[slot=button-group]:rounded-sm has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-9 gap-1 rounded-sm px-3 text-[0.85rem] in-data-[slot=button-group]:rounded-sm has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-11 gap-1.5 px-5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        icon: "size-10",
        "icon-xs":
          "size-8 rounded-sm in-data-[slot=button-group]:rounded-sm [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-9 rounded-sm in-data-[slot=button-group]:rounded-sm [&_svg:not([class*='size-'])]:size-3",
        "icon-lg": "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
