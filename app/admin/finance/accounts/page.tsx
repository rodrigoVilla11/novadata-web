"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AdminProtected } from "@/components/AdminProtected";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Field";
import { useAuth } from "@/app/providers/AuthProvider";

import {
  FinanceAccountType,
  useCreateFinanceAccountMutation,
  useGetFinanceAccountsQuery,
  useUpdateFinanceAccountMutation,
} from "@/redux/services/financeApi";

import {
  RefreshCcw,
  Plus,
  Search,
  X,
  CheckCircle2,
  AlertTriangle,
  Wallet,
  ArrowLeft,
  Pencil,
  SlidersHorizontal,
  ChevronRight,
  Power,
} from "lucide-react";

/* =============================================================================
 * Helpers
 * ========================================================================== */

function buildAccountCode(name: string) {
  return name
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_")
    .replace(/[^A-Z0-9_]/g, "")
    .slice(0, 24);
}

const TYPE_OPTIONS: Array<{ label: string; value: FinanceAccountType }> = [
  { label: "Efectivo", value: "CASH" },
  { label: "Banco", value: "BANK" },
  { label: "Billetera", value: "WALLET" },
];

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function parseNumberLoose(v: string) {
  const s = String(v ?? "")
    .trim()
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function getActiveFlag(a: any): boolean {
  if (typeof a?.isActive === "boolean") return a.isActive;
  if (typeof a?.active === "boolean") return a.active;
  return true;
}

function moneyARS(n: number) {
  const v = Number(n ?? 0) || 0;
  return v.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
}

function typeBadge(t: FinanceAccountType) {
  const base =
    "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold";
  if (t === "CASH")
    return (
      <span
        className={cn(
          base,
          "border-emerald-200 bg-emerald-50 text-emerald-700"
        )}
      >
        Efectivo
      </span>
    );
  if (t === "BANK")
    return (
      <span className={cn(base, "border-blue-200 bg-blue-50 text-blue-700")}>
        Banco
      </span>
    );
  return (
    <span
      className={cn(base, "border-violet-200 bg-violet-50 text-violet-700")}
    >
      Billetera
    </span>
  );
}

function statusPill(active: boolean) {
  const base =
    "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold";
  if (active) {
    return (
      <span
        className={cn(
          base,
          "border-emerald-200 bg-emerald-50 text-emerald-700"
        )}
      >
        <CheckCircle2 className="h-3.5 w-3.5" />
        Activa
      </span>
    );
  }
  return (
    <span className={cn(base, "border-zinc-200 bg-zinc-50 text-zinc-600")}>
      Inactiva
    </span>
  );
}

function useDebouncedValue<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function normalizeAccountForEdit(a: any) {
  return {
    id: String(a?.id ?? a?._id ?? ""),
    name: String(a?.name ?? ""),
    type: (a?.type ?? "CASH") as FinanceAccountType,
    currency: String(a?.currency ?? "ARS"),
    openingBalance: Number(a?.openingBalance ?? 0) || 0,
    notes: (a?.notes ?? null) as string | null,
    isActive: getActiveFlag(a),
  };
}

/* =============================================================================
 * Minimal Drawer (no deps) - bottom sheet on mobile
 * ========================================================================== */

function Drawer({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
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
            <h3 className="text-sm font-semibold text-zinc-900">
              {title || "Panel"}
            </h3>
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

/* =============================================================================
 * Account Form Panel (Create + Edit) - now as Drawer on mobile + inline on desktop
 * ========================================================================== */

type AccountFormMode = "create" | "edit";

function AccountForm({
  mode,
  initial,
  onSubmit,
  onCancel,
  isSubmitting,
  serverError,
}: {
  mode: AccountFormMode;
  initial?: {
    id?: string;
    name: string;
    type: FinanceAccountType;
    currency: string;
    openingBalance: number;
    notes: string | null;
  } | null;
  onCancel: () => void;
  onSubmit: (data: {
    id?: string;
    name: string;
    type: FinanceAccountType;
    currency: string;
    openingBalance: number;
    notes: string | null;
  }) => Promise<void>;
  isSubmitting: boolean;
  serverError?: string | null;
}) {
  const [name, setName] = useState("");
  const [accType, setAccType] = useState<FinanceAccountType>("CASH");
  const [currency, setCurrency] = useState("ARS");
  const [openingBalance, setOpeningBalance] = useState("0");
  const [notes, setNotes] = useState("");

  const nameRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const init = initial ?? null;
    setName(init?.name ?? "");
    setAccType(init?.type ?? "CASH");
    setCurrency((init?.currency ?? "ARS").toUpperCase());
    setOpeningBalance(String(init?.openingBalance ?? 0));
    setNotes(init?.notes ?? "");
    setTimeout(() => nameRef.current?.focus(), 50);
  }, [initial]);

  const canSubmit = name.trim().length > 0 && currency.trim().length > 0;

  async function submit() {
    if (!canSubmit || isSubmitting) return;
    await onSubmit({
      id: initial?.id,
      name: name.trim(),
      type: accType,
      currency: currency.trim().toUpperCase(),
      openingBalance: parseNumberLoose(openingBalance),
      notes: notes.trim() ? notes.trim() : null,
    });
  }

  return (
    <div className="space-y-3">
      {serverError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {serverError}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <Field label="Nombre">
          <Input
            ref={nameRef as any}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder='Ej: "Efectivo", "Santander", "MP"...'
          />
        </Field>

        <Field label="Tipo">
          <Select
            value={accType}
            onChange={(e) => setAccType(e.target.value as any)}
          >
            {TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Moneda">
          <Input
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            placeholder="ARS"
          />
        </Field>

        <Field label="Saldo inicial">
          <Input
            value={openingBalance}
            onChange={(e) => setOpeningBalance(e.target.value)}
            inputMode="decimal"
            placeholder="0"
          />
        </Field>

        <div className="md:col-span-4">
          <Field label="Notas (opcional)">
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas internas…"
            />
          </Field>
        </div>

        <div className="md:col-span-4 flex items-center justify-end gap-2">
          <Button
            variant="secondary"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button onClick={submit} disabled={!canSubmit} loading={isSubmitting}>
            {mode === "create" ? "Crear cuenta" : "Guardar cambios"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* =============================================================================
 * Page
 * ========================================================================== */

export default function FinanceAccountsPage() {
  const { user } = useAuth();
  const branchId = String((user as any)?.branchId || "");

  const [q, setQ] = useState("");
  const [type, setType] = useState<FinanceAccountType | "">("");
  const [activeFilter, setActiveFilter] = useState<
    "active" | "inactive" | "all"
  >("active");

  const qDebounced = useDebouncedValue(q, 300);

  const activeParam = useMemo(() => {
    if (activeFilter === "all") return undefined;
    if (activeFilter === "inactive") return false;
    return true;
  }, [activeFilter]);

  const { data, isLoading, isFetching, error, refetch } =
    useGetFinanceAccountsQuery({
      branchId: branchId || undefined,
      q: qDebounced.trim() || undefined,
      type: (type || undefined) as any,
      active: activeParam,
    } as any);

  const [createAccount, createState] = useCreateFinanceAccountMutation();
  const [updateAccount, updateState] = useUpdateFinanceAccountMutation();

  // panel (drawer on mobile)
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelMode, setPanelMode] = useState<AccountFormMode>("create");
  const [panelInitial, setPanelInitial] = useState<any>(null);
  const [panelErr, setPanelErr] = useState<string | null>(null);

  // filters drawer (mobile)
  const [filtersOpen, setFiltersOpen] = useState(false);

  const rows = useMemo(() => (data || []) as any[], [data]);

  const stats = useMemo(() => {
    const total = rows.length;
    const active = rows.filter((r) => getActiveFlag(r)).length;
    const inactive = total - active;
    const sumOpening = rows.reduce(
      (acc, r: any) => acc + (Number(r.openingBalance ?? 0) || 0),
      0
    );
    return { total, active, inactive, sumOpening };
  }, [rows]);

  const topError =
    (error as any)?.data?.message || (error as any)?.message || null;

  const activeFiltersCount = useMemo(() => {
    let n = 0;
    if (q.trim()) n++;
    if (type) n++;
    if (activeFilter !== "active") n++;
    return n;
  }, [q, type, activeFilter]);

  function openCreate() {
    setPanelErr(null);
    setPanelMode("create");
    setPanelInitial({
      name: "",
      type: "CASH",
      currency: "ARS",
      openingBalance: 0,
      notes: "",
    });
    setPanelOpen(true);
  }

  function openEdit(a: any) {
    const norm = normalizeAccountForEdit(a);
    setPanelErr(null);
    setPanelMode("edit");
    setPanelInitial({
      id: norm.id,
      name: norm.name,
      type: norm.type,
      currency: norm.currency,
      openingBalance: norm.openingBalance,
      notes: norm.notes ?? "",
    });
    setPanelOpen(true);
  }

  async function onPanelSubmit(payload: {
    id?: string;
    name: string;
    type: FinanceAccountType;
    currency: string;
    openingBalance: number;
    notes: string | null;
  }) {
    setPanelErr(null);
    try {
      if (panelMode === "create") {
        await createAccount({
          branchId: branchId || undefined,
          code: buildAccountCode(payload.name),
          name: payload.name,
          type: payload.type,
          currency: payload.currency,
          openingBalance: payload.openingBalance,
          notes: payload.notes,
        } as any).unwrap();
      } else {
        if (!payload.id) throw new Error("Falta id para editar");
        await updateAccount({
          branchId: branchId || undefined,
          id: payload.id,
          code: buildAccountCode(payload.name),
          name: payload.name,
          type: payload.type,
          currency: payload.currency,
          openingBalance: payload.openingBalance,
          notes: payload.notes,
        } as any).unwrap();
      }

      setPanelOpen(false);
      refetch();
    } catch (e: any) {
      setPanelErr(e?.data?.message || e?.message || "No se pudo guardar.");
    }
  }

  async function toggleActive(a: any) {
    const next = !getActiveFlag(a);
    if (
      !window.confirm(
        next
          ? `¿Activar "${a.name}"?`
          : `¿Desactivar "${a.name}"?\n\nNo se borra, solo se oculta.`
      )
    )
      return;

    try {
      await updateAccount({
        branchId: branchId || undefined,
        id: a.id,
        isActive: next,
      } as any).unwrap();
      refetch();
    } catch (e: any) {
      alert(
        e?.data?.message || e?.message || "No se pudo actualizar el estado."
      );
    }
  }

  const panelSubmitting = createState.isLoading || updateState.isLoading;

  return (
    <AdminProtected>
      <div className="space-y-4 md:space-y-6">
        {/* Header */}
        <div className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs">
                <Link
                  href="/admin/finance"
                  className="inline-flex items-center gap-1 rounded-xl border border-zinc-200 bg-white px-2.5 py-1.5 font-semibold text-zinc-700 hover:bg-zinc-50"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Finance
                </Link>
                <ChevronRight className="h-4 w-4 text-zinc-300" />
                <span className="font-semibold text-zinc-700">Cuentas</span>
              </div>

              <h1 className="mt-3 text-xl font-semibold text-zinc-900 md:text-2xl">
                Finance · Cuentas
              </h1>
              <p className="mt-1 text-sm text-zinc-500">
                Efectivo, bancos y billeteras. Definí saldos iniciales para
                balances correctos.
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full border px-3 py-1 text-xs font-semibold text-zinc-700">
                  Total: {stats.total}
                </span>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                  Activas: {stats.active}
                </span>
                <span className="rounded-full border px-3 py-1 text-xs font-semibold text-zinc-700">
                  Inactivas: {stats.inactive}
                </span>
                <span className="rounded-full border px-3 py-1 text-xs font-semibold text-zinc-700">
                  Σ Inicial: {moneyARS(stats.sumOpening)}
                </span>
              </div>
            </div>

            {/* Desktop actions */}
            <div className="hidden items-center gap-2 md:flex">
              <Button
                variant="secondary"
                onClick={refetch}
                loading={isFetching}
                disabled={isLoading}
                title="Actualizar"
              >
                <RefreshCcw className="h-4 w-4" />
              </Button>
              <Button onClick={openCreate}>
                <span className="inline-flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Nueva cuenta
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
                {activeFiltersCount ? (
                  <span className="ml-2 rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] font-bold text-white">
                    {activeFiltersCount}
                  </span>
                ) : null}
              </Button>
              <Button onClick={openCreate} className="flex-1">
                <Plus className="h-4 w-4" />
                Nueva
              </Button>
            </div>
          </div>

          {topError ? (
            <div className="mt-4 flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4" />
              <div>
                <div className="font-semibold">
                  No se pudieron cargar las cuentas
                </div>
                <div className="text-amber-700">{topError}</div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Desktop: Filters card */}
        <div className="hidden md:block">
          <Card>
            <CardBody>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
                <Field label="Buscar">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                    <Input
                      className="pl-9"
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      placeholder="Nombre…"
                    />
                  </div>
                </Field>

                <Field label="Tipo">
                  <Select
                    value={type}
                    onChange={(e) => setType(e.target.value as any)}
                  >
                    <option value="">Todos</option>
                    {TYPE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field label="Estado">
                  <Select
                    value={activeFilter}
                    onChange={(e) => setActiveFilter(e.target.value as any)}
                  >
                    <option value="active">Activas</option>
                    <option value="inactive">Inactivas</option>
                    <option value="all">Todas</option>
                  </Select>
                </Field>

                <div className="md:col-span-2 flex items-end justify-end gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setQ("");
                      setType("");
                      setActiveFilter("active");
                    }}
                    disabled={isLoading || isFetching}
                  >
                    Limpiar
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={refetch}
                    loading={isFetching}
                    disabled={isLoading}
                  >
                    <span className="inline-flex items-center gap-2">
                      <RefreshCcw className="h-4 w-4" />
                      Actualizar
                    </span>
                  </Button>
                </div>
              </div>
              <div className="mt-3 text-xs text-zinc-500">
                Tip: Buscar filtra con debounce (300ms).
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Mobile: Cards list */}
        <div className="md:hidden space-y-3">
          {(isLoading || isFetching) && rows.length === 0 ? (
            <>
              <div className="animate-pulse rounded-2xl border border-zinc-200 bg-white p-4">
                <div className="h-4 w-44 rounded bg-zinc-100" />
                <div className="mt-2 h-3 w-64 rounded bg-zinc-100" />
                <div className="mt-3 flex gap-2">
                  <div className="h-6 w-20 rounded-full bg-zinc-100" />
                  <div className="h-6 w-24 rounded-full bg-zinc-100" />
                </div>
              </div>
              <div className="animate-pulse rounded-2xl border border-zinc-200 bg-white p-4">
                <div className="h-4 w-52 rounded bg-zinc-100" />
                <div className="mt-2 h-3 w-60 rounded bg-zinc-100" />
                <div className="mt-3 flex gap-2">
                  <div className="h-6 w-20 rounded-full bg-zinc-100" />
                  <div className="h-6 w-24 rounded-full bg-zinc-100" />
                </div>
              </div>
            </>
          ) : rows.length === 0 ? (
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600">
              No hay cuentas para mostrar.
            </div>
          ) : (
            rows.map((a: any) => {
              const isActive = getActiveFlag(a);
              const opening = Number(a.openingBalance ?? 0) || 0;

              return (
                <div
                  key={a.id}
                  className={cn(
                    "rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm",
                    !isActive && "opacity-70"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-700">
                          <Wallet className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-zinc-900">
                            {a.name}
                          </div>
                          <div className="truncate text-xs text-zinc-500">
                            {a.id}
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {typeBadge(a.type)}
                        {statusPill(isActive)}
                        <span className="inline-flex items-center rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-700">
                          {a.currency || "ARS"}
                        </span>
                      </div>

                      <div className="mt-3 text-sm font-semibold text-zinc-900">
                        Saldo inicial: {moneyARS(opening)}
                      </div>

                      {a.notes ? (
                        <div className="mt-2 line-clamp-2 text-xs text-zinc-600">
                          {a.notes}
                        </div>
                      ) : (
                        <div className="mt-2 text-xs text-zinc-400">
                          — sin notas —
                        </div>
                      )}
                    </div>

                    <div className="shrink-0">
                      <button
                        onClick={() => openEdit(a)}
                        className="inline-flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-900 hover:bg-zinc-50"
                        disabled={panelSubmitting}
                      >
                        <Pencil className="h-4 w-4" />
                        Editar
                      </button>

                      <button
                        onClick={() => toggleActive(a)}
                        className={cn(
                          "mt-2 inline-flex w-full items-center justify-center gap-2 rounded-2xl border px-3 py-2 text-xs font-semibold",
                          isActive
                            ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                            : "border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50"
                        )}
                        disabled={updateState.isLoading}
                      >
                        <Power className="h-4 w-4" />
                        {isActive ? "Desactivar" : "Activar"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}

          <div className="pb-16 text-xs text-zinc-500">
            Tip: desactivadas no se borran — solo se ocultan.
          </div>
        </div>

        {/* Desktop: Table */}
        <div className="hidden md:block overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <div className="max-h-[70vh] overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 z-10 bg-zinc-50">
                <tr className="border-b border-zinc-200">
                  <th className="px-4 py-3 text-left text-zinc-500">Cuenta</th>
                  <th className="px-4 py-3 text-left text-zinc-500">Tipo</th>
                  <th className="px-4 py-3 text-left text-zinc-500">Estado</th>
                  <th className="px-4 py-3 text-left text-zinc-500">Moneda</th>
                  <th className="px-4 py-3 text-right text-zinc-500">
                    Saldo inicial
                  </th>
                  <th className="px-4 py-3 text-left text-zinc-500">Notas</th>
                  <th className="px-4 py-3 text-right text-zinc-500">
                    Acciones
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-zinc-100">
                {rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-10 text-center text-sm text-zinc-500"
                    >
                      {isLoading
                        ? "Cargando cuentas…"
                        : "No hay cuentas para mostrar."}
                    </td>
                  </tr>
                ) : (
                  rows.map((a: any) => {
                    const isActive = getActiveFlag(a);
                    const opening = Number(a.openingBalance ?? 0) || 0;

                    return (
                      <tr
                        key={a.id}
                        className={cn(
                          "hover:bg-zinc-50",
                          !isActive && "opacity-60"
                        )}
                      >
                        <td className="px-4 py-3">
                          <div className="font-semibold text-zinc-900">
                            {a.name}
                          </div>
                          <div className="text-xs text-zinc-500">{a.id}</div>
                        </td>
                        <td className="px-4 py-3">{typeBadge(a.type)}</td>
                        <td className="px-4 py-3">{statusPill(isActive)}</td>
                        <td className="px-4 py-3">{a.currency || "ARS"}</td>
                        <td className="px-4 py-3 text-right font-semibold text-zinc-900">
                          {moneyARS(opening)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              "text-zinc-700",
                              !a.notes && "text-zinc-400"
                            )}
                          >
                            {a.notes || "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-2">
                            <Button
                              variant="secondary"
                              onClick={() => openEdit(a)}
                              disabled={panelSubmitting}
                            >
                              <Pencil className="h-4 w-4" />
                              Editar
                            </Button>

                            <Button
                              variant={isActive ? "danger" : "secondary"}
                              onClick={() => toggleActive(a)}
                              loading={updateState.isLoading}
                            >
                              {isActive ? "Desactivar" : "Activar"}
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
        </div>

        {/* Mobile sticky bar */}
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white/95 p-3 backdrop-blur md:hidden">
          <div className="mx-auto flex max-w-3xl items-center gap-2">
            <button
              className="flex-1 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-900 shadow-sm hover:bg-zinc-50 disabled:opacity-60"
              disabled={isLoading}
              onClick={() => refetch()}
            >
              <span className="inline-flex items-center justify-center gap-2">
                <RefreshCcw
                  className={cn("h-4 w-4", isFetching && "animate-spin")}
                />
                Actualizar
              </span>
            </button>

            <button
              className="flex-1 rounded-2xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800 disabled:opacity-60"
              onClick={openCreate}
              disabled={panelSubmitting}
            >
              <span className="inline-flex items-center justify-center gap-2">
                <Plus className="h-4 w-4" />
                Nueva
              </span>
            </button>
          </div>
        </div>

        <div className="h-16 md:hidden" />

        {/* Filters Drawer (mobile) */}
        <Drawer
          open={filtersOpen}
          onClose={() => setFiltersOpen(false)}
          title="Filtros"
          footer={
            <div className="grid grid-cols-2 gap-2">
              <button
                className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-900 hover:bg-zinc-50 disabled:opacity-60"
                disabled={isLoading || isFetching}
                onClick={() => {
                  setQ("");
                  setType("");
                  setActiveFilter("active");
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
          <div className="grid gap-3">
            <Field label="Buscar">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                <Input
                  className="pl-9"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Nombre…"
                />
              </div>
            </Field>

            <Field label="Tipo">
              <Select
                value={type}
                onChange={(e) => setType(e.target.value as any)}
              >
                <option value="">Todos</option>
                {TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Estado">
              <Select
                value={activeFilter}
                onChange={(e) => setActiveFilter(e.target.value as any)}
              >
                <option value="active">Activas</option>
                <option value="inactive">Inactivas</option>
                <option value="all">Todas</option>
              </Select>
            </Field>

            <div className="text-xs text-zinc-500">
              Tip: Buscar filtra con debounce (300ms).
            </div>
          </div>
        </Drawer>

        {/* Create/Edit Drawer */}
        <Drawer
          open={panelOpen}
          onClose={() => setPanelOpen(false)}
          title={panelMode === "create" ? "Nueva cuenta" : "Editar cuenta"}
          footer={
            <div className="text-xs text-zinc-500">
              {panelMode === "create"
                ? "Creá una cuenta para registrar movimientos (caja/banco/billetera)."
                : "Actualizar esto no toca movimientos ya cargados."}
            </div>
          }
        >
          <AccountForm
            mode={panelMode}
            initial={panelInitial}
            onCancel={() => setPanelOpen(false)}
            onSubmit={onPanelSubmit}
            isSubmitting={panelSubmitting}
            serverError={panelErr}
          />
        </Drawer>

        {/* Desktop inline panel (optional): keep it if you like “inline form” UX */}
        {/* If you prefer: remove this block. */}
        <div className="hidden md:block">
          {panelOpen ? (
            <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-700">
                    <Wallet className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-zinc-900">
                      {panelMode === "create"
                        ? "Nueva cuenta"
                        : "Editar cuenta"}
                    </h2>
                    <p className="mt-0.5 text-sm text-zinc-500">
                      {panelMode === "create"
                        ? "Creá una cuenta para registrar movimientos (caja/banco/billetera)."
                        : "Actualizá datos visibles y saldo inicial. (No toca movimientos existentes)"}
                    </p>
                  </div>
                </div>

                <Button variant="secondary" onClick={() => setPanelOpen(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="mt-4">
                <AccountForm
                  mode={panelMode}
                  initial={panelInitial}
                  onCancel={() => setPanelOpen(false)}
                  onSubmit={onPanelSubmit}
                  isSubmitting={panelSubmitting}
                  serverError={panelErr}
                />
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </AdminProtected>
  );
}
