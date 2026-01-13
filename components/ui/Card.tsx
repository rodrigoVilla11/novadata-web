"use client";

import React from "react";

/* =============================================================================
 * Utils
 * ========================================================================== */

function cn(...parts: Array<string | undefined | null | false>) {
  return parts.filter(Boolean).join(" ");
}

/* =============================================================================
 * Card
 * - variantes (default / subtle / danger)
 * - estado disabled
 * - hover opcional
 * ========================================================================== */

export function Card({
  children,
  variant = "default",
  disabled,
  hoverable,
  className,
}: {
  children: React.ReactNode;
  variant?: "default" | "subtle" | "danger";
  disabled?: boolean;
  hoverable?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border bg-white shadow-sm transition",
        variant === "default" && "border-zinc-200",
        variant === "subtle" && "border-zinc-100 bg-zinc-50",
        variant === "danger" && "border-red-200 bg-red-50",
        hoverable && "hover:shadow-md",
        disabled && "opacity-70 pointer-events-none",
        className
      )}
    >
      {children}
    </div>
  );
}

/* =============================================================================
 * CardHeader
 * - soporta subtitle, description, badge
 * - right (acciones)
 * - compacto opcional
 * ========================================================================== */

export function CardHeader({
  title,
  subtitle,
  description,
  right,
  badge,
  compact,
}: {
  title: string;
  subtitle?: string;
  description?: string;
  badge?: React.ReactNode;
  right?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4 border-b border-zinc-100",
        compact ? "px-4 py-3" : "px-5 py-4"
      )}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-zinc-900 truncate">
            {title}
          </h2>
          {badge}
        </div>

        {subtitle && (
          <p className="mt-0.5 text-sm font-medium text-zinc-600">
            {subtitle}
          </p>
        )}

        {description && (
          <p className="mt-1 text-sm text-zinc-500 max-w-prose">
            {description}
          </p>
        )}
      </div>

      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}

/* =============================================================================
 * CardBody
 * - tamaños (default / compact)
 * ========================================================================== */

export function CardBody({
  children,
  compact,
  className,
}: {
  children: React.ReactNode;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        compact ? "px-4 py-3" : "px-5 py-5",
        className
      )}
    >
      {children}
    </div>
  );
}

/* =============================================================================
 * CardFooter (nuevo)
 * - acciones alineadas
 * ========================================================================== */

export function CardFooter({
  children,
  align = "right",
  compact,
}: {
  children: React.ReactNode;
  align?: "left" | "right" | "between";
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex gap-2 border-t border-zinc-100",
        compact ? "px-4 py-3" : "px-5 py-4",
        align === "left" && "justify-start",
        align === "right" && "justify-end",
        align === "between" && "justify-between"
      )}
    >
      {children}
    </div>
  );
}
