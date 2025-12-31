"use client";

import React from "react";
import { X } from "lucide-react";

export default function Modal({
  open,
  title,
  description,
  onClose,
  children,
  footer,
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden
      />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-lg rounded-3xl border border-zinc-200 bg-white shadow-xl">
          <div className="flex items-start justify-between gap-3 border-b border-zinc-100 p-5">
            <div>
              <div className="text-lg font-semibold text-zinc-900">{title}</div>
              {description ? (
                <div className="mt-1 text-sm text-zinc-500">{description}</div>
              ) : null}
            </div>
            <button
              type="button"
              className="rounded-xl border border-zinc-200 bg-white p-2 text-zinc-700 hover:bg-zinc-50"
              onClick={onClose}
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="p-5">{children}</div>

          {footer ? (
            <div className="flex flex-wrap justify-end gap-2 border-t border-zinc-100 p-5">
              {footer}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
