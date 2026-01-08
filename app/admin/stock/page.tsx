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
  Boxes,
  AlertTriangle,
  CheckCircle2,
  X,
  Trash2,
  ArrowUpDown,
  Filter,
  Minus,
  PlusCircle,
  Copy,
  Wand2,
  Zap,
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

  // si en el futuro devolvés minQty/idealQty desde backend, se aprovecha:
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
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-xs", cls)}>
      {children}
    </span>
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
    <div className="inline-flex rounded-2xl border bg-white p-1">
      <button
        className={cn(
          "rounded-xl px-3 py-2 text-sm transition",
          value === "balances" ? "bg-neutral-900 text-white" : "hover:bg-neutral-100"
        )}
        onClick={() => onChange("balances")}
      >
        Balances
      </button>
      <button
        className={cn(
          "rounded-xl px-3 py-2 text-sm transition",
          value === "movements" ? "bg-neutral-900 text-white" : "hover:bg-neutral-100"
        )}
        onClick={() => onChange("movements")}
      >
        Movimientos
      </button>
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
  const [manualReason, setManualReason] = useState<StockMovementReason>("MANUAL");
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

      const data = await apiFetchAuthed(getAccessToken, `/stock/movements?${qs.toString()}`);
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
    const low = balances.filter((b) => num(b.qty) <= 0).length; // sin minQty todavía
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
          String(b.unit || "").toLowerCase().includes(q) ||
          String(b.ingredientName || "").toLowerCase().includes(q)
        );
      });
    }

    if (onlyLow) {
      rows = rows.filter((b) => num(b.qty) <= 0);
    }

    if (sortBy === "name") {
      rows = [...rows].sort((a, b) =>
        String(a.ingredientName ?? "").localeCompare(String(b.ingredientName ?? ""))
      );
    } else if (sortBy === "qtyAsc") {
      rows = [...rows].sort((a, b) => num(a.qty) - num(b.qty));
    } else if (sortBy === "qtyDesc") {
      rows = [...rows].sort((a, b) => num(b.qty) - num(a.qty));
    }

    return rows;
  }, [balances, balanceSearch, onlyLow, sortBy]);

  function openQuickManual(args: { type: StockMovementType; ingredientId: string; unit: string }) {
    setManualErr(null);
    setManualOk(null);
    setManualType(args.type);
    setManualReason("MANUAL");
    setManualRefType("TEST");
    setManualRefId("");
    setManualNote("");

    const opt = optionById.get(args.ingredientId);
    setManualItems([{ ingredientId: args.ingredientId, qty: "", unit: opt?.unit || args.unit || "KG" }]);

    setOpenManual(true);
  }

  function addManualItem() {
    setManualItems((prev) => [...prev, { ingredientId: "", qty: "", unit: "KG" }]);
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

      // UX: si fue ok, mantener modal abierto para seguir cargando (pero limpio qty)
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

  return (
    <AdminProtected>
      <div className="mx-auto max-w-6xl p-4 space-y-4">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold">Stock</h1>
            <p className="text-sm text-neutral-500">
              Control rápido de inventario + auditoría de movimientos.
            </p>
          </div>

          <div className="flex items-center gap-2 justify-between sm:justify-end">
            <SectionTabs value={tab} onChange={setTab} />

            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  fetchBalances();
                  fetchMovements();
                }}
                disabled={balancesLoading || movementsLoading}
              >
                <RefreshCcw className="mr-2 h-4 w-4" />
                Refrescar
              </Button>

              <Button onClick={() => setOpenManual(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Movimiento
              </Button>
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Card>
            <CardBody>
              <div className="text-sm text-neutral-500">Ingredientes</div>
              <div className="mt-1 text-2xl font-semibold">{summary.total}</div>
              <div className="mt-2">
                <Pill>{balancesLoading ? "Cargando…" : "Actualizado"}</Pill>
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <div className="text-sm text-neutral-500">Faltantes (qty ≤ 0)</div>
              <div className="mt-1 text-2xl font-semibold">{summary.low}</div>
              <div className="mt-2">
                <Pill tone={summary.low > 0 ? "warn" : "good"}>
                  {summary.low > 0 ? "Revisar compras" : "OK"}
                </Pill>
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <div className="text-sm text-neutral-500">Suma onHand (mix units)</div>
              <div className="mt-1 text-2xl font-semibold">{Math.round(summary.totalQty * 100) / 100}</div>
              <div className="mt-2">
                <Pill tone="default">Referencia</Pill>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* ========================= Balances ========================= */}
        {tab === "balances" ? (
          <Card>
            <CardHeader
              title="Balances"
              subtitle="OnHand en tiempo real (Ingredient.stock.onHand)"
              right={
                <div className="flex flex-wrap items-end justify-end gap-2">
                  <div className="w-[340px]">
                    <Field label="Buscar">
                      <Input
                        value={balanceSearch}
                        onChange={(e) => setBalanceSearch(e.target.value)}
                        placeholder="Ej: arroz / langostinos / KG"
                      />
                    </Field>
                  </div>

                  <div className="w-[180px]">
                    <Field label="Orden">
                      <Select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}>
                        <option value="name">Nombre</option>
                        <option value="qtyAsc">Stock ↑</option>
                        <option value="qtyDesc">Stock ↓</option>
                      </Select>
                    </Field>
                  </div>

                  <Button
                    onClick={() => setOnlyLow((v) => !v)}
                    title="Mostrar faltantes"
                  >
                    <Filter className="mr-2 h-4 w-4" />
                    {onlyLow ? "Solo faltantes" : "Todos"}
                  </Button>
                </div>
              }
            />

            <CardBody>
              {balancesErr ? (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    <span>{balancesErr}</span>
                  </div>
                </div>
              ) : null}

              <div className="overflow-x-auto mt-3">
                <table className="min-w-full text-sm">
                  <thead className="text-left text-neutral-500">
                    <tr className="border-b">
                      <th className="py-2 pr-3">Ingrediente</th>
                      <th className="py-2 pr-3">Unit</th>
                      <th className="py-2 pr-3">OnHand</th>
                      <th className="py-2 pr-3">Reserved</th>
                      <th className="py-2 pr-3">IN</th>
                      <th className="py-2 pr-3">OUT</th>
                      <th className="py-2 pr-3">Last</th>
                      <th className="py-2 pr-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {balancesLoading ? (
                      <tr>
                        <td className="py-3 text-neutral-500" colSpan={8}>
                          Cargando...
                        </td>
                      </tr>
                    ) : filteredBalances.length === 0 ? (
                      <tr>
                        <td className="py-3 text-neutral-500" colSpan={8}>
                          Sin datos
                        </td>
                      </tr>
                    ) : (
                      filteredBalances.map((b) => {
                        const q = num(b.qty);
                        const tone = q <= 0 ? "warn" : q < 3 ? "default" : "good";

                        return (
                          <tr key={`${b.ingredientId}-${b.unit}`} className="border-b hover:bg-neutral-50">
                            <td className="py-2 pr-3">
                              <div className="flex items-center gap-2">
                                <div className="min-w-0">
                                  <div className="font-medium truncate">{b.ingredientName || "-"}</div>
                                  <div className="font-mono text-xs text-neutral-500">
                                    {shortId(b.ingredientId)}
                                  </div>
                                </div>
                                {q <= 0 ? <Pill tone="warn">Faltante</Pill> : <Pill tone={tone}>OK</Pill>}
                              </div>
                            </td>
                            <td className="py-2 pr-3">{b.unit}</td>
                            <td className="py-2 pr-3 font-semibold">{q}</td>
                            <td className="py-2 pr-3">{num(b.reserved)}</td>
                            <td className="py-2 pr-3">{num(b.totalIn)}</td>
                            <td className="py-2 pr-3">{num(b.totalOut)}</td>
                            <td className="py-2 pr-3">{fmtDateTime(b.lastAt ?? null)}</td>
                            <td className="py-2 pr-3">
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
                                  onClick={() => openQuickManual({ type: "IN", ingredientId: b.ingredientId, unit: b.unit })}
                                  title="Ingreso rápido"
                                >
                                  <PlusCircle className="h-4 w-4" />
                                </Button>

                                <Button
                                  variant="secondary"
                                  onClick={() => openQuickManual({ type: "OUT", ingredientId: b.ingredientId, unit: b.unit })}
                                  title="Egreso rápido"
                                >
                                  <Minus className="h-4 w-4" />
                                </Button>

                                <Button
                                  variant="secondary"
                                  onClick={() => openQuickManual({ type: "ADJUST", ingredientId: b.ingredientId, unit: b.unit })}
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

              <div className="mt-3 text-xs text-neutral-500">
                Tip: tocá “Ver movimientos” para filtrar por ingrediente. Con IN/OUT/ADJUST abrís el modal pre-cargado.
              </div>
            </CardBody>
          </Card>
        ) : null}

        {/* ========================= Movements ========================= */}
        {tab === "movements" ? (
          <Card>
            <CardHeader
              title="Movimientos"
              subtitle="Auditoría (clic en una fila para setear filtros)"
              right={
                <div className="flex flex-wrap items-end justify-end gap-2">
                  <div className="w-[160px]">
                    <Field label="dateKey">
                      <Input value={mDateKey} onChange={(e) => setMDateKey(e.target.value)} />
                    </Field>
                  </div>

                  <div className="w-[320px]">
                    <Field label="Ingrediente">
                      <Select
                        value={mIngredientId || ""}
                        onChange={(e) => setMIngredientId(e.target.value)}
                      >
                        <option value="">Todos</option>
                        {ingredientOptions.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.name}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  </div>

                  <div className="w-[160px]">
                    <Field label="refType">
                      <Input value={mRefType} onChange={(e) => setMRefType(e.target.value)} placeholder="SALE / TEST" />
                    </Field>
                  </div>

                  <div className="w-[220px]">
                    <Field label="refId">
                      <Input value={mRefId} onChange={(e) => setMRefId(e.target.value)} placeholder="ObjectId" />
                    </Field>
                  </div>

                  <div className="w-[120px]">
                    <Field label="limit">
                      <Input
                        value={String(mLimit)}
                        onChange={(e) => setMLimit(clamp(Number(e.target.value || 0), 1, 500))}
                      />
                    </Field>
                  </div>

                  <Button variant="secondary" onClick={fetchMovements} disabled={movementsLoading}>
                    <Search className="mr-2 h-4 w-4" />
                    Buscar
                  </Button>

                  <Button
                    variant="secondary"
                    onClick={() => {
                      setMIngredientId("");
                      setMRefType("");
                      setMRefId("");
                    }}
                    title="Limpiar filtros"
                  >
                    <ArrowUpDown className="mr-2 h-4 w-4" />
                    Reset
                  </Button>
                </div>
              }
            />

            <CardBody>
              {movementsErr ? (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    <span>{movementsErr}</span>
                  </div>
                </div>
              ) : null}

              <div className="overflow-x-auto mt-3">
                <table className="min-w-full text-sm">
                  <thead className="text-left text-neutral-500">
                    <tr className="border-b">
                      <th className="py-2 pr-3">Created</th>
                      <th className="py-2 pr-3">Type</th>
                      <th className="py-2 pr-3">Reason</th>
                      <th className="py-2 pr-3">Ingrediente</th>
                      <th className="py-2 pr-3">Qty</th>
                      <th className="py-2 pr-3">After</th>
                      <th className="py-2 pr-3">Ref</th>
                      <th className="py-2 pr-3">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movementsLoading ? (
                      <tr>
                        <td className="py-3 text-neutral-500" colSpan={8}>
                          Cargando...
                        </td>
                      </tr>
                    ) : movements.length === 0 ? (
                      <tr>
                        <td className="py-3 text-neutral-500" colSpan={8}>
                          Sin datos
                        </td>
                      </tr>
                    ) : (
                      movements.map((m) => (
                        <tr
                          key={m.id}
                          className="border-b hover:bg-neutral-50 cursor-pointer"
                          onClick={() => applyMovementFilterFromRow(m)}
                          title="Click para filtrar por ingrediente/ref"
                        >
                          <td className="py-2 pr-3">
                            <div>{fmtDateTime(m.createdAt)}</div>
                            <div className="font-mono text-xs text-neutral-500">{m.dateKey}</div>
                          </td>
                          <td className="py-2 pr-3">
                            <Pill tone={m.qty < 0 ? "bad" : "good"}>{m.type}</Pill>
                          </td>
                          <td className="py-2 pr-3">{m.reason}</td>

                          <td className="py-2 pr-3">
                            <div className="font-medium">{m.ingredientName || "-"}</div>
                            <div className="font-mono text-xs text-neutral-500">
                              {shortId(m.ingredientId)}
                              {m.unit ? ` · ${m.unit}` : ""}
                            </div>
                          </td>

                          <td className={cn("py-2 pr-3 font-semibold", m.qty < 0 ? "text-red-600" : "text-emerald-600")}>
                            {num(m.qty)}
                          </td>
                          <td className="py-2 pr-3">{m.qtyAfter ?? "-"}</td>

                          <td className="py-2 pr-3">
                            {m.refType ? (
                              <div className="text-xs">
                                <div className="font-mono">{m.refType}</div>
                                <div className="font-mono text-neutral-500">{shortId(m.refId)}</div>
                              </div>
                            ) : (
                              "-"
                            )}
                          </td>

                          <td className="py-2 pr-3 text-neutral-600">{m.note ?? "-"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-3 text-xs text-neutral-500">
                Click en una fila: setea filtros (ingredient/ref) y te deja listo para investigar rápido.
              </div>
            </CardBody>
          </Card>
        ) : null}

        {/* ========================= Manual Modal ========================= */}
        {openManual ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-4xl rounded-2xl border bg-white shadow-lg">
              <div className="flex items-center justify-between border-b p-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="text-base font-semibold">Movimiento manual</div>
                    <Pill tone="default">
                      <Zap className="mr-1 h-3 w-3" />
                      Rápido
                    </Pill>
                  </div>
                  <div className="text-sm text-neutral-500">
                    Elegí ingredientes por nombre. Unit se autocompleta. Recomendado: refType+refId para idempotencia.
                  </div>
                </div>

                <button
                  className="rounded-lg p-2 hover:bg-neutral-100"
                  onClick={() => setOpenManual(false)}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-4 space-y-3">
                {manualErr ? (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      <span>{manualErr}</span>
                    </div>
                  </div>
                ) : null}

                {manualOk ? (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>{manualOk}</span>
                    </div>
                  </div>
                ) : null}

                <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
                  <Field label="dateKey">
                    <Input value={manualDateKey} onChange={(e) => setManualDateKey(e.target.value)} />
                  </Field>

                  <Field label="type">
                    <Select value={manualType} onChange={(e) => setManualType(e.target.value as any)}>
                      <option value="IN">IN</option>
                      <option value="OUT">OUT</option>
                      <option value="ADJUST">ADJUST</option>
                    </Select>
                  </Field>

                  <Field label="reason">
                    <Select value={manualReason} onChange={(e) => setManualReason(e.target.value as any)}>
                      <option value="MANUAL">MANUAL</option>
                      <option value="PURCHASE">PURCHASE</option>
                      <option value="WASTE">WASTE</option>
                      <option value="COUNT">COUNT</option>
                      <option value="TRANSFER">TRANSFER</option>
                      <option value="PRODUCTION">PRODUCTION</option>
                    </Select>
                  </Field>

                  <Field label="refType (opcional)">
                    <Input value={manualRefType} onChange={(e) => setManualRefType(e.target.value)} placeholder="TEST" />
                  </Field>

                  <Field label="refId (ObjectId, opcional)">
                    <Input value={manualRefId} onChange={(e) => setManualRefId(e.target.value)} placeholder="65f..." />
                  </Field>

                  <div className="flex items-end">
                    <Button
                      variant="secondary"
                      onClick={() => {
                        // mini helper: setea refId “random” para test rápido si querés
                        // (solo UI, vos podés borrarlo)
                        const rnd = Math.random().toString(16).slice(2).padEnd(24, "0").slice(0, 24);
                        setManualRefType((v) => (v?.trim() ? v : "TEST"));
                        setManualRefId(rnd);
                      }}
                      title="Generar refId fake para probar idempotencia (no recomendado en prod)"
                      className="w-full"
                    >
                      <Wand2 className="mr-2 h-4 w-4" />
                      RefId test
                    </Button>
                  </div>
                </div>

                <Field label="note (opcional)">
                  <Input value={manualNote} onChange={(e) => setManualNote(e.target.value)} placeholder="observación" />
                </Field>

                {/* Items */}
                <div className="rounded-2xl border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold">Items</div>
                    <div className="flex gap-2">
                      <Button variant="secondary" onClick={addManualItem}>
                        <Plus className="mr-2 h-4 w-4" />
                        Agregar
                      </Button>
                    </div>
                  </div>

                  <div className="mt-3 space-y-2">
                    {manualItems.map((it, idx) => {
                      const opt = it.ingredientId ? optionById.get(it.ingredientId) : null;

                      return (
                        <div
                          key={idx}
                          className="rounded-xl border p-3"
                        >
                          <div className="grid grid-cols-1 gap-2 md:grid-cols-12 items-end">
                            <div className="md:col-span-6">
                              <Field label={`Ingrediente #${idx + 1}`}>
                                <Select
                                  value={it.ingredientId || ""}
                                  onChange={(e) => setManualItemIngredient(idx, e.target.value)}
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
                                <div className="mt-1 text-xs text-neutral-500 font-mono">
                                  {shortId(opt.id)} · unit {opt.unit}
                                </div>
                              ) : null}
                            </div>

                            <div className="md:col-span-3">
                              <Field label={manualType === "ADJUST" ? "qty (signed)" : "qty"}>
                                <div className="flex gap-2">
                                  <Input
                                    value={it.qty}
                                    onChange={(e) => {
                                      const v = e.target.value;
                                      setManualItems((prev) => prev.map((x, i) => (i === idx ? { ...x, qty: v } : x)));
                                    }}
                                    placeholder={manualType === "ADJUST" ? "-1 / 1" : "ej 2"}
                                  />
                                  <Button
                                    variant="secondary"
                                    onClick={() => bumpQty(idx, manualType === "ADJUST" ? -1 : -1)}
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
                              <div className="mt-1 text-xs text-neutral-500">
                                Tip: OUT es negativo en backend; acá ingresás positivo.
                              </div>
                            </div>

                            <div className="md:col-span-2">
                              <Field label="unit">
                                <Select
                                  value={it.unit}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    setManualItems((prev) => prev.map((x, i) => (i === idx ? { ...x, unit: v } : x)));
                                  }}
                                >
                                  <option value="KG">KG</option>
                                  <option value="UNIT">UNIT</option>
                                  <option value="L">L</option>
                                </Select>
                              </Field>
                            </div>

                            <div className="md:col-span-1 flex justify-end gap-2">
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

                  <div className="mt-2 text-xs text-neutral-500">
                    * IN/OUT: qty positivo. ADJUST: qty con signo (≠ 0).
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 border-t p-4">
                <div className="text-xs text-neutral-500">
                  Consejo: si vas a aplicar varias veces, dejá el modal abierto; solo cambia qty y “Aplicar”.
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => setOpenManual(false)} disabled={manualSaving}>
                    Cerrar
                  </Button>
                  <Button onClick={submitManual} disabled={manualSaving}>
                    {manualSaving ? "Aplicando..." : "Aplicar"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </AdminProtected>
  );
}
