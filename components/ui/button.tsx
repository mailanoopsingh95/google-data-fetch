import { Button as ButtonPrimitive } from '@base-ui/react/button'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-60 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 skeu-button",
  {
    variants: {
      variant: {
        default: 'bg-gradient-to-b from-amber-600 to-amber-800 text-amber-50 hover:from-amber-500 hover:to-amber-700 active:from-amber-700 active:to-amber-900',
        outline:
          'border border-amber-900 bg-gradient-to-b from-amber-950 to-amber-900 text-amber-100 hover:from-amber-900 hover:to-amber-800 aria-expanded:from-amber-900 aria-expanded:to-amber-800',
        secondary:
          'bg-gradient-to-b from-orange-600 to-orange-800 text-orange-50 hover:from-orange-500 hover:to-orange-700 active:from-orange-700 active:to-orange-900',
        ghost:
          'bg-transparent hover:bg-gradient-to-b hover:from-amber-950/50 hover:to-amber-900/50 text-amber-100 aria-expanded:from-amber-950/50 aria-expanded:to-amber-900/50',
        destructive:
          'bg-gradient-to-b from-red-700 to-red-900 text-red-50 hover:from-red-600 hover:to-red-800 active:from-red-800 active:to-red-950',
        link: 'text-amber-400 underline-offset-4 hover:underline hover:text-amber-300',
      },
      size: {
        default:
          'h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2',
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: 'h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2',
        icon: 'size-8',
        'icon-xs':
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        'icon-sm':
          'size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg',
        'icon-lg': 'size-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Button({
  className,
  variant = 'default',
  size = 'default',
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
