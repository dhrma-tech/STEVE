import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

export type CardVariant = "marketing" | "app" | "deep" | "blue";

const variantClasses: Record<CardVariant, string> = {
  marketing: "border-[0.8px] border-[var(--color-border-card)] bg-[var(--color-surface-raised)] text-[var(--color-ink)]",
  app: "border-[0.8px] border-[var(--app-border)] bg-[var(--app-workspace-raised)] text-[var(--app-text)]",
  deep: "border-[0.8px] border-[var(--app-border)] bg-[var(--app-card)] text-[var(--app-text)]",
  blue: "border-[0.8px] border-[var(--feature-blue-border)] bg-[var(--feature-blue-bg)] text-[var(--color-ink)]"
};

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(({ className, variant = "marketing", ...props }, ref) => (
  <div ref={ref} className={cn("rounded-[16px]", variantClasses[variant], className)} {...props} />
));

Card.displayName = "Card";

export const CardHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("grid gap-2 p-4", className)} {...props} />
);

export const CardTitle = ({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h3 className={cn("text-xl font-medium leading-snug tracking-[0px]", className)} {...props} />
);

export const CardDescription = ({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
  <p className={cn("text-sm leading-6 text-current/65", className)} {...props} />
);

export const CardContent = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("p-4 pt-0", className)} {...props} />
);

export const CardFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex items-center gap-2 p-4 pt-0", className)} {...props} />
);

export interface PricingCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  price: string;
  currency?: string;
  period?: string;
  description: string;
  features: readonly string[];
  ctaLabel: string;
  highlighted?: boolean;
  onCtaClick?: () => void;
}

export function PricingCard({
  title,
  price,
  currency = "$",
  period,
  description,
  features,
  ctaLabel,
  highlighted = false,
  onCtaClick,
  className,
  ...props
}: PricingCardProps) {
  const card = (
    <Card
      className={cn(
        "flex min-h-[594px] w-full max-w-[350px] flex-col p-3 pb-8 shadow-[rgba(0,0,0,0.06)_0_20px_48px,rgba(255,255,255,0.7)_0_1px_0_inset]",
        className
      )}
      {...props}
    >
      <div className="min-h-[220px] rounded-[8px] border border-[var(--color-border-card)] bg-[linear-gradient(135deg,#f4efe7,#dff2e1_45%,#d7e8ff)]" />
      <CardHeader className="px-1 pb-3 pt-5">
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="grid flex-1 gap-4 px-1">
        <div className="flex items-end gap-1 font-mono text-[var(--color-ink-strongest)]">
          <span className="text-[32px] leading-none">{currency}</span>
          <span className="text-[50px] leading-none">{price}</span>
          {period ? <span className="mb-1 text-sm text-[var(--color-ink-faint)]">{period}</span> : null}
        </div>
        <ul className="grid gap-2 text-sm leading-6 text-[var(--color-ink-muted)]">
          {features.map((feature) => (
            <li key={feature} className="flex gap-2">
              <span aria-hidden="true" className="mt-2 size-1.5 rounded-full bg-[var(--color-feature-success)]" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </CardContent>
      <CardFooter className="px-1">
        <Button variant={highlighted ? "dark" : "light"} fullWidth onClick={onCtaClick}>
          {ctaLabel}
        </Button>
      </CardFooter>
    </Card>
  );

  return highlighted ? <div className="rounded-[17px] border border-[var(--color-ink-ui-solid)] p-1">{card}</div> : card;
}

export interface FeatureCalloutProps extends React.HTMLAttributes<HTMLDivElement> {
  label?: string;
  title: string;
  description: string;
}

export function FeatureCallout({ label, title, description, className, children, ...props }: FeatureCalloutProps) {
  return (
    <Card variant="blue" className={cn("grid gap-2 p-4", className)} {...props}>
      {children ? <div className="grid size-9 place-items-center rounded-[8px] bg-white text-[var(--hero-blue)] [&_svg]:size-5">{children}</div> : null}
      {label ? <span className="font-mono text-[11px] font-medium uppercase leading-none tracking-[0.08em] text-[var(--hero-blue)]">{label}</span> : null}
      <h3 className="text-lg font-medium leading-snug tracking-[0px] text-[var(--foreground)]">{title}</h3>
      <p className="text-sm leading-6 text-[var(--color-ink-muted)]">{description}</p>
    </Card>
  );
}

export function AppPanel({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <section
      className={cn("rounded-[14px] border-[0.8px] border-[var(--app-border)] bg-[var(--app-workspace-raised)] text-[var(--app-text)] shadow-[rgba(0,0,0,0.18)_0_18px_48px]", className)}
      {...props}
    />
  );
}
