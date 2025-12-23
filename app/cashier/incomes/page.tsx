"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/app/providers/AuthProvider";
import { apiFetchAuthed } from "@/lib/apiAuthed";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Field";
import {
  ArrowLeft,
  RefreshCcw,
  Search,
  PlusCircle,
  XCircle,
  CheckCircle2,
  Filter,
  Trash2,
} from "lucide-react";

// ============================================================================
// Helpers
// ============================================================================
function todayKeyArgentina() {
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

function fmtTime(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function parseAmountInput(raw: string) {
  // acepta "200000" o "200.000" o "200,000" o "200,50"
  const s = String(raw || "").trim();
  if (!s) return 0;
  const cleaned = s.replace(/\./g, "").replace(/,/g, ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

// ============================================================================
// Types
// ============================================================================
type FinanceAccountRow = { id: string; name: string };
type FinanceCategoryRow = { id: string; name: string; type: "INCOME" | "EXPENSE" | "BOTH" };

type FinanceMovementType = "INCOME" | "EXPENSE" | "TRANSFER";
type FinanceMovementStatus = "POSTED" | "VOID";

type FinanceMovementRow = {
  id: string;
  dateKey: string;
  type: FinanceMovementType;
  amount: number;
  accountId: string | null;
  toAccountId: string | null;
  categoryId: string | null;
  providerId: string | null;
  notes: string | null;
  status: FinanceMovementStatus;
  accountNameSnapshot: string | null;
  categoryNameSnapshot: string | null;
  createdAt?: string;
};

type FinanceMovementsResponse = {
  items: FinanceMovementRow[];
  page: number;
  limit: number;
  total: number;
};

type CreateFinanceMovementDto = {
  dateKey: string;
  type: "INCOME";
  amount: number;
  accountId: string;
  categoryId?: string | null;
  notes?: string | null;
};

type StatusFilter = "POSTED" | "VOID" | "ALL";

// ============================================================================
// Page
// ============================================================================
export default function CashierIncomePage() {
  const { getAccessToken } = useAuth();

  const [dateKey, setDateKey] = useState(todayKeyArgentina());

  const [accounts, setAccounts] = useState<FinanceAccountRow[]>([]);
  const [categories, setCategories] = useState<FinanceCategoryRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  // form
  const [amount, setAmount] = useState<string>("");
  const [accountId, setAccountId] = useState<string>("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  // list
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  // ✅ nuevo
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("POSTED");

  // ⚠️ Como backend no filtra por status, si querés ver VOID/ALL,
  // levantamos limit para que entren en la primera página sin “perderse”.
  const limit = statusFilter === "POSTED" ? 30 : 200;

  const [resp, setResp] = useState<FinanceMovementsResponse | null>(null);

  const accountNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of accounts) m.set(a.id, a.name);
    return m;
  }, [accounts]);

  const categoryNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of categories) m.set(c.id, c.name);
    return m;
  }, [categories]);

  function buildListUrl() {
    const sp = new URLSearchParams();
    sp.set("from", dateKey);
    sp.set("to", dateKey);
    sp.set("type", "INCOME");
    sp.set("limit", String(limit));
    sp.set("page", String(page));
    if (q.trim()) sp.set("q", q.trim());
    return `/finance/movements?${sp.toString()}`;
  }

  async function loadBase() {
    setError(null);
    setLoading(true);
    try {
      const [acc, cats] = await Promise.all([
        apiFetchAuthed<FinanceAccountRow[]>(getAccessToken, "/finance/accounts?active=true"),
        apiFetchAuthed<FinanceCategoryRow[]>(getAccessToken, "/finance/categories?active=true&type=INCOME"),
      ]);

      setAccounts(acc || []);
      const filteredCats = (cats || []).filter((c) => c.type === "INCOME" || c.type === "BOTH");
      setCategories(filteredCats);

      if (!accountId && (acc || [])[0]?.id) setAccountId((acc || [])[0].id);
      if (!categoryId && filteredCats[0]?.id) setCategoryId(filteredCats[0].id);
    } catch (e: any) {
      setError(e?.message || "Error cargando cuentas/categorías");
    } finally {
      setLoading(false);
    }
  }

  async function loadList() {
    setError(null);
    try {
      const r = await apiFetchAuthed<FinanceMovementsResponse>(getAccessToken, buildListUrl());
      setResp(r);
    } catch (e: any) {
      setError(e?.message || "Error cargando ingresos");
    }
  }

  async function loadAll() {
    await Promise.all([loadBase(), loadList()]);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setPage(1);
  }, [dateKey, statusFilter]);

  useEffect(() => {
    loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateKey, q, page, statusFilter]);

  async function createIncome() {
    setError(null);
    setOkMsg(null);

    const amt = parseAmountInput(amount);
    if (!(amt > 0)) {
      setError("Monto inválido");
      return;
    }
    if (!accountId) {
      setError("Seleccioná una cuenta");
      return;
    }

    setBusy(true);
    try {
      const dto: CreateFinanceMovementDto = {
        dateKey,
        type: "INCOME",
        amount: amt,
        accountId,
        categoryId: categoryId || null,
        notes: notes.trim() || null,
      };

      await apiFetchAuthed(getAccessToken, "/finance/movements", {
        method: "POST",
        body: JSON.stringify(dto),
      });

      setAmount("");
      setNotes("");
      setOkMsg("Ingreso creado ✔");
      window.setTimeout(() => setOkMsg(null), 2000);

      await loadList();
    } catch (e: any) {
      setError(e?.message || "Error creando ingreso");
    } finally {
      setBusy(false);
    }
  }

  async function voidMovement(id: string) {
    if (!confirm("¿Anular ingreso?")) return;
    setBusy(true);
    setError(null);
    setOkMsg(null);
    try {
      await apiFetchAuthed(getAccessToken, `/finance/movements/${id}/void`, { method: "POST" });
      setOkMsg("Ingreso anulado ✔");
      window.setTimeout(() => setOkMsg(null), 2000);
      await loadList();
    } catch (e: any) {
      setError(e?.message || "Error anulando");
    } finally {
      setBusy(false);
    }
  }

  const parsedPreview = useMemo(() => parseAmountInput(amount), [amount]);

  // ✅ filtrado por status CLIENT-SIDE
  const filteredItems = useMemo(() => {
    const items = resp?.items || [];
    if (statusFilter === "ALL") return items;
    return items.filter((r) => r.status === statusFilter);
  }, [resp, statusFilter]);

  // ✅ total real del día (solo POSTED)
  const totalDayPosted = useMemo(() => {
    const items = resp?.items || [];
    return items.reduce((acc, r) => acc + (r.status === "VOID" ? 0 : Number(r.amount || 0)), 0);
  }, [resp]);

  const voidCount = useMemo(() => {
    const items = resp?.items || [];
    return items.filter((r) => r.status === "VOID").length;
  }, [resp]);

  const totalLabel = resp ? `${filteredItems.length} / ${resp.total} items` : "—";

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="sticky top-0 z-10 border-b border-zinc-200 bg-white/80 backdrop-blur">
        <div className="mx-auto max-w-5xl px-4 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
                  onClick={() => (window.location.href = "/cashier")}
                  type="button"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Volver
                </button>

                <h1 className="text-2xl font-bold text-zinc-900">Cashier • Ingresos</h1>

                <span className="ml-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                  Total día: {moneyARS(totalDayPosted)}
                </span>

                {voidCount > 0 && (
                  <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-semibold text-zinc-600">
                    Anulados: {voidCount}
                  </span>
                )}
              </div>

              <p className="mt-1 text-sm text-zinc-500">Carga rápida de ingresos y listado del día.</p>

              {statusFilter !== "POSTED" && (
                <div className="mt-2 inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                  <Filter className="h-4 w-4" />
                  Estás viendo: <span className="font-bold">{statusFilter === "ALL" ? "TODOS" : statusFilter}</span>
                </div>
              )}
            </div>

            <Button
              variant="secondary"
              onClick={async () => {
                setBusy(true);
                try {
                  await loadAll();
                } finally {
                  setBusy(false);
                }
              }}
              disabled={busy}
              loading={busy}
            >
              <span className="inline-flex items-center gap-2">
                <RefreshCcw className="h-4 w-4" />
                Refrescar
              </span>
            </Button>
          </div>

          {(error || okMsg) && (
            <div className="mt-3 grid gap-2">
              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              )}
              {okMsg && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                  {okMsg}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-6 space-y-6">
        {/* Form */}
        <Card>
          <CardHeader
            title="Nuevo ingreso"
            subtitle="Crea un movimiento INCOME"
            right={
              <Button
                variant="secondary"
                onClick={() => {
                  setAmount("");
                  setNotes("");
                  setError(null);
                  setOkMsg(null);
                }}
                disabled={busy}
              >
                <span className="inline-flex items-center gap-2">
                  <Trash2 className="h-4 w-4" />
                  Limpiar
                </span>
              </Button>
            }
          />
          <CardBody>
            <div className="grid gap-3 md:grid-cols-4 md:items-end">
              <Field label="Día (dateKey)">
                <Input
                  type="date"
                  value={dateKey}
                  onChange={(e) => setDateKey(e.target.value)}
                  disabled={busy}
                />
              </Field>

              <Field label="Monto (ARS)">
                <Input
                  inputMode="decimal"
                  placeholder="Ej: 15000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") createIncome();
                  }}
                  disabled={busy}
                />
                <div className="mt-1 text-xs text-zinc-500">
                  Preview: <span className="font-semibold">{moneyARS(parsedPreview)}</span>
                </div>
              </Field>

              <Field label="Cuenta">
                <Select value={accountId} onChange={(e) => setAccountId(e.target.value)} disabled={busy || loading}>
                  <option value="">Seleccionar…</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Categoría">
                <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} disabled={busy || loading}>
                  <option value="">Sin categoría</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>

              <div className="md:col-span-4">
                <Field label="Notas (opcional)">
                  <Input
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Ej: Venta mostrador / Ajuste caja…"
                    disabled={busy}
                  />
                </Field>
              </div>
            </div>

            <div className="mt-4">
              <Button onClick={createIncome} disabled={busy || loading} loading={busy}>
                <span className="inline-flex items-center gap-2">
                  <PlusCircle className="h-4 w-4" />
                  Crear ingreso
                </span>
              </Button>
            </div>
          </CardBody>
        </Card>

        {/* List */}
        <Card>
          <CardHeader title="Ingresos del día" subtitle="Listado (se filtra por INCOME)" />
          <CardBody>
            <div className="grid gap-3 md:grid-cols-[1fr_220px_160px] md:items-end">
              <Field label="Buscar">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                  <Input
                    className="pl-9"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Notas / cuenta / categoría…"
                  />
                </div>
              </Field>

              {/* ✅ status filter */}
              <Field label="Estado">
                <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}>
                  <option value="POSTED">Activos (POSTED)</option>
                  <option value="VOID">Anulados (VOID)</option>
                  <option value="ALL">Todos</option>
                </Select>
              </Field>

              <div className="text-sm text-zinc-500 md:text-right">{totalLabel}</div>
            </div>

            <div className="mt-4 overflow-x-auto rounded-2xl border border-zinc-200 bg-white">
              <table className="min-w-full">
                <thead className="bg-zinc-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Hora
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Cuenta
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Categoría
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Monto
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Notas
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Estado
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Acción
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-zinc-100">
                  {loading || !resp ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-sm text-zinc-500">
                        Cargando…
                      </td>
                    </tr>
                  ) : filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-sm text-zinc-500">
                        No hay ingresos para el filtro seleccionado.
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((r) => {
                      const acc =
                        r.accountNameSnapshot ||
                        (r.accountId ? accountNameById.get(r.accountId) : null) ||
                        r.accountId ||
                        "—";
                      const cat =
                        r.categoryNameSnapshot ||
                        (r.categoryId ? categoryNameById.get(r.categoryId) : null) ||
                        (r.categoryId ? r.categoryId : null) ||
                        "Sin categoría";

                      const isVoid = r.status === "VOID";
                      return (
                        <tr key={r.id} className={cn("hover:bg-zinc-50/60", isVoid && "opacity-60")}>
                          <td className="px-4 py-3 text-sm text-zinc-700">{fmtTime(r.createdAt ?? null)}</td>
                          <td className="px-4 py-3 text-sm font-semibold text-zinc-900">{acc}</td>
                          <td className="px-4 py-3 text-sm text-zinc-700">{cat}</td>
                          <td className="px-4 py-3 text-right text-sm font-bold text-zinc-900">{moneyARS(r.amount)}</td>
                          <td className="px-4 py-3 text-sm text-zinc-700">{r.notes?.trim() ? r.notes : "—"}</td>
                          <td className="px-4 py-3 text-right">
                            {isVoid ? (
                              <span className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-semibold text-zinc-600">
                                <XCircle className="h-4 w-4" />
                                VOID
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                                <CheckCircle2 className="h-4 w-4" />
                                POSTED
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button variant="secondary" disabled={busy || isVoid} onClick={() => voidMovement(r.id)}>
                              Anular
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* paginado: sólo tiene sentido en POSTED (limit 30). En ALL/VOID traemos mucho, igual lo dejamos por si total explota */}
            {resp && resp.total > limit && (
              <div className="mt-3 flex items-center justify-between">
                <div className="text-xs text-zinc-500">
                  Página {resp.page} · {resp.total} items
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    disabled={busy || page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={busy || resp.page * resp.limit >= resp.total}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Siguiente
                  </Button>
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
