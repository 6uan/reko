import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

type Variant = 'ghost' | 'solid'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  active?: boolean
}

const base =
  'px-3 py-1.5 text-xs font-medium rounded-(--radius-s) border cursor-pointer transition-colors'

const variants: Record<Variant, { idle: string; active: string }> = {
  ghost: {
    idle: 'bg-(--card) border-(--line) text-(--ink-3) hover:text-(--ink)',
    active: 'bg-(--card) border-(--accent) text-(--accent)',
  },
  solid: {
    idle: 'bg-(--accent) border-transparent text-white hover:opacity-90',
    active: 'bg-(--accent) border-transparent text-white hover:opacity-90',
  },
}

const Button = forwardRef<HTMLButtonElement, Props>(
  function Button({ variant = 'ghost', active = false, className, type = 'button', ...rest }, ref) {
    const v = variants[variant]
    return (
      <button
        ref={ref}
        type={type}
        className={cn(base, active ? v.active : v.idle, className)}
        {...rest}
      />
    )
  },
)

export default Button
