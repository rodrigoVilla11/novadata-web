"use client";

import React, { forwardRef, useId } from "react";

/* =============================================================================
 * Utils
 * ========================================================================== */

function cn(...parts: Array<string | undefined | null | false>) {
  return parts.filter(Boolean).join(" ");
}

/* =============================================================================
 * Field
 * - accesible (htmlFor / aria-describedby)
 * - soporta hint, required, disabled, actions (botón a la derecha del label)
 * - estilos mejores y consistentes
 * ========================================================================== */

export function Field({
  label,
  error,
  hint,
  required,
  disabled,
  actions,
  id,
  children,
}: {
  label: string;
  error?: string | null;
  hint?: string | null;
  required?: boolean;
  disabled?: boolean;
  actions?: React.ReactNode;
  id?: string;
  children: React.ReactNode;
}) {
  const autoId = useId();
  const fieldId = id ?? autoId;

  const hintId = `${fieldId}-hint`;
  const errId = `${fieldId}-error`;

  // Mejor práctica: si el child es un input/select real, le inyectamos id/aria.
  const child = React.isValidElement(children)
    ? React.cloneElement(children as any, {
        id: (children as any).props?.id ?? fieldId,
        "aria-invalid": Boolean(error) || undefined,
        "aria-describedby": cn(
          (children as any).props?.["aria-describedby"],
          hint ? hintId : null,
          error ? errId : null
        ) || undefined,
        disabled: disabled ?? (children as any).props?.disabled,
      })
    : children;

  return (
    <div className={cn("grid gap-1.5", disabled && "opacity-80")}>
      <div className="flex items-center justify-between gap-2">
        <label
          htmlFor={fieldId}
          className={cn(
            "text-sm font-medium text-zinc-700",
            disabled && "text-zinc-500"
          )}
        >
          {label}
          {required ? <span className="text-red-500"> *</span> : null}
        </label>

        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>

      {child}

      {hint ? (
        <p id={hintId} className="text-xs text-zinc-500">
          {hint}
        </p>
      ) : null}

      {error ? (
        <p id={errId} className="text-xs font-medium text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/* =============================================================================
 * Input
 * - soporta error/leftIcon/rightIcon
 * - respeta className del caller
 * - estilos mejorados (hover, disabled, error)
 * - forwardRef para forms
 * ========================================================================== */

export const Input = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & {
    error?: boolean;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
  }
>(function Input(
  { className, error, leftIcon, rightIcon, ...props },
  ref
) {
  return (
    <div className={cn("relative", props.disabled && "opacity-80")}>
      {leftIcon ? (
        <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">
          {leftIcon}
        </div>
      ) : null}

      <input
        ref={ref}
        {...props}
        className={cn(
          "w-full rounded-xl border bg-white px-3 py-2 text-sm text-zinc-900 outline-none",
          "border-zinc-200 hover:border-zinc-300",
          "focus:border-zinc-400 focus:ring-4 focus:ring-zinc-100",
          "placeholder:text-zinc-400",
          "disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-700",
          leftIcon ? "pl-10" : null,
          rightIcon ? "pr-10" : null,
          error
            ? "border-red-300 focus:border-red-400 focus:ring-red-100"
            : null,
          className
        )}
      />

      {rightIcon ? (
        <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400">
          {rightIcon}
        </div>
      ) : null}
    </div>
  );
});

/* =============================================================================
 * Select
 * - soporta error
 * - ícono de dropdown
 * - respeta className
 * ========================================================================== */

export const Select = forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement> & { error?: boolean }
>(function Select({ className, error, children, ...props }, ref) {
  return (
    <div className={cn("relative", props.disabled && "opacity-80")}>
      <select
        ref={ref}
        {...props}
        className={cn(
          "w-full appearance-none rounded-xl border bg-white px-3 py-2 pr-10 text-sm text-zinc-900 outline-none",
          "border-zinc-200 hover:border-zinc-300",
          "focus:border-zinc-400 focus:ring-4 focus:ring-zinc-100",
          "disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-700",
          error
            ? "border-red-300 focus:border-red-400 focus:ring-red-100"
            : null,
          className
        )}
      >
        {children}
      </select>

      {/* caret */}
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
      >
        <path
          fill="currentColor"
          d="M5.5 7.5a1 1 0 0 1 1.6-.8L10 9.2l2.9-2.5a1 1 0 1 1 1.2 1.6l-3.6 3.1a1.5 1.5 0 0 1-2 0L5.9 8.3a1 1 0 0 1-.4-.8Z"
        />
      </svg>
    </div>
  );
});
