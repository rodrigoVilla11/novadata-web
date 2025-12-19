"use client";

import React from "react";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  loading?: boolean;
};

const base =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed";

const styles: Record<string, string> = {
  primary: "bg-zinc-900 text-white hover:bg-zinc-800",
  secondary: "bg-zinc-100 text-zinc-900 hover:bg-zinc-200",
  ghost: "bg-transparent text-zinc-900 hover:bg-zinc-100",
  danger: "bg-red-600 text-white hover:bg-red-500",
};

export function Button({ variant = "primary", loading, children, ...rest }: Props) {
  return (
    <button className={`${base} ${styles[variant]}`} {...rest}>
      {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/60 border-t-white" />}
      {children}
    </button>
  );
}
