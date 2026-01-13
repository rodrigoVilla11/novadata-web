"use client";

import React, { forwardRef } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type ButtonSize = "sm" | "md" | "lg";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
};

function cn(...parts: Array<string | undefined | null | false>) {
  return parts.filter(Boolean).join(" ");
}

/* =============================================================================
 * Spinner (re-usable)
 * - hereda el color por currentColor (borde)
 * ========================================================================== */

function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent",
        className
      )}
    />
  );
}

/* =============================================================================
 * Button
 * - size + icons
 * - loading bloquea click y mantiene ancho estable
 * - focus ring consistente
 * - outline nuevo
 * - respeta className del caller
 * ========================================================================== */

const base =
  "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition " +
  "disabled:opacity-50 disabled:cursor-not-allowed " +
  "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-zinc-100 focus-visible:ring-offset-2 focus-visible:ring-offset-white";

const sizes: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-11 px-5 text-base",
};

const variants: Record<ButtonVariant, string> = {
  primary: "bg-zinc-900 text-white hover:bg-zinc-800 active:bg-zinc-900",
  secondary: "bg-zinc-100 text-zinc-900 hover:bg-zinc-200 active:bg-zinc-200",
  ghost: "bg-transparent text-zinc-900 hover:bg-zinc-100 active:bg-zinc-100",
  outline:
    "bg-white text-zinc-900 border border-zinc-200 hover:bg-zinc-50 active:bg-zinc-50",
  danger:
    "bg-red-600 text-white hover:bg-red-500 active:bg-red-600 focus-visible:ring-red-100",
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  {
    variant = "primary",
    size = "md",
    loading,
    disabled,
    leftIcon,
    rightIcon,
    children,
    className,
    type,
    ...rest
  },
  ref
) {
  const isDisabled = Boolean(disabled || loading);

  return (
    <button
      ref={ref}
      type={type ?? "button"}
      aria-busy={loading || undefined}
      disabled={isDisabled}
      className={cn(base, sizes[size], variants[variant], className)}
      {...rest}
    >
      {/* Left */}
      {loading ? (
        <Spinner className={cn(variant === "primary" || variant === "danger" ? "text-white" : "text-zinc-700")} />
      ) : leftIcon ? (
        <span className="inline-flex items-center">{leftIcon}</span>
      ) : null}

      {/* Label */}
      <span className={cn(loading && "opacity-90")}>{children}</span>

      {/* Right */}
      {!loading && rightIcon ? (
        <span className="inline-flex items-center">{rightIcon}</span>
      ) : null}
    </button>
  );
});
