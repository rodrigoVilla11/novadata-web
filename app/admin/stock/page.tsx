"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AdminProtected } from "@/components/AdminProtected";
import { useAuth } from "@/app/providers/AuthProvider";
import { apiFetchAuthed } from "@/lib/apiAuthed";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Field";
import {
  RefreshCcw,
  Search,
  Plus,
  ClipboardList,
  AlertTriangle,
  CheckCircle2,
  X,
  Trash2,
  Filter,
  Minus,
  PlusCircle,
  Copy,
  Wand2,
  Zap,
  Package,
  TrendingDown,
  ListChecks,
} from "lucide-react";

/* =============================================================================
 * Helpers
 * ========================================================================== */

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function todayKeyArgentina() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Cordoba",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function num(v: any) {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function fmtDateTime(v?: string | null) {
  if (!v) return "-";
  try {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return String(v);
    return new Intl.DateTimeFormat("es-AR", {
      timeZone: "America/Argentina/Cordoba",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return String(v);
  }
}

function shortId(id?: string | null) {
  if (!id) return "-";
  const s = String(id);
  if (s.length <= 10) return s;
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}

/* =============================================================================
 * Types
 * ========================================================================== */

type BalanceRow = {
  ingredientId: string;
  ingredientName?: string;
  unit: string;
  qty: number;
  reserved?: number;
  totalIn?: number;
  totalOut?: number;
  lastAt?: string | null;

  minQty?: number;
  idealQty?: number | null;
};

type MovementRow = {
  id: string;
  dateKey: string;
  type: string;
  reason: string;
  refType: string | null;
  refId: string | null;
  ingredientId: string | null;
  ingredientName?: string | null;
  unit: string;
  qty: number;
  qtyAfter?: number | null;
  note: string | null;
  createdByUserId?: string | null;
  createdAt: string;
  dedupeKey?: string | null;
};

type StockMovementType = "IN" | "OUT" | "ADJUST" | "REVERSAL";
type StockMovementReason =
  | "MANUAL"
  | "PURCHASE"
  | "SALE"
  | "WASTE"
  | "COUNT"
  | "TRANSFER"
  | "PRODUCTION";

/* =============================================================================
 * Small UI pieces
 * ========================================================================== */

function Pill({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "good" | "warn" | "bad";
}) {
  const cls =
    tone === "good"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : tone === "warn"
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : tone === "bad"
      ? "border-red-200 bg-red-50 text-red-700"
      : "border-neutral-200 bg-neutral-50 text-neutral-700";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs",
        cls
      )}
    >
      {children}
    </span>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  icon,
  tone = "neutral",
}: {
  title: string;
  value: React.ReactNode;
  subtitle?: React.ReactNode;
  icon: React.ReactNode;
  tone?: "neutral" | "good" | "warn" | "bad";
}) {
  const iconCls =
    tone === "good"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : tone === "warn"
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : tone === "bad"
      ? "border-red-200 bg-red-50 text-red-700"
      : "border-zinc-200 bg-zinc-50 text-zinc-700";

  return (
    <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-zinc-900">{title}</div>
          <div className="mt-2 text-3xl font-bold text-zinc-900">{value}</div>
          {subtitle ? (
            <div className="mt-1 text-sm text-zinc-600">{subtitle}</div>
          ) : null}
        </div>
        <div className={cn("rounded-2xl border p-2", iconCls)}>{icon}</div>
      </div>
    </div>
  );
}

function SectionTabs({
  value,
  onChange,
}: {
  value: "balances" | "movements";
  onChange: (v: "balances" | "movements") => void;
}) {
  return (
    <div className="inline-flex w-full sm:w-auto rounded-2xl border bg-white p-1">
      <button
        type="button"
        className={cn(
          "flex-1 sm:flex-none rounded-xl px-3 py-2 text-sm transition",
          value === "balances"
            ? "bg-neutral-900 text-white"
            : "hover:bg-neutral-100"
        )}
        onClick={() => onChange("balances")}
      >
        Balances
      </button>
      <button
        type="button"
        className={cn(
          "flex-1 sm:flex-none rounded-xl px-3 py-2 text-sm transition",
          value === "movements"
            ? "bg-neutral-900 text-white"
            : "hover:bg-neutral-100"
        )}
        onClick={() => onChange("movements")}
      >
        Movimientos
      </button>
    </div>
  );
}

function Modal({
  open,
  title,
  subtitle,
  children,
  onClose,
  footer,
  maxWidthClass = "max-w-4xl",
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onClose: () => void;
  footer?: React.ReactNode;
  maxWidthClass?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40">
      <div className="flex min-h-dvh items-end sm:items-center justify-center p-0 sm:p-4">
        <div
          className={cn(
            "w-full bg-white shadow-xl border border-zinc-200",
            "rounded-t-3xl sm:rounded-3xl",
            "max-h-dvh sm:max-h-[85vh] flex flex-col",
            maxWidthClass
          )}
        >
          <div className="sticky top-0 z-10 bg-white rounded-t-3xl sm:rounded-3xl border-b border-zinc-100 p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-base sm:text-lg font-semibold text-zinc-900">
                  {title}
                </div>
                {subtitle ? (
                  <div className="mt-1 text-sm text-zinc-500">{subtitle}</div>
                ) : null}
              </div>

              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-zinc-200 p-2 hover:bg-zinc-50"
                aria-label="Cerrar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="p-4 sm:p-5 overflow-auto">{children}</div>

          {footer ? (
            <div className="sticky bottom-0 bg-white border-t border-zinc-100 p-4 sm:p-5">
              {footer}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* =============================================================================
 * Page
 * ========================================================================== */

export default function AdminStockPage() {
  const { getAccessToken } = useAuth();

  const [tab, setTab] = useState<"balances" | "movements">("balances");

  // Balances
  const [balances, setBalances] = useState<BalanceRow[]>([]);
  const [balancesLoading, setBalancesLoading] = useState(false);
  const [balancesErr, setBalancesErr] = useState<string | null>(null);

  const [balanceSearch, setBalanceSearch] = useState("");
  const [onlyLow, setOnlyLow] = useState(false);
  const [sortBy, setSortBy] = useState<"name" | "qtyAsc" | "qtyDesc">("name");

  // Movements
  const [movements, setMovements] = useState<MovementRow[]>([]);
  const [movementsLoading, setMovementsLoading] = useState(false);
  const [movementsErr, setMovementsErr] = useState<string | null>(null);

  const [mDateKey, setMDateKey] = useState(todayKeyArgentina());
  const [mIngredientId, setMIngredientId] = useState("");
  const [mRefType, setMRefType] = useState("");
  const [mRefId, setMRefId] = useState("");
  const [mLimit, setMLimit] = useState(200);

  // Manual modal
  const [openManual, setOpenManual] = useState(false);
  const [manualSaving, setManualSaving] = useState(false);
  const [manualErr, setManualErr] = useState<string | null>(null);
  const [manualOk, setManualOk] = useState<string | null>(null);

  const [manualDateKey, setManualDateKey] = useState(todayKeyArgentina());
  const [manualType, setManualType] = useState<StockMovementType>("IN");
  const [manualReason, setManualReason] =
    useState<StockMovementReason>("MANUAL");
  const [manualRefType, setManualRefType] = useState<string>("TEST");
  const [manualRefId, setManualRefId] = useState<string>("");
  const [manualNote, setManualNote] = useState<string>("");

  type ManualItem = {
    ingredientId: string;
    qty: string;
    unit: string;
    note?: string;
  };
  const [manualItems, setManualItems] = useState<ManualItem[]>([
    { ingredientId: "", qty: "", unit: "KG" },
  ]);

  // Ingredient options (from balances)
  const ingredientOptions = useMemo(() => {
    const m = new Map<string, { id: string; name: string; unit: string }>();
    for (const b of balances) {
      m.set(b.ingredientId, {
        id: b.ingredientId,
        name: String(b.ingredientName ?? "—"),
        unit: String(b.unit ?? ""),
      });
    }
    return Array.from(m.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [balances]);

  const optionById = useMemo(() => {
    const m = new Map<string, { id: string; name: string; unit: string }>();
    for (const o of ingredientOptions) m.set(o.id, o);
    return m;
  }, [ingredientOptions]);

  async function fetchBalances() {
    if (!getAccessToken) return;
    setBalancesLoading(true);
    setBalancesErr(null);
    try {
      const data = await apiFetchAuthed(getAccessToken, `/stock/balances`);
      setBalances(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setBalancesErr(e?.message ?? "Error cargando balances");
      setBalances([]);
    } finally {
      setBalancesLoading(false);
    }
  }

  async function fetchMovements() {
    if (!getAccessToken) return;
    setMovementsLoading(true);
    setMovementsErr(null);
    try {
      const qs = new URLSearchParams();
      if (mDateKey.trim()) qs.set("dateKey", mDateKey.trim());
      if (mIngredientId.trim()) qs.set("ingredientId", mIngredientId.trim());
      if (mRefType.trim()) qs.set("refType", mRefType.trim());
      if (mRefId.trim()) qs.set("refId", mRefId.trim());
      if (mLimit) qs.set("limit", String(mLimit));

      const data = await apiFetchAuthed(
        getAccessToken,
        `/stock/movements?${qs.toString()}`
      );
      setMovements(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setMovementsErr(e?.message ?? "Error cargando movimientos");
      setMovements([]);
    } finally {
      setMovementsLoading(false);
    }
  }

  useEffect(() => {
    if (!getAccessToken) return;
    fetchBalances();
    fetchMovements();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getAccessToken]);

  const summary = useMemo(() => {
    const total = balances.length;
    const low = balances.filter((b) => num(b.qty) <= 0).length;
    const totalQty = balances.reduce((acc, b) => acc + num(b.qty), 0);
    return { total, low, totalQty };
  }, [balances]);

  const filteredBalances = useMemo(() => {
    const q = balanceSearch.trim().toLowerCase();
    let rows = balances;

    if (q) {
      rows = rows.filter((b) => {
        return (
          b.ingredientId.toLowerCase().includes(q) ||
          String(b.unit || "")
            .toLowerCase()
            .includes(q) ||
          String(b.ingredientName || "")
            .toLowerCase()
            .includes(q)
        );
      });
    }

    if (onlyLow) {
      rows = rows.filter((b) => num(b.qty) <= 0);
    }

    if (sortBy === "name") {
      rows = [...rows].sort((a, b) =>
        String(a.ingredientName ?? "").localeCompare(
          String(b.ingredientName ?? "")
        )
      );
    } else if (sortBy === "qtyAsc") {
      rows = [...rows].sort((a, b) => num(a.qty) - num(b.qty));
    } else if (sortBy === "qtyDesc") {
      rows = [...rows].sort((a, b) => num(b.qty) - num(a.qty));
    }

    return rows;
  }, [balances, balanceSearch, onlyLow, sortBy]);

  function openQuickManual(args: {
    type: StockMovementType;
    ingredientId: string;
    unit: string;
  }) {
    setManualErr(null);
    setManualOk(null);
    setManualType(args.type);
    setManualReason("MANUAL");
    setManualRefType("TEST");
    setManualRefId("");
    setManualNote("");

    const opt = optionById.get(args.ingredientId);
    setManualItems([
      {
        ingredientId: args.ingredientId,
        qty: "",
        unit: opt?.unit || args.unit || "KG",
      },
    ]);

    setOpenManual(true);
  }

  function addManualItem() {
    setManualItems((prev) => [
      ...prev,
      { ingredientId: "", qty: "", unit: "KG" },
    ]);
  }

  function duplicateManualItem(idx: number) {
    setManualItems((prev) => {
      const it = prev[idx];
      const copy: ManualItem = { ...it };
      return [...prev.slice(0, idx + 1), copy, ...prev.slice(idx + 1)];
    });
  }

  function removeManualItem(idx: number) {
    setManualItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function setManualItemIngredient(idx: number, ingredientId: string) {
    const opt = optionById.get(ingredientId);
    setManualItems((prev) =>
      prev.map((x, i) =>
        i === idx
          ? {
              ...x,
              ingredientId,
              unit: opt?.unit || x.unit || "KG",
            }
          : x
      )
    );
  }

  function bumpQty(idx: number, delta: number) {
    setManualItems((prev) =>
      prev.map((x, i) => {
        if (i !== idx) return x;
        const cur = Number(x.qty || 0);
        const next = cur + delta;
        return { ...x, qty: String(next) };
      })
    );
  }

  async function submitManual() {
    if (!getAccessToken) return;

    setManualErr(null);
    setManualOk(null);

    const items = manualItems
      .map((it) => ({
        ingredientId: it.ingredientId.trim(),
        qty: Number(it.qty),
        unit: it.unit.trim(),
        note: it.note?.trim() ? it.note.trim() : null,
      }))
      .filter((x) => x.ingredientId && Number.isFinite(x.qty));

    if (!manualDateKey.trim()) {
      setManualErr("dateKey requerido (YYYY-MM-DD)");
      return;
    }
    if (!items.length) {
      setManualErr("Agregá al menos 1 item con ingrediente y qty válido");
      return;
    }

    setManualSaving(true);
    try {
      const payload: any = {
        dateKey: manualDateKey.trim(),
        type: manualType,
        reason: manualReason,
        refType: manualRefType.trim() ? manualRefType.trim() : null,
        refId: manualRefId.trim() ? manualRefId.trim() : null,
        note: manualNote.trim() ? manualNote.trim() : null,
        items: items.map((x) => ({
          ingredientId: x.ingredientId,
          qty: x.qty,
          unit: x.unit || null,
          note: x.note ?? null,
        })),
      };

      const res = await apiFetchAuthed(getAccessToken, `/stock/manual`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setManualOk(`OK: created ${res ?? "?"}`);
      await fetchBalances();
      await fetchMovements();
      setManualItems((prev) => prev.map((x) => ({ ...x, qty: "" })));
    } catch (e: any) {
      setManualErr(e?.message ?? "Error aplicando movimiento");
    } finally {
      setManualSaving(false);
    }
  }

  function applyMovementFilterFromRow(m: MovementRow) {
    if (m.ingredientId) setMIngredientId(m.ingredientId);
    if (m.refType) setMRefType(m.refType);
    if (m.refId) setMRefId(m.refId);
    setTab("movements");
    fetchMovements();
  }

  const overallOk = !balancesLoading && !movementsLoading && summary.low === 0;

  return (
    <AdminProtected>
      <div className="mx-auto max-w-6xl p-4 space-y-6">
        {/* Header */}
        <div className="rounded-3xl border border-zinc-200 bg-white p-5 sm:p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className="h-10 w-10 rounded-2xl border border-zinc-200 bg-zinc-50 flex items-center justify-center">
                  <Package className="h-5 w-5 text-zinc-800" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-xl sm:text-2xl font-semibold text-zinc-900">
                      Stock
                    </h1>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-semibold border",
                        balancesLoading || movementsLoading
                          ? "bg-zinc-50 text-zinc-700 border-zinc-200"
                          : overallOk
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-amber-50 text-amber-900 border-amber-200"
                      )}
                    >
                      {balancesLoading || movementsLoading
                        ? "Cargando…"
                        : overallOk
                        ? "Todo OK"
                        : "Requiere atención"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-zinc-500">
                    Control rápido de inventario + auditoría de movimientos.
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-col sm:flex-row gap-2 sm:items-center">
                <SectionTabs value={tab} onChange={setTab} />

                <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-end w-full">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      fetchBalances();
                      fetchMovements();
                    }}
                    disabled={balancesLoading || movementsLoading}
                    className="w-full sm:w-auto"
                  >
                    <div className="inline-flex items-center gap-2">
                      <RefreshCcw className="h-4 w-4" />
                      Refrescar
                    </div>
                  </Button>

                  <Button
                    onClick={() => setOpenManual(true)}
                    className="w-full sm:w-auto"
                  >
                    <div className="inline-flex items-center gap-2">
                      <Plus className="h-4 w-4" />
                      Movimiento
                    </div>
                  </Button>
                </div>
              </div>
            </div>

            <div className="hidden lg:flex flex-col items-end text-xs text-zinc-500">
              <div>Tips</div>
              <div className="mt-1 max-w-sm text-right">
                Click en una fila de movimientos para setear filtros. En
                balances tenés IN/OUT/ADJUST rápidos por ingrediente.
              </div>
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <StatCard
            title="Ingredientes"
            value={summary.total}
            subtitle={
              <span className="inline-flex items-center gap-2">
                <Pill>{balancesLoading ? "Cargando…" : "Actualizado"}</Pill>
              </span>
            }
            icon={<ListChecks className="h-5 w-5" />}
            tone="neutral"
          />
          <StatCard
            title="Faltantes"
            value={summary.low}
            subtitle={
              <span className="inline-flex items-center gap-2">
                <Pill tone={summary.low > 0 ? "warn" : "good"}>
                  {summary.low > 0 ? "Revisar compras" : "OK"}
                </Pill>
              </span>
            }
            icon={<TrendingDown className="h-5 w-5" />}
            tone={summary.low > 0 ? "warn" : "good"}
          />
          <StatCard
            title="Suma Stock Actual"
            value={Math.round(summary.totalQty * 100) / 100}
            subtitle={<Pill>Referencia</Pill>}
            icon={<Package className="h-5 w-5" />}
            tone="neutral"
          />
        </div>

        {/* ========================= Balances ========================= */}
        {tab === "balances" ? (
          <>
            {/* Responsive toolbar */}
            <div className="rounded-3xl border border-zinc-200 bg-white p-4 sm:p-5 shadow-sm">
              <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto] lg:items-end">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                    <Field label="Buscar">
                      <Input
                        value={balanceSearch}
                        onChange={(e) => setBalanceSearch(e.target.value)}
                        placeholder="Ej: arroz / langostinos / KG"
                        className="pl-9"
                      />
                    </Field>
                  </div>

                  <Field label="Orden">
                    <Select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as any)}
                    >
                      <option value="name">Nombre</option>
                      <option value="qtyAsc">Stock ↑</option>
                      <option value="qtyDesc">Stock ↓</option>
                    </Select>
                  </Field>
                </div>

                <Button
                  variant={onlyLow ? "secondary" : "secondary"}
                  onClick={() => setOnlyLow((v) => !v)}
                  className={cn("w-full lg:w-auto", onlyLow ? "" : "")}
                  title="Mostrar faltantes"
                >
                  <div className="inline-flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    {onlyLow ? "Solo faltantes" : "Todos"}
                  </div>
                </Button>

                <Button
                  variant="secondary"
                  onClick={() => {
                    setBalanceSearch("");
                    setOnlyLow(false);
                    setSortBy("name");
                  }}
                  className="w-full lg:w-auto"
                  disabled={
                    !balanceSearch.trim() && !onlyLow && sortBy === "name"
                  }
                >
                  Limpiar
                </Button>
              </div>

              {balancesErr ? (
                <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    <span>{balancesErr}</span>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-left text-zinc-500 bg-zinc-50">
                    <tr className="border-b">
                      <th className="py-3 px-4">Ingrediente</th>
                      <th className="py-3 px-4">Unit</th>
                      <th className="py-3 px-4">OnHand</th>
                      <th className="py-3 px-4">Reserved</th>
                      <th className="py-3 px-4">IN</th>
                      <th className="py-3 px-4">OUT</th>
                      <th className="py-3 px-4">Last</th>
                      <th className="py-3 px-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {balancesLoading ? (
                      <tr>
                        <td className="py-4 px-4 text-zinc-500" colSpan={8}>
                          Cargando...
                        </td>
                      </tr>
                    ) : filteredBalances.length === 0 ? (
                      <tr>
                        <td className="py-4 px-4 text-zinc-500" colSpan={8}>
                          Sin datos
                        </td>
                      </tr>
                    ) : (
                      filteredBalances.map((b) => {
                        const q = num(b.qty);
                        const isLow = q <= 0;
                        const tone = isLow
                          ? "warn"
                          : q < 3
                          ? "default"
                          : "good";

                        return (
                          <tr
                            key={`${b.ingredientId}-${b.unit}`}
                            className="hover:bg-zinc-50"
                          >
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <div className="min-w-0">
                                  <div className="font-medium text-zinc-900 truncate">
                                    {b.ingredientName || "-"}
                                  </div>
                                  <div className="font-mono text-xs text-zinc-500">
                                    {shortId(b.ingredientId)}
                                  </div>
                                </div>
                                {isLow ? (
                                  <Pill tone="warn">Faltante</Pill>
                                ) : (
                                  <Pill tone={tone}>OK</Pill>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-4">{b.unit}</td>
                            <td className="py-3 px-4 font-semibold">{q}</td>
                            <td className="py-3 px-4">{num(b.reserved)}</td>
                            <td className="py-3 px-4">{num(b.totalIn)}</td>
                            <td className="py-3 px-4">{num(b.totalOut)}</td>
                            <td className="py-3 px-4">
                              {fmtDateTime(b.lastAt ?? null)}
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="secondary"
                                  onClick={() => {
                                    setMIngredientId(b.ingredientId);
                                    setTab("movements");
                                    fetchMovements();
                                  }}
                                  title="Ver movimientos"
                                >
                                  <ClipboardList className="h-4 w-4" />
                                </Button>

                                <Button
                                  variant="secondary"
                                  onClick={() =>
                                    openQuickManual({
                                      type: "IN",
                                      ingredientId: b.ingredientId,
                                      unit: b.unit,
                                    })
                                  }
                                  title="Ingreso rápido"
                                >
                                  <PlusCircle className="h-4 w-4" />
                                </Button>

                                <Button
                                  variant="secondary"
                                  onClick={() =>
                                    openQuickManual({
                                      type: "OUT",
                                      ingredientId: b.ingredientId,
                                      unit: b.unit,
                                    })
                                  }
                                  title="Egreso rápido"
                                >
                                  <Minus className="h-4 w-4" />
                                </Button>

                                <Button
                                  variant="secondary"
                                  onClick={() =>
                                    openQuickManual({
                                      type: "ADJUST",
                                      ingredientId: b.ingredientId,
                                      unit: b.unit,
                                    })
                                  }
                                  title="Ajuste"
                                >
                                  <Wand2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className="px-4 py-3 text-xs text-zinc-500">
                Tip: “Ver movimientos” filtra por ingrediente. IN/OUT/ADJUST
                abre el modal pre-cargado.
              </div>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-3">
              {balancesLoading ? (
                <div className="rounded-3xl border border-zinc-200 bg-white p-4 text-sm text-zinc-500">
                  Cargando...
                </div>
              ) : filteredBalances.length === 0 ? (
                <div className="rounded-3xl border border-zinc-200 bg-white p-4 text-sm text-zinc-500">
                  Sin datos
                </div>
              ) : (
                filteredBalances.map((b) => {
                  const q = num(b.qty);
                  const isLow = q <= 0;
                  const tone = isLow ? "warn" : q < 3 ? "default" : "good";

                  return (
                    <div
                      key={`${b.ingredientId}-${b.unit}`}
                      className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-semibold text-zinc-900 truncate">
                            {b.ingredientName || "-"}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <Pill tone={isLow ? "warn" : tone}>
                              {isLow ? "Faltante" : "OK"}
                            </Pill>
                            <span className="text-xs text-zinc-500">
                              {b.unit}
                            </span>
                            <span className="text-xs text-zinc-400">·</span>
                            <span className="text-xs text-zinc-500 font-mono">
                              {shortId(b.ingredientId)}
                            </span>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-xs text-zinc-500">OnHand</div>
                          <div
                            className={cn(
                              "text-2xl font-bold",
                              isLow ? "text-amber-800" : "text-zinc-900"
                            )}
                          >
                            {q}
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-2">
                          <div className="text-zinc-500">Reserved</div>
                          <div className="font-semibold text-zinc-900">
                            {num(b.reserved)}
                          </div>
                        </div>
                        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-2">
                          <div className="text-zinc-500">IN</div>
                          <div className="font-semibold text-zinc-900">
                            {num(b.totalIn)}
                          </div>
                        </div>
                        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-2">
                          <div className="text-zinc-500">OUT</div>
                          <div className="font-semibold text-zinc-900">
                            {num(b.totalOut)}
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 text-xs text-zinc-500">
                        Last: {fmtDateTime(b.lastAt ?? null)}
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <Button
                          variant="secondary"
                          className="w-full"
                          onClick={() => {
                            setMIngredientId(b.ingredientId);
                            setTab("movements");
                            fetchMovements();
                          }}
                          title="Ver movimientos"
                        >
                          <div className="inline-flex items-center gap-2">
                            <ClipboardList className="h-4 w-4" />
                            Movimientos
                          </div>
                        </Button>

                        <Button
                          variant="secondary"
                          className="w-full"
                          onClick={() =>
                            openQuickManual({
                              type: "ADJUST",
                              ingredientId: b.ingredientId,
                              unit: b.unit,
                            })
                          }
                          title="Ajuste"
                        >
                          <div className="inline-flex items-center gap-2">
                            <Wand2 className="h-4 w-4" />
                            Ajustar
                          </div>
                        </Button>

                        <Button
                          variant="secondary"
                          className="w-full"
                          onClick={() =>
                            openQuickManual({
                              type: "IN",
                              ingredientId: b.ingredientId,
                              unit: b.unit,
                            })
                          }
                          title="Ingreso rápido"
                        >
                          <div className="inline-flex items-center gap-2">
                            <PlusCircle className="h-4 w-4" />
                            IN
                          </div>
                        </Button>

                        <Button
                          variant="secondary"
                          className="w-full"
                          onClick={() =>
                            openQuickManual({
                              type: "OUT",
                              ingredientId: b.ingredientId,
                              unit: b.unit,
                            })
                          }
                          title="Egreso rápido"
                        >
                          <div className="inline-flex items-center gap-2">
                            <Minus className="h-4 w-4" />
                            OUT
                          </div>
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        ) : null}

        {/* ========================= Movements ========================= */}
        {tab === "movements" ? (
          <>
            {/* Filters (responsive) */}
            {/* Filters (UX friendly) */}
            <div className="rounded-3xl border border-zinc-200 bg-white p-4 sm:p-5 shadow-sm">
              {/* Title + quick help */}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-zinc-900">
                    Filtros
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">
                    Elegí una fecha y (si querés) un ingrediente. Tocá{" "}
                    <b>Buscar</b> para ver los movimientos.
                  </div>
                </div>

                {/* Quick actions */}
                <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-end">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      // Hoy (Argentina)
                      setMDateKey(todayKeyArgentina());
                      fetchMovements();
                    }}
                    disabled={movementsLoading}
                    className="w-full sm:w-auto"
                    title="Ver movimientos de hoy"
                  >
                    Hoy
                  </Button>

                  <Button
                    variant="secondary"
                    onClick={() => {
                      setMDateKey(todayKeyArgentina());
                      setMIngredientId("");
                      setMRefType("");
                      setMRefId("");
                      // si agregás type/reason abajo:
                      // setMType(""); setMReason("");
                      setMLimit(200);
                    }}
                    className="w-full sm:w-auto"
                    title="Limpiar filtros"
                    disabled={movementsLoading}
                  >
                    Limpiar
                  </Button>
                </div>
              </div>

              {/* Main filters */}
              <div className="mt-4 grid gap-3 lg:grid-cols-12 lg:items-end">
                <div className="lg:col-span-3">
                  <Field label="Fecha (YYYY-MM-DD)">
                    <Input
                      value={mDateKey}
                      onChange={(e) => setMDateKey(e.target.value)}
                      placeholder="2026-01-12"
                    />
                  </Field>
                </div>

                <div className="lg:col-span-6">
                  <Field label="Ingrediente (opcional)">
                    <Select
                      value={mIngredientId || ""}
                      onChange={(e) => setMIngredientId(e.target.value)}
                    >
                      <option value="">Todos los ingredientes</option>
                      {ingredientOptions.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>

                {/* BASIC extra filters (no-programmer friendly) */}
                <div className="lg:col-span-3">
                  <Field label="Tipo de movimiento">
                    {/* necesitás agregar: const [mType, setMType] = useState<string>(""); */}
                    <Select
                      value={
                        (typeof (globalThis as any).__noop === "undefined"
                          ? ""
                          : "") as any
                      }
                      onChange={(e) => {
                        // 👇 copiá y usá esto si agregás el estado mType arriba
                        // setMType(e.target.value);
                      }}
                      disabled
                      title="Activá este filtro si agregás el estado mType"
                    >
                      <option value="">Todos</option>
                      <option value="IN">Ingreso (IN)</option>
                      <option value="OUT">Egreso (OUT)</option>
                      <option value="ADJUST">Ajuste (ADJUST)</option>
                    </Select>
                  </Field>
                </div>

                <div className="lg:col-span-12 flex flex-col sm:flex-row gap-2 sm:justify-end">
                  <Button
                    variant="secondary"
                    onClick={fetchMovements}
                    disabled={movementsLoading}
                    className="w-full sm:w-auto"
                  >
                    <div className="inline-flex items-center gap-2">
                      <Search className="h-4 w-4" />
                      Buscar
                    </div>
                  </Button>

                  <Button
                    onClick={() => setOpenManual(true)}
                    disabled={movementsLoading}
                    className="w-full sm:w-auto"
                    title="Cargar un movimiento manual"
                  >
                    <div className="inline-flex items-center gap-2">
                      <Plus className="h-4 w-4" />
                      Nuevo movimiento
                    </div>
                  </Button>
                </div>
              </div>

              {/* Active filters summary (super útil para no técnicos) */}
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="text-xs text-zinc-500">Aplicando:</span>

                <span className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs text-zinc-700">
                  Fecha: <b className="font-semibold">{mDateKey || "—"}</b>
                </span>

                <span className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs text-zinc-700">
                  Ingrediente:{" "}
                  <b className="font-semibold">
                    {mIngredientId
                      ? ingredientOptions.find((x) => x.id === mIngredientId)
                          ?.name ?? "Seleccionado"
                      : "Todos"}
                  </b>
                </span>

                {mRefType || mRefId ? (
                  <span className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs text-zinc-700">
                    Referencia:{" "}
                    <b className="font-semibold">{mRefType || "—"}</b>{" "}
                    <span className="text-zinc-400">·</span>{" "}
                    <b className="font-semibold">
                      {mRefId ? shortId(mRefId) : "—"}
                    </b>
                  </span>
                ) : null}
              </div>

              {movementsErr ? (
                <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    <span>{movementsErr}</span>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Movements list */}
            {/* Desktop table */}
            <div className="hidden md:block overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-left text-zinc-500 bg-zinc-50">
                    <tr className="border-b">
                      <th className="py-3 px-4">Created</th>
                      <th className="py-3 px-4">Tipo</th>
                      <th className="py-3 px-4">Motivo</th>
                      <th className="py-3 px-4">Ingrediente</th>
                      <th className="py-3 px-4">Cantidad</th>
                      <th className="py-3 px-4">Luego</th>
                      <th className="py-3 px-4">Referencia</th>
                      <th className="py-3 px-4">Nota</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-zinc-100">
                    {movementsLoading ? (
                      <tr>
                        <td className="py-4 px-4 text-zinc-500" colSpan={8}>
                          Cargando...
                        </td>
                      </tr>
                    ) : movements.length === 0 ? (
                      <tr>
                        <td className="py-4 px-4 text-zinc-500" colSpan={8}>
                          Sin datos
                        </td>
                      </tr>
                    ) : (
                      movements.map((m) => (
                        <tr
                          key={m.id}
                          className="hover:bg-zinc-50 cursor-pointer"
                          onClick={() => applyMovementFilterFromRow(m)}
                          title="Click para filtrar por ingrediente/ref"
                        >
                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="text-zinc-900">
                              {fmtDateTime(m.createdAt)}
                            </div>
                            <div className="font-mono text-xs text-zinc-500">
                              {m.dateKey}
                            </div>
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap">
                            <Pill tone={m.qty < 0 ? "bad" : "good"}>
                              {m.type}
                            </Pill>
                          </td>

                          <td className="py-3 px-4">
                            <span className="text-zinc-900">{m.reason}</span>
                          </td>

                          <td className="py-3 px-4 min-w-65">
                            <div className="font-medium text-zinc-900 truncate">
                              {m.ingredientName || "-"}
                            </div>
                            <div className="font-mono text-xs text-zinc-500">
                              {shortId(m.ingredientId)}
                              {m.unit ? ` · ${m.unit}` : ""}
                            </div>
                          </td>

                          <td
                            className={cn(
                              "py-3 px-4 font-semibold whitespace-nowrap",
                              m.qty < 0 ? "text-red-600" : "text-emerald-600"
                            )}
                          >
                            {num(m.qty)}
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap">
                            {m.qtyAfter ?? "-"}
                          </td>

                          <td className="py-3 px-4">
                            {m.refType ? (
                              <div className="text-xs">
                                <div className="font-mono text-zinc-900">
                                  {m.refType}
                                </div>
                                <div className="font-mono text-zinc-500">
                                  {shortId(m.refId)}
                                </div>
                              </div>
                            ) : (
                              <span className="text-zinc-500">-</span>
                            )}
                          </td>

                          <td className="py-3 px-4 text-zinc-600 max-w-90">
                            <span className="line-clamp-2">
                              {m.note ?? "-"}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="px-4 py-3 text-xs text-zinc-500">
                Tip: hacé click en una fila para autocompletar filtros y
                analizar rápido.
              </div>
            </div>

            {/* Mobile / Tablet cards */}
            <div className="md:hidden space-y-2">
              {movementsLoading ? (
                <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-500">
                  Cargando...
                </div>
              ) : movements.length === 0 ? (
                <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-500">
                  Sin datos
                </div>
              ) : (
                movements.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => applyMovementFilterFromRow(m)}
                    className={cn(
                      "w-full text-left rounded-2xl border bg-white p-4 shadow-sm",
                      "border-zinc-200 hover:bg-zinc-50/60 active:bg-zinc-50",
                      "focus:outline-none focus:ring-4 focus:ring-emerald-100"
                    )}
                    title="Tocar para filtrar por ingrediente/ref"
                  >
                    {/* Top row: date + type + qty */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-zinc-900">
                          {m.ingredientName || "—"}
                        </div>
                        <div className="mt-0.5 text-xs text-zinc-500">
                          {fmtDateTime(m.createdAt)}{" "}
                          <span className="text-zinc-300">·</span>{" "}
                          <span className="font-mono">{m.dateKey}</span>
                        </div>
                      </div>

                      <div className="shrink-0 flex flex-col items-end gap-2">
                        <Pill tone={m.qty < 0 ? "bad" : "good"}>{m.type}</Pill>
                        <div
                          className={cn(
                            "text-sm font-bold",
                            m.qty < 0 ? "text-red-600" : "text-emerald-600"
                          )}
                        >
                          {num(m.qty)}
                          {m.unit ? ` ${m.unit}` : ""}
                        </div>
                      </div>
                    </div>

                    {/* Details */}
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-2">
                        <div className="text-zinc-500">Motivo</div>
                        <div className="mt-0.5 font-semibold text-zinc-900">
                          {m.reason}
                        </div>
                      </div>

                      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-2">
                        <div className="text-zinc-500">Luego</div>
                        <div className="mt-0.5 font-semibold text-zinc-900">
                          {m.qtyAfter ?? "-"}
                        </div>
                      </div>

                      <div className="col-span-2 rounded-xl border border-zinc-200 bg-zinc-50 p-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-zinc-500">Ingrediente ID</div>
                          <div className="font-mono text-zinc-600">
                            {shortId(m.ingredientId)}
                          </div>
                        </div>

                        {m.refType ? (
                          <div className="mt-2 flex items-center justify-between gap-2">
                            <div className="text-zinc-500">Referencia</div>
                            <div className="text-right">
                              <div className="font-mono text-zinc-900">
                                {m.refType}
                              </div>
                              <div className="font-mono text-zinc-500">
                                {shortId(m.refId)}
                              </div>
                            </div>
                          </div>
                        ) : null}

                        {m.note ? (
                          <div className="mt-2">
                            <div className="text-zinc-500">Nota</div>
                            <div className="mt-0.5 text-zinc-700 line-clamp-2">
                              {m.note}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-3 text-xs font-semibold text-zinc-700">
                      Tocar para filtrar y analizar →
                    </div>
                  </button>
                ))
              )}
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-3">
              {movementsLoading ? (
                <div className="rounded-3xl border border-zinc-200 bg-white p-4 text-sm text-zinc-500">
                  Cargando...
                </div>
              ) : movements.length === 0 ? (
                <div className="rounded-3xl border border-zinc-200 bg-white p-4 text-sm text-zinc-500">
                  Sin datos
                </div>
              ) : (
                movements.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className="w-full text-left rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm hover:bg-zinc-50"
                    onClick={() => applyMovementFilterFromRow(m)}
                    title="Tap para filtrar por ingrediente/ref"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Pill tone={m.qty < 0 ? "bad" : "good"}>
                            {m.type}
                          </Pill>
                          <span className="text-xs text-zinc-500">
                            {m.reason}
                          </span>
                        </div>

                        <div className="mt-2 font-semibold text-zinc-900 truncate">
                          {m.ingredientName || "-"}
                        </div>
                        <div className="mt-1 text-xs text-zinc-500 font-mono">
                          {shortId(m.ingredientId)}
                          {m.unit ? ` · ${m.unit}` : ""}
                        </div>

                        {m.refType ? (
                          <div className="mt-2 text-xs text-zinc-500 font-mono">
                            {m.refType} · {shortId(m.refId)}
                          </div>
                        ) : null}

                        <div className="mt-2 text-xs text-zinc-500">
                          {fmtDateTime(m.createdAt)} · {m.dateKey}
                        </div>

                        {m.note ? (
                          <div className="mt-2 text-xs text-zinc-600">
                            {m.note}
                          </div>
                        ) : null}
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-xs text-zinc-500">Qty</div>
                        <div
                          className={cn(
                            "text-2xl font-bold",
                            m.qty < 0 ? "text-red-600" : "text-emerald-600"
                          )}
                        >
                          {num(m.qty)}
                        </div>
                        <div className="mt-1 text-xs text-zinc-500">
                          After: {m.qtyAfter ?? "-"}
                        </div>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </>
        ) : null}

        {/* ========================= Manual Modal ========================= */}
        <Modal
          open={openManual}
          title="Movimiento manual"
          subtitle="Elegí ingredientes por nombre. Unit se autocompleta. Recomendado: refType+refId para idempotencia."
          onClose={() => setOpenManual(false)}
          footer={
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="text-xs text-zinc-500">
                Consejo: dejá el modal abierto y solo cambiá qty para cargar
                rápido.
              </div>
              <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
                <Button
                  variant="secondary"
                  onClick={() => setOpenManual(false)}
                  disabled={manualSaving}
                  className="w-full sm:w-auto"
                >
                  Cerrar
                </Button>
                <Button
                  onClick={submitManual}
                  disabled={manualSaving}
                  className="w-full sm:w-auto"
                >
                  {manualSaving ? "Aplicando..." : "Aplicar"}
                </Button>
              </div>
            </div>
          }
        >
          {manualErr ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                <span>{manualErr}</span>
              </div>
            </div>
          ) : null}

          {manualOk ? (
            <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                <span>{manualOk}</span>
              </div>
            </div>
          ) : null}

          <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-12 lg:items-end">
            <div className="lg:col-span-2">
              <Field label="dateKey">
                <Input
                  value={manualDateKey}
                  onChange={(e) => setManualDateKey(e.target.value)}
                />
              </Field>
            </div>

            <div className="lg:col-span-2">
              <Field label="type">
                <Select
                  value={manualType}
                  onChange={(e) => setManualType(e.target.value as any)}
                >
                  <option value="IN">IN</option>
                  <option value="OUT">OUT</option>
                  <option value="ADJUST">ADJUST</option>
                </Select>
              </Field>
            </div>

            <div className="lg:col-span-3">
              <Field label="reason">
                <Select
                  value={manualReason}
                  onChange={(e) => setManualReason(e.target.value as any)}
                >
                  <option value="MANUAL">MANUAL</option>
                  <option value="PURCHASE">PURCHASE</option>
                  <option value="WASTE">WASTE</option>
                  <option value="COUNT">COUNT</option>
                  <option value="TRANSFER">TRANSFER</option>
                  <option value="PRODUCTION">PRODUCTION</option>
                </Select>
              </Field>
            </div>

            <div className="lg:col-span-2">
              <Field label="refType (opcional)">
                <Input
                  value={manualRefType}
                  onChange={(e) => setManualRefType(e.target.value)}
                  placeholder="TEST"
                />
              </Field>
            </div>

            <div className="lg:col-span-3">
              <Field label="refId (opcional)">
                <Input
                  value={manualRefId}
                  onChange={(e) => setManualRefId(e.target.value)}
                  placeholder="65f..."
                />
              </Field>
            </div>

            <div className="lg:col-span-12">
              <Field label="note (opcional)">
                <Input
                  value={manualNote}
                  onChange={(e) => setManualNote(e.target.value)}
                  placeholder="observación"
                />
              </Field>
            </div>

            <div className="lg:col-span-12">
              <Button
                variant="secondary"
                onClick={() => {
                  const rnd = Math.random()
                    .toString(16)
                    .slice(2)
                    .padEnd(24, "0")
                    .slice(0, 24);
                  setManualRefType((v) => (v?.trim() ? v : "TEST"));
                  setManualRefId(rnd);
                }}
                title="Generar refId fake para test"
                className="w-full sm:w-auto"
              >
                <Wand2 className="mr-2 h-4 w-4" />
                RefId test
              </Button>
            </div>
          </div>

          {/* Items */}
          <div className="mt-4 rounded-3xl border border-zinc-200 p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="text-sm font-semibold text-zinc-900">Items</div>
                <Pill>
                  <Zap className="mr-1 h-3 w-3" />
                  rápido
                </Pill>
              </div>
              <Button variant="secondary" onClick={addManualItem}>
                <Plus className="mr-2 h-4 w-4" />
                Agregar
              </Button>
            </div>

            <div className="mt-3 space-y-2">
              {manualItems.map((it, idx) => {
                const opt = it.ingredientId
                  ? optionById.get(it.ingredientId)
                  : null;

                return (
                  <div
                    key={idx}
                    className="rounded-2xl border border-zinc-200 p-3"
                  >
                    <div className="grid grid-cols-1 gap-2 lg:grid-cols-12 lg:items-end">
                      <div className="lg:col-span-6">
                        <Field label={`Ingrediente #${idx + 1}`}>
                          <Select
                            value={it.ingredientId || ""}
                            onChange={(e) =>
                              setManualItemIngredient(idx, e.target.value)
                            }
                          >
                            <option value="">Seleccionar…</option>
                            {ingredientOptions.map((o) => (
                              <option key={o.id} value={o.id}>
                                {o.name}
                              </option>
                            ))}
                          </Select>
                        </Field>
                        {opt ? (
                          <div className="mt-1 text-xs text-zinc-500 font-mono">
                            {shortId(opt.id)} · unit {opt.unit}
                          </div>
                        ) : null}
                      </div>

                      <div className="lg:col-span-3">
                        <Field
                          label={
                            manualType === "ADJUST" ? "qty (signed)" : "qty"
                          }
                        >
                          <div className="flex gap-2">
                            <Input
                              value={it.qty}
                              onChange={(e) => {
                                const v = e.target.value;
                                setManualItems((prev) =>
                                  prev.map((x, i) =>
                                    i === idx ? { ...x, qty: v } : x
                                  )
                                );
                              }}
                              placeholder={
                                manualType === "ADJUST" ? "-1 / 1" : "ej 2"
                              }
                            />
                            <Button
                              variant="secondary"
                              onClick={() => bumpQty(idx, -1)}
                              title="-1"
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="secondary"
                              onClick={() => bumpQty(idx, 1)}
                              title="+1"
                            >
                              <PlusCircle className="h-4 w-4" />
                            </Button>
                          </div>
                        </Field>
                        <div className="mt-1 text-xs text-zinc-500">
                          Tip: IN/OUT acá es positivo. ADJUST puede ser
                          negativo.
                        </div>
                      </div>

                      <div className="lg:col-span-2">
                        <Field label="unit">
                          <Select
                            value={it.unit}
                            onChange={(e) => {
                              const v = e.target.value;
                              setManualItems((prev) =>
                                prev.map((x, i) =>
                                  i === idx ? { ...x, unit: v } : x
                                )
                              );
                            }}
                          >
                            <option value="KG">KG</option>
                            <option value="UNIT">UNIT</option>
                            <option value="L">L</option>
                          </Select>
                        </Field>
                      </div>

                      <div className="lg:col-span-1 flex justify-end gap-2">
                        <Button
                          variant="secondary"
                          onClick={() => duplicateManualItem(idx)}
                          title="Duplicar item"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() => removeManualItem(idx)}
                          disabled={manualItems.length <= 1}
                          title="Eliminar item"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-2 text-xs text-zinc-500">
              * IN/OUT: qty positivo. ADJUST: qty con signo (≠ 0).
            </div>
          </div>
        </Modal>
      </div>
    </AdminProtected>
  );
}
