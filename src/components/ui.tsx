import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "gold";
type Size = "md" | "lg" | "sm";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-primary text-white hover:bg-primary-hover shadow-[0_1px_0_rgb(0_0_0/0.08),0_8px_20px_-8px_rgb(8_122_98/0.6)]",
  secondary: "bg-surface text-ink border border-border hover:border-ink-muted/40 hover:bg-surface-muted",
  ghost: "text-ink-muted hover:text-ink hover:bg-ink/5",
  danger: "bg-surface text-danger border border-danger/30 hover:bg-danger-soft",
  gold: "bg-gold-bright text-ink hover:bg-gold hover:text-white shadow-[0_8px_20px_-8px_rgb(185_130_36/0.7)]",
};

const SIZES: Record<Size, string> = {
  sm: "min-h-11 px-3.5 text-sm rounded-xl",
  md: "min-h-12 px-5 text-base rounded-2xl",
  lg: "min-h-14 px-6 text-lg rounded-2xl",
};

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  busy = false,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; busy?: boolean }) {
  return (
    <button
      {...rest}
      disabled={rest.disabled || busy}
      aria-busy={busy || undefined}
      className={`inline-flex items-center justify-center gap-2 font-semibold transition-colors disabled:opacity-50 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
    >
      {busy ? <Spinner /> : null}
      {children}
    </button>
  );
}

export function Spinner({ className = "size-4" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block animate-spin rounded-full border-2 border-current border-r-transparent ${className}`}
    />
  );
}

export function Card({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <div className={`rounded-3xl border border-border bg-surface shadow-[0_1px_2px_rgb(22_42_54/0.04),0_12px_32px_-16px_rgb(22_42_54/0.18)] ${className}`}>
      {children}
    </div>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "error" | "success" | "warn"; children: ReactNode }) {
  const styles = {
    info: "bg-surface-muted text-ink",
    error: "bg-danger-soft text-danger",
    success: "bg-primary-soft text-primary-hover",
    warn: "bg-gold-soft text-ink",
  }[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-2xl px-4 py-3 text-sm font-medium ${styles}`}>
      {children}
    </div>
  );
}
