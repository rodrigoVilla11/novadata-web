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
  AlertTriangle,
  CheckCircle2,
  Package,
  SlidersHorizontal,
  ShoppingCart,
  X,
  ScrollText,
} from "lucide-react";

/* =============================================================================
 * Endpoints reales (según tu controller)
 * ========================================================================== */
const API_INGREDIENTS = "/ingredients";
const API_SUPPLIERS = "/suppliers";

const API_STOCK_MANUAL = "/stock/manual"; // ✅ tu controller
const API_STOCK_MOVEMENTS = "/stock/movements"; // ✅ auditoría
const API_PURCHASE_ORDERS = "/purchase-orders"; // ✅ tu controller

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

function money(n: number, currency: "ARS" | "USD" = "ARS") {
  const v = Number(n ?? 0) || 0;
  try {
    return v.toLocaleString("es-AR", { style: "currency", currency });
  } catch {
    return v.toLocaleString("es-AR");
  }
}

function Notice({
  tone,
  children,
}: {
  tone: "error" | "ok" | "warn";
  children: React.ReactNode;
}) {
  const map = {
    error: "border-red-200 bg-red-50 text-red-700",
    ok: "border-emerald-200 bg-emerald-50 text-emerald-700",
    warn: "border-amber-200 bg-amber-50 text-amber-800",
  } as const;

  const Icon =
    tone === "ok"
      ? CheckCircle2
      : tone === "warn"
      ? AlertTriangle
      : AlertTriangle;

  return (
    <div className={cn("rounded-2xl border px-3 py-2 text-sm", map[tone])}>
      <span className="inline-flex items-center gap-2">
        <Icon className="h-4 w-4" />
        {children}
      </span>
    </div>
  );
}

/* =============================================================================
 * Types
 * ========================================================================== */
type Supplier = { id: string; name: string; isActive: boolean };

type IngredientRow = {
  id: string;
  name: string;
  displayName?: string | null;
  baseUnit?: string | null;
  supplierId?: string | null;
  name_for_supplier?: string | null;
  isActive?: boolean;

  stock?: {
    trackStock?: boolean;
    onHand?: number;
    reserved?: number;
    minQty?: number;
    idealQty?: number | null;
    storageLocation?: string | null;
  };

  cost?: {
    lastCost?: number;
    avgCost?: number;
    currency?: "ARS" | "USD";
  };
};

type ManualMode = "IN" | "OUT" | "ADJUST";

/** OJO: names deben coincidir con tus enums en backend */
type StockMovementType = "IN" | "OUT" | "ADJUST"; // si tu enum es otro, cambiá acá
type StockMovementReason = "MANUAL" | "PURCHASE" | "WASTE" | "ADJUSTMENT"; // idem

type StockMovementRow = {
  id: string;
  dateKey: string;
  ingredientId: string;
  qty: number;
  qtyAfter?: number;
  unit?: string;
  type?: string;
  reason?: string;
  note?: string | null;
  createdAt?: string;
};

type POCreatePayload = {
  supplierId: string;
  notes?: string | null;
  items: Array<{ ingredientId: string; qty: number }>;
};

function prettyName(i: IngredientRow) {
  return String(i.displayName || i.name || "").trim() || "—";
}

function StockPill({ onHand, minQty }: { onHand: number; minQty: number }) {
  const low = minQty > 0 && onHand < minQty;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold border",
        low
          ? "bg-red-50 text-red-700 border-red-200"
          : "bg-emerald-50 text-emerald-700 border-emerald-200"
      )}
    >
      {low ? "BAJO" : "OK"}
    </span>
  );
}

/* =============================================================================
 * Movements Modal (auditoría)
 * ========================================================================== */
function MovementsModal({
  open,
  onClose,
  ingredient,
  getAccessToken,
}: {
  open: boolean;
  onClose: () => void;
  ingredient: IngredientRow | null;
  getAccessToken: any;
}) {
  const [rows, setRows] = useState<StockMovementRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    if (!ingredient) return;
    setLoading(true);
    setErr(null);
    try {
      const data = await apiFetchAuthed<StockMovementRow[]>(
        getAccessToken,
        `${API_STOCK_MOVEMENTS}?ingredientId=${encodeURIComponent(
          ingredient.id
        )}&limit=50`
      );
      setRows(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setErr(e?.message || "Error cargando movimientos");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    setRows([]);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ingredient?.id]);

  if (!open || !ingredient) return null;

  return (
    <div className="fixed inset-0 z-[75]">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute left-1/2 top-10 w-[min(980px,92vw)] -translate-x-1/2 rounded-3xl border border-zinc-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <div className="text-xs text-zinc-500">Movimientos de stock</div>
            <div className="text-lg font-semibold text-zinc-900">
              {prettyName(ingredient)}{" "}
              <span className="text-sm font-normal text-zinc-500">
                ({ingredient.id.slice(-6)})
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={load} disabled={loading}>
              <span className="inline-flex items-center gap-2">
                <RefreshCcw className="h-4 w-4" />
                Actualizar
              </span>
            </Button>
            <Button variant="secondary" onClick={onClose}>
              Cerrar
            </Button>
          </div>
        </div>

        <div className="p-5">
          {err && <Notice tone="error">{err}</Notice>}

          <div className="mt-3 overflow-hidden rounded-2xl border border-zinc-200">
            <table className="min-w-full">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-zinc-500">
                    Fecha
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-zinc-500">
                    Tipo / Razón
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-zinc-500">
                    Qty
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-zinc-500">
                    Stock después
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-zinc-500">
                    Nota
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {loading && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-sm text-zinc-500">
                      Cargando…
                    </td>
                  </tr>
                )}
                {!loading && rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-sm text-zinc-500">
                      Sin movimientos.
                    </td>
                  </tr>
                )}
                {!loading &&
                  rows.map((r) => (
                    <tr key={r.id}>
                      <td className="px-4 py-2 text-sm text-zinc-700">
                        <div className="font-semibold">{r.dateKey}</div>
                        {r.createdAt && (
                          <div className="text-xs text-zinc-500">
                            {new Date(r.createdAt).toLocaleString("es-AR")}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2 text-sm text-zinc-700">
                        <div className="font-semibold">
                          {r.type || "—"} / {r.reason || "—"}
                        </div>
                        <div className="text-xs text-zinc-500">
                          {r.unit || "—"}
                        </div>
                      </td>
                      <td className="px-4 py-2 text-sm">
                        <span
                          className={cn(
                            "font-semibold",
                            r.qty < 0 ? "text-red-700" : "text-emerald-700"
                          )}
                        >
                          {r.qty}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-sm text-zinc-700">
                        {r.qtyAfter ?? "—"}
                      </td>
                      <td className="px-4 py-2 text-sm text-zinc-700">
                        {r.note ?? "—"}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 text-xs text-zinc-500">
            Endpoint: GET /stock/movements?ingredientId=...&limit=50
          </div>
        </div>
      </div>
    </div>
  );
}

/* =============================================================================
 * Movement Modal (manual => /stock/manual)
 * ========================================================================== */
function ManualMoveModal({
  open,
  onClose,
  ingredient,
  suppliersById,
  getAccessToken,
  onApplied,
}: {
  open: boolean;
  onClose: () => void;
  ingredient: IngredientRow | null;
  suppliersById: Record<string, Supplier>;
  getAccessToken: any;
  onApplied: () => void;
}) {
  const [mode, setMode] = useState<ManualMode>("IN");
  const [reason, setReason] = useState<StockMovementReason>("MANUAL");
  const [qty, setQty] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [dateKey, setDateKey] = useState<string>(todayKeyArgentina());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setMode("IN");
    setReason("MANUAL");
    setQty("");
    setNote("");
    setDateKey(todayKeyArgentina());
    setErr(null);
  }, [open]);

  if (!open || !ingredient) return null;

  const supplierName =
    ingredient.supplierId && suppliersById[ingredient.supplierId]
      ? suppliersById[ingredient.supplierId].name
      : "—";

  const onHand = num(ingredient.stock?.onHand);
  const minQty = num(ingredient.stock?.minQty);

  function mapType(m: ManualMode): StockMovementType {
    if (m === "IN") return "IN";
    if (m === "OUT") return "OUT";
    return "ADJUST";
  }

  async function apply() {
    setErr(null);

    const q = Number(qty);
    if (!Number.isFinite(q) || q === 0) {
      setErr("Ingresá una cantidad distinta de 0");
      return;
    }

    let qtyDelta = q;
    if (mode === "IN") qtyDelta = Math.abs(q);
    if (mode === "OUT") qtyDelta = -Math.abs(q);
    if (mode === "ADJUST") qtyDelta = q;

    setBusy(true);
    try {
      await apiFetchAuthed(getAccessToken, API_STOCK_MANUAL, {
        method: "POST",
        body: JSON.stringify({
          dateKey,
          type: mapType(mode),
          reason,
          refType: "MANUAL_UI",
          refId: null,
          items: [
            {
              ingredientId: ingredient?.id,
              unit: ingredient?.baseUnit ?? "UNIT",
              qtyDelta,
            },
          ],
          note: note.trim() || null,
        }),
      });

      onApplied();
      onClose();
    } catch (e: any) {
      setErr(e?.message || "Error aplicando movimiento");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80]">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute left-1/2 top-10 w-[min(900px,92vw)] -translate-x-1/2 rounded-3xl border border-zinc-200 bg-white shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b px-5 py-4">
          <div className="space-y-1">
            <div className="text-xs text-zinc-500">Movimiento manual</div>
            <div className="text-lg font-semibold text-zinc-900">
              {prettyName(ingredient)}{" "}
              <span className="text-sm font-normal text-zinc-500">
                ({ingredient.id.slice(-6)})
              </span>
            </div>
            <div className="text-sm text-zinc-600">
              Proveedor: <b>{supplierName}</b> · Unidad:{" "}
              <b>{ingredient.baseUnit || "—"}</b>
            </div>
            <div className="text-sm text-zinc-700">
              Stock actual: <b>{onHand}</b> · Min: <b>{minQty}</b>
            </div>
          </div>

          <Button variant="secondary" onClick={onClose} disabled={busy}>
            <span className="inline-flex items-center gap-2">
              <X className="h-4 w-4" />
              Cerrar
            </span>
          </Button>
        </div>

        <div className="p-5 space-y-4">
          {err && <Notice tone="error">{err}</Notice>}

          <div className="grid gap-3 md:grid-cols-4">
            <Field label="Tipo">
              <Select
                value={mode}
                onChange={(e) => setMode(e.target.value as any)}
              >
                <option value="IN">Entrada (IN)</option>
                <option value="OUT">Salida (OUT)</option>
                <option value="ADJUST">Ajuste (+/-)</option>
              </Select>
            </Field>

            <Field label="Razón">
              <Select
                value={reason}
                onChange={(e) => setReason(e.target.value as any)}
              >
                <option value="MANUAL">MANUAL</option>
                <option value="PURCHASE">PURCHASE</option>
                <option value="WASTE">WASTE</option>
                <option value="ADJUSTMENT">ADJUSTMENT</option>
              </Select>
            </Field>

            <Field label="Fecha (dateKey)">
              <Input
                value={dateKey}
                onChange={(e) => setDateKey(e.target.value)}
                placeholder="YYYY-MM-DD"
              />
            </Field>

            <Field
              label={`Cantidad (${
                mode === "ADJUST" ? "+/-" : "valor absoluto"
              })`}
            >
              <Input
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                inputMode="decimal"
                placeholder={mode === "ADJUST" ? "Ej: -2 o 5" : "Ej: 10"}
              />
            </Field>
          </div>

          <Field label="Nota (opcional)">
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ej: merma / ajuste inventario / etc."
            />
          </Field>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose} disabled={busy}>
              Cancelar
            </Button>
            <Button onClick={apply} loading={busy} disabled={busy}>
              Aplicar
            </Button>
          </div>

          <div className="text-xs text-zinc-500">
            POST /stock/manual con items[{`{ingredientId, unit, qtyDelta}`}]
          </div>
        </div>
      </div>
    </div>
  );
}

/* =============================================================================
 * Create PO drawer
 * ========================================================================== */
function PurchaseOrderDrawer({
  open,
  onClose,
  supplierId,
  supplierName,
  lines,
  getAccessToken,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  supplierId: string | null;
  supplierName: string;
  lines: Array<{ ingredientId: string; label: string; qty: number }>;
  getAccessToken: any;
  onCreated: () => void;
}) {
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // ✅ ahora las líneas se editan localmente
  const [draftLines, setDraftLines] = useState(lines);

  useEffect(() => {
    if (!open) return;
    setNotes("");
    setErr(null);
    setDraftLines(lines);
  }, [open, lines]);

  function setLineQty(ingredientId: string, next: number) {
    const v = Number(next);
    const safe = Number.isFinite(v) ? v : 0;
    setDraftLines((prev) =>
      prev.map((l) =>
        l.ingredientId === ingredientId ? { ...l, qty: Math.max(0, safe) } : l
      )
    );
  }

  function removeLine(ingredientId: string) {
    setDraftLines((prev) =>
      prev.filter((l) => l.ingredientId !== ingredientId)
    );
  }

  async function createPO() {
    setErr(null);

    if (!supplierId) {
      setErr("No hay proveedor.");
      return;
    }

    const items = draftLines
      .map((l) => ({ ingredientId: l.ingredientId, qty: num(l.qty) }))
      .filter((x) => x.ingredientId && x.qty > 0);

    if (!items.length) {
      setErr("No hay ítems con cantidad > 0.");
      return;
    }

    setBusy(true);
    try {
      const payload: POCreatePayload = {
        supplierId,
        notes: notes.trim() || null,
        items,
      };

      await apiFetchAuthed(getAccessToken, API_PURCHASE_ORDERS, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      onCreated();
      onClose();
    } catch (e: any) {
      setErr(e?.message || "Error creando pedido");
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70]">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-full max-w-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <div className="text-xs text-zinc-500">Crear pedido</div>
            <div className="text-lg font-semibold text-zinc-900">
              {supplierName}
            </div>
          </div>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cerrar
          </Button>
        </div>

        <div className="h-[calc(100%-64px)] overflow-y-auto p-5 space-y-4">
          {err && <Notice tone="error">{err}</Notice>}

          <Card>
            <CardHeader title="Notas" subtitle="Opcional" />
            <CardBody>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ej: entrega mañana / segunda marca / etc."
              />
            </CardBody>
          </Card>

          <div className="rounded-2xl border border-zinc-200 overflow-hidden">
            <div className="border-b px-4 py-3 text-sm font-semibold text-zinc-900 flex items-center justify-between">
              <span>Ítems ({draftLines.length})</span>
              <span className="text-xs font-normal text-zinc-500">
                Editá cantidades antes de crear
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-zinc-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-zinc-500">
                      Ingrediente
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-zinc-500">
                      Cantidad
                    </th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>

                <tbody className="divide-y">
                  {draftLines.length === 0 && (
                    <tr>
                      <td
                        colSpan={3}
                        className="px-4 py-8 text-sm text-zinc-500"
                      >
                        No hay ítems.
                      </td>
                    </tr>
                  )}

                  {draftLines.map((l) => (
                    <tr key={l.ingredientId}>
                      <td className="px-4 py-2 text-sm">
                        <div className="font-semibold text-zinc-900">
                          {l.label}
                        </div>
                        <div className="text-xs text-zinc-500">
                          {l.ingredientId.slice(-6)}
                        </div>
                      </td>

                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="secondary"
                            disabled={busy}
                            onClick={() =>
                              setLineQty(l.ingredientId, num(l.qty) - 1)
                            }
                            title="-1"
                          >
                            −
                          </Button>

                          <Input
                            value={String(l.qty ?? 0)}
                            onChange={(e) =>
                              setLineQty(l.ingredientId, Number(e.target.value))
                            }
                            inputMode="decimal"
                            className="w-28"
                            placeholder="0"
                          />

                          <Button
                            type="button"
                            variant="secondary"
                            disabled={busy}
                            onClick={() =>
                              setLineQty(l.ingredientId, num(l.qty) + 1)
                            }
                            title="+1"
                          >
                            +
                          </Button>
                        </div>

                        {num(l.qty) <= 0 && (
                          <div className="mt-1 text-xs text-red-700">
                            Cantidad debe ser &gt; 0 para incluirse en el
                            pedido.
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-2 text-right">
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={busy}
                          onClick={() => removeLine(l.ingredientId)}
                          title="Quitar ítem"
                        >
                          Quitar
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={createPO} loading={busy} disabled={busy}>
              Crear pedido
            </Button>
          </div>

          <div className="text-xs text-zinc-500">POST /purchase-orders</div>
        </div>
      </div>
    </div>
  );
}

/* =============================================================================
 * Page
 * ========================================================================== */
export default function ManagerStockPage() {
  const { getAccessToken } = useAuth();

  const [ingredients, setIngredients] = useState<IngredientRow[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  const suppliersById = useMemo(() => {
    const m: Record<string, Supplier> = {};
    for (const s of suppliers) m[s.id] = s;
    return m;
  }, [suppliers]);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  // filters
  const [q, setQ] = useState("");
  const [onlyLow, setOnlyLow] = useState(false);
  const [supplierId, setSupplierId] = useState<string>("ALL");

  // selection for PO
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  // modals
  const [manualOpen, setManualOpen] = useState(false);
  const [movsOpen, setMovsOpen] = useState(false);
  const [activeIngredient, setActiveIngredient] =
    useState<IngredientRow | null>(null);

  // PO drawer
  const [poOpen, setPoOpen] = useState(false);
  const [poSupplierId, setPoSupplierId] = useState<string | null>(null);
  const [poLines, setPoLines] = useState<
    Array<{ ingredientId: string; label: string; qty: number }>
  >([]);

  function flashOk(msg: string) {
    setOk(msg);
    window.setTimeout(() => setOk(null), 1400);
  }

  async function loadAll() {
    setErr(null);
    setOk(null);
    setLoading(true);
    try {
      const [sup, ing] = await Promise.all([
        apiFetchAuthed<Supplier[]>(getAccessToken, API_SUPPLIERS),
        apiFetchAuthed<IngredientRow[]>(
          getAccessToken,
          `${API_INGREDIENTS}?limit=800&activeOnly=true`
        ),
      ]);

      setSuppliers(Array.isArray(sup) ? sup : []);
      setIngredients(Array.isArray(ing) ? ing : []);
      flashOk("Stock actualizado ✔");
    } catch (e: any) {
      setErr(e?.message || "Error cargando stock");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows = useMemo(() => {
    const qq = q.trim().toLowerCase();

    return (ingredients || [])
      .filter((i) => {
        if (supplierId !== "ALL" && String(i.supplierId || "") !== supplierId)
          return false;

        if (qq) {
          const s = `${i.name} ${i.displayName ?? ""} ${
            i.name_for_supplier ?? ""
          }`.toLowerCase();
          if (!s.includes(qq)) return false;
        }

        const onHand = num(i.stock?.onHand);
        const minQty = num(i.stock?.minQty);
        if (onlyLow && !(minQty > 0 && onHand < minQty)) return false;

        return true;
      })
      .sort((a, b) => prettyName(a).localeCompare(prettyName(b)));
  }, [ingredients, q, onlyLow, supplierId]);

  const totals = useMemo(() => {
    const total = ingredients.length;
    const low = ingredients.filter((i) => {
      const onHand = num(i.stock?.onHand);
      const minQty = num(i.stock?.minQty);
      return minQty > 0 && onHand < minQty;
    }).length;

    const selectedCount = Object.values(selected).filter(Boolean).length;

    return { total, low, selectedCount };
  }, [ingredients, selected]);

  function toggleSel(id: string) {
    setSelected((p) => ({ ...p, [id]: !p[id] }));
  }

  function clearSel() {
    setSelected({});
  }

  function openManual(i: IngredientRow) {
    setActiveIngredient(i);
    setManualOpen(true);
  }

  function openMovs(i: IngredientRow) {
    setActiveIngredient(i);
    setMovsOpen(true);
  }

  function buildSuggestedOrderForSupplier(supplier: string) {
    const selectedIds = Object.keys(selected).filter((id) => selected[id]);

    return ingredients
      .filter((i) => selectedIds.includes(i.id))
      .filter((i) => String(i.supplierId || "") === supplier)
      .map((i) => {
        const onHand = num(i.stock?.onHand);
        const minQty = num(i.stock?.minQty);
        const ideal = i.stock?.idealQty != null ? num(i.stock.idealQty) : null;

        const target =
          ideal != null && ideal > 0 ? ideal : minQty > 0 ? minQty : 0;
        const need = target > 0 ? Math.max(0, target - onHand) : 0;

        return {
          ingredientId: i.id,
          label: prettyName(i),
          qty: need > 0 ? need : 1, // fallback
        };
      });
  }

  function createPOFromSelection() {
    setErr(null);

    const selectedIds = Object.keys(selected).filter((id) => selected[id]);
    if (!selectedIds.length) {
      setErr("Seleccioná al menos 1 ingrediente para armar un pedido.");
      return;
    }

    const suppliersSet = new Set(
      ingredients
        .filter((i) => selectedIds.includes(i.id))
        .map((i) => String(i.supplierId || ""))
        .filter(Boolean)
    );

    const list = Array.from(suppliersSet);
    if (list.length === 0) {
      setErr("Los ingredientes seleccionados no tienen supplierId.");
      return;
    }

    if (list.length > 1) {
      setErr(
        "Seleccionaste ingredientes de más de 1 proveedor. Por ahora armamos 1 pedido por vez (1 proveedor)."
      );
    }

    const supplier = list[0];
    const lines = buildSuggestedOrderForSupplier(supplier);

    setPoSupplierId(supplier);
    setPoLines(lines);
    setPoOpen(true);
  }

  const poSupplierName =
    poSupplierId && suppliersById[poSupplierId]
      ? suppliersById[poSupplierId].name
      : "Proveedor";

  return (
    <AdminProtected>
      <div className="space-y-6">
        {/* Header */}
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
                Stock (Manager)
              </h1>
              <p className="mt-1 text-sm text-zinc-500">
                Ingredientes, stock actual, movimientos manuales y pedidos a
                proveedores.
              </p>

              <div className="mt-4 flex flex-wrap gap-4 text-sm">
                <span className="text-zinc-700">
                  Ingredientes: <b>{totals.total}</b>
                </span>
                <span className="text-red-700">
                  Bajo minQty: <b>{totals.low}</b>
                </span>
                <span className="text-zinc-700">
                  Seleccionados: <b>{totals.selectedCount}</b>
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                onClick={loadAll}
                loading={loading}
                disabled={busy}
                title="Actualizar"
              >
                <span className="inline-flex items-center gap-2">
                  <RefreshCcw className="h-4 w-4" />
                </span>
              </Button>

              <Button
                onClick={createPOFromSelection}
                disabled={busy || loading}
                title="Crear pedido con seleccionados"
              >
                <span className="inline-flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4" />
                  Crear pedido
                </span>
              </Button>

              <Button
                variant="secondary"
                onClick={clearSel}
                disabled={busy || loading}
                title="Limpiar selección"
              >
                <span className="inline-flex items-center gap-2">
                  <X className="h-4 w-4" />
                  Limpiar
                </span>
              </Button>
            </div>
          </div>
        </div>

        {/* Notices */}
        {(err || ok) && (
          <div className="grid gap-2">
            {err && <Notice tone="error">{err}</Notice>}
            {!err && ok && <Notice tone="ok">{ok}</Notice>}
          </div>
        )}

        {/* Filters */}
        <Card>
          <CardHeader title="Filtros" subtitle="Buscá y encontrá rápido" />
          <CardBody>
            <div className="grid gap-3 md:grid-cols-[1fr_260px_200px_auto] md:items-end">
              <Field label="Buscar">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                  <Input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Nombre / displayName / nombre proveedor…"
                    className="pl-9"
                  />
                </div>
              </Field>

              <Field label="Proveedor">
                <Select
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                >
                  <option value="ALL">Todos</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Stock">
                <Select
                  value={onlyLow ? "LOW" : "ALL"}
                  onChange={(e) => setOnlyLow(e.target.value === "LOW")}
                >
                  <option value="ALL">Todos</option>
                  <option value="LOW">Solo bajo minQty</option>
                </Select>
              </Field>

              <div className="text-sm text-zinc-500">
                <span className="inline-flex items-center gap-2">
                  <SlidersHorizontal className="h-4 w-4" />
                  {rows.length} resultado(s)
                </span>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Table */}
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-100 px-5 py-4 flex items-center justify-between">
            <div>
              <div className="text-lg font-semibold text-zinc-900">
                Ingredientes
              </div>
              <div className="text-sm text-zinc-500">
                Seleccioná para pedido · Movimientos manuales · Auditoría
              </div>
            </div>
            <div className="text-sm text-zinc-500">
              {loading ? "Cargando…" : `${rows.length} fila(s)`}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Sel
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Ingrediente
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Proveedor
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Stock
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Min / Ideal
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Costo
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Acciones
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-zinc-100">
                {loading && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-sm text-zinc-500">
                      Cargando…
                    </td>
                  </tr>
                )}

                {!loading && rows.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-10 text-sm text-zinc-500"
                    >
                      No hay ingredientes con esos filtros.
                    </td>
                  </tr>
                )}

                {!loading &&
                  rows.map((i) => {
                    const onHand = num(i.stock?.onHand);
                    const minQty = num(i.stock?.minQty);
                    const ideal =
                      i.stock?.idealQty != null ? num(i.stock.idealQty) : null;
                    const unit = i.baseUnit || "—";
                    const supplierName =
                      i.supplierId && suppliersById[i.supplierId]
                        ? suppliersById[i.supplierId].name
                        : "—";

                    const low = minQty > 0 && onHand < minQty;

                    return (
                      <tr
                        key={i.id}
                        className={cn(
                          "hover:bg-zinc-50",
                          low && "bg-red-50/30"
                        )}
                      >
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={Boolean(selected[i.id])}
                            onChange={() => toggleSel(i.id)}
                          />
                        </td>

                        <td className="px-4 py-3">
                          <div className="text-sm font-semibold text-zinc-900">
                            {prettyName(i)}
                          </div>
                          <div className="text-xs text-zinc-500">
                            {i.name_for_supplier
                              ? `Prov: ${i.name_for_supplier} · `
                              : ""}
                            ID: {i.id.slice(-6)} · Unidad: {unit}
                          </div>
                        </td>

                        <td className="px-4 py-3 text-sm text-zinc-700">
                          {supplierName}
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-semibold text-zinc-900">
                              {onHand}
                            </div>
                            <StockPill onHand={onHand} minQty={minQty} />
                          </div>
                          <div className="text-xs text-zinc-500">
                            trackStock: {String(i.stock?.trackStock ?? true)}
                          </div>
                        </td>

                        <td className="px-4 py-3 text-sm text-zinc-700">
                          <div>
                            Min: <b>{minQty}</b>
                          </div>
                          <div className="text-xs text-zinc-500">
                            Ideal: <b>{ideal != null ? ideal : "—"}</b>
                          </div>
                        </td>

                        <td className="px-4 py-3 text-sm text-zinc-700">
                          <div>
                            Últ:{" "}
                            <b>
                              {money(
                                num(i.cost?.lastCost),
                                (i.cost?.currency ?? "ARS") as any
                              )}
                            </b>
                          </div>
                          <div className="text-xs text-zinc-500">
                            Prom: {num(i.cost?.avgCost)}
                          </div>
                        </td>

                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex flex-wrap justify-end gap-2">
                            <Button
                              variant="secondary"
                              onClick={() => openManual(i)}
                              disabled={busy}
                            >
                              <span className="inline-flex items-center gap-2">
                                <Package className="h-4 w-4" />
                                Movimiento
                              </span>
                            </Button>

                            <Button
                              variant="secondary"
                              onClick={() => openMovs(i)}
                              disabled={busy}
                              title="Ver auditoría"
                            >
                              <span className="inline-flex items-center gap-2">
                                <ScrollText className="h-4 w-4" />
                                Movs
                              </span>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          <div className="border-t border-zinc-100 px-5 py-4 text-xs text-zinc-500">
            Si querés, sumamos “Editar minQty / idealQty” inline acá mismo.
          </div>
        </div>

        {/* Modals */}
        <ManualMoveModal
          open={manualOpen}
          onClose={() => setManualOpen(false)}
          ingredient={activeIngredient}
          suppliersById={suppliersById}
          getAccessToken={getAccessToken}
          onApplied={loadAll}
        />

        <MovementsModal
          open={movsOpen}
          onClose={() => setMovsOpen(false)}
          ingredient={activeIngredient}
          getAccessToken={getAccessToken}
        />

        <PurchaseOrderDrawer
          open={poOpen}
          onClose={() => setPoOpen(false)}
          supplierId={poSupplierId}
          supplierName={poSupplierName}
          lines={poLines}
          getAccessToken={getAccessToken}
          onCreated={() => {
            flashOk("Pedido creado ✔");
            clearSel();
          }}
        />
      </div>
    </AdminProtected>
  );
}
