"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
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
  Info,
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
  const v = Number(n ?? 0) || 0;
  const str = v.toFixed(2).replace(".", ",");
  return str.endsWith(",00") ? str.slice(0, -3) : str;
}

function formatDateTimeAR(iso?: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("es-AR");
  } catch {
    return String(iso);
  }
}

function signColor(n: number) {
  return n >= 0 ? "text-emerald-700" : "text-red-700";
}

function pillTone(n: number) {
  return n >= 0
    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
    : "border-red-200 bg-red-50 text-red-800";
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

type UpsertDayClosingDto = {
  declaredBalances: Array<{ accountId: string; balance: number }>;
  notes?: string | null;
};

// ============================================================================
// UI tiny components
// ============================================================================
function StatusChip({ status }: { status?: ClosingStatus | null }) {
  if (!status) {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-semibold text-zinc-700">
        <Info className="h-4 w-4" />
        Sin cierre
      </span>
    );
  }

  const base =
    "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold";

  if (status === "LOCKED") {
    return (
      <span className={cn(base, "border-zinc-300 bg-zinc-100 text-zinc-700")}>
        <LockIcon className="h-4 w-4" />
        LOCKED
      </span>
    );
  }
  if (status === "SUBMITTED") {
    return (
      <span
        className={cn(
          base,
          "border-emerald-200 bg-emerald-50 text-emerald-800"
        )}
      >
        <CheckCircle2 className="h-4 w-4" />
        ENVIADO
      </span>
    );
  }
  return (
    <span className={cn(base, "border-amber-200 bg-amber-50 text-amber-800")}>
      <AlertTriangle className="h-4 w-4" />
      BORRADOR
    </span>
  );
}

function StatCard({
  title,
  subtitle,
  value,
  tone = "default",
}: {
  title: string;
  subtitle: string;
  value: React.ReactNode;
  tone?: "default" | "good" | "bad";
}) {
  const ring =
    tone === "good"
      ? "ring-1 ring-emerald-100"
      : tone === "bad"
      ? "ring-1 ring-red-100"
      : "ring-1 ring-zinc-100";

  return (
    <div
      className={cn(
        "rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm",
        ring
      )}
    >
      <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
        {title}
      </div>
      <div className="mt-1 text-sm text-zinc-500">{subtitle}</div>
      <div className="mt-3 text-2xl font-bold text-zinc-900">{value}</div>
    </div>
  );
}

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
  const [refreshing, setRefreshing] = useState(false); // ✅ separado

  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const isLocked = closing?.status === "LOCKED";
  const isSubmitted = closing?.status === "SUBMITTED";
  const showComputed = isSubmitted || isLocked;

  const okTimerRef = useRef<number | null>(null);
  function flashOk(msg: string) {
    setOkMsg(msg);
    if (okTimerRef.current) window.clearTimeout(okTimerRef.current);
    okTimerRef.current = window.setTimeout(() => setOkMsg(null), 2200);
  }

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

  const diffTotal = useMemo(
    () => declaredTotal - computedTotal,
    [declaredTotal, computedTotal]
  );

  // ----------------------------------------------------------------------------
  // Loaders
  // ----------------------------------------------------------------------------
  async function loadAccounts() {
    const acc = await apiFetchAuthed<FinanceAccountRow[]>(
      getAccessToken,
      "/finance/accounts?active=true"
    );
    setAccounts(acc || []);
    return acc || [];
  }

  async function loadClosing() {
    try {
      const c = await apiFetchAuthed<FinanceDayClosingDTO>(
        getAccessToken,
        `/finance/closings/${encodeURIComponent(dateKey)}`
      );
      setClosing(c);

      const next: Record<string, string> = {};
      for (const r of c.declaredBalances || []) {
        if (r.accountId) next[r.accountId] = fmtInputFromNumber(r.balance);
      }
      setDeclaredMap((prev) => ({ ...prev, ...next }));
      setNotes(c.notes ?? "");
    } catch (e: any) {
      const msg = String(e?.message || "");
      if (
        msg.toLowerCase().includes("404") ||
        msg.toLowerCase().includes("no encontrado")
      ) {
        setClosing(null);
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

    const declaredBalances = accounts.map((a) => ({
      accountId: a.id,
      balance: safeNumFromInput(declaredMap[a.id] ?? ""),
    }));

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
      flashOk("Borrador guardado");
    } catch (e: any) {
      setError(e?.message || "Error guardando borrador");
    } finally {
      setBusy(false);
    }
  }

  async function submitClosing() {
    if (!confirm("¿Enviar cierre? Esto recalcula y marca ENVIADO.")) return;

    setBusy(true);
    setError(null);
    setOkMsg(null);
    try {
      await saveDraft();

      const res = await apiFetchAuthed<FinanceDayClosingDTO>(
        getAccessToken,
        `/finance/closings/${encodeURIComponent(dateKey)}/submit`,
        { method: "POST" }
      );
      setClosing(res);
      flashOk("Cierre enviado (ENVIADO)");
    } catch (e: any) {
      setError(e?.message || "Error enviando cierre");
    } finally {
      setBusy(false);
    }
  }

  async function lockClosing() {
    if (!confirm("¿LOCK? Solo ADMIN. Esto bloqueará modificaciones del día."))
      return;
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
      flashOk("Cierre bloqueado (LOCKED)");
    } catch (e: any) {
      setError(e?.message || "Error lockeando cierre");
    } finally {
      setBusy(false);
    }
  }

  async function refresh() {
    setRefreshing(true);
    setError(null);
    setOkMsg(null);
    try {
      await loadAll();
      flashOk("Actualizado");
    } catch (e: any) {
      setError(e?.message || "Error actualizando");
    } finally {
      setRefreshing(false);
    }
  }

  function onBlurFormatAccount(id: string) {
    setDeclaredMap((prev) => {
      const raw = prev[id] ?? "";
      if (!raw.trim()) return prev;
      const n = safeNumFromInput(raw);
      return { ...prev, [id]: fmtInputFromNumber(n) };
    });
  }

  // ----------------------------------------------------------------------------
  // UI
  // ----------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Top bar (Gourmetify-ish) */}
      <div className="sticky top-0 z-20 border-b border-zinc-200 bg-white/85 backdrop-blur">
        <div className="mx-auto max-w-5xl px-4 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <div className="min-w-0">
                  <h1 className="truncate text-xl font-bold text-zinc-900 md:text-2xl">
                    Cierre del día
                  </h1>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-zinc-500">
                    <span className="font-medium text-zinc-700">{dateKey}</span>
                    <span>•</span>
                    <span>
                      Enviado: {formatDateTimeAR(closing?.submittedAt)}
                      {closing?.lockedAt
                        ? ` · Lock: ${formatDateTimeAR(closing.lockedAt)}`
                        : ""}
                    </span>
                  </div>
                </div>

                <StatusChip status={closing?.status} />
              </div>

              <p className="mt-2 text-sm text-zinc-500">
                Cargá saldos por cuenta. Al enviar, el sistema recalcula y te
                muestra diferencias.
              </p>

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

            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                onClick={refresh}
                disabled={busy || refreshing}
                loading={refreshing}
              >
                <span className="inline-flex items-center gap-2">
                  <RefreshCcw className="h-4 w-4" />
                  Actualizar
                </span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* TODO: tu resto del componente sigue EXACTAMENTE igual */}
      {/* Pegá desde acá hacia abajo tal cual lo tenías (yo no lo toqué) */}

      <div className="mx-auto max-w-5xl px-4 py-6 pb-28 space-y-6">
        {/* Fecha */}
        <Card>
          <CardHeader title="Fecha" subtitle="Se usa dateKey (Argentina)" />
          <CardBody>
            <div className="grid gap-3 md:grid-cols-[240px_1fr] md:items-end">
              <Field label="Día">
                <Input
                  type="date"
                  value={dateKey}
                  onChange={(e) => setDateKey(e.target.value)}
                  disabled={busy}
                />
              </Field>

              <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-zinc-800">Tip:</span>
                  <span>
                    Si querés ver “computado” y “diff”, primero enviá el cierre.
                  </span>
                </div>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Resumen */}
        <div className="grid gap-4 md:grid-cols-3">
          <StatCard
            title="Declarado"
            subtitle="Suma de tus inputs"
            value={moneyARS(declaredTotal)}
          />
          <StatCard
            title="Computado"
            subtitle={
              showComputed ? "Desde movimientos" : "Disponible al enviar"
            }
            value={showComputed ? moneyARS(computedTotal) : "—"}
          />
          <StatCard
            title="Diferencia"
            subtitle="Declarado - Computado"
            tone={showComputed ? (diffTotal >= 0 ? "good" : "bad") : "default"}
            value={
              showComputed ? (
                <span className={cn(signColor(diffTotal))}>
                  {moneyARS(diffTotal)}
                </span>
              ) : (
                "—"
              )
            }
          />
        </div>

        {/* Inputs por cuenta */}
        <Card>
          <CardHeader
            title="Saldos por cuenta"
            subtitle={
              isLocked
                ? "LOCKED: solo lectura"
                : "Cargá los saldos reales al cierre"
            }
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

                  const computedVal = computedById.get(a.id) ?? 0;
                  const diffVal = showComputed
                    ? diffById.get(a.id) ?? 0
                    : declaredVal - computedVal;

                  return (
                    <div
                      key={a.id}
                      className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm"
                    >
                      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-zinc-900">
                            {a.name}
                          </div>
                          <div className="mt-0.5 text-xs text-zinc-500">
                            {a.id}
                          </div>
                        </div>

                        <div className="grid gap-3 md:grid-cols-3 md:items-end">
                          <Field label="Declarado (ARS)">
                            <Input
                              inputMode="decimal"
                              value={declaredStr}
                              onChange={(e) =>
                                setDeclaredMap((prev) => ({
                                  ...prev,
                                  [a.id]: e.target.value,
                                }))
                              }
                              onFocus={(e) => e.currentTarget.select()}
                              onBlur={() => onBlurFormatAccount(a.id)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") saveDraft();
                              }}
                              placeholder="Ej: 120000"
                              disabled={busy || isLocked}
                              className="text-right"
                            />
                          </Field>

                          <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2">
                            <div className="text-xs font-semibold text-zinc-500 inline-flex items-center gap-2">
                              <Calculator className="h-4 w-4" />
                              Computado
                            </div>
                            <div className="mt-1 text-sm font-bold text-zinc-900">
                              {showComputed ? moneyARS(computedVal) : "—"}
                            </div>
                          </div>

                          <div
                            className={cn(
                              "rounded-xl border px-3 py-2",
                              showComputed
                                ? pillTone(diffVal)
                                : "border-zinc-200 bg-white text-zinc-700"
                            )}
                          >
                            <div className="text-xs font-semibold text-zinc-500">
                              Diff (decl - comp)
                            </div>
                            <div
                              className={cn(
                                "mt-1 text-sm font-extrabold",
                                showComputed && signColor(diffVal)
                              )}
                            >
                              {showComputed ? moneyARS(diffVal) : "—"}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mt-5">
              <Field label="Notas (opcional)">
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Observaciones del cierre…"
                  disabled={busy || isLocked}
                />
              </Field>
            </div>

            {!showComputed && (
              <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
                <div className="flex items-start gap-2">
                  <Info className="mt-0.5 h-4 w-4" />
                  <div>
                    <div className="font-semibold text-zinc-800">Consejo</div>
                    <div>
                      Guardá borrador durante el día. Cuando termines,{" "}
                      <b>Enviar cierre</b> para ver el computado y las
                      diferencias.
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardBody>
        </Card>

        {/* Tablas extra (solo enviado/locked) */}
        {showComputed && (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
              <div className="border-b border-zinc-100 px-5 py-4">
                <h2 className="text-lg font-semibold text-zinc-900">
                  Computado (sistema)
                </h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Saldo final por cuenta hasta {dateKey}.
                </p>
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
                      const name = id ? accountNameById.get(id) || id : "—";
                      return (
                        <tr
                          key={`${id}-${idx}`}
                          className="hover:bg-zinc-50/60"
                        >
                          <td className="px-4 py-3 text-sm font-semibold text-zinc-900">
                            {name}
                          </td>
                          <td className="px-4 py-3 text-right text-sm font-extrabold text-zinc-900">
                            {moneyARS(r.balance)}
                          </td>
                        </tr>
                      );
                    })}
                    {(closing?.computedBalances || []).length === 0 && (
                      <tr>
                        <td
                          colSpan={2}
                          className="px-4 py-6 text-sm text-zinc-500"
                        >
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
                <h2 className="text-lg font-semibold text-zinc-900">
                  Diferencias
                </h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Declarado - Computado.
                </p>
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
                      const name = id ? accountNameById.get(id) || id : "—";
                      const val = Number(r.balance ?? 0);
                      return (
                        <tr
                          key={`${id}-${idx}`}
                          className="hover:bg-zinc-50/60"
                        >
                          <td className="px-4 py-3 text-sm font-semibold text-zinc-900">
                            {name}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span
                              className={cn(
                                "inline-flex min-w-30 justify-end rounded-full border px-3 py-1 text-sm font-extrabold",
                                pillTone(val)
                              )}
                            >
                              {moneyARS(val)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {(closing?.diffBalances || []).length === 0 && (
                      <tr>
                        <td
                          colSpan={2}
                          className="px-4 py-6 text-sm text-zinc-500"
                        >
                          No hay diffs.
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

      {/* Sticky action bar (muy Gourmetify) */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200 bg-white/90 backdrop-blur">
        <div className="mx-auto max-w-5xl px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-zinc-600">
              <span className="font-semibold text-zinc-900">
                {moneyARS(declaredTotal)}
              </span>{" "}
              <span className="text-zinc-400">·</span>{" "}
              <span
                className={cn(
                  "font-semibold",
                  showComputed ? signColor(diffTotal) : "text-zinc-600"
                )}
              >
                {showComputed ? `Diff: ${moneyARS(diffTotal)}` : "Diff: —"}
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                onClick={saveDraft}
                disabled={busy || loading || isLocked}
                loading={busy}
              >
                <span className="inline-flex items-center gap-2">
                  <Save className="h-4 w-4" />
                  Guardar
                </span>
              </Button>

              <Button
                variant="secondary"
                onClick={submitClosing}
                disabled={busy || loading || isLocked}
                loading={busy}
              >
                <span className="inline-flex items-center gap-2">
                  <Send className="h-4 w-4" />
                  Enviar
                </span>
              </Button>

              <Button
                variant="danger"
                onClick={lockClosing}
                disabled={busy || loading || closing?.status !== "SUBMITTED"}
                loading={busy}
              >
                <span className="inline-flex items-center gap-2">
                  <LockIcon className="h-4 w-4" />
                  Lock
                </span>
              </Button>
            </div>
          </div>

          <div className="mt-1 text-xs text-zinc-500">
            * Enviar recalcula en backend. Lock solo ADMIN.
          </div>
        </div>
      </div>
    </div>
  );
}
