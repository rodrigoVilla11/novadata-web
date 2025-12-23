"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/app/providers/AuthProvider";
import { apiFetchAuthed } from "@/lib/apiAuthed";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import {
  ArrowLeft,
  RefreshCcw,
  Save,
  Send,
  Lock as LockIcon,
  AlertTriangle,
  CheckCircle2,
  Calculator,
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

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function safeNumFromInput(s: string) {
  // permite "12.345,67" o "12345.67"
  const clean = (s || "").trim();
  if (!clean) return 0;
  const normalized = clean.replace(/\./g, "").replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

function fmtInputFromNumber(n: number) {
  // input amigable: sin símbolo, con coma decimal si hace falta
  const v = Number(n ?? 0) || 0;
  // dos decimales, pero sin forzar .00 (más cómodo)
  const str = v.toFixed(2).replace(".", ",");
  // recorta ,00
  return str.endsWith(",00") ? str.slice(0, -3) : str;
}

// ============================================================================
// Types
// ============================================================================
type FinanceAccountRow = { id: string; name: string; active?: boolean };

type ClosingStatus = "OPEN" | "SUBMITTED" | "LOCKED";

type ClosingBalanceRowDTO = {
  accountId: string | null;
  balance: number;
};

type FinanceDayClosingDTO = {
  id: string;
  dateKey: string;
  status: ClosingStatus;
  notes: string | null;

  declaredBalances: ClosingBalanceRowDTO[];
  computedBalances: ClosingBalanceRowDTO[];
  diffBalances: ClosingBalanceRowDTO[];

  submittedAt: string | null;
  lockedAt: string | null;
};

// DTO upsert
type UpsertDayClosingDto = {
  declaredBalances: Array<{ accountId: string; balance: number }>;
  notes?: string | null;
};

// ============================================================================
// Page
// ============================================================================
export default function CashierClosingPage() {
  const { getAccessToken } = useAuth();

  const [dateKey, setDateKey] = useState(todayKeyArgentina());

  const [accounts, setAccounts] = useState<FinanceAccountRow[]>([]);
  const [closing, setClosing] = useState<FinanceDayClosingDTO | null>(null);

  const [declaredMap, setDeclaredMap] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const isLocked = closing?.status === "LOCKED";

  const accountNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of accounts) m.set(a.id, a.name);
    return m;
  }, [accounts]);

  const computedById = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of closing?.computedBalances || []) {
      if (r.accountId) m.set(r.accountId, Number(r.balance ?? 0));
    }
    return m;
  }, [closing]);

  const diffById = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of closing?.diffBalances || []) {
      if (r.accountId) m.set(r.accountId, Number(r.balance ?? 0));
    }
    return m;
  }, [closing]);

  const declaredTotal = useMemo(() => {
    let sum = 0;
    for (const a of accounts) {
      const s = declaredMap[a.id] ?? "";
      sum += safeNumFromInput(s);
    }
    return sum;
  }, [accounts, declaredMap]);

  const computedTotal = useMemo(() => {
    let sum = 0;
    for (const a of accounts) {
      sum += computedById.get(a.id) ?? 0;
    }
    return sum;
  }, [accounts, computedById]);

  const diffTotal = useMemo(() => declaredTotal - computedTotal, [declaredTotal, computedTotal]);

  // ----------------------------------------------------------------------------
  // Loaders
  // ----------------------------------------------------------------------------
  async function loadAccounts() {
    const acc = await apiFetchAuthed<FinanceAccountRow[]>(getAccessToken, "/finance/accounts?active=true");
    setAccounts(acc || []);
    return acc || [];
  }

  async function loadClosing() {
    try {
      const c = await apiFetchAuthed<FinanceDayClosingDTO>(getAccessToken, `/finance/closings/${encodeURIComponent(dateKey)}`);
      setClosing(c);

      // inicializar form desde closing
      const next: Record<string, string> = {};
      for (const r of c.declaredBalances || []) {
        if (r.accountId) next[r.accountId] = fmtInputFromNumber(r.balance);
      }
      setDeclaredMap((prev) => ({ ...prev, ...next }));
      setNotes(c.notes ?? "");
    } catch (e: any) {
      // si no existe cierre, no rompas: dejamos null y permitimos crear con POST
      const msg = String(e?.message || "");
      if (msg.toLowerCase().includes("404") || msg.toLowerCase().includes("no encontrado")) {
        setClosing(null);
        // no tocamos declaredMap para que puedas empezar a cargar
      } else {
        throw e;
      }
    }
  }

  async function loadAll() {
    setError(null);
    setOkMsg(null);
    setLoading(true);
    try {
      const acc = await loadAccounts();

      // si todavía no había declaredMap, prellenar con 0 vacío para cada cuenta (solo UI)
      setDeclaredMap((prev) => {
        const next = { ...prev };
        for (const a of acc) {
          if (next[a.id] === undefined) next[a.id] = "";
        }
        return next;
      });

      await loadClosing();
    } catch (e: any) {
      setError(e?.message || "Error cargando cierre");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // al cambiar dateKey, recargar cierre y mantener cuentas
    (async () => {
      setError(null);
      setOkMsg(null);
      setLoading(true);
      try {
        if (accounts.length === 0) await loadAccounts();
        await loadClosing();
      } catch (e: any) {
        setError(e?.message || "Error cargando cierre");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateKey]);

  // ----------------------------------------------------------------------------
  // Actions
  // ----------------------------------------------------------------------------
  async function saveDraft() {
    setError(null);
    setOkMsg(null);

    const declaredBalances = accounts
      .map((a) => ({
        accountId: a.id,
        balance: safeNumFromInput(declaredMap[a.id] ?? ""),
      }))
      // si querés permitir “no declarar” una cuenta, filtrá vacíos:
      // .filter((r) => (declaredMap[r.accountId] ?? "").trim() !== "")
      ;

    const dto: UpsertDayClosingDto = {
      declaredBalances,
      notes: notes.trim() || null,
    };

    setBusy(true);
    try {
      const res = await apiFetchAuthed<FinanceDayClosingDTO>(
        getAccessToken,
        `/finance/closings/${encodeURIComponent(dateKey)}`,
        { method: "POST", body: JSON.stringify(dto) }
      );
      setClosing(res);
      setOkMsg("Borrador guardado ✔");
      window.setTimeout(() => setOkMsg(null), 2500);
    } catch (e: any) {
      setError(e?.message || "Error guardando borrador");
    } finally {
      setBusy(false);
    }
  }

  async function submitClosing() {
    if (!confirm("¿Enviar cierre? Esto recalcula y marca SUBMITTED.")) return;

    setBusy(true);
    setError(null);
    setOkMsg(null);
    try {
      // primero guardamos el draft para asegurar declared actual
      await saveDraft();

      const res = await apiFetchAuthed<FinanceDayClosingDTO>(
        getAccessToken,
        `/finance/closings/${encodeURIComponent(dateKey)}/submit`,
        { method: "POST" }
      );
      setClosing(res);
      setOkMsg("Cierre enviado ✔ (SUBMITTED)");
      window.setTimeout(() => setOkMsg(null), 2500);
    } catch (e: any) {
      setError(e?.message || "Error enviando cierre");
    } finally {
      setBusy(false);
    }
  }

  async function lockClosing() {
    if (!confirm("¿LOCK? Solo ADMIN. Esto bloqueará modificaciones del día.")) return;
    setBusy(true);
    setError(null);
    setOkMsg(null);
    try {
      const res = await apiFetchAuthed<FinanceDayClosingDTO>(
        getAccessToken,
        `/finance/closings/${encodeURIComponent(dateKey)}/lock`,
        { method: "POST" }
      );
      setClosing(res);
      setOkMsg("Cierre LOCKED ✔");
      window.setTimeout(() => setOkMsg(null), 2500);
    } catch (e: any) {
      setError(e?.message || "Error lockeando cierre");
    } finally {
      setBusy(false);
    }
  }

  // ----------------------------------------------------------------------------
  // UI
  // ----------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="sticky top-0 z-10 border-b border-zinc-200 bg-white/80 backdrop-blur">
        <div className="mx-auto max-w-5xl px-4 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <button
                  className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
                  onClick={() => (window.location.href = "/cashier")}
                  type="button"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Volver
                </button>

                <h1 className="text-2xl font-bold text-zinc-900">Cashier • Cierre del día</h1>

                {closing?.status ? (
                  <span
                    className={cn(
                      "ml-2 inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold",
                      closing.status === "LOCKED"
                        ? "border-zinc-300 bg-zinc-100 text-zinc-700"
                        : closing.status === "SUBMITTED"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-amber-200 bg-amber-50 text-amber-800"
                    )}
                  >
                    {closing.status === "LOCKED" ? (
                      <>
                        <LockIcon className="h-4 w-4" />
                        LOCKED
                      </>
                    ) : closing.status === "SUBMITTED" ? (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        SUBMITTED
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="h-4 w-4" />
                        OPEN
                      </>
                    )}
                  </span>
                ) : (
                  <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-semibold text-zinc-600">
                    Sin cierre (se crea al guardar)
                  </span>
                )}
              </div>

              <p className="mt-1 text-sm text-zinc-500">
                Declarás saldos por cuenta. Al enviar, el sistema recalcula y muestra diferencias.
              </p>
            </div>

            <div className="flex items-end gap-2">
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
        {/* Filters */}
        <Card>
          <CardHeader title="Fecha de cierre" subtitle="dateKey en Argentina" />
          <CardBody>
            <div className="grid gap-3 md:grid-cols-[220px_1fr] md:items-end">
              <Field label="Día (dateKey)">
                <Input type="date" value={dateKey} onChange={(e) => setDateKey(e.target.value)} />
              </Field>

              <div className="text-sm text-zinc-500">
                {closing?.submittedAt ? `Enviado: ${new Date(closing.submittedAt).toLocaleString("es-AR")}` : "—"}
                {closing?.lockedAt ? ` · LOCK: ${new Date(closing.lockedAt).toLocaleString("es-AR")}` : ""}
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Summary totals */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader title="Total declarado" subtitle="Suma inputs" />
            <CardBody>
              <div className="text-2xl font-bold text-zinc-900">{moneyARS(declaredTotal)}</div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Total computado" subtitle="Desde movimientos" />
            <CardBody>
              <div className="text-2xl font-bold text-zinc-900">{moneyARS(computedTotal)}</div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Diferencia total" subtitle="Declarado - Computado" />
            <CardBody>
              <div className={cn("text-2xl font-bold", diffTotal >= 0 ? "text-emerald-700" : "text-red-700")}>
                {moneyARS(diffTotal)}
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Declared balances */}
        <Card>
          <CardHeader
            title="Saldos declarados por cuenta"
            subtitle={isLocked ? "LOCKED: solo lectura" : "Cargá los saldos reales al cierre"}
          />
          <CardBody>
            {loading ? (
              <div className="text-sm text-zinc-500">Cargando…</div>
            ) : accounts.length === 0 ? (
              <div className="text-sm text-zinc-500">No hay cuentas.</div>
            ) : (
              <div className="space-y-3">
                {accounts.map((a) => {
                  const declaredStr = declaredMap[a.id] ?? "";
                  const declaredVal = safeNumFromInput(declaredStr);

                  const computedVal = computedById.get(a.id);
                  const diffVal = diffById.get(a.id);

                  const showComputed = closing?.status === "SUBMITTED" || closing?.status === "LOCKED";

                  return (
                    <div key={a.id} className="rounded-2xl border border-zinc-200 bg-white p-4">
                      <div className="flex flex-wrap items-end justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-zinc-900">{a.name}</div>
                          <div className="text-xs text-zinc-500">{a.id}</div>
                        </div>

                        <div className="grid gap-3 md:grid-cols-3 md:items-end">
                          <Field label="Declarado (ARS)">
                            <Input
                              inputMode="decimal"
                              value={declaredStr}
                              onChange={(e) =>
                                setDeclaredMap((prev) => ({ ...prev, [a.id]: e.target.value }))
                              }
                              placeholder="Ej: 120000"
                              disabled={busy || isLocked}
                            />
                          </Field>

                          <div className="text-sm">
                            <div className="text-xs text-zinc-500 inline-flex items-center gap-2">
                              <Calculator className="h-4 w-4" />
                              Computado
                            </div>
                            <div className="mt-1 font-semibold text-zinc-900">
                              {showComputed ? moneyARS(computedVal ?? 0) : "—"}
                            </div>
                          </div>

                          <div className="text-sm">
                            <div className="text-xs text-zinc-500">Diff (decl - comp)</div>
                            <div
                              className={cn(
                                "mt-1 font-bold",
                                (diffVal ?? (declaredVal - (computedVal ?? 0))) >= 0
                                  ? "text-emerald-700"
                                  : "text-red-700"
                              )}
                            >
                              {showComputed ? moneyARS(diffVal ?? 0) : "—"}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mt-4">
              <Field label="Notas (opcional)">
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Observaciones del cierre…"
                  disabled={busy || isLocked}
                />
              </Field>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={saveDraft} disabled={busy || loading || isLocked} loading={busy}>
                <span className="inline-flex items-center gap-2">
                  <Save className="h-4 w-4" />
                  Guardar borrador
                </span>
              </Button>

              <Button variant="secondary" onClick={submitClosing} disabled={busy || loading || isLocked} loading={busy}>
                <span className="inline-flex items-center gap-2">
                  <Send className="h-4 w-4" />
                  Enviar cierre
                </span>
              </Button>

              {/* Si querés que lock sea solo admin y no se muestre en cashier, borrá este botón */}
              <Button variant="danger" onClick={lockClosing} disabled={busy || loading || closing?.status !== "SUBMITTED"} loading={busy}>
                <span className="inline-flex items-center gap-2">
                  <LockIcon className="h-4 w-4" />
                  Lock (ADMIN)
                </span>
              </Button>
            </div>

            <p className="mt-3 text-xs text-zinc-500">
              * Submit recalcula computed/diff en backend y marca SUBMITTED. Lock solo ADMIN.
            </p>
          </CardBody>
        </Card>

        {/* If submitted/locked, show computed table */}
        {(closing?.status === "SUBMITTED" || closing?.status === "LOCKED") && (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
              <div className="border-b border-zinc-100 px-5 py-4">
                <h2 className="text-lg font-semibold text-zinc-900">Computed (sistema)</h2>
                <p className="mt-1 text-sm text-zinc-500">Saldo final por cuenta hasta {dateKey}.</p>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-zinc-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                        Cuenta
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">
                        Computado
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {(closing?.computedBalances || []).map((r, idx) => {
                      const id = r.accountId || "";
                      const name = id ? (accountNameById.get(id) || id) : "—";
                      return (
                        <tr key={`${id}-${idx}`} className="hover:bg-zinc-50/60">
                          <td className="px-4 py-3 text-sm font-semibold text-zinc-900">{name}</td>
                          <td className="px-4 py-3 text-right text-sm font-bold text-zinc-900">{moneyARS(r.balance)}</td>
                        </tr>
                      );
                    })}
                    {(closing?.computedBalances || []).length === 0 && (
                      <tr>
                        <td colSpan={2} className="px-4 py-6 text-sm text-zinc-500">
                          Sin datos computed.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
              <div className="border-b border-zinc-100 px-5 py-4">
                <h2 className="text-lg font-semibold text-zinc-900">Diffs (decl - comp)</h2>
                <p className="mt-1 text-sm text-zinc-500">Solo para cuentas declaradas.</p>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-zinc-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                        Cuenta
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">
                        Diferencia
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {(closing?.diffBalances || []).map((r, idx) => {
                      const id = r.accountId || "";
                      const name = id ? (accountNameById.get(id) || id) : "—";
                      const val = Number(r.balance ?? 0);
                      return (
                        <tr key={`${id}-${idx}`} className="hover:bg-zinc-50/60">
                          <td className="px-4 py-3 text-sm font-semibold text-zinc-900">{name}</td>
                          <td
                            className={cn(
                              "px-4 py-3 text-right text-sm font-bold",
                              val >= 0 ? "text-emerald-700" : "text-red-700"
                            )}
                          >
                            {moneyARS(val)}
                          </td>
                        </tr>
                      );
                    })}
                    {(closing?.diffBalances || []).length === 0 && (
                      <tr>
                        <td colSpan={2} className="px-4 py-6 text-sm text-zinc-500">
                          No hay diffs (todavía).
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
