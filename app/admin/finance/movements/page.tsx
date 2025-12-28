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
} from "lucide-react";

/* ===================== */
/* Helpers */
/* ===================== */

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
  return (Number(n ?? 0) || 0).toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
  });
}

function cn(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
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
  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>("POSTED");

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

  const { data: accounts = [] } = useGetFinanceAccountsQuery(
    { active: undefined as any } as any
  );
  const { data: categories = [] } =
    useGetFinanceCategoriesQuery(
      { active: undefined as any } as any
    );

  /* ===================== */
  /* Mutations */
  /* ===================== */

  const [createMovement, createState] =
    useCreateFinanceMovementMutation();
  const [updateMovement, updateState] =
    useUpdateFinanceMovementMutation();
  const [voidMovement, voidState] =
    useVoidFinanceMovementMutation();

  /* ===================== */
  /* Create form */
  /* ===================== */

  const [cDateKey, setCDateKey] = useState(todayKeyAR());
  const [cType, setCType] =
    useState<FinanceMovementType>("EXPENSE");
  const [cAmount, setCAmount] = useState("");
  const [cAccountId, setCAccountId] = useState("");
  const [cToAccountId, setCToAccountId] = useState("");
  const [cCategoryId, setCCategoryId] = useState("");
  const [cNotes, setCNotes] = useState("");

  const isTransfer = cType === "TRANSFER";

  const canCreate =
    !!cDateKey &&
    Number(cAmount) > 0 &&
    !!cAccountId &&
    (isTransfer
      ? !!cToAccountId && cToAccountId !== cAccountId
      : true);

  async function onCreate() {
    await createMovement({
      dateKey: cDateKey,
      type: cType,
      amount: Number(cAmount),
      accountId: cAccountId,
      toAccountId: isTransfer ? cToAccountId : null,
      categoryId: isTransfer
        ? null
        : cCategoryId || null,
      notes: cNotes.trim() || null,
    }).unwrap();

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
    const raw = movementsQuery.data?.items ?? [];
    if (statusFilter === "ALL") return raw;
    return raw.filter((m) => m.status === statusFilter);
  }, [movementsQuery.data, statusFilter]);

  const total = movementsQuery.data?.total ?? items.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const totals = useMemo(() => {
    let income = 0,
      expense = 0;
    for (const m of items) {
      if (m.status === "VOID") continue;
      if (m.type === "INCOME") income += m.amount;
      if (m.type === "EXPENSE") expense += m.amount;
    }
    return { income, expense, net: income - expense };
  }, [items]);

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
              >
                <RefreshCcw className="h-4 w-4" />
              </Button>
              <Button onClick={() => setShowCreate((s) => !s)}>
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
                  totals.net >= 0
                    ? "text-emerald-700"
                    : "text-red-700"
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
            <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
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
                  onChange={(e) =>
                    setType(e.target.value as any)
                  }
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
                      {a.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Categoría">
                <Select
                  value={categoryId}
                  onChange={(e) =>
                    setCategoryId(e.target.value)
                  }
                >
                  <option value="">Todas</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Buscar">
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </Field>
              <Field label="Estado">
                <Select
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(e.target.value as any)
                  }
                >
                  <option value="POSTED">Activos</option>
                  <option value="VOID">Anulados</option>
                  <option value="ALL">Todos</option>
                </Select>
              </Field>
            </div>
          </CardBody>
        </Card>

        {/* Create */}
        {showCreate && (
          <Card>
            <CardBody>
              <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                <Field label="Fecha">
                  <Input
                    type="date"
                    value={cDateKey}
                    onChange={(e) =>
                      setCDateKey(e.target.value)
                    }
                  />
                </Field>
                <Field label="Tipo">
                  <Select
                    value={cType}
                    onChange={(e) =>
                      setCType(e.target.value as any)
                    }
                  >
                    {TYPE_OPTIONS.map((o) => (
                      <option
                        key={o.value}
                        value={o.value}
                      >
                        {o.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Monto">
                  <Input
                    value={cAmount}
                    onChange={(e) =>
                      setCAmount(e.target.value)
                    }
                  />
                </Field>
                <Field label="Cuenta">
                  <Select
                    value={cAccountId}
                    onChange={(e) =>
                      setCAccountId(e.target.value)
                    }
                  >
                    <option value="">Seleccionar</option>
                    {accounts.map((a) => (
                      <option
                        key={a.id}
                        value={a.id}
                      >
                        {a.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field
                  label={
                    isTransfer
                      ? "Cuenta destino"
                      : "Categoría"
                  }
                >
                  {isTransfer ? (
                    <Select
                      value={cToAccountId}
                      onChange={(e) =>
                        setCToAccountId(e.target.value)
                      }
                    >
                      <option value="">Seleccionar</option>
                      {accounts.map((a) => (
                        <option
                          key={a.id}
                          value={a.id}
                        >
                          {a.name}
                        </option>
                      ))}
                    </Select>
                  ) : (
                    <Select
                      value={cCategoryId}
                      onChange={(e) =>
                        setCCategoryId(e.target.value)
                      }
                    >
                      <option value="">(Opcional)</option>
                      {categories.map((c) => (
                        <option
                          key={c.id}
                          value={c.id}
                        >
                          {c.name}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
                <Field label="Notas">
                  <Input
                    value={cNotes}
                    onChange={(e) =>
                      setCNotes(e.target.value)
                    }
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
                >
                  Cancelar
                </Button>
              </div>
            </CardBody>
          </Card>
        )}

        {/* Table */}
        <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
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
            <tbody>
              {items.map((m) => (
                <tr
                  key={m.id}
                  className={cn(
                    "border-t",
                    m.status === "VOID" &&
                      "bg-red-50/40"
                  )}
                >
                  <td className="p-3">{m.dateKey}</td>
                  <td className="p-3 font-semibold">
                    {m.type}
                  </td>
                  <td className="p-3 text-right font-semibold">
                    {moneyARS(m.amount)}
                  </td>
                  <td className="p-3">
                    {m.accountNameSnapshot || m.accountId}
                  </td>
                  <td className="p-3">
                    {m.categoryNameSnapshot || "—"}
                  </td>
                  <td className="p-3">
                    {m.status === "VOID"
                      ? "ANULADO"
                      : "POSTED"}
                  </td>
                  <td className="p-3 text-right">
                    <Button
                      variant="danger"
                      onClick={() =>
                        voidMovement({ id: m.id })
                      }
                      disabled={m.status === "VOID"}
                    >
                      <Ban className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex justify-end gap-2">
          <Button
            variant="secondary"
            onClick={() =>
              setPage((p) => Math.max(1, p - 1))
            }
            disabled={page <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              setPage((p) => Math.min(totalPages, p + 1))
            }
            disabled={page >= totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </AdminProtected>
  );
}
