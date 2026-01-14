"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { AdminProtected } from "@/components/AdminProtected";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Field";

import {
  useCreateFinanceMovementMutation,
  useGetFinanceAccountsQuery,
  useGetFinanceCategoriesQuery,
  useGetFinanceMovementsQuery,
  useUpdateFinanceMovementMutation,
  useVoidFinanceMovementMutation,
  type FinanceMovementType,
  type FinanceMovementRow,
  FinanceMovementStatus,
  FinanceCategoryType,
} from "@/redux/services/financeApi";

import {
  Search,
  Plus,
  RefreshCcw,
  Ban,
  ChevronLeft,
  ChevronRight,
  ArrowRightLeft,
  Pencil,
  X,
  Save,
  CheckCircle2,
  AlertTriangle,
  SlidersHorizontal,
  ChevronDown,
  ChevronRight as ChevronRightIcon,
  CalendarDays,
  Wallet,
  Tag,
  StickyNote,
} from "lucide-react";

/* ===================== */
/* Helpers */
/* ===================== */

function todayKeyAR() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Cordoba",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function cn(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

function moneyARS(n: any) {
  const v = Number(n ?? 0) || 0;
  return v.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
}

function numLoose(s: string) {
  const raw = String(s ?? "")
    .trim()
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

/** si tu backend usa direction IN/OUT */
function directionFromType(type: FinanceMovementType) {
  if (type === "INCOME") return "IN";
  if (type === "EXPENSE") return "OUT";
  // Transfer: normalmente sale de cuenta origen y entra en destino, pero muchos backends lo modelan aparte.
  return "OUT";
}

const TYPE_OPTIONS: Array<{ label: string; value: FinanceMovementType }> = [
  { label: "Ingreso", value: "INCOME" },
  { label: "Egreso", value: "EXPENSE" },
  { label: "Transferencia", value: "TRANSFER" },
];

type StatusFilter = FinanceMovementStatus | "ALL";

function typePill(t: FinanceMovementType) {
  const base =
    "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold";
  if (t === "INCOME")
    return (
      <span
        className={cn(
          base,
          "border-emerald-200 bg-emerald-50 text-emerald-700"
        )}
      >
        INGRESO
      </span>
    );
  if (t === "EXPENSE")
    return (
      <span className={cn(base, "border-red-200 bg-red-50 text-red-700")}>
        EGRESO
      </span>
    );
  return (
    <span className={cn(base, "border-blue-200 bg-blue-50 text-blue-700")}>
      TRANSFER
    </span>
  );
}

function statusPill(s: FinanceMovementStatus) {
  const base =
    "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold";
  if (s === "VOID")
    return (
      <span className={cn(base, "border-red-200 bg-red-50 text-red-700")}>
        ANULADO
      </span>
    );

  return (
    <span className={cn(base, "border-zinc-200 bg-white text-zinc-700")}>
      POSTED
    </span>
  );
}

function useDebouncedValue<T>(value: T, delay = 250) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

/* ===================== */
/* Drawer (sin deps) */
/* ===================== */

function Drawer({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    setTimeout(() => panelRef.current?.focus(), 0);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-70">
      <button
        className="absolute inset-0 bg-black/35"
        onClick={onClose}
        aria-label="Cerrar"
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        className="absolute bottom-0 left-0 right-0 max-h-[88vh] overflow-hidden rounded-t-3xl border-t border-zinc-200 bg-white shadow-2xl outline-none"
      >
        <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-10 rounded-full bg-zinc-200" />
            <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-900 hover:bg-zinc-50"
          >
            <X className="h-4 w-4" />
            Cerrar
          </button>
        </div>

        <div className="max-h-[calc(88vh-112px)] overflow-auto p-4">
          {children}
        </div>

        {footer ? (
          <div className="border-t border-zinc-100 bg-white p-3">{footer}</div>
        ) : null}
      </div>
    </div>
  );
}

/* ===================== */
/* Edit/Create forms */
/* ===================== */

type MovementForm = {
  open: boolean;
  mode: "create" | "edit";
  id?: string;
  status?: FinanceMovementStatus;

  dateKey: string;
  type: FinanceMovementType;
  amount: string;

  accountId: string;
  toAccountId: string;

  categoryId: string; // IN/OUT
  notes: string;
};

function emptyForm(mode: "create" | "edit" = "create"): MovementForm {
  return {
    open: false,
    mode,
    dateKey: todayKeyAR(),
    type: "EXPENSE",
    amount: "",
    accountId: "",
    toAccountId: "",
    categoryId: "",
    notes: "",
    status: "POSTED",
  };
}

/* ===================== */
/* Page */
/* ===================== */

export default function FinanceMovementsPage() {
  /* ===================== */
  /* UI state */
  /* ===================== */

  const [toast, setToast] = useState<{
    type: "ok" | "err";
    msg: string;
  } | null>(null);
  function showOk(msg: string) {
    setToast({ type: "ok", msg });
    window.setTimeout(() => setToast(null), 2200);
  }
  function showErr(msg: string) {
    setToast({ type: "err", msg });
    window.setTimeout(() => setToast(null), 3200);
  }

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [form, setForm] = useState<MovementForm>(() => emptyForm("create"));

  /* ===================== */
  /* Filters */
  /* ===================== */

  const [from, setFrom] = useState(todayKeyAR());
  const [to, setTo] = useState(todayKeyAR());
  const [type, setType] = useState<FinanceMovementType | "">("");
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [q, setQ] = useState("");
  const qDebounced = useDebouncedValue(q, 250);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("POSTED");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);

  useEffect(() => {
    setPage(1);
  }, [from, to, type, accountId, categoryId, qDebounced, statusFilter, limit]);

  const filtersCount = useMemo(() => {
    let n = 0;
    if (from !== todayKeyAR() || to !== todayKeyAR()) n++;
    if (type) n++;
    if (accountId) n++;
    if (categoryId) n++;
    if (q.trim()) n++;
    if (statusFilter !== "POSTED") n++;
    if (limit !== 50) n++;
    return n;
  }, [from, to, type, accountId, categoryId, q, statusFilter, limit]);

  /* ===================== */
  /* Queries */
  /* ===================== */

  const movementsQuery = useGetFinanceMovementsQuery({
    from,
    to,
    type: type || undefined,
    accountId: accountId || undefined,
    categoryId: categoryId || undefined,
    q: qDebounced.trim() || undefined,
    page,
    limit,
    status: statusFilter === "ALL" ? undefined : statusFilter,
    includeVoided: statusFilter !== "POSTED",
  } as any);

  const { data: accounts = [] } = useGetFinanceAccountsQuery({
    active: undefined as any,
  } as any);
  const { data: categories = [] } = useGetFinanceCategoriesQuery({
    active: undefined as any,
  } as any);

  const accountNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of accounts as any[]) m.set(String(a.id), String(a.name));
    return m;
  }, [accounts]);

  const categoryNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of categories as any[]) m.set(String(c.id), String(c.name));
    return m;
  }, [categories]);

  /* ===================== */
  /* Mutations */
  /* ===================== */

  const [createMovement, createState] = useCreateFinanceMovementMutation();
  const [updateMovement, updateState] = useUpdateFinanceMovementMutation();
  const [voidMovement, voidState] = useVoidFinanceMovementMutation();
  const busy =
    createState.isLoading || updateState.isLoading || voidState.isLoading;

  /* ===================== */
  /* Data */
  /* ===================== */

  const items = useMemo(() => {
    const raw = (movementsQuery.data?.items ?? []) as FinanceMovementRow[];
    if (statusFilter === "ALL") return raw;
    return raw.filter((m: any) => m.status === statusFilter);
  }, [movementsQuery.data, statusFilter]);

  const total = movementsQuery.data?.total ?? items.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;

    for (const m of items as any[]) {
      if (m.status === "VOID") continue;
      if (m.type === "INCOME") income += Number(m.amount ?? 0) || 0;
      if (m.type === "EXPENSE") expense += Number(m.amount ?? 0) || 0;
    }
    return { income, expense, net: income - expense };
  }, [items]);

  /* ===================== */
  /* Categories for selects */
  /* ===================== */

  const createIsTransfer =
    form.open && form.mode === "create" && form.type === "TRANSFER";
  const editIsTransfer =
    form.open && form.mode === "edit" && form.type === "TRANSFER";
  const isTransfer = form.type === "TRANSFER";

  const allowedCategoriesForType = useMemo(() => {
    // Si tu backend deja cualquier categoría para income/expense, podés sacar el filtro.
    if (form.type === "INCOME") {
      return (categories as any[]).filter(
        (c) => c.type === "INCOME" || c.type === "BOTH"
      );
    }
    if (form.type === "EXPENSE") {
      return (categories as any[]).filter(
        (c) => c.type === "EXPENSE" || c.type === "BOTH"
      );
    }
    // TRANSFER
    return [];
  }, [categories, form.type]);

  const canSubmitForm = useMemo(() => {
    if (!form.open) return false;
    if (form.mode === "edit" && (!form.id || form.status === "VOID"))
      return false;
    if (!form.dateKey) return false;

    const amt = numLoose(form.amount);
    if (!Number.isFinite(amt) || amt <= 0) return false;

    if (!form.accountId) return false;

    if (isTransfer) {
      if (!form.toAccountId) return false;
      if (form.toAccountId === form.accountId) return false;
      return true;
    }

    // INCOME/EXPENSE: categoría opcional
    return true;
  }, [form, isTransfer]);

  /* ===================== */
  /* Actions: open/close */
  /* ===================== */

  function openCreate() {
    setForm({
      ...emptyForm("create"),
      open: true,
      dateKey: todayKeyAR(),
      type: "EXPENSE",
    });
  }

  function openEdit(m: any) {
    setForm({
      open: true,
      mode: "edit",
      id: String(m.id),
      status: m.status,
      dateKey: String(m.dateKey || todayKeyAR()),
      type: m.type as FinanceMovementType,
      amount: String(m.amount ?? ""),
      accountId: String(m.accountId ?? ""),
      toAccountId: String(m.toAccountId ?? ""),
      categoryId: String(m.categoryId ?? ""),
      notes: String(m.notes ?? ""),
    });
  }

  function closeForm() {
    setForm((p) => ({ ...p, open: false }));
  }

  /* ===================== */
  /* Create/Update */
  /* ===================== */

  async function submitForm() {
    try {
      const payload: any = {
        dateKey: form.dateKey,
        type: form.type,
        direction: directionFromType(form.type),
        amount: numLoose(form.amount),
        accountId: form.accountId,
        notes: form.notes.trim() || null,
      };

      if (form.type === "TRANSFER") {
        payload.toAccountId = form.toAccountId;
        payload.categoryId = null;
      } else {
        payload.toAccountId = null;
        payload.categoryId = form.categoryId || null;
      }

      if (form.mode === "create") {
        await createMovement(payload as any).unwrap();
        showOk("Movimiento creado ✔");
      } else {
        await updateMovement({ id: form.id!, ...payload } as any).unwrap();
        showOk("Movimiento actualizado ✔");
      }

      closeForm();
      movementsQuery.refetch();
    } catch (e: any) {
      showErr(String(e?.data?.message || e?.message || "Error guardando"));
    }
  }

  async function onVoid(m: any) {
    if (m.status === "VOID") return;

    const ok = window.confirm(
      `¿Anular este movimiento?\n\n${m.dateKey} · ${m.type} · ${moneyARS(
        m.amount
      )}`
    );
    if (!ok) return;

    try {
      await voidMovement({ id: m.id } as any).unwrap();
      showOk("Movimiento anulado ✔");
      movementsQuery.refetch();
    } catch (e: any) {
      showErr(String(e?.data?.message || e?.message || "No se pudo anular"));
    }
  }

  /* ===================== */
  /* Render helpers */
  /* ===================== */

  function FiltersContent() {
    return (
      <div className="grid grid-cols-1 md:grid-cols-8 gap-3">
        <Field label="Desde">
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </Field>

        <Field label="Hasta">
          <Input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </Field>

        <Field label="Tipo">
          <Select value={type} onChange={(e) => setType(e.target.value as any)}>
            <option value="">Todos</option>
            {TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Cuenta">
          <Select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
          >
            <option value="">Todas</option>
            {(accounts as any[]).map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Categoría">
          <Select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <option value="">Todas</option>
            {(categories as any[]).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Buscar">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9"
              placeholder="Notas…"
            />
          </div>
        </Field>

        <Field label="Estado">
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
          >
            <option value="POSTED">Activos</option>
            <option value="VOID">Anulados</option>
            <option value="ALL">Todos</option>
          </Select>
        </Field>

        <Field label="Por página">
          <Select
            value={String(limit)}
            onChange={(e) => setLimit(Number(e.target.value) || 50)}
          >
            <option value="25">25</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </Select>
        </Field>

        <div className="md:col-span-8 flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="text-xs text-zinc-500">
            Tip: búsqueda con debounce (250ms). Transferencias no afectan neto.
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setFrom(todayKeyAR());
                setTo(todayKeyAR());
                setType("");
                setAccountId("");
                setCategoryId("");
                setQ("");
                setStatusFilter("POSTED");
                setLimit(50);
              }}
              disabled={movementsQuery.isLoading || movementsQuery.isFetching}
            >
              Limpiar
            </Button>
            <Button
              variant="secondary"
              onClick={() => movementsQuery.refetch()}
              loading={movementsQuery.isFetching}
              disabled={movementsQuery.isLoading}
            >
              <span className="inline-flex items-center gap-2">
                <RefreshCcw className="h-4 w-4" />
                Actualizar{" "}
              </span>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  function FormContent() {
    const isVoid = form.status === "VOID";
    const sameAccount =
      form.type === "TRANSFER" &&
      form.accountId &&
      form.toAccountId &&
      form.accountId === form.toAccountId;

    return (
      <div className="space-y-3">
        {isVoid ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            Este movimiento está <b>ANULADO</b>. No se puede editar.
          </div>
        ) : null}

        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <Field label="Fecha">
            <div className="relative">
              <CalendarDays className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
              <Input
                className="pl-9"
                type="date"
                value={form.dateKey}
                onChange={(e) =>
                  setForm((p) => ({ ...p, dateKey: e.target.value }))
                }
                disabled={isVoid}
              />
            </div>
          </Field>

          <Field label="Tipo">
            <Select
              value={form.type}
              onChange={(e) => {
                const next = e.target.value as FinanceMovementType;
                setForm((p) => ({
                  ...p,
                  type: next,
                  // resets coherentes
                  categoryId: next === "TRANSFER" ? "" : p.categoryId,
                  toAccountId: next === "TRANSFER" ? p.toAccountId : "",
                }));
              }}
              disabled={isVoid}
            >
              {TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Monto">
            <Input
              inputMode="decimal"
              placeholder="0"
              value={form.amount}
              onChange={(e) =>
                setForm((p) => ({ ...p, amount: e.target.value }))
              }
              disabled={isVoid}
            />
          </Field>

          <Field label={form.type === "TRANSFER" ? "Cuenta origen" : "Cuenta"}>
            <div className="relative">
              <Wallet className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
              <Select
                className="pl-9"
                value={form.accountId}
                onChange={(e) =>
                  setForm((p) => ({ ...p, accountId: e.target.value }))
                }
                disabled={isVoid}
              >
                <option value="">Seleccionar</option>
                {(accounts as any[]).map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </div>
          </Field>

          <Field
            label={form.type === "TRANSFER" ? "Cuenta destino" : "Categoría"}
          >
            {form.type === "TRANSFER" ? (
              <Select
                value={form.toAccountId}
                onChange={(e) =>
                  setForm((p) => ({ ...p, toAccountId: e.target.value }))
                }
                disabled={isVoid}
              >
                <option value="">Seleccionar</option>
                {(accounts as any[]).map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            ) : (
              <div className="relative">
                <Tag className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                <Select
                  className="pl-9"
                  value={form.categoryId}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, categoryId: e.target.value }))
                  }
                  disabled={isVoid}
                >
                  <option value="">(Opcional)</option>
                  {allowedCategoriesForType.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </div>
            )}
          </Field>

          <Field label="Notas">
            <div className="relative">
              <StickyNote className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
              <Input
                className="pl-9"
                value={form.notes}
                onChange={(e) =>
                  setForm((p) => ({ ...p, notes: e.target.value }))
                }
                placeholder="Opcional"
                disabled={isVoid}
              />
            </div>
          </Field>
        </div>

        {sameAccount ? (
          <div className="text-sm text-red-600">
            La cuenta destino no puede ser la misma que la cuenta origen.
          </div>
        ) : null}

        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-600">
          <b>Tip:</b> Para transferencias, seleccioná origen y destino. Para
          ingresos/egresos, la categoría es opcional.
        </div>
      </div>
    );
  }

  /* ===================== */
  /* Render */
  /* ===================== */

  return (
    <AdminProtected>
      <div className="space-y-4 md:space-y-6">
        {/* Header */}
        <div className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="text-xl font-semibold text-zinc-900 md:text-2xl">
                Finance · Movimientos
              </h1>
              <p className="mt-1 text-sm text-zinc-500">
                Ingresos, egresos y transferencias.
              </p>
            </div>

            {/* Desktop actions */}
            <div className="hidden gap-2 md:flex">
              <Button
                variant="secondary"
                onClick={() => movementsQuery.refetch()}
                loading={movementsQuery.isFetching}
                disabled={movementsQuery.isLoading}
                title="Refrescar"
              >
                <RefreshCcw className="h-4 w-4" />
              </Button>
              <Button onClick={openCreate} title="Nuevo">
                <span className="inline-flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Nuevo
                </span>
              </Button>
            </div>

            {/* Mobile actions */}
            <div className="flex gap-2 md:hidden">
              <Button
                variant="secondary"
                onClick={() => setFiltersOpen(true)}
                className="flex-1"
              >
                <SlidersHorizontal className="h-4 w-4" />
                Filtros
                {filtersCount ? (
                  <span className="ml-2 rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] font-bold text-white">
                    {filtersCount}
                  </span>
                ) : null}
              </Button>
              <Button onClick={openCreate} className="flex-1">
                <Plus className="h-4 w-4" />
                Nuevo
              </Button>
            </div>
          </div>

          {/* Toast */}
          {toast ? (
            <div
              className={cn(
                "mt-4 rounded-xl border px-3 py-2 text-sm flex items-center gap-2",
                toast.type === "ok"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-red-200 bg-red-50 text-red-700"
              )}
            >
              {toast.type === "ok" ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <AlertTriangle className="h-4 w-4" />
              )}
              {toast.msg}
            </div>
          ) : null}
        </div>

        {/* Totals */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Card>
            <CardBody>
              <div className="text-xs text-zinc-500">Ingresos</div>
              <div className="mt-1 text-lg font-bold">
                {moneyARS(totals.income)}
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <div className="text-xs text-zinc-500">Gastos</div>
              <div className="mt-1 text-lg font-bold">
                {moneyARS(totals.expense)}
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <div className="text-xs text-zinc-500">Neto</div>
              <div
                className={cn(
                  "mt-1 text-lg font-bold",
                  totals.net >= 0 ? "text-emerald-700" : "text-red-700"
                )}
              >
                {moneyARS(totals.net)}
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Desktop Filters */}
        <div className="hidden md:block">
          <Card>
            <CardBody>
              <FiltersContent />
            </CardBody>
          </Card>
        </div>

        {/* Mobile Filters Drawer */}
        <Drawer
          open={filtersOpen}
          onClose={() => setFiltersOpen(false)}
          title="Filtros"
          footer={
            <div className="grid grid-cols-2 gap-2">
              <button
                className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-900 hover:bg-zinc-50 disabled:opacity-60"
                disabled={movementsQuery.isLoading || movementsQuery.isFetching}
                onClick={() => {
                  setFrom(todayKeyAR());
                  setTo(todayKeyAR());
                  setType("");
                  setAccountId("");
                  setCategoryId("");
                  setQ("");
                  setStatusFilter("POSTED");
                  setLimit(50);
                  setFiltersOpen(false);
                }}
              >
                Limpiar
              </button>
              <button
                className="rounded-2xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white hover:bg-zinc-800"
                onClick={() => setFiltersOpen(false)}
              >
                Aplicar
              </button>
            </div>
          }
        >
          <FiltersContent />
        </Drawer>

        {/* Table (desktop) + Cards (mobile) */}
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
          {movementsQuery.isLoading ? (
            <div className="p-4 text-sm text-zinc-500">Cargando…</div>
          ) : movementsQuery.error ? (
            <div className="p-4 text-sm text-red-600">
              Error cargando movimientos
            </div>
          ) : items.length === 0 ? (
            <div className="p-4 text-sm text-zinc-500">
              Sin movimientos para este filtro.
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block">
                <table className="min-w-full text-sm">
                  <thead className="sticky top-0 bg-zinc-50">
                    <tr>
                      <th className="p-3 text-left text-zinc-500">Fecha</th>
                      <th className="p-3 text-left text-zinc-500">Tipo</th>
                      <th className="p-3 text-right text-zinc-500">Monto</th>
                      <th className="p-3 text-left text-zinc-500">Cuenta</th>
                      <th className="p-3 text-left text-zinc-500">Categoría</th>
                      <th className="p-3 text-left text-zinc-500">Estado</th>
                      <th className="p-3 text-right text-zinc-500">Acciones</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-zinc-100">
                    {items.map((m: any) => {
                      const isVoid = m.status === "VOID";

                      const acc =
                        m.accountNameSnapshot ||
                        accountNameById.get(String(m.accountId)) ||
                        String(m.accountId);

                      const toAcc =
                        m.toAccountNameSnapshot ||
                        accountNameById.get(String(m.toAccountId)) ||
                        (m.toAccountId ? String(m.toAccountId) : "");

                      const cat =
                        m.type === "TRANSFER"
                          ? "—"
                          : m.categoryNameSnapshot ||
                            categoryNameById.get(String(m.categoryId)) ||
                            (m.categoryId ? String(m.categoryId) : "—");

                      return (
                        <tr key={m.id} className={cn(isVoid && "bg-red-50/40")}>
                          <td className="p-3">{m.dateKey}</td>

                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              {typePill(m.type)}
                              {m.type === "TRANSFER" && (
                                <ArrowRightLeft className="h-4 w-4 text-zinc-400" />
                              )}
                            </div>
                          </td>

                          <td className="p-3 text-right font-semibold">
                            {moneyARS(m.amount)}
                          </td>

                          <td className="p-3">
                            {m.type === "TRANSFER" ? (
                              <div className="text-sm">
                                <div className="font-semibold text-zinc-900">
                                  {acc}
                                </div>
                                <div className="text-zinc-500">
                                  {toAcc ? `→ ${toAcc}` : "→ —"}
                                </div>
                              </div>
                            ) : (
                              <span className="font-semibold text-zinc-900">
                                {acc}
                              </span>
                            )}
                          </td>

                          <td className="p-3">{cat}</td>

                          <td className="p-3">{statusPill(m.status)}</td>

                          <td className="p-3 text-right">
                            <div className="inline-flex gap-2">
                              <Button
                                variant="secondary"
                                onClick={() => openEdit(m)}
                                disabled={isVoid || busy}
                                title={
                                  isVoid
                                    ? "No se puede editar un anulado"
                                    : "Editar"
                                }
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>

                              <Button
                                variant="danger"
                                onClick={() => onVoid(m)}
                                disabled={isVoid || busy}
                                loading={voidState.isLoading}
                                title="Anular"
                              >
                                <Ban className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden divide-y divide-zinc-100">
                {items.map((m: any) => {
                  const isVoid = m.status === "VOID";

                  const acc =
                    m.accountNameSnapshot ||
                    accountNameById.get(String(m.accountId)) ||
                    String(m.accountId);

                  const toAcc =
                    m.toAccountNameSnapshot ||
                    accountNameById.get(String(m.toAccountId)) ||
                    (m.toAccountId ? String(m.toAccountId) : "");

                  const cat =
                    m.type === "TRANSFER"
                      ? "—"
                      : m.categoryNameSnapshot ||
                        categoryNameById.get(String(m.categoryId)) ||
                        (m.categoryId ? String(m.categoryId) : "—");

                  return (
                    <div
                      key={m.id}
                      className={cn("p-4", isVoid && "bg-red-50/40")}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-zinc-700">
                              {m.dateKey}
                            </span>
                            {typePill(m.type)}
                            {statusPill(m.status)}
                          </div>

                          <div className="mt-2 text-lg font-bold text-zinc-900">
                            {moneyARS(m.amount)}
                          </div>

                          <div className="mt-2 text-sm text-zinc-700">
                            {m.type === "TRANSFER" ? (
                              <>
                                <div className="font-semibold">{acc}</div>
                                <div className="text-zinc-500">
                                  {toAcc ? `→ ${toAcc}` : "→ —"}
                                </div>
                              </>
                            ) : (
                              <div className="font-semibold">{acc}</div>
                            )}
                          </div>

                          <div className="mt-1 text-sm text-zinc-500">
                            Categoría:{" "}
                            <span className="text-zinc-700">{cat}</span>
                          </div>

                          {m.notes ? (
                            <div className="mt-1 text-sm text-zinc-500">
                              Notas:{" "}
                              <span className="text-zinc-700">
                                {String(m.notes)}
                              </span>
                            </div>
                          ) : null}
                        </div>

                        <div className="shrink-0 flex flex-col gap-2">
                          <button
                            className="rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-900 hover:bg-zinc-50 disabled:opacity-60"
                            onClick={() => openEdit(m)}
                            disabled={isVoid || busy}
                            title={isVoid ? "No se puede editar" : "Editar"}
                          >
                            <span className="inline-flex items-center gap-2">
                              <Pencil className="h-4 w-4" />
                              Editar
                            </span>
                          </button>

                          <button
                            className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                            onClick={() => onVoid(m)}
                            disabled={isVoid || busy}
                            title="Anular"
                          >
                            <span className="inline-flex items-center gap-2">
                              <Ban className="h-4 w-4" />
                              Anular
                            </span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Pagination */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm text-zinc-500">
            {total > 0 ? (
              <>
                Página{" "}
                <span className="font-semibold text-zinc-900">{page}</span> de{" "}
                <span className="font-semibold text-zinc-900">
                  {totalPages}
                </span>{" "}
                · <span className="font-semibold text-zinc-900">{total}</span>{" "}
                items
              </>
            ) : (
              "—"
            )}
          </div>

          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              title="Anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="secondary"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              title="Siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Create/Edit Drawer */}
        <Drawer
          open={form.open}
          onClose={closeForm}
          title={
            form.mode === "create" ? "Nuevo movimiento" : "Editar movimiento"
          }
          footer={
            <div className="grid grid-cols-2 gap-2">
              <button
                className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-900 hover:bg-zinc-50 disabled:opacity-60"
                onClick={closeForm}
                disabled={busy}
              >
                Cancelar
              </button>
              <button
                className="rounded-2xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60"
                onClick={submitForm}
                disabled={!canSubmitForm || busy}
                title={
                  !canSubmitForm
                    ? "Completá los campos obligatorios"
                    : "Guardar"
                }
              >
                <span className="inline-flex items-center justify-center gap-2">
                  <Save className="h-4 w-4" />
                  {busy ? "Guardando…" : "Guardar"}
                </span>
              </button>
            </div>
          }
        >
          <FormContent />
        </Drawer>

        {/* Mobile sticky bar */}
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white/95 p-3 backdrop-blur md:hidden">
          <div className="mx-auto flex max-w-3xl items-center gap-2">
            <button
              className="flex-1 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-900 shadow-sm hover:bg-zinc-50 disabled:opacity-60"
              disabled={movementsQuery.isLoading}
              onClick={() => movementsQuery.refetch()}
            >
              <span className="inline-flex items-center gap-2">
                <RefreshCcw
                  className={cn(
                    "h-4 w-4",
                    movementsQuery.isFetching && "animate-spin"
                  )}
                />
                Actualizar
              </span>
            </button>

            <button
              className="flex-1 rounded-2xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800 disabled:opacity-60"
              onClick={openCreate}
              disabled={busy}
            >
              <span className="inline-flex items-center justify-center gap-2">
                <Plus className="h-4 w-4" />
                Nuevo
              </span>
            </button>
          </div>
        </div>
        <div className="h-16 md:hidden" />
      </div>
    </AdminProtected>
  );
}
