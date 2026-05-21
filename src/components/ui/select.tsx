"use client";

import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

export const Select = SelectPrimitive.Root;
export const SelectGroup = SelectPrimitive.Group;
export const SelectValue = SelectPrimitive.Value;

export const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger> & { surface?: "light" | "dark" }
>(({ className, children, surface = "light", ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      "flex h-10 w-full items-center justify-between rounded-[8px] border-[0.8px] px-3 text-[15px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--focused)] disabled:cursor-not-allowed disabled:opacity-50",
      surface === "dark"
        ? "border-[var(--input)] bg-[var(--foreground-5)] text-[var(--foreground-80)]"
        : "border-[var(--color-border-pill)] bg-[var(--color-surface-raised)] text-[var(--foreground)]",
      className
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown aria-hidden="true" className="size-4 opacity-60" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));

SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

export const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = "popper", sideOffset = 6, ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      position={position}
      sideOffset={sideOffset}
      className={cn(
        "z-50 max-h-[320px] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-[8px] border border-[var(--border-10)] bg-[var(--popover)] text-[var(--popover-foreground)] shadow-[var(--shadow-outset-100)]",
        className
      )}
      {...props}
    >
      <SelectPrimitive.Viewport className="p-1">{children}</SelectPrimitive.Viewport>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
));

SelectContent.displayName = SelectPrimitive.Content.displayName;

export const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex min-h-9 cursor-default select-none items-center rounded-[6px] py-2 pl-9 pr-3 text-sm outline-none data-[disabled]:pointer-events-none data-[highlighted]:bg-[var(--foreground-8)] data-[disabled]:opacity-45",
      className
    )}
    {...props}
  >
    <span className="absolute left-2.5 flex size-4 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check aria-hidden="true" className="size-4" />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
));

SelectItem.displayName = SelectPrimitive.Item.displayName;

export interface SelectFieldProps extends React.ComponentPropsWithoutRef<typeof SelectPrimitive.Root> {
  label?: string;
  placeholder?: string;
  options: readonly SelectOption[];
  surface?: "light" | "dark";
  className?: string;
  onCreate?: () => void;
  createLabel?: string;
}

const CREATE_SENTINEL = "__create_new__";

export function SelectField({ label, placeholder = "Select", options, surface = "light", className, onCreate, createLabel = "Create new", onValueChange, value, ...props }: SelectFieldProps) {
  function handleChange(val: string) {
    if (val === CREATE_SENTINEL) {
      onCreate?.();
      return;
    }
    onValueChange?.(val);
  }

  return (
    <label className={cn("grid gap-2 text-sm", surface === "dark" ? "text-[var(--foreground-80)]" : "text-[var(--color-ink-strong)]", className)}>
      {label ? <span className="font-medium">{label}</span> : null}
      <SelectPrimitive.Root value={value} onValueChange={handleChange} {...props}>
        <SelectTrigger surface={surface}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </SelectItem>
          ))}
          {onCreate ? (
            <>
              <div className="mx-1 my-1 border-t border-[var(--border-10)]" />
              <SelectPrimitive.Item
                value={CREATE_SENTINEL}
                className="relative flex min-h-9 cursor-default select-none items-center gap-2 rounded-[6px] py-2 pl-3 pr-3 text-sm font-medium text-[var(--tt-color-text-blue)] outline-none data-[highlighted]:bg-[var(--foreground-8)] data-[highlighted]:text-[var(--tt-color-text-blue)]"
              >
                <Plus aria-hidden="true" className="size-3.5 shrink-0" />
                <SelectPrimitive.ItemText>{createLabel}</SelectPrimitive.ItemText>
              </SelectPrimitive.Item>
            </>
          ) : null}
        </SelectContent>
      </SelectPrimitive.Root>
    </label>
  );
}

