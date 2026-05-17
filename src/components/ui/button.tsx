import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export type ButtonVariant = "light" | "dark" | "brand" | "ghost" | "app" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const variantClasses: Record<ButtonVariant, string> = {
  light:
    "border-[0.8px] border-[var(--border-10)] bg-[var(--background-l0)] text-[var(--foreground)] shadow-[var(--shadows-light-buttons-md)] hover:brightness-[1.02] active:brightness-[0.98]",
  dark:
    "border-[0.8px] border-[rgba(0,0,0,0.5)] bg-[var(--primary)] text-[var(--primary-foreground)] shadow-[var(--shadows-light-buttons-lg)] hover:brightness-110",
  brand:
    "border-[0.8px] border-[var(--border-15)] bg-[var(--tt-brand-color-500)] text-white hover:bg-[var(--tt-brand-color-400)]",
  ghost:
    "border-[0.8px] border-[var(--border-subtle,rgba(0,0,0,0.06))] bg-transparent text-[var(--foreground-60)] hover:border-[var(--border-20)] hover:bg-[var(--foreground-8)]",
  app:
    "border-[0.8px] border-[var(--border-90)] bg-[var(--primary)] text-[var(--primary-foreground)] shadow-[var(--shadow-button-md)] hover:brightness-[1.04] active:brightness-[0.96]",
  danger:
    "border-[0.8px] border-[var(--border-10)] bg-transparent text-[var(--destructive)] hover:bg-[var(--tt-color-text-red-contrast)]"
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-[30px] gap-1.5 px-3 text-[13px] leading-none",
  md: "h-[41px] gap-2 px-3 text-[15px] leading-none",
  lg: "h-[46px] gap-2.5 px-4 text-[16px] leading-none"
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
}

export function buttonClassName({
  variant = "light",
  size = "md",
  fullWidth = false,
  className
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
} = {}) {
  return cn(
    "inline-flex shrink-0 items-center justify-center rounded-[8px] font-normal outline-none transition-[background,border-color,box-shadow,filter,color] duration-[var(--tt-transition-duration-short)] ease-[var(--tt-transition-easing-default)] focus-visible:ring-2 focus-visible:ring-[var(--focused)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50",
    sizeClasses[size],
    variantClasses[variant],
    fullWidth && "w-full",
    className
  );
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "light", size = "md", fullWidth = false, loading = false, type = "button", disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      disabled={disabled ?? loading}
      className={buttonClassName({ variant, size, fullWidth, className })}
      {...props}
    >
      {loading ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
      {children}
    </button>
  )
);

Button.displayName = "Button";
