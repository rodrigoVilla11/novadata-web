"use client";

import React, { useEffect, useMemo, useState } from "react";
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
} from "lucide-react";

/* ===================== */
/* Helpers */
/* ===================== */

function directionFromType(type: FinanceMovementType) {
  // Ajustalo si tu backend usa otros strings.
  // Normalmente: IN / OUT
  return type === "INCOME" ? "IN" : "OUT";
}

const TYPE_OPTIONS: Array<{ label: string; value: FinanceMovementType }> = [
  { label: "Ingreso", value: "INCOME" },
  { label: "Egreso", value: "EXPENSE" },
  { label: "Transferencia", value: "TRANSFER" },
];

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

function typePill(t: FinanceMovementType) {
  const base =
    "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold";
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
    "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold";
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

/* ===================== */
/* Edit Modal types */
/* ===================== */

type EditForm = {
  open: boolean;
  id?: string;

  dateKey: string;
  type: FinanceMovementType;

  amount: string;

  accountId: string;
  toAccountId: string;

  categoryId: string; // solo INCOME/EXPENSE
  notes: string;

  status?: FinanceMovementStatus;
};

function emptyEdit(): EditForm {
  return {
    open: false,
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
  const [showCreate, setShowCreate] = useState(false);

  /* ===================== */
  /* Filters */
  /* ===================== */

  const [from, setFrom] = useState(todayKeyAR());
  const [to, setTo] = useState(todayKeyAR());
  const [type, setType] = useState<FinanceMovementType | "">("");
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [q, setQ] = useState("");

  type StatusFilter = FinanceMovementStatus | "ALL";
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("POSTED");

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);

  useEffect(() => {
    setPage(1);
  }, [from, to, type, accountId, categoryId, q, statusFilter, limit]);

  const movementsQuery = useGetFinanceMovementsQuery({
    from,
    to,
    type: type || undefined,
    accountId: accountId || undefined,
    categoryId: categoryId || undefined,
    q: q.trim() || undefined,
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

  /* ===================== */
  /* Create form */
  /* ===================== */

  const [cDateKey, setCDateKey] = useState(todayKeyAR());
  const [cType, setCType] = useState<FinanceMovementType>("EXPENSE");
  const [cAmount, setCAmount] = useState("");
  const [cAccountId, setCAccountId] = useState("");
  const [cToAccountId, setCToAccountId] = useState("");
  const [cCategoryId, setCCategoryId] = useState("");
  const [cNotes, setCNotes] = useState("");

  const isTransferCreate = cType === "TRANSFER";

  const canCreate = useMemo(() => {
    const amt = numLoose(cAmount);
    if (!cDateKey) return false;
    if (!Number.isFinite(amt) || amt <= 0) return false;
    if (!cAccountId) return false;
    if (isTransferCreate) {
      if (!cToAccountId) return false;
      if (cToAccountId === cAccountId) return false;
    }
    return true;
  }, [cDateKey, cAmount, cAccountId, cToAccountId, isTransferCreate]);

  async function onCreate() {
    const amount = numLoose(cAmount);

    await createMovement({
      dateKey: cDateKey,
      type: cType,
      amount,
      direction: directionFromType(cType),
      accountId: cAccountId,
      toAccountId: isTransferCreate ? cToAccountId : null,
      categoryId: isTransferCreate ? null : cCategoryId || null,
      notes: cNotes.trim() || null,
    } as any).unwrap();

    setShowCreate(false);
    setCAmount("");
    setCNotes("");
    setCCategoryId("");
    setCToAccountId("");
    movementsQuery.refetch();
  }

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
  /* Edit */
  /* ===================== */

  const [edit, setEdit] = useState<EditForm>(() => emptyEdit());

  function openEdit(m: any) {
    setEdit({
      open: true,
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

  function closeEdit() {
    setEdit((p) => ({ ...p, open: false }));
  }

  const isTransferEdit = edit.type === "TRANSFER";
  const editIsVoid = edit.status === "VOID";

  const canSaveEdit = useMemo(() => {
    if (!edit.open) return false;
    if (!edit.id) return false;
    if (!edit.dateKey) return false;
    if (editIsVoid) return false;

    const amt = numLoose(edit.amount);
    if (!Number.isFinite(amt) || amt <= 0) return false;

    if (!edit.accountId) return false;

    if (isTransferEdit) {
      if (!edit.toAccountId) return false;
      if (edit.toAccountId === edit.accountId) return false;
      return true;
    }

    // INCOME/EXPENSE
    // categoryId es opcional en tu create, mantenemos opcional también en update
    return true;
  }, [edit, editIsVoid, isTransferEdit]);

  async function saveEdit() {
    if (!edit.id) return;

    const payload: any = {
      dateKey: edit.dateKey,
      type: edit.type,
      direction: directionFromType(edit.type), // ✅ NUEVO
      amount: numLoose(edit.amount),
      accountId: edit.accountId,
      notes: edit.notes.trim() || null,
    };

    if (edit.type === "TRANSFER") {
      payload.toAccountId = edit.toAccountId;
      payload.categoryId = null;
    } else {
      payload.toAccountId = null;
      payload.categoryId = edit.categoryId || null;
    }

    await updateMovement({ id: edit.id!, ...payload } as any).unwrap();
    closeEdit();
    movementsQuery.refetch();
  }

  /* ===================== */
  /* Void */
  /* ===================== */

  async function onVoid(m: any) {
    if (m.status === "VOID") return;

    const ok = window.confirm(
      `¿Anular este movimiento?\n\n${m.dateKey} · ${m.type} · ${moneyARS(
        m.amount
      )}`
    );
    if (!ok) return;

    await voidMovement({ id: m.id } as any).unwrap();
    movementsQuery.refetch();
  }

  /* ===================== */
  /* Render */
  /* ===================== */

  return (
    <AdminProtected>
      <div className="space-y-6">
        {/* Header */}
        <div className="rounded-3xl border bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-zinc-900">
                Finance · Movimientos
              </h1>
              <p className="mt-1 text-sm text-zinc-500">
                Ingresos, egresos y transferencias.
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => movementsQuery.refetch()}
                loading={movementsQuery.isFetching}
                disabled={movementsQuery.isLoading}
                title="Refrescar"
              >
                <RefreshCcw className="h-4 w-4" />
              </Button>
              <Button onClick={() => setShowCreate((s) => !s)} title="Nuevo">
                <Plus className="h-4 w-4" />
                Nuevo
              </Button>
            </div>
          </div>
        </div>

        {/* Totals */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

        {/* Filters */}
        <Card>
          <CardBody>
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

              <Field label="Cuenta">
                <Select
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                >
                  <option value="">Todas</option>
                  {accounts.map((a: any) => (
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
                  {categories.map((c: any) => (
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
            </div>
          </CardBody>
        </Card>

        {/* Create */}
        {showCreate && (
          <Card>
            <CardBody>
              <div className="flex items-center justify-between gap-3">
                <div className="font-semibold text-zinc-900">
                  Nuevo movimiento
                </div>
                <Button
                  variant="secondary"
                  onClick={() => setShowCreate(false)}
                >
                  Cerrar
                </Button>
              </div>

              <div className="mt-3 grid grid-cols-1 md:grid-cols-6 gap-3">
                <Field label="Fecha">
                  <Input
                    type="date"
                    value={cDateKey}
                    onChange={(e) => setCDateKey(e.target.value)}
                  />
                </Field>

                <Field label="Tipo">
                  <Select
                    value={cType}
                    onChange={(e) => {
                      const next = e.target.value as FinanceMovementType;
                      setCType(next);
                      if (next === "TRANSFER") setCCategoryId("");
                      if (next !== "TRANSFER") setCToAccountId("");
                    }}
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
                    value={cAmount}
                    onChange={(e) => setCAmount(e.target.value)}
                  />
                </Field>

                <Field label="Cuenta origen">
                  <Select
                    value={cAccountId}
                    onChange={(e) => setCAccountId(e.target.value)}
                  >
                    <option value="">Seleccionar</option>
                    {accounts.map((a: any) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field
                  label={isTransferCreate ? "Cuenta destino" : "Categoría"}
                >
                  {isTransferCreate ? (
                    <Select
                      value={cToAccountId}
                      onChange={(e) => setCToAccountId(e.target.value)}
                    >
                      <option value="">Seleccionar</option>
                      {accounts.map((a: any) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </Select>
                  ) : (
                    <Select
                      value={cCategoryId}
                      onChange={(e) => setCCategoryId(e.target.value)}
                    >
                      <option value="">(Opcional)</option>
                      {categories.map((c: any) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>

                <Field label="Notas">
                  <Input
                    value={cNotes}
                    onChange={(e) => setCNotes(e.target.value)}
                    placeholder="Opcional"
                  />
                </Field>
              </div>

              <div className="mt-4 flex gap-2">
                <Button
                  onClick={onCreate}
                  disabled={!canCreate}
                  loading={createState.isLoading}
                >
                  Crear
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setShowCreate(false)}
                  disabled={createState.isLoading}
                >
                  Cancelar
                </Button>
              </div>

              {isTransferCreate &&
                cAccountId &&
                cToAccountId &&
                cAccountId === cToAccountId && (
                  <div className="mt-3 text-sm text-red-600">
                    La cuenta destino no puede ser la misma que la cuenta
                    origen.
                  </div>
                )}
            </CardBody>
          </Card>
        )}

        {/* Table */}
        <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
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
            <table className="min-w-full text-sm">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="p-3 text-left">Fecha</th>
                  <th className="p-3 text-left">Tipo</th>
                  <th className="p-3 text-right">Monto</th>
                  <th className="p-3 text-left">Cuenta</th>
                  <th className="p-3 text-left">Categoría</th>
                  <th className="p-3 text-left">Estado</th>
                  <th className="p-3 text-right">Acciones</th>
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
                            disabled={isVoid}
                            title={
                              isVoid
                                ? "No se puede editar un movimiento anulado"
                                : "Editar"
                            }
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>

                          <Button
                            variant="danger"
                            onClick={() => onVoid(m)}
                            disabled={isVoid}
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

        {/* Edit Modal */}
        {edit.open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-4xl rounded-2xl bg-white border shadow-xl">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <div className="font-semibold flex items-center gap-2">
                  <span>Editar movimiento</span>
                  {edit.status ? statusPill(edit.status) : null}
                </div>

                <button
                  onClick={closeEdit}
                  className="rounded-xl border p-2 hover:bg-zinc-50"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="p-4">
                {editIsVoid && (
                  <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    Este movimiento está <b>ANULADO</b>. No se puede editar.
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                  <Field label="Fecha">
                    <Input
                      type="date"
                      value={edit.dateKey}
                      onChange={(e) =>
                        setEdit((p) => ({ ...p, dateKey: e.target.value }))
                      }
                      disabled={editIsVoid}
                    />
                  </Field>

                  <Field label="Tipo">
                    <Select
                      value={edit.type}
                      onChange={(e) => {
                        const next = e.target.value as FinanceMovementType;
                        setEdit((p) => ({
                          ...p,
                          type: next,
                          // resets coherentes
                          categoryId: next === "TRANSFER" ? "" : p.categoryId,
                          toAccountId: next === "TRANSFER" ? p.toAccountId : "",
                        }));
                      }}
                      disabled={editIsVoid}
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
                      value={edit.amount}
                      onChange={(e) =>
                        setEdit((p) => ({ ...p, amount: e.target.value }))
                      }
                      disabled={editIsVoid}
                    />
                  </Field>

                  <Field label={isTransferEdit ? "Cuenta origen" : "Cuenta"}>
                    <Select
                      value={edit.accountId}
                      onChange={(e) =>
                        setEdit((p) => ({ ...p, accountId: e.target.value }))
                      }
                      disabled={editIsVoid}
                    >
                      <option value="">Seleccionar</option>
                      {accounts.map((a: any) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <Field
                    label={isTransferEdit ? "Cuenta destino" : "Categoría"}
                  >
                    {isTransferEdit ? (
                      <Select
                        value={edit.toAccountId}
                        onChange={(e) =>
                          setEdit((p) => ({
                            ...p,
                            toAccountId: e.target.value,
                          }))
                        }
                        disabled={editIsVoid}
                      >
                        <option value="">Seleccionar</option>
                        {accounts.map((a: any) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                      </Select>
                    ) : (
                      <Select
                        value={edit.categoryId}
                        onChange={(e) =>
                          setEdit((p) => ({ ...p, categoryId: e.target.value }))
                        }
                        disabled={editIsVoid}
                      >
                        <option value="">(Opcional)</option>
                        {categories.map((c: any) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </Select>
                    )}
                  </Field>

                  <Field label="Notas">
                    <Input
                      value={edit.notes}
                      onChange={(e) =>
                        setEdit((p) => ({ ...p, notes: e.target.value }))
                      }
                      disabled={editIsVoid}
                    />
                  </Field>
                </div>

                {isTransferEdit &&
                  edit.accountId &&
                  edit.toAccountId &&
                  edit.accountId === edit.toAccountId && (
                    <div className="mt-3 text-sm text-red-600">
                      La cuenta destino no puede ser la misma que la cuenta
                      origen.
                    </div>
                  )}
              </div>

              <div className="border-t px-4 py-3 flex justify-end gap-2">
                <Button
                  variant="secondary"
                  onClick={closeEdit}
                  disabled={updateState.isLoading}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={saveEdit}
                  disabled={!canSaveEdit || updateState.isLoading}
                  loading={updateState.isLoading}
                >
                  <Save className="h-4 w-4" />
                  Guardar
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminProtected>
  );
}
