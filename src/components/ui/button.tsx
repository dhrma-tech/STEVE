import * as React from "react";
import { cn } from "@/lib/utils/cn";

export type ButtonVariant = "light" | "dark" | "brand" | "ghost" | "app" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const variantClasses: Record<ButtonVariant, string> = {
  light:
    "border-[0.8px] border-[rgba(32,32,32,0.1)] bg-[var(--color-surface)] text-[var(--foreground)] shadow-[rgba(0,0,0,0.06)_0_2px_3px,rgba(255,255,255,0.35)_0_0_0.357px_1.5px_inset,#fff_0_2px_0_inset] hover:bg-[var(--color-surface-raised)]",
  dark:
    "border-[0.8px] border-[#383838] bg-[linear-gradient(rgba(32,32,32,0.1),rgba(32,32,32,0.1)),linear-gradient(#4f4f4f,rgba(32,32,32,0.85))] text-white shadow-[rgba(0,0,0,0.22)_0_12px_28px] hover:brightness-110",
  brand: "border-[0.8px] border-[rgba(255,255,255,0.12)] bg-[var(--brand-500)] text-white hover:bg-[var(--brand-400)]",
  ghost:
    "border-[0.8px] border-transparent bg-transparent text-[var(--color-ink-strong)] hover:border-[var(--color-border-pill)] hover:bg-[rgba(231,231,227,0.45)]",
  app:
    "border-[0.8px] border-[var(--app-border)] bg-[var(--app-primary-light)] text-[var(--app-black-base)] hover:bg-white",
  danger: "border-[0.8px] border-[rgba(239,68,68,0.38)] bg-[rgba(239,68,68,0.12)] text-red-100 hover:bg-[rgba(239,68,68,0.2)]"
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
    "inline-flex shrink-0 items-center justify-center rounded-[8px] font-normal outline-none transition-[background,border-color,box-shadow,filter,color] focus-visible:ring-2 focus-visible:ring-[var(--brand-300)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] disabled:pointer-events-none disabled:opacity-50",
    sizeClasses[size],
    variantClasses[variant],
    fullWidth && "w-full",
    className
  );
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "light", size = "md", fullWidth = false, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={buttonClassName({ variant, size, fullWidth, className })}
      {...props}
    />
  )
);

Button.displayName = "Button";
