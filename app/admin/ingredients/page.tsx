"use client";

import {
  Fragment,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AdminProtected } from "@/components/AdminProtected";
import { useAuth } from "@/app/providers/AuthProvider";
import { apiFetchAuthed } from "@/lib/apiAuthed";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Field";
import {
  RefreshCcw,
  Search,
  Plus,
  Filter,
  Power,
  Save,
  CheckCircle2,
  AlertTriangle,
  Truck,
  BadgeDollarSign,
  Tag,
  ChevronDown,
  ChevronUp,
  X,
} from "lucide-react";

/* =============================================================================
 * Types
 * ========================================================================== */

type Supplier = { id: string; name: string; isActive: boolean };
type Unit = "UNIT" | "KG" | "L";

type Ingredient = {
  id: string;
  name: string;
  displayName: string | null;
  baseUnit: Unit;
  supplierId: string;
  name_for_supplier: string | null;
  isActive: boolean;

  stock: {
    trackStock: boolean;
    onHand: number;
    reserved: number;
    minQty: number;
    idealQty: number | null;
    storageLocation: string | null;
  };

  cost: {
    lastCost: number;
    avgCost: number;
    currency: "ARS" | "USD";
  };

  tags: string[];
  notes: string | null;

  createdAt?: string;
  updatedAt?: string;
};

/* =============================================================================
 * Helpers
 * ========================================================================== */

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function unitLabel(u: Unit) {
  if (u === "UNIT") return "Unidad";
  if (u === "KG") return "Kg";
  if (u === "L") return "Litros";
  return u;
}

function isValidNumberDraft(v: string) {
  return v === "" || /^[0-9]*([.][0-9]*)?$/.test(v);
}

function parseTags(raw: string) {
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => t.toLowerCase());
}

function normNum(s: string) {
  const n = Number(s || 0);
  return Number.isFinite(n) ? n : 0;
}

function isDirtyMin(p: Ingredient, draft: string | undefined) {
  const cur = p.stock?.minQty ?? 0;
  return normNum(draft ?? String(cur)) !== cur;
}

function isDirtyCost(p: Ingredient, draft: string | undefined) {
  const cur = p.cost?.lastCost ?? 0;
  return normNum(draft ?? String(cur)) !== cur;
}

function isDirtyNameForSupplier(p: Ingredient, draft: string | undefined) {
  const cur = (p.name_for_supplier ?? "").trim();
  const d = (draft ?? cur).trim();
  return d !== cur;
}

function StatusPill({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold border",
        active
          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
          : "bg-zinc-100 text-zinc-600 border-zinc-200"
      )}
    >
      {active ? "ACTIVO" : "INACTIVO"}
    </span>
  );
}

function Notice({
  tone,
  children,
}: {
  tone: "error" | "ok";
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border px-3 py-2 text-sm",
        tone === "error"
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-emerald-200 bg-emerald-50 text-emerald-700"
      )}
    >
      <span className="inline-flex items-center gap-2">
        {tone === "error" ? (
          <AlertTriangle className="h-4 w-4" />
        ) : (
          <CheckCircle2 className="h-4 w-4" />
        )}
        {children}
      </span>
    </div>
  );
}

function MiniKpi({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  tone?: "default" | "ok" | "warn";
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border px-3 py-2",
        tone === "ok"
          ? "border-emerald-200 bg-emerald-50"
          : tone === "warn"
          ? "border-amber-200 bg-amber-50"
          : "border-zinc-200 bg-white"
      )}
    >
      <div className="text-[11px] font-semibold text-zinc-500">{label}</div>
      <div className="mt-0.5 text-sm font-semibold text-zinc-900">{value}</div>
    </div>
  );
}

/* =============================================================================
 * Page
 * ========================================================================== */

export default function AdminIngredientsPage() {
  const { getAccessToken } = useAuth();

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierId, setSupplierId] = useState<string>("__ALL__"); // ✅ ALL por defecto

  const [items, setItems] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  // row editor
  const [openRow, setOpenRow] = useState<string | null>(null);

  // create
  const [createOpen, setCreateOpen] = useState(true);
  const [name, setName] = useState("");
  const [nameForSupplier, setNameForSupplier] = useState("");
  const [baseUnit, setBaseUnit] = useState<Unit>("UNIT");
  const [minQtyCreate, setMinQtyCreate] = useState("0");
  const [lastCostCreate, setLastCostCreate] = useState("0");
  const [currencyCreate, setCurrencyCreate] = useState<"ARS" | "USD">("ARS");
  const [tagsCreate, setTagsCreate] = useState("");

  // search / filters
  const [q, setQ] = useState("");
  const [onlyActive, setOnlyActive] = useState(false);

  // drafts
  const [minDraft, setMinDraft] = useState<Record<string, string>>({});
  const [nameForSupplierDraft, setNameForSupplierDraft] = useState<
    Record<string, string>
  >({});
  const [lastCostDraft, setLastCostDraft] = useState<Record<string, string>>(
    {}
  );

  const [savingMinById, setSavingMinById] = useState<Record<string, boolean>>(
    {}
  );
  const [savingNameById, setSavingNameById] = useState<Record<string, boolean>>(
    {}
  );
  const [savingCostById, setSavingCostById] = useState<Record<string, boolean>>(
    {}
  );

  const searchRef = useRef<HTMLInputElement | null>(null);

  const activeSuppliers = useMemo(
    () => suppliers.filter((s) => s.isActive !== false),
    [suppliers]
  );

  // ✅ filtro por proveedor es LOCAL (front), no en el fetch
  const supplierMap = useMemo(() => {
    const m = new Map<string, Supplier>();
    for (const s of suppliers) m.set(s.id, s);
    return m;
  }, [suppliers]);

  const currentSupplierName = useMemo(() => {
    if (supplierId === "__ALL__") return "Todos";
    return suppliers.find((s) => s.id === supplierId)?.name ?? "—";
  }, [suppliers, supplierId]);

  const filtered = useMemo(() => {
    let base = items;

    if (supplierId !== "__ALL__") {
      base = base.filter((i) => i.supplierId === supplierId);
    }

    if (onlyActive) base = base.filter((i) => i.isActive);

    const qq = q.trim().toLowerCase();
    if (!qq) return base;

    return base.filter((i) => {
      const a = (i.name || "").toLowerCase();
      const b = (i.name_for_supplier || "").toLowerCase();
      const tags = (i.tags || []).some((t) =>
        (t || "").toLowerCase().includes(qq)
      );
      const supplierName = (
        supplierMap.get(i.supplierId)?.name || ""
      ).toLowerCase();
      return (
        a.includes(qq) || b.includes(qq) || tags || supplierName.includes(qq)
      );
    });
  }, [items, supplierId, onlyActive, q, supplierMap]);

  const totals = useMemo(() => {
    const total = items.length;
    const active = items.filter((p) => p.isActive).length;
    return { total, active, inactive: total - active };
  }, [items]);

  const filteredTotals = useMemo(() => {
    const total = filtered.length;
    const active = filtered.filter((p) => p.isActive).length;
    return { total, active, inactive: total - active };
  }, [filtered]);

  /* =============================================================================
   * Loaders
   * ========================================================================== */

  async function loadSuppliers() {
    const s = await apiFetchAuthed<Supplier[]>(getAccessToken, "/suppliers");
    setSuppliers(Array.isArray(s) ? s : []);
  }

  // ✅ trae TODO /ingredients
  async function loadIngredientsAll() {
    const data = await apiFetchAuthed<Ingredient[]>(
      getAccessToken,
      "/ingredients"
    );
    const list = Array.isArray(data) ? data : [];
    setItems(list);

    // drafts (solo setear si faltan, no pisar lo que el user está editando)
    setMinDraft((prev) => {
      const next = { ...prev };
      for (const it of list)
        if (next[it.id] === undefined)
          next[it.id] = String(it.stock?.minQty ?? 0);
      return next;
    });

    setNameForSupplierDraft((prev) => {
      const next = { ...prev };
      for (const it of list)
        if (next[it.id] === undefined)
          next[it.id] = String(it.name_for_supplier ?? "");
      return next;
    });

    setLastCostDraft((prev) => {
      const next = { ...prev };
      for (const it of list)
        if (next[it.id] === undefined)
          next[it.id] = String(it.cost?.lastCost ?? 0);
      return next;
    });
  }

  async function loadAll() {
    setErr(null);
    setOk(null);
    setLoading(true);
    try {
      await Promise.all([loadSuppliers(), loadIngredientsAll()]);
      setOk("Datos actualizados ✔");
      window.setTimeout(() => setOk(null), 1500);
    } catch (e: any) {
      setErr(e?.message || "Error cargando");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* =============================================================================
   * Actions
   * ========================================================================== */

  async function create() {
    if (!name.trim()) return;

    const sId = supplierId === "__ALL__" ? "" : supplierId;
    if (!sId) {
      setErr("Elegí un proveedor para crear el ingrediente.");
      return;
    }

    const minQty = Number(minQtyCreate || 0);
    if (!Number.isFinite(minQty) || minQty < 0) {
      setErr("El mínimo debe ser un número >= 0");
      return;
    }

    const lastCost = Number(lastCostCreate || 0);
    if (!Number.isFinite(lastCost) || lastCost < 0) {
      setErr("El costo debe ser un número >= 0");
      return;
    }

    setBusy(true);
    setErr(null);

    try {
      await apiFetchAuthed(getAccessToken, "/ingredients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          baseUnit,
          supplierId: sId,
          name_for_supplier: nameForSupplier.trim()
            ? nameForSupplier.trim()
            : null,
          minQty,
          lastCost,
          currency: currencyCreate,
          tags: parseTags(tagsCreate),
        }),
      });

      setName("");
      setNameForSupplier("");
      setBaseUnit("UNIT");
      setMinQtyCreate("0");
      setLastCostCreate("0");
      setCurrencyCreate("ARS");
      setTagsCreate("");

      setOk("Ingrediente creado ✔");
      window.setTimeout(() => setOk(null), 1500);

      await loadIngredientsAll();
      searchRef.current?.focus();
    } catch (e: any) {
      setErr(e?.message || "Error creando ingrediente");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(p: Ingredient) {
    const next = !p.isActive;
    if (
      !window.confirm(
        next
          ? `¿Reactivar "${p.name}"?`
          : `¿Desactivar "${p.name}"?\n\nNo aparecerá en listados activos.`
      )
    )
      return;

    setBusy(true);
    setErr(null);

    try {
      await apiFetchAuthed(getAccessToken, `/ingredients/${p.id}/active`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: next }),
      });
      await loadIngredientsAll();
    } catch (e: any) {
      setErr(e?.message || "Error actualizando estado");
    } finally {
      setBusy(false);
    }
  }

  function setMinValue(id: string, v: string) {
    if (isValidNumberDraft(v)) setMinDraft((prev) => ({ ...prev, [id]: v }));
  }

  function setCostValue(id: string, v: string) {
    if (isValidNumberDraft(v))
      setLastCostDraft((prev) => ({ ...prev, [id]: v }));
  }

  function setNameForSupplierValue(id: string, v: string) {
    setNameForSupplierDraft((prev) => ({ ...prev, [id]: v }));
  }

  function resetRowDrafts(p: Ingredient) {
    setNameForSupplierDraft((prev) => ({
      ...prev,
      [p.id]: String(p.name_for_supplier ?? ""),
    }));
    setLastCostDraft((prev) => ({
      ...prev,
      [p.id]: String(p.cost?.lastCost ?? 0),
    }));
    setMinDraft((prev) => ({
      ...prev,
      [p.id]: String(p.stock?.minQty ?? 0),
    }));
  }

  async function saveMin(p: Ingredient) {
    const raw = minDraft[p.id] ?? "0";
    const minQty = Number(raw || 0);
    if (!Number.isFinite(minQty) || minQty < 0) {
      setErr("El mínimo debe ser un número >= 0");
      return;
    }

    setSavingMinById((prev) => ({ ...prev, [p.id]: true }));
    setErr(null);

    try {
      await apiFetchAuthed(getAccessToken, `/ingredients/${p.id}/min-qty`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minQty }),
      });
      await loadIngredientsAll();
      setOk("Mínimo guardado ✔");
      window.setTimeout(() => setOk(null), 1200);
    } catch (e: any) {
      setErr(e?.message || "Error guardando mínimo");
    } finally {
      setSavingMinById((prev) => ({ ...prev, [p.id]: false }));
    }
  }

  async function saveNameForSupplier(p: Ingredient) {
    const v = (nameForSupplierDraft[p.id] ?? "").trim();

    setSavingNameById((prev) => ({ ...prev, [p.id]: true }));
    setErr(null);

    try {
      await apiFetchAuthed(
        getAccessToken,
        `/ingredients/${p.id}/name-for-supplier`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name_for_supplier: v ? v : null }),
        }
      );
      await loadIngredientsAll();
      setOk("Nombre proveedor guardado ✔");
      window.setTimeout(() => setOk(null), 1200);
    } catch (e: any) {
      setErr(e?.message || "Error guardando nombre proveedor");
    } finally {
      setSavingNameById((prev) => ({ ...prev, [p.id]: false }));
    }
  }

  async function saveCost(p: Ingredient) {
    const raw = lastCostDraft[p.id] ?? "0";
    const lastCost = Number(raw || 0);
    if (!Number.isFinite(lastCost) || lastCost < 0) {
      setErr("El costo debe ser un número >= 0");
      return;
    }

    setSavingCostById((prev) => ({ ...prev, [p.id]: true }));
    setErr(null);

    try {
      await apiFetchAuthed(getAccessToken, `/ingredients/${p.id}/cost`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lastCost }),
      });
      await loadIngredientsAll();
      setOk("Costo guardado ✔");
      window.setTimeout(() => setOk(null), 1200);
    } catch (e: any) {
      setErr(e?.message || "Error guardando costo");
    } finally {
      setSavingCostById((prev) => ({ ...prev, [p.id]: false }));
    }
  }

  // ⭐ Guardar SOLO lo que cambió en la fila
  async function saveRow(p: Ingredient) {
    const dirtyMin = isDirtyMin(p, minDraft[p.id]);
    const dirtyCost = isDirtyCost(p, lastCostDraft[p.id]);
    const dirtyName = isDirtyNameForSupplier(p, nameForSupplierDraft[p.id]);

    if (!dirtyMin && !dirtyCost && !dirtyName) return;

    setBusy(true);
    setErr(null);

    try {
      const calls: Promise<any>[] = [];

      if (dirtyName) {
        const v = (nameForSupplierDraft[p.id] ?? "").trim();
        calls.push(
          apiFetchAuthed(
            getAccessToken,
            `/ingredients/${p.id}/name-for-supplier`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name_for_supplier: v ? v : null }),
            }
          )
        );
      }

      if (dirtyCost) {
        const lastCost = normNum(lastCostDraft[p.id] ?? "0");
        calls.push(
          apiFetchAuthed(getAccessToken, `/ingredients/${p.id}/cost`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lastCost }),
          })
        );
      }

      if (dirtyMin) {
        const minQty = normNum(minDraft[p.id] ?? "0");
        calls.push(
          apiFetchAuthed(getAccessToken, `/ingredients/${p.id}/min-qty`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ minQty }),
          })
        );
      }

      await Promise.all(calls);
      await loadIngredientsAll();
      setOk("Cambios guardados ✔");
      window.setTimeout(() => setOk(null), 1200);
    } catch (e: any) {
      setErr(e?.message || "Error guardando cambios");
    } finally {
      setBusy(false);
    }
  }

  /* =============================================================================
   * Render
   * ========================================================================== */

  return (
    <AdminProtected>
      <div className="space-y-6">
        {/* Header */}
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
                Ingredientes
              </h1>
              <p className="mt-1 text-sm text-zinc-500">
                Ahora se muestran <b>todos</b>. Filtrá por proveedor si querés.
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <MiniKpi
                  label="Proveedor (filtro)"
                  value={currentSupplierName}
                />
                <MiniKpi label="Total (DB)" value={totals.total} />
                <MiniKpi label="Mostrando" value={filteredTotals.total} />
                <MiniKpi
                  label="Activos (mostrando)"
                  value={filteredTotals.active}
                  tone="ok"
                />
                <MiniKpi
                  label="Inactivos (mostrando)"
                  value={filteredTotals.inactive}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={loadAll} loading={loading}>
                <RefreshCcw className="h-4 w-4" />
                Actualizar
              </Button>
            </div>
          </div>

          {(err || ok) && (
            <div className="mt-4 grid gap-2">
              {err && <Notice tone="error">{err}</Notice>}
              {!err && ok && <Notice tone="ok">{ok}</Notice>}
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-4">
          <div className="grid gap-2 sm:grid-cols-[320px_1fr_auto] sm:items-center">
            <div className="relative">
              <Truck className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <Select
                value={supplierId}
                onChange={(e) => {
                  setSupplierId(e.target.value);
                  setOpenRow(null);
                }}
                className="pl-9"
              >
                <option value="__ALL__">Todos los proveedores</option>
                {activeSuppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>

              {supplierId !== "__ALL__" && (
                <button
                  type="button"
                  onClick={() => {
                    setSupplierId("__ALL__");
                    setOpenRow(null);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1 hover:bg-zinc-100"
                  title="Quitar filtro proveedor"
                >
                  <X className="h-4 w-4 text-zinc-500" />
                </button>
              )}
            </div>

            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <Input
                ref={searchRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar por nombre / proveedor / tags…"
                className="pl-9"
              />
            </div>

            <button
              type="button"
              onClick={() => setOnlyActive((v) => !v)}
              className={cn(
                "h-10 rounded-xl border px-3 text-sm font-semibold inline-flex items-center gap-2",
                onlyActive
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50"
              )}
            >
              <Filter className="h-4 w-4" />
              {onlyActive ? "Solo activos" : "Todos"}
            </button>
          </div>
        </div>

        {/* Create */}
        <Card>
          <div className="flex items-start justify-between px-5 pt-5">
            <div>
              <div className="text-base font-semibold text-zinc-900">
                Crear ingrediente
              </div>
              <div className="text-sm text-zinc-500">
                Para crear, elegí un proveedor en el filtro.
              </div>
            </div>

            <button
              onClick={() => setCreateOpen((v) => !v)}
              className="rounded-xl border px-3 py-2 text-sm hover:bg-zinc-50 inline-flex items-center gap-2"
            >
              {createOpen ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
              {createOpen ? "Ocultar" : "Mostrar"}
            </button>
          </div>

          {createOpen && (
            <CardBody>
              {supplierId === "__ALL__" && (
                <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  Elegí un proveedor para poder crear (así evitamos ingredientes
                  sin supplier).
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-6">
                <Field label="Nombre (interno)">
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </Field>

                <Field label="Nombre en proveedor">
                  <Input
                    value={nameForSupplier}
                    onChange={(e) => setNameForSupplier(e.target.value)}
                    placeholder="Factura/lista"
                  />
                </Field>

                <Field label="Unidad base">
                  <Select
                    value={baseUnit}
                    onChange={(e) => setBaseUnit(e.target.value as Unit)}
                  >
                    <option value="UNIT">Unidad</option>
                    <option value="KG">Kg</option>
                    <option value="L">Litros</option>
                  </Select>
                </Field>

                <Field label="Stock mínimo">
                  <Input
                    value={minQtyCreate}
                    onChange={(e) =>
                      isValidNumberDraft(e.target.value) &&
                      setMinQtyCreate(e.target.value)
                    }
                  />
                </Field>

                <Field label="Costo unitario">
                  <div className="relative">
                    <BadgeDollarSign className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                    <Input
                      className="pl-9 tabular-nums"
                      value={lastCostCreate}
                      onChange={(e) =>
                        isValidNumberDraft(e.target.value) &&
                        setLastCostCreate(e.target.value)
                      }
                    />
                  </div>
                </Field>

                <Field label="Moneda">
                  <Select
                    value={currencyCreate}
                    onChange={(e) =>
                      setCurrencyCreate(e.target.value as "ARS" | "USD")
                    }
                  >
                    <option value="ARS">ARS</option>
                    <option value="USD">USD</option>
                  </Select>
                </Field>

                <div className="md:col-span-5">
                  <Field label="Tags (coma separado)">
                    <div className="relative">
                      <Tag className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                      <Input
                        className="pl-9"
                        value={tagsCreate}
                        onChange={(e) => setTagsCreate(e.target.value)}
                        placeholder="packaging, sushi, limpieza…"
                      />
                    </div>
                  </Field>
                </div>

                <div className="flex items-end">
                  <Button
                    onClick={create}
                    disabled={busy || !name.trim() || supplierId === "__ALL__"}
                  >
                    <Plus className="h-4 w-4" />
                    Crear
                  </Button>
                </div>
              </div>
            </CardBody>
          )}
        </Card>

        {/* List */}
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <table className="min-w-full">
            <thead className="bg-zinc-50 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">
                  Ingrediente
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">
                  Proveedor / Unidad / Moneda
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">
                  Estado
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">
                  Acciones
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-zinc-100">
              {filtered.map((p) => {
                const savingMin = !!savingMinById[p.id];
                const savingName = !!savingNameById[p.id];
                const savingCost = !!savingCostById[p.id];

                const supplierName = supplierMap.get(p.supplierId)?.name ?? "—";

                const dirtyMin = isDirtyMin(p, minDraft[p.id]);
                const dirtyCost = isDirtyCost(p, lastCostDraft[p.id]);
                const dirtyName = isDirtyNameForSupplier(
                  p,
                  nameForSupplierDraft[p.id]
                );
                const dirtyAny = dirtyMin || dirtyCost || dirtyName;

                const isOpen = openRow === p.id;

                return (
                  <Fragment key={p.id}>
                    {/* Compact row */}
                    <tr
                      className={cn(
                        "hover:bg-zinc-50",
                        isOpen && "bg-zinc-50/40"
                      )}
                    >
                      <td className="px-4 py-3 align-top">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-medium text-zinc-900">
                              {p.name}
                            </div>

                            {p.tags?.length ? (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {p.tags.slice(0, 3).map((t) => (
                                  <span
                                    key={t}
                                    className="inline-flex rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-[11px] text-zinc-600"
                                  >
                                    {t}
                                  </span>
                                ))}
                                {p.tags.length > 3 && (
                                  <span className="text-[11px] text-zinc-400">
                                    +{p.tags.length - 3}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <div className="mt-1 text-[11px] text-zinc-400">
                                Sin tags
                              </div>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => setOpenRow(isOpen ? null : p.id)}
                            className={cn(
                              "rounded-xl border px-3 py-2 text-sm font-semibold inline-flex items-center gap-2",
                              isOpen
                                ? "border-zinc-300 bg-zinc-50"
                                : "border-zinc-200 bg-white hover:bg-zinc-50"
                            )}
                          >
                            {isOpen ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                            Editar
                            {dirtyAny && (
                              <span className="ml-1 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                                cambios
                              </span>
                            )}
                          </button>
                        </div>
                      </td>

                      <td className="px-4 py-3 align-top">
                        <div className="text-sm font-semibold text-zinc-900">
                          {supplierName}
                        </div>
                        <div className="mt-1 text-xs text-zinc-500">
                          {unitLabel(p.baseUnit)} · {p.cost?.currency ?? "ARS"}
                        </div>
                        <div className="mt-2 text-xs text-zinc-500">
                          Costo:{" "}
                          <span className="font-semibold text-zinc-900 tabular-nums">
                            {String(p.cost?.lastCost ?? 0)}
                          </span>{" "}
                          · Mínimo:{" "}
                          <span className="font-semibold text-zinc-900 tabular-nums">
                            {String(p.stock?.minQty ?? 0)}
                          </span>
                        </div>
                      </td>

                      <td className="px-4 py-3 align-top">
                        <StatusPill active={p.isActive} />
                      </td>

                      <td className="px-4 py-3 align-top">
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            variant={p.isActive ? "danger" : "secondary"}
                            onClick={() => toggleActive(p)}
                            disabled={busy}
                          >
                            <Power className="h-4 w-4" />
                            {p.isActive ? "Desactivar" : "Reactivar"}
                          </Button>

                          <Button
                            variant="secondary"
                            onClick={() => {
                              resetRowDrafts(p);
                              setOk("Cambios descartados ✔");
                              window.setTimeout(() => setOk(null), 900);
                            }}
                            disabled={!dirtyAny || busy}
                            title={
                              !dirtyAny ? "Sin cambios" : "Descartar cambios"
                            }
                          >
                            <X className="h-4 w-4" />
                            Descartar
                          </Button>

                          <Button
                            onClick={() => saveRow(p)}
                            disabled={!dirtyAny || busy}
                            title={
                              !dirtyAny
                                ? "Sin cambios"
                                : "Guardar cambios de la fila"
                            }
                          >
                            <Save className="h-4 w-4" />
                            Guardar cambios
                          </Button>
                        </div>
                      </td>
                    </tr>

                    {/* Expanded editor */}
                    {isOpen && (
                      <tr className="bg-zinc-50/40">
                        <td colSpan={4} className="px-4 pb-5">
                          <div className="mt-3 grid gap-3 md:grid-cols-3">
                            {/* Nombre proveedor */}
                            <div className="rounded-2xl border border-zinc-200 bg-white p-3">
                              <div className="text-xs font-semibold text-zinc-500">
                                Nombre en proveedor
                              </div>
                              <div className="mt-2 flex items-center gap-2">
                                <Input
                                  value={nameForSupplierDraft[p.id] ?? ""}
                                  onChange={(e) =>
                                    setNameForSupplierValue(
                                      p.id,
                                      e.target.value
                                    )
                                  }
                                  onKeyDown={(e) => {
                                    if (
                                      e.key === "Enter" &&
                                      dirtyName &&
                                      !savingName
                                    )
                                      saveNameForSupplier(p);
                                    if (e.key === "Escape") resetRowDrafts(p);
                                  }}
                                  className={cn(
                                    dirtyName
                                      ? "border-amber-300"
                                      : "border-zinc-200"
                                  )}
                                  placeholder="Factura/lista…"
                                />
                                <Button
                                  {...(!dirtyName
                                    ? { variant: "secondary" as const }
                                    : {})}
                                  loading={savingName}
                                  disabled={!dirtyName}
                                  onClick={() => saveNameForSupplier(p)}
                                  title={dirtyName ? "Guardar" : "Sin cambios"}
                                >
                                  <Save className="h-4 w-4" />
                                </Button>
                              </div>
                              <div className="mt-2 text-[11px] text-zinc-500">
                                Tip: Enter guarda · Esc descarta
                              </div>
                            </div>

                            {/* Costo */}
                            <div className="rounded-2xl border border-zinc-200 bg-white p-3">
                              <div className="text-xs font-semibold text-zinc-500">
                                Costo unitario
                              </div>
                              <div className="mt-2 flex items-center gap-2">
                                <div className="relative w-full">
                                  <BadgeDollarSign className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                                  <Input
                                    className={cn(
                                      "pl-9 tabular-nums",
                                      dirtyCost
                                        ? "border-amber-300"
                                        : "border-zinc-200"
                                    )}
                                    value={lastCostDraft[p.id] ?? "0"}
                                    onChange={(e) =>
                                      setCostValue(p.id, e.target.value)
                                    }
                                    onKeyDown={(e) => {
                                      if (
                                        e.key === "Enter" &&
                                        dirtyCost &&
                                        !savingCost
                                      )
                                        saveCost(p);
                                      if (e.key === "Escape") resetRowDrafts(p);
                                    }}
                                  />
                                </div>

                                <Button
                                  {...(!dirtyCost
                                    ? { variant: "secondary" as const }
                                    : {})}
                                  loading={savingCost}
                                  disabled={!dirtyCost}
                                  onClick={() => saveCost(p)}
                                  title={dirtyCost ? "Guardar" : "Sin cambios"}
                                >
                                  <Save className="h-4 w-4" />
                                </Button>

                                <span className="text-xs font-semibold text-zinc-600">
                                  {p.cost?.currency ?? "ARS"}
                                </span>
                              </div>
                              <div className="mt-2 text-[11px] text-zinc-500">
                                Tip: Enter guarda · Esc descarta
                              </div>
                            </div>

                            {/* Mínimo */}
                            <div className="rounded-2xl border border-zinc-200 bg-white p-3">
                              <div className="text-xs font-semibold text-zinc-500">
                                Stock mínimo
                              </div>
                              <div className="mt-2 flex items-center gap-2">
                                <Input
                                  className={cn(
                                    "tabular-nums",
                                    dirtyMin
                                      ? "border-amber-300"
                                      : "border-zinc-200"
                                  )}
                                  value={minDraft[p.id] ?? "0"}
                                  onChange={(e) =>
                                    setMinValue(p.id, e.target.value)
                                  }
                                  onKeyDown={(e) => {
                                    if (
                                      e.key === "Enter" &&
                                      dirtyMin &&
                                      !savingMin
                                    )
                                      saveMin(p);
                                    if (e.key === "Escape") resetRowDrafts(p);
                                  }}
                                />
                                <Button
                                  {...(!dirtyMin
                                    ? { variant: "secondary" as const }
                                    : {})}
                                  loading={savingMin}
                                  disabled={!dirtyMin}
                                  onClick={() => saveMin(p)}
                                  title={dirtyMin ? "Guardar" : "Sin cambios"}
                                >
                                  <Save className="h-4 w-4" />
                                </Button>
                              </div>
                              <div className="mt-2 text-[11px] text-zinc-500">
                                Tip: Enter guarda · Esc descarta
                              </div>
                            </div>
                          </div>

                          {/* Footer row actions */}
                          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                            <div className="inline-flex items-center gap-2">
                              <StatusPill active={p.isActive} />
                              {dirtyAny && (
                                <span className="text-xs font-semibold text-amber-800">
                                  Tenés cambios sin guardar
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              <Button
                                variant="secondary"
                                onClick={() => resetRowDrafts(p)}
                                disabled={!dirtyAny || busy}
                              >
                                <X className="h-4 w-4" />
                                Descartar
                              </Button>

                              <Button
                                onClick={() => saveRow(p)}
                                disabled={!dirtyAny || busy}
                              >
                                <Save className="h-4 w-4" />
                                Guardar cambios
                              </Button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}

              {!loading && filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-10 text-center text-sm text-zinc-500"
                  >
                    No hay ingredientes para mostrar.
                  </td>
                </tr>
              )}

              {loading && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-10 text-center text-sm text-zinc-500"
                  >
                    Cargando…
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="text-xs text-zinc-500">
          Mostrando <b>{filtered.length}</b> de <b>{items.length}</b>{" "}
          ingredientes.
        </div>
      </div>
    </AdminProtected>
  );
}
