"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { AdminProtected } from "@/components/AdminProtected";
import { useAuth } from "@/app/providers/AuthProvider";
import { apiFetchAuthed } from "@/lib/apiAuthed";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Field";
import {
  RefreshCcw,
  PlusCircle,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Unlock,
  XCircle,
  Trash2,
  Wallet,
  ArrowDownCircle,
  ArrowUpCircle,
  BadgeDollarSign,
} from "lucide-react";

/* ============================================================================
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

function moneyARS(n: number) {
  const v = Number(n ?? 0) || 0;
  return v.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
}

function isValidNumberDraft(v: string) {
  return v === "" || /^[0-9]*([.][0-9]*)?$/.test(v);
}

function looksForbidden(msg: string) {
  const m = (msg || "").toLowerCase();
  return m.includes("forbidden") || m.includes("sin permisos") || m.includes("prohibido");
}

function StatusPill({ status }: { status: "OPEN" | "CLOSED" }) {
  const open = status === "OPEN";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold border",
        open
          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
          : "bg-zinc-100 text-zinc-600 border-zinc-200"
      )}
    >
      {open ? "ABIERTA" : "CERRADA"}
    </span>
  );
}

function Notice({
  tone,
  children,
}: {
  tone: "error" | "ok" | "warn";
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border px-3 py-2 text-sm",
        tone === "error"
          ? "border-red-200 bg-red-50 text-red-700"
          : tone === "warn"
          ? "border-amber-200 bg-amber-50 text-amber-800"
          : "border-emerald-200 bg-emerald-50 text-emerald-700"
      )}
    >
      <span className="inline-flex items-center gap-2">
        {tone === "error" ? (
          <AlertTriangle className="h-4 w-4" />
        ) : tone === "warn" ? (
          <AlertTriangle className="h-4 w-4" />
        ) : (
          <CheckCircle2 className="h-4 w-4" />
        )}
        {children}
      </span>
    </div>
  );
}

/* ============================================================================
 * Types (API)
 * ========================================================================== */

type CashDay = {
  id: string;
  dateKey: string;
  status: "OPEN" | "CLOSED";
  openingCash: number;
  expectedCash: number;
  countedCash: number | null;
  diffCash: number;
  openedAt: string | null;
  closedAt: string | null;
  closeNote?: string;
};

type CashMovement = {
  id: string;
  cashDayId: string;
  type: "INCOME" | "EXPENSE";
  method: "CASH" | "TRANSFER" | "CARD" | "OTHER";
  amount: number;
  categoryId: string | null;
  concept: string;
  note: string;
  voided: boolean;
  voidReason?: string;
  createdAt: string;
};

type FinanceCategory = {
  id: string;
  name: string;
  type?: string; // optional
  isActive?: boolean;
};

type CashSummary = {
  day: CashDay;
  totals: { income: number; expense: number; net: number; cashNet: number };
  byMethod: Array<{
    method: CashMovement["method"];
    income: number;
    expense: number;
    net: number;
    countIncome: number;
    countExpense: number;
  }>;
  byCategory: Array<{
    categoryId: string;
    name: string;
    type: string | null;
    income: number;
    expense: number;
    net: number;
    countIncome: number;
    countExpense: number;
  }>;
};

/* ============================================================================
 * Page
 * ========================================================================== */

export default function AdminCashPage() {
  const { getAccessToken, user } = useAuth();
  const roles = (user?.roles ?? []).map((r: any) => String(r).toUpperCase());
  const isAdmin = roles.includes("ADMIN");

  const [dateKey, setDateKey] = useState(todayKeyArgentina());

  const [day, setDay] = useState<CashDay | null>(null);
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [summary, setSummary] = useState<CashSummary | null>(null);
  const [categories, setCategories] = useState<FinanceCategory[]>([]);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  // create movement form
  const [type, setType] = useState<CashMovement["type"]>("INCOME");
  const [method, setMethod] = useState<CashMovement["method"]>("CASH");
  const [amount, setAmount] = useState("0");
  const [categoryId, setCategoryId] = useState<string>(""); // "" = none
  const [concept, setConcept] = useState("");
  const [note, setNote] = useState("");

  // close form
  const [countedCash, setCountedCash] = useState("");
  const [adminOverride, setAdminOverride] = useState(false);
  const [closeNote, setCloseNote] = useState("");

  const canWrite = useMemo(() => day?.status === "OPEN", [day]);

  const activeCategories = useMemo(
    () => categories.filter((c) => c.isActive !== false),
    [categories]
  );

  const totalsUi = useMemo(() => {
    if (!summary) return null;
    return summary.totals;
  }, [summary]);

  // ---------------- data loaders ----------------

  async function loadCategories() {
    // Ajustá la ruta si tu Finance usa otra
    const cats = await apiFetchAuthed<FinanceCategory[]>(
      getAccessToken,
      "/finance/categories"
    );
    setCategories(cats);
  }

  async function loadDay() {
    const d = await apiFetchAuthed<CashDay>(
      getAccessToken,
      `/cash/day?dateKey=${encodeURIComponent(dateKey)}`
    );
    setDay(d);
    return d;
  }

  async function loadMovements(cashDayId: string) {
    const rows = await apiFetchAuthed<CashMovement[]>(
      getAccessToken,
      `/cash/movements?cashDayId=${encodeURIComponent(cashDayId)}`
    );
    setMovements(rows);
  }

  async function loadSummary() {
    const s = await apiFetchAuthed<CashSummary>(
      getAccessToken,
      `/cash/day/summary?dateKey=${encodeURIComponent(dateKey)}`
    );
    setSummary(s);
    // sincronizamos day por si recalculó expectedCash
    setDay(s.day);
  }

  async function loadAll() {
    setErr(null);
    setOk(null);
    setLoading(true);

    try {
      await loadCategories();

      const d = await loadDay();
      await Promise.all([loadMovements(d.id), loadSummary()]);

      setOk("Datos actualizados ✔");
      setTimeout(() => setOk(null), 1400);
    } catch (e: any) {
      const msg = String(e?.message || "Error cargando caja");
      setErr(looksForbidden(msg) ? "Sin permisos para Caja." : msg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // cada vez que cambia el día
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateKey]);

  // ---------------- actions ----------------

  async function refresh() {
    setBusy(true);
    try {
      const d = await loadDay();
      await Promise.all([loadMovements(d.id), loadSummary()]);
    } catch (e: any) {
      setErr(String(e?.message || "Error actualizando"));
    } finally {
      setBusy(false);
    }
  }

  async function openCashDay() {
    // opcional: apertura explícita para setear openingCash
    if (!day) return;
    const opening = window.prompt("Efectivo inicial (apertura)", String(day.openingCash ?? 0));
    if (opening == null) return;

    const n = Number(opening);
    if (!Number.isFinite(n) || n < 0) {
      setErr("El efectivo inicial debe ser un número >= 0");
      return;
    }

    setBusy(true);
    setErr(null);
    try {
      await apiFetchAuthed(getAccessToken, "/cash/day/open", {
        method: "POST",
        body: JSON.stringify({ dateKey, openingCash: n }),
      });
      await refresh();
      setOk("Apertura actualizada ✔");
      setTimeout(() => setOk(null), 1400);
    } catch (e: any) {
      setErr(String(e?.message || "Error abriendo caja"));
    } finally {
      setBusy(false);
    }
  }

  async function createMovement() {
    if (!day) return;
    if (day.status !== "OPEN") {
      setErr("La caja está cerrada.");
      return;
    }

    const n = Number(amount || 0);
    if (!Number.isFinite(n) || n <= 0) {
      setErr("El monto debe ser un número > 0");
      return;
    }

    setBusy(true);
    setErr(null);

    try {
      await apiFetchAuthed(getAccessToken, "/cash/movements", {
        method: "POST",
        body: JSON.stringify({
          cashDayId: day.id,
          type,
          method,
          amount: n,
          categoryId: categoryId || undefined,
          concept,
          note,
        }),
      });

      setConcept("");
      setNote("");
      setAmount("0");
      setCategoryId("");

      await refresh();
      setOk("Movimiento creado ✔");
      setTimeout(() => setOk(null), 1400);
    } catch (e: any) {
      setErr(String(e?.message || "Error creando movimiento"));
    } finally {
      setBusy(false);
    }
  }

  async function voidMovement(m: CashMovement) {
    if (!window.confirm(`¿Anular movimiento?\n\n${m.type} ${moneyARS(m.amount)} (${m.method})`)) return;

    const reason = window.prompt("Razón de anulación (opcional)", m.voidReason || "");
    setBusy(true);
    setErr(null);
    try {
      await apiFetchAuthed(getAccessToken, `/cash/movements/${m.id}/void`, {
        method: "PATCH",
        body: JSON.stringify({ reason: reason ?? "" }),
      });
      await refresh();
      setOk("Movimiento anulado ✔");
      setTimeout(() => setOk(null), 1400);
    } catch (e: any) {
      setErr(String(e?.message || "Error anulando"));
    } finally {
      setBusy(false);
    }
  }

  async function closeCashDay() {
    if (!day) return;
    if (day.status !== "OPEN") {
      setErr("La caja ya está cerrada.");
      return;
    }

    const raw = countedCash.trim();
    const counted = raw === "" ? null : Number(raw);
    if (!adminOverride) {
      if (counted == null || !Number.isFinite(counted) || counted < 0) {
        setErr("Ingresá el efectivo contado (>= 0) o activá override admin.");
        return;
      }
    } else {
      if (!isAdmin) {
        setErr("Solo ADMIN puede usar override.");
        return;
      }
      if (counted != null && (!Number.isFinite(counted) || counted < 0)) {
        setErr("El contado debe ser >= 0");
        return;
      }
    }

    setBusy(true);
    setErr(null);

    try {
      await apiFetchAuthed(getAccessToken, "/cash/day/close", {
        method: "POST",
        body: JSON.stringify({
          dateKey,
          countedCash: counted,
          adminOverride,
          note: closeNote,
        }),
      });

      setCountedCash("");
      setAdminOverride(false);
      setCloseNote("");

      await refresh();
      setOk("Caja cerrada ✔");
      setTimeout(() => setOk(null), 1400);
    } catch (e: any) {
      setErr(String(e?.message || "Error cerrando caja"));
    } finally {
      setBusy(false);
    }
  }

  // ---------------- UI derived ----------------

  const headerRight = (
    <div className="flex flex-wrap gap-2">
      <Button variant="secondary" onClick={refresh} loading={busy || loading}>
        <RefreshCcw className="h-4 w-4" />
        Actualizar
      </Button>

      <Button
        variant="secondary"
        onClick={openCashDay}
        disabled={!day || day.status !== "OPEN" || busy}
      >
        <Wallet className="h-4 w-4" />
        Apertura
      </Button>

      <Button
        variant={day?.status === "OPEN" ? "danger" : "secondary"}
        onClick={closeCashDay}
        disabled={!day || day.status !== "OPEN" || busy}
      >
        <Lock className="h-4 w-4" />
        Cerrar caja
      </Button>
    </div>
  );

  return (
    <AdminProtected>
      <div className="space-y-6">
        {/* Header */}
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
                Caja diaria
              </h1>
              <p className="mt-1 text-sm text-zinc-500">
                Una caja por día. Movimientos categorizados (Finance) + arqueo.
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {day ? <StatusPill status={day.status} /> : null}
                {summary ? (
                  <span className="text-sm text-zinc-600">
                    Neto: <b>{moneyARS(summary.totals.net)}</b>{" "}
                    <span className="text-zinc-400">·</span> Ingresos:{" "}
                    <b className="text-emerald-700">{moneyARS(summary.totals.income)}</b>{" "}
                    <span className="text-zinc-400">·</span> Egresos:{" "}
                    <b className="text-rose-700">{moneyARS(summary.totals.expense)}</b>
                  </span>
                ) : null}
              </div>
            </div>

            <div className="min-w-[260px]">
              <Field label="Fecha">
                <Input
                  type="date"
                  value={dateKey}
                  onChange={(e) => setDateKey(e.target.value)}
                  disabled={busy || loading}
                />
              </Field>
              <div className="mt-3">{headerRight}</div>
            </div>
          </div>

          {(err || ok) && (
            <div className="mt-4 grid gap-2">
              {err && <Notice tone="error">{err}</Notice>}
              {!err && ok && <Notice tone="ok">{ok}</Notice>}
            </div>
          )}
        </div>

        {/* Summary cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader title="Efectivo" subtitle="Arqueo y esperado" />
            <CardBody>
              <div className="text-sm text-zinc-600 space-y-2">
                <div className="flex items-center justify-between">
                  <span>Apertura</span>
                  <b>{moneyARS(day?.openingCash ?? 0)}</b>
                </div>
                <div className="flex items-center justify-between">
                  <span>Esperado (efectivo)</span>
                  <b>{moneyARS(day?.expectedCash ?? 0)}</b>
                </div>
                <div className="flex items-center justify-between">
                  <span>Contado</span>
                  <b>{moneyARS(day?.countedCash ?? 0)}</b>
                </div>
                <div className="h-px bg-zinc-100 my-2" />
                <div className="flex items-center justify-between">
                  <span>Diferencia</span>
                  <b className={cn((day?.diffCash ?? 0) === 0 ? "text-emerald-700" : "text-rose-700")}>
                    {moneyARS(day?.diffCash ?? 0)}
                  </b>
                </div>
              </div>

              {day?.status === "OPEN" && (
                <div className="mt-4">
                  <Field label="Efectivo contado (para cerrar)">
                    <Input
                      value={countedCash}
                      onChange={(e) => isValidNumberDraft(e.target.value) && setCountedCash(e.target.value)}
                      placeholder="0"
                      disabled={busy || loading}
                    />
                  </Field>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className={cn(
                        "h-10 rounded-xl border px-3 text-sm font-semibold inline-flex items-center gap-2",
                        adminOverride
                          ? "border-amber-200 bg-amber-50 text-amber-800"
                          : "border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50"
                      )}
                      onClick={() => setAdminOverride((v) => !v)}
                      disabled={!isAdmin}
                      title={!isAdmin ? "Solo ADMIN" : "Cerrar aunque falten datos"}
                    >
                      {adminOverride ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                      Override admin
                    </button>
                  </div>

                  <div className="mt-3">
                    <Field label="Nota de cierre (opcional)">
                      <Input
                        value={closeNote}
                        onChange={(e) => setCloseNote(e.target.value)}
                        placeholder="Ej: faltó arqueo de tarjeta..."
                        disabled={busy || loading}
                      />
                    </Field>
                  </div>
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Por método" subtitle="Ingresos / egresos" />
            <CardBody>
              {!summary ? (
                <div className="text-sm text-zinc-500">Cargando…</div>
              ) : (
                <div className="space-y-3">
                  {summary.byMethod.map((m) => (
                    <div key={m.method} className="rounded-2xl border border-zinc-200 bg-white px-3 py-2">
                      <div className="flex items-center justify-between text-sm">
                        <b className="text-zinc-900">{m.method}</b>
                        <span className="text-zinc-600">
                          Neto: <b>{moneyARS(m.net)}</b>
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-xs text-zinc-600">
                        <span className="text-emerald-700">+ {moneyARS(m.income)}</span>
                        <span className="text-rose-700">- {moneyARS(m.expense)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Por categoría" subtitle="Finance" />
            <CardBody>
              {!summary ? (
                <div className="text-sm text-zinc-500">Cargando…</div>
              ) : summary.byCategory.length === 0 ? (
                <div className="text-sm text-zinc-500">Sin categorías usadas hoy.</div>
              ) : (
                <div className="space-y-2 max-h-[320px] overflow-auto pr-1">
                  {summary.byCategory.map((c) => (
                    <div key={c.categoryId} className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm">
                      <div className="min-w-0">
                        <div className="font-semibold text-zinc-900 truncate">{c.name}</div>
                        <div className="text-xs text-zinc-500">
                          +{moneyARS(c.income)} / -{moneyARS(c.expense)}
                        </div>
                      </div>
                      <div className={cn("font-semibold", c.net >= 0 ? "text-emerald-700" : "text-rose-700")}>
                        {moneyARS(c.net)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        {/* Create movement */}
        <Card>
          <CardHeader title="Nuevo movimiento" subtitle="Ingreso / Egreso con método y categoría" />
          <CardBody>
            <div className="grid gap-4 md:grid-cols-6">
              <Field label="Tipo">
                <Select value={type} onChange={(e) => setType(e.target.value as any)} disabled={!canWrite || busy}>
                  <option value="INCOME">Ingreso</option>
                  <option value="EXPENSE">Egreso</option>
                </Select>
              </Field>

              <Field label="Método">
                <Select value={method} onChange={(e) => setMethod(e.target.value as any)} disabled={!canWrite || busy}>
                  <option value="CASH">Efectivo</option>
                  <option value="TRANSFER">Transferencia</option>
                  <option value="CARD">Tarjeta</option>
                  <option value="OTHER">Otro</option>
                </Select>
              </Field>

              <Field label="Monto">
                <Input
                  value={amount}
                  onChange={(e) => isValidNumberDraft(e.target.value) && setAmount(e.target.value)}
                  disabled={!canWrite || busy}
                />
              </Field>

              <Field label="Categoría (Finance)">
                <Select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  disabled={!canWrite || busy}
                >
                  <option value="">— Sin categoría —</option>
                  {activeCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Concepto">
                <Input
                  value={concept}
                  onChange={(e) => setConcept(e.target.value)}
                  placeholder="Ej: Venta mostrador / Pago proveedor"
                  disabled={!canWrite || busy}
                />
              </Field>

              <Field label="Nota">
                <Input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Opcional"
                  disabled={!canWrite || busy}
                />
              </Field>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={createMovement} disabled={!canWrite || busy}>
                <PlusCircle className="h-4 w-4" />
                Agregar movimiento
              </Button>

              {!canWrite && (
                <div className="text-sm text-zinc-500 inline-flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  Caja cerrada: no se pueden agregar movimientos.
                </div>
              )}
            </div>
          </CardBody>
        </Card>

        {/* Movements table */}
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-100 px-5 py-4">
            <h2 className="text-lg font-semibold text-zinc-900">Movimientos</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Podés anular un movimiento (queda auditado).
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">Fecha</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">Tipo</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">Método</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">Monto</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">Categoría</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">Concepto</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">Acciones</th>
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

                {!loading && movements.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-sm text-zinc-500">
                      No hay movimientos.
                    </td>
                  </tr>
                )}

                {!loading &&
                  movements.map((m) => {
                    const isIncome = m.type === "INCOME";
                    const catName =
                      (summary?.byCategory.find((c) => c.categoryId === m.categoryId)?.name ||
                        activeCategories.find((c) => c.id === m.categoryId)?.name ||
                        "—");

                    return (
                      <tr key={m.id} className={cn(m.voided ? "opacity-60" : "hover:bg-zinc-50")}>
                        <td className="px-4 py-3 text-sm text-zinc-600">
                          {new Date(m.createdAt).toLocaleString("es-AR")}
                        </td>

                        <td className="px-4 py-3 text-sm">
                          <span
                            className={cn(
                              "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-semibold",
                              isIncome
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "border-rose-200 bg-rose-50 text-rose-700"
                            )}
                          >
                            {isIncome ? (
                              <ArrowUpCircle className="h-4 w-4" />
                            ) : (
                              <ArrowDownCircle className="h-4 w-4" />
                            )}
                            {isIncome ? "INGRESO" : "EGRESO"}
                          </span>
                          {m.voided && (
                            <div className="mt-1 text-xs text-zinc-500 inline-flex items-center gap-1">
                              <XCircle className="h-3.5 w-3.5" />
                              Anulado {m.voidReason ? `(${m.voidReason})` : ""}
                            </div>
                          )}
                        </td>

                        <td className="px-4 py-3 text-sm text-zinc-700">{m.method}</td>

                        <td className="px-4 py-3 text-sm">
                          <span className={cn("font-semibold", isIncome ? "text-emerald-700" : "text-rose-700")}>
                            {isIncome ? "+" : "-"} {moneyARS(m.amount)}
                          </span>
                        </td>

                        <td className="px-4 py-3 text-sm text-zinc-700">{m.categoryId ? catName : "—"}</td>

                        <td className="px-4 py-3 text-sm text-zinc-700">
                          <div className="font-medium text-zinc-900">{m.concept || "—"}</div>
                          {m.note ? <div className="text-xs text-zinc-500">{m.note}</div> : null}
                        </td>

                        <td className="px-4 py-3 text-sm">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="danger"
                              disabled={m.voided || busy || (!canWrite && !isAdmin)}
                              onClick={() => voidMovement(m)}
                              title={m.voided ? "Ya anulado" : "Anular"}
                            >
                              <Trash2 className="h-4 w-4" />
                              Anular
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
            Movimientos: <b>{movements.length}</b>
          </div>
        </div>
      </div>
    </AdminProtected>
  );
}
