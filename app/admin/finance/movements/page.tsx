"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AdminProtected } from "@/components/AdminProtected";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
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
} from "@/redux/services/financeApi";

import {
  Search,
  Plus,
  X,
  RefreshCcw,
  Pencil,
  Save,
  Ban,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
} from "lucide-react";

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

function moneyARS(n: number) {
  const v = Number(n ?? 0) || 0;
  return v.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function FinanceMovementsPage() {
  const [showCreate, setShowCreate] = useState(false);

  // =========================
  // Filters
  // =========================
  const [from, setFrom] = useState(todayKeyAR());
  const [to, setTo] = useState(todayKeyAR());
  const [type, setType] = useState<FinanceMovementType | "">("");
  const [accountId, setAccountId] = useState<string>("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [q, setQ] = useState("");

  type StatusFilter = FinanceMovementStatus | "ALL";

  const STATUS_OPTIONS: Array<{ label: string; value: StatusFilter }> = [
    { label: "Activos", value: "POSTED" },
    { label: "Anulados", value: "VOID" },
    { label: "Todos", value: "ALL" },
  ];

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("POSTED");

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);

  // reset page en cambios de filtros
  useEffect(() => {
    setPage(1);
  }, [from, to, type, accountId, categoryId, q, statusFilter, limit]);
  const includeVoidedParam = statusFilter !== "POSTED";
  const movementsQuery = useGetFinanceMovementsQuery({
    from: from || undefined,
    to: to || undefined,
    type: (type || undefined) as any,
    accountId: accountId || undefined,
    categoryId: categoryId || undefined,
    q: q.trim() || undefined,
    page,
    limit,
    status: statusFilter === "ALL" ? undefined : statusFilter, // ✅ NUEVO
    includeVoided: includeVoidedParam,
  } as any);

  const { data: accounts = [] } = useGetFinanceAccountsQuery({
    active: undefined as any,
  } as any);

  const { data: categories = [] } = useGetFinanceCategoriesQuery({
    active: undefined as any,
  } as any);

  // =========================
  // Mutations
  // =========================
  const [createMovement, createState] = useCreateFinanceMovementMutation();
  const [updateMovement, updateState] = useUpdateFinanceMovementMutation();
  const [voidMovement, voidState] = useVoidFinanceMovementMutation();

  // =========================
  // Create form
  // =========================
  const [cDateKey, setCDateKey] = useState(todayKeyAR());
  const [cType, setCType] = useState<FinanceMovementType>("EXPENSE");
  const [cAmount, setCAmount] = useState<string>("");
  const [cAccountId, setCAccountId] = useState<string>("");
  const [cToAccountId, setCToAccountId] = useState<string>("");
  const [cCategoryId, setCCategoryId] = useState<string>("");
  const [cNotes, setCNotes] = useState<string>("");

  const isTransfer = cType === "TRANSFER";
  const canCreate =
    !!cDateKey &&
    Number(cAmount) > 0 &&
    !!cAccountId &&
    (isTransfer ? !!cToAccountId && cToAccountId !== cAccountId : true);

  async function onCreate() {
    await createMovement({
      dateKey: cDateKey,
      type: cType,
      amount: Number(cAmount || 0),
      accountId: cAccountId,
      toAccountId: isTransfer ? cToAccountId : null,
      categoryId: isTransfer ? null : cCategoryId ? cCategoryId : null,
      notes: cNotes.trim() ? cNotes.trim() : null,
    }).unwrap();

    setShowCreate(false);
    setCAmount("");
    setCNotes("");
    setCCategoryId("");
    setCToAccountId("");
    // refrescar lista
    movementsQuery.refetch();
  }

  // =========================
  // Quick edit row (inline)
  // =========================
  const [editingId, setEditingId] = useState<string | null>(null);
  const editingRow = useMemo(() => {
    const items = movementsQuery.data?.items ?? [];
    return items.find((x: any) => x.id === editingId) as
      | FinanceMovementRow
      | undefined;
  }, [movementsQuery.data, editingId]);

  const [eAmount, setEAmount] = useState<string>("");
  const [eAccountId, setEAccountId] = useState<string>("");
  const [eToAccountId, setEToAccountId] = useState<string>("");
  const [eCategoryId, setECategoryId] = useState<string>("");
  const [eNotes, setENotes] = useState<string>("");

  useEffect(() => {
    if (!editingRow) return;
    setEAmount(String(editingRow.amount ?? 0));
    setEAccountId(editingRow.accountId ?? "");
    setEToAccountId(editingRow.toAccountId ?? "");
    setECategoryId(editingRow.categoryId ?? "");
    setENotes(editingRow.notes ?? "");
  }, [editingRow]);

  const isEditingTransfer = (editingRow?.type ?? "") === "TRANSFER";

  const canSaveEdit =
    !!editingRow &&
    Number(eAmount) > 0 &&
    !!eAccountId &&
    (isEditingTransfer ? !!eToAccountId && eToAccountId !== eAccountId : true);

  async function onSaveEdit() {
    if (!editingRow) return;

    await updateMovement({
      id: editingRow.id,
      body: {
        amount: Number(eAmount || 0),
        accountId: eAccountId,
        toAccountId: isEditingTransfer ? eToAccountId || null : null,
        categoryId: isEditingTransfer ? null : eCategoryId || null,
        notes: eNotes.trim() ? eNotes.trim() : null,
      },
    }).unwrap();

    setEditingId(null);
    movementsQuery.refetch();
  }

  // =========================
  // Client-side include VOID fallback
  // =========================
  const items = useMemo(() => {
    const raw = (movementsQuery.data?.items ?? []) as FinanceMovementRow[];

    // fallback client-side: si backend no filtra, filtramos acá
    if (statusFilter === "ALL") return raw;
    return raw.filter((x) => x.status === statusFilter);
  }, [movementsQuery.data, statusFilter]);

  const totalFromServer = movementsQuery.data?.total ?? items.length;
  const totalPages = Math.max(1, Math.ceil((totalFromServer || 1) / limit));

  const accountsById = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of accounts)
      m.set(a.id, `${a.name} (${a.type}) ${a.currency}`);
    return m;
  }, [accounts]);

  const categoriesById = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of categories) m.set(c.id, `${c.name} (${c.type})`);
    return m;
  }, [categories]);

  const totalsBar = useMemo(() => {
    let income = 0;
    let expense = 0;
    let transfer = 0;
    for (const m of items) {
      if (m.status === "VOID") continue;
      if (m.type === "INCOME") income += Number(m.amount || 0);
      if (m.type === "EXPENSE") expense += Number(m.amount || 0);
      if (m.type === "TRANSFER") transfer += Number(m.amount || 0);
    }
    return {
      income,
      expense,
      transfer,
      net: income - expense,
    };
  }, [items]);

  return (
    <AdminProtected>
      <div className="p-4 min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="max-w-6xl mx-auto space-y-4">
          <Card>
            <CardHeader
              title="Finance · Movimientos"
              subtitle="Ingresos, egresos y transferencias entre cuentas. Incluye edición rápida y anulaciones."
              right={
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => movementsQuery.refetch()}
                    loading={movementsQuery.isFetching}
                  >
                    <span className="inline-flex items-center gap-2">
                      <RefreshCcw className="h-4 w-4" />
                      Refrescar
                    </span>
                  </Button>

                  <Button onClick={() => setShowCreate((s) => !s)}>
                    <span className="inline-flex items-center gap-2">
                      {showCreate ? (
                        <X className="h-4 w-4" />
                      ) : (
                        <Plus className="h-4 w-4" />
                      )}
                      {showCreate ? "Cerrar" : "Nuevo movimiento"}
                    </span>
                  </Button>
                </div>
              }
            />

            <CardBody>
              {/* Totals quick bar */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="rounded-2xl border bg-white p-4">
                  <div className="text-xs text-gray-500">
                    Ingresos (visible)
                  </div>
                  <div className="mt-1 text-lg font-bold">
                    {moneyARS(totalsBar.income)}
                  </div>
                </div>
                <div className="rounded-2xl border bg-white p-4">
                  <div className="text-xs text-gray-500">Gastos (visible)</div>
                  <div className="mt-1 text-lg font-bold">
                    {moneyARS(totalsBar.expense)}
                  </div>
                </div>
                <div className="rounded-2xl border bg-white p-4">
                  <div className="text-xs text-gray-500">Neto (visible)</div>
                  <div
                    className={cn(
                      "mt-1 text-lg font-bold",
                      totalsBar.net >= 0 ? "text-emerald-700" : "text-red-700"
                    )}
                  >
                    {moneyARS(totalsBar.net)}
                  </div>
                </div>
                <div className="rounded-2xl border bg-white p-4">
                  <div className="text-xs text-gray-500">
                    Transferencias (visible)
                  </div>
                  <div className="mt-1 text-lg font-bold">
                    {moneyARS(totalsBar.transfer)}
                  </div>
                </div>
              </div>

              {/* Filters */}
              <div className="mt-4 grid grid-cols-1 md:grid-cols-7 gap-3">
                <Field label="Desde">
                  <Input
                    type="date"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                    placeholder="YYYY-MM-DD"
                  />
                </Field>

                <Field label="Hasta">
                  <Input
                    type="date"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    placeholder="YYYY-MM-DD"
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
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.type}) {a.currency}
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
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.type})
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field label="Buscar">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <Input
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      placeholder="nota / cuenta / categoría"
                      className="pl-9"
                    />
                  </div>
                </Field>

                <Field label="Estado">
                  <Select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                  >
                    {STATUS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>

              {/* Create */}
              {showCreate && (
                <div className="mt-4 p-4 rounded-2xl bg-white shadow-sm border">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-bold text-zinc-900">
                        Nuevo movimiento
                      </div>
                      <div className="text-xs text-zinc-500">
                        Tip: para transferencias no se elige categoría.
                      </div>
                    </div>
                    <Button
                      variant="secondary"
                      onClick={() => setShowCreate(false)}
                    >
                      <span className="inline-flex items-center gap-2">
                        <X className="h-4 w-4" /> Cerrar
                      </span>
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
                        onChange={(e) => setCType(e.target.value as any)}
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
                        value={cAmount}
                        onChange={(e) => setCAmount(e.target.value)}
                        placeholder="0"
                        inputMode="decimal"
                      />
                    </Field>

                    <Field label="Cuenta origen">
                      <Select
                        value={cAccountId}
                        onChange={(e) => setCAccountId(e.target.value)}
                      >
                        <option value="">Seleccionar...</option>
                        {accounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name} ({a.type}) {a.currency}
                          </option>
                        ))}
                      </Select>
                    </Field>

                    <Field label={isTransfer ? "Cuenta destino" : "Categoría"}>
                      {isTransfer ? (
                        <Select
                          value={cToAccountId}
                          onChange={(e) => setCToAccountId(e.target.value)}
                        >
                          <option value="">Seleccionar...</option>
                          {accounts.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.name} ({a.type}) {a.currency}
                            </option>
                          ))}
                        </Select>
                      ) : (
                        <Select
                          value={cCategoryId}
                          onChange={(e) => setCCategoryId(e.target.value)}
                        >
                          <option value="">(Opcional)</option>
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name} ({c.type})
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

                  {cType === "TRANSFER" &&
                    cAccountId &&
                    cToAccountId &&
                    cAccountId === cToAccountId && (
                      <p className="mt-2 text-sm text-amber-700">
                        Transferencia: origen y destino no pueden ser iguales.
                      </p>
                    )}

                  {createState.isError && (
                    <p className="mt-3 text-sm text-red-600">
                      {String(
                        (createState.error as any)?.data?.message ||
                          "Error creando movimiento"
                      )}
                    </p>
                  )}

                  <div className="mt-4 flex gap-2">
                    <Button
                      onClick={onCreate}
                      disabled={!canCreate || createState.isLoading}
                      loading={createState.isLoading}
                    >
                      Crear
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => setShowCreate(false)}
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}

              {/* Table */}
              <div className="mt-4">
                {movementsQuery.isLoading ? (
                  <p className="text-sm text-gray-600">Cargando...</p>
                ) : movementsQuery.error ? (
                  <p className="text-red-600 text-sm">
                    {String(
                      (movementsQuery.error as any)?.data?.message || "Error"
                    )}
                  </p>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                      <p className="text-sm text-gray-600">
                        Total:{" "}
                        <span className="font-semibold">
                          {movementsQuery.data?.total ?? items.length}
                        </span>{" "}
                        · Página {page} / {totalPages}
                      </p>

                      <div className="flex items-center gap-2">
                        <Select
                          value={String(limit)}
                          onChange={(e) => setLimit(Number(e.target.value))}
                        >
                          {[20, 50, 100, 200].map((n) => (
                            <option key={n} value={n}>
                              {n} / pág
                            </option>
                          ))}
                        </Select>

                        <Button
                          variant="secondary"
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                          disabled={page <= 1}
                        >
                          <span className="inline-flex items-center gap-2">
                            <ChevronLeft className="h-4 w-4" /> Anterior
                          </span>
                        </Button>

                        <Button
                          variant="secondary"
                          onClick={() =>
                            setPage((p) => Math.min(totalPages, p + 1))
                          }
                          disabled={page >= totalPages}
                        >
                          <span className="inline-flex items-center gap-2">
                            Siguiente <ChevronRight className="h-4 w-4" />
                          </span>
                        </Button>
                      </div>
                    </div>

                    <div className="overflow-auto rounded-2xl border bg-white">
                      <table className="min-w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="text-left p-3">Fecha</th>
                            <th className="text-left p-3">Tipo</th>
                            <th className="text-right p-3">Monto</th>
                            <th className="text-left p-3">Cuenta</th>
                            <th className="text-left p-3">Destino</th>
                            <th className="text-left p-3">Categoría</th>
                            <th className="text-left p-3">Notas</th>
                            <th className="text-left p-3">Estado</th>
                            <th className="text-left p-3">Acciones</th>
                          </tr>
                        </thead>

                        <tbody>
                          {items.map((m) => {
                            const isVoid = m.status === "VOID";
                            const isEditing = editingId === m.id;
                            const rowIsTransfer = m.type === "TRANSFER";

                            const accLabel =
                              m.accountNameSnapshot ||
                              (m.accountId
                                ? accountsById.get(m.accountId)
                                : null) ||
                              m.accountId ||
                              "-";

                            const toAccLabel =
                              m.type === "TRANSFER"
                                ? (m.toAccountId
                                    ? accountsById.get(m.toAccountId)
                                    : null) ||
                                  m.toAccountId ||
                                  "-"
                                : "-";

                            const catLabel = rowIsTransfer
                              ? "-"
                              : m.categoryNameSnapshot ||
                                (m.categoryId
                                  ? categoriesById.get(m.categoryId)
                                  : null) ||
                                m.categoryId ||
                                "-";

                            return (
                              <tr
                                key={m.id}
                                className={cn(
                                  "border-t",
                                  isVoid
                                    ? "bg-red-50/40"
                                    : "hover:bg-zinc-50/60"
                                )}
                              >
                                <td className="p-3">{m.dateKey}</td>
                                <td className="p-3 font-semibold">{m.type}</td>

                                {/* Amount */}
                                <td className="p-3 text-right">
                                  {isEditing ? (
                                    <Input
                                      value={eAmount}
                                      onChange={(e) =>
                                        setEAmount(e.target.value)
                                      }
                                      inputMode="decimal"
                                    />
                                  ) : (
                                    <span
                                      className={cn(
                                        "font-semibold",
                                        m.type === "EXPENSE"
                                          ? "text-red-700"
                                          : "text-zinc-900"
                                      )}
                                    >
                                      {moneyARS(m.amount)}
                                    </span>
                                  )}
                                </td>

                                {/* Account */}
                                <td className="p-3">
                                  {isEditing ? (
                                    <Select
                                      value={eAccountId}
                                      onChange={(e) =>
                                        setEAccountId(e.target.value)
                                      }
                                    >
                                      <option value="">Seleccionar...</option>
                                      {accounts.map((a) => (
                                        <option key={a.id} value={a.id}>
                                          {a.name} ({a.type}) {a.currency}
                                        </option>
                                      ))}
                                    </Select>
                                  ) : (
                                    <div className="font-medium">
                                      {accLabel}
                                    </div>
                                  )}
                                </td>

                                {/* To account */}
                                <td className="p-3">
                                  {rowIsTransfer ? (
                                    isEditing ? (
                                      <Select
                                        value={eToAccountId}
                                        onChange={(e) =>
                                          setEToAccountId(e.target.value)
                                        }
                                      >
                                        <option value="">Seleccionar...</option>
                                        {accounts.map((a) => (
                                          <option key={a.id} value={a.id}>
                                            {a.name} ({a.type}) {a.currency}
                                          </option>
                                        ))}
                                      </Select>
                                    ) : (
                                      <div className="font-medium">
                                        {toAccLabel}
                                      </div>
                                    )
                                  ) : (
                                    "-"
                                  )}
                                </td>

                                {/* Category */}
                                <td className="p-3">
                                  {rowIsTransfer ? (
                                    "-"
                                  ) : isEditing ? (
                                    <Select
                                      value={eCategoryId}
                                      onChange={(e) =>
                                        setECategoryId(e.target.value)
                                      }
                                    >
                                      <option value="">(Opcional)</option>
                                      {categories.map((c) => (
                                        <option key={c.id} value={c.id}>
                                          {c.name} ({c.type})
                                        </option>
                                      ))}
                                    </Select>
                                  ) : (
                                    <div className="text-zinc-700">
                                      {catLabel}
                                    </div>
                                  )}
                                </td>

                                {/* Notes */}
                                <td className="p-3">
                                  {isEditing ? (
                                    <Input
                                      value={eNotes}
                                      onChange={(e) =>
                                        setENotes(e.target.value)
                                      }
                                      placeholder="—"
                                    />
                                  ) : (
                                    <span className="text-zinc-700">
                                      {m.notes?.trim() ? m.notes : "—"}
                                    </span>
                                  )}
                                </td>

                                {/* Status */}
                                <td className="p-3">
                                  <span
                                    className={cn(
                                      "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold",
                                      isVoid
                                        ? "border-red-200 bg-red-50 text-red-700"
                                        : "border-emerald-200 bg-emerald-50 text-emerald-700"
                                    )}
                                  >
                                    {isVoid ? "ANULADO" : "POSTED"}
                                  </span>
                                </td>

                                {/* Actions */}
                                <td className="p-3">
                                  <div className="flex flex-wrap gap-2">
                                    {!isEditing ? (
                                      <Button
                                        variant="secondary"
                                        onClick={() => setEditingId(m.id)}
                                        disabled={isVoid}
                                      >
                                        <span className="inline-flex items-center gap-2">
                                          <Pencil className="h-4 w-4" />
                                          Editar
                                        </span>
                                      </Button>
                                    ) : (
                                      <>
                                        <Button
                                          onClick={onSaveEdit}
                                          disabled={
                                            !canSaveEdit ||
                                            updateState.isLoading
                                          }
                                          loading={updateState.isLoading}
                                        >
                                          <span className="inline-flex items-center gap-2">
                                            <Save className="h-4 w-4" />
                                            Guardar
                                          </span>
                                        </Button>

                                        <Button
                                          variant="secondary"
                                          onClick={() => setEditingId(null)}
                                        >
                                          <span className="inline-flex items-center gap-2">
                                            <X className="h-4 w-4" />
                                            Cancelar
                                          </span>
                                        </Button>
                                      </>
                                    )}

                                    <Button
                                      variant="danger"
                                      onClick={async () => {
                                        await voidMovement({
                                          id: m.id,
                                        }).unwrap();
                                        movementsQuery.refetch();
                                      }}
                                      disabled={isVoid || voidState.isLoading}
                                      loading={voidState.isLoading}
                                    >
                                      <span className="inline-flex items-center gap-2">
                                        <Ban className="h-4 w-4" />
                                        Anular
                                      </span>
                                    </Button>
                                  </div>

                                  {isEditing &&
                                    isEditingTransfer &&
                                    eAccountId &&
                                    eToAccountId &&
                                    eAccountId === eToAccountId && (
                                      <p className="mt-2 text-xs text-amber-700">
                                        Transferencia: origen y destino no
                                        pueden ser iguales.
                                      </p>
                                    )}
                                </td>
                              </tr>
                            );
                          })}

                          {items.length === 0 && (
                            <tr>
                              <td colSpan={9} className="p-4 text-gray-500">
                                Sin movimientos.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    {createState.isError && (
                      <p className="mt-3 text-sm text-red-600">
                        {String(
                          (createState.error as any)?.data?.message ||
                            "Error creando movimiento"
                        )}
                      </p>
                    )}
                    {updateState.isError && (
                      <p className="mt-3 text-sm text-red-600">
                        {String(
                          (updateState.error as any)?.data?.message ||
                            "Error actualizando movimiento"
                        )}
                      </p>
                    )}
                    {voidState.isError && (
                      <p className="mt-3 text-sm text-red-600">
                        {String(
                          (voidState.error as any)?.data?.message ||
                            "Error anulando movimiento"
                        )}
                      </p>
                    )}
                  </>
                )}
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </AdminProtected>
  );
}
