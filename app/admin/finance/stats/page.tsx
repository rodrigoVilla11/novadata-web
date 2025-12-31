"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { AdminProtected } from "@/components/AdminProtected";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Field";

import {
  useGetFinanceStatsQuery,
  useGetFinanceAccountsQuery,
  type PeriodType,
} from "@/redux/services/financeApi";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";

import {
  RefreshCcw,
  TrendingUp,
  TrendingDown,
  ArrowRightLeft,
  Wallet,
  BarChart3,
  ChevronLeft,
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

function moneyARS(n: number) {
  return (Number(n ?? 0) || 0).toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
  });
}

function cn(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

const PERIODS: Array<{ label: string; value: PeriodType }> = [
  { label: "Día", value: "day" },
  { label: "Semana", value: "week" },
  { label: "Mes", value: "month" },
  { label: "Custom", value: "custom" },
];

type ChartMode = "DAILY" | "CUMULATIVE";

/* ===================== */
/* Page */
/* ===================== */

export default function FinanceStatsPage() {
  const [periodType, setPeriodType] = useState<PeriodType>("month");
  const [dateKey, setDateKey] = useState(todayKeyAR());
  const [from, setFrom] = useState(todayKeyAR());
  const [to, setTo] = useState(todayKeyAR());

  const [chartMode, setChartMode] = useState<ChartMode>("DAILY");
  const [highlightAccountId, setHighlightAccountId] = useState("");

  // ✅ siempre mandamos dateKey (AR) salvo custom
  const params = useMemo(() => {
    if (periodType === "custom") return { periodType, from, to };
    if (periodType === "day") return { periodType, dateKey };
    return { periodType, dateKey }; // ✅ para week/month el backend resuelve rango desde dateKey
  }, [periodType, dateKey, from, to]);

  const q = useGetFinanceStatsQuery(params as any);

  const { data: accounts = [], isFetching: accountsFetching } =
    useGetFinanceAccountsQuery({ active: undefined as any } as any);

  const accountNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of accounts) m.set(a.id, `${a.name} (${a.type}) ${a.currency}`);
    return m;
  }, [accounts]);

  /* ===================== */
  /* Derived data */
  /* ===================== */

  const totals = q.data?.totals;

  const seriesForChart = useMemo(() => {
    const base =
      q.data?.seriesDaily?.map((r) => ({
        dateKey: r.dateKey,
        income: Number(r.income || 0),
        expense: Number(r.expense || 0),
        net: Number(r.net || 0),
      })) || [];

    if (chartMode === "DAILY") return base;

    let accIncome = 0;
    let accExpense = 0;
    let accNet = 0;

    return base.map((r) => {
      accIncome += r.income;
      accExpense += r.expense;
      accNet += r.net;
      return { ...r, income: accIncome, expense: accExpense, net: accNet };
    });
  }, [q.data, chartMode]);

  const rangeLabel = q.data ? `${q.data.range.from} → ${q.data.range.to}` : "—";

  const filteredByAccount = useMemo(() => {
    const rows = q.data?.byAccount ?? [];
    if (!highlightAccountId) return rows;
    return rows.filter((r) => r.accountId === highlightAccountId);
  }, [q.data, highlightAccountId]);

  /* ===================== */
  /* Render */
  /* ===================== */

  return (
    <AdminProtected>
      <div className="space-y-6">
        {/* Header */}
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-[240px]">
              <div className="flex items-center gap-2 text-sm text-zinc-500">
                <Link
                  href="/admin/finance"
                  className="inline-flex items-center gap-1 hover:text-zinc-700"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Finance
                </Link>
                <span className="text-zinc-300">/</span>
                <span>Stats</span>
              </div>

              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900">
                Estadísticas
              </h1>
              <p className="mt-1 text-sm text-zinc-500">
                Ingresos, egresos, neto, transferencias y balances por cuenta.
              </p>

              <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-semibold text-zinc-600">
                Rango: <span className="text-zinc-900">{rangeLabel}</span>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => q.refetch()}
                loading={q.isFetching}
              >
                <RefreshCcw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardBody>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
              <Field label="Período">
                <Select
                  value={periodType}
                  onChange={(e) => setPeriodType(e.target.value as PeriodType)}
                >
                  {PERIODS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </Select>
              </Field>

              {periodType === "day" ? (
                <Field label="Día">
                  <Input
                    type="date"
                    value={dateKey}
                    onChange={(e) => setDateKey(e.target.value)}
                  />
                </Field>
              ) : periodType === "custom" ? (
                <>
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
                </>
              ) : (
                <Field label="Fecha base">
                  <Input
                    type="date"
                    value={dateKey}
                    onChange={(e) => setDateKey(e.target.value)}
                  />
                </Field>
              )}

              <Field label="Gráfico">
                <Select
                  value={chartMode}
                  onChange={(e) => setChartMode(e.target.value as ChartMode)}
                >
                  <option value="DAILY">Diario</option>
                  <option value="CUMULATIVE">Acumulado</option>
                </Select>
              </Field>

              <Field label="Cuenta (highlight)">
                <Select
                  value={highlightAccountId}
                  onChange={(e) => setHighlightAccountId(e.target.value)}
                  disabled={accountsFetching}
                >
                  <option value="">Todas</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label=" ">
                <Input disabled value="" />
              </Field>
            </div>
          </CardBody>
        </Card>

        {/* Loading / Error */}
        {q.isLoading ? (
          <p className="text-sm text-zinc-600">Cargando estadísticas…</p>
        ) : q.error || !q.data ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {String((q.error as any)?.data?.message || "Error")}
          </div>
        ) : (
          <>
            {/* Summary */}
            {totals && (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
                <Summary label="Ingresos" value={moneyARS(totals.income)} icon={TrendingUp} />
                <Summary label="Egresos" value={moneyARS(totals.expense)} icon={TrendingDown} />
                <Summary
                  label="Neto"
                  value={moneyARS(totals.net)}
                  icon={Wallet}
                  emphasis={totals.net >= 0 ? "good" : "bad"}
                />
                <Summary label="Transfer Out" value={moneyARS(totals.transferOut)} icon={ArrowRightLeft} />
                <Summary label="Transfer In" value={moneyARS(totals.transferIn)} icon={ArrowRightLeft} />
              </div>
            )}

            {/* Chart */}
            <Card>
              <CardBody>
                <div className="mb-3 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-zinc-500" />
                  <h3 className="font-semibold text-zinc-900">Serie temporal</h3>
                  <span className="text-xs text-zinc-500">
                    ({chartMode === "DAILY" ? "diario" : "acumulado"})
                  </span>
                </div>

                <div style={{ width: "100%", height: 320 }}>
                  <ResponsiveContainer>
                    <LineChart data={seriesForChart}>
                      <XAxis dataKey="dateKey" />
                      <YAxis
                        tickFormatter={(v) =>
                          Intl.NumberFormat("es-AR", { notation: "compact" }).format(Number(v))
                        }
                      />
                      <Tooltip
                        formatter={(v: any, name: any) => [moneyARS(Number(v)), String(name)]}
                        labelFormatter={(l) => `Fecha: ${l}`}
                      />
                      <Legend />
                      <Line type="monotone" dataKey="income" />
                      <Line type="monotone" dataKey="expense" />
                      <Line type="monotone" dataKey="net" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardBody>
            </Card>

            {/* By Account */}
            <Card>
              <CardBody>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <h3 className="font-semibold text-zinc-900">Por cuenta</h3>
                  <div className="text-xs text-zinc-500">
                    Filas: {filteredByAccount.length}
                  </div>
                </div>

                <div className="overflow-auto rounded-xl border border-zinc-200">
                  <table className="min-w-full text-sm">
                    <thead className="bg-zinc-50 text-zinc-500">
                      <tr>
                        <th className="p-3 text-left">Cuenta</th>
                        <th className="p-3 text-right">Start</th>
                        <th className="p-3 text-right">Ingresos</th>
                        <th className="p-3 text-right">Egresos</th>
                        <th className="p-3 text-right">Transfer In</th>
                        <th className="p-3 text-right">Transfer Out</th>
                        <th className="p-3 text-right">Neto</th>
                        <th className="p-3 text-right">End</th>
                        <th className="p-3 text-right">Δ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {filteredByAccount.map((r) => {
                        const start = Number(r.startBalance || 0);
                        const end = Number(r.endBalance || 0);
                        const delta = end - start;

                        return (
                          <tr key={r.accountId}>
                            <td className="p-3 font-medium text-zinc-900">
                              {accountNameById.get(r.accountId) || r.accountId}
                            </td>
                            <td className="p-3 text-right">{moneyARS(start)}</td>
                            <td className="p-3 text-right">{moneyARS(r.income)}</td>
                            <td className="p-3 text-right">{moneyARS(r.expense)}</td>
                            <td className="p-3 text-right">{moneyARS(r.transferIn)}</td>
                            <td className="p-3 text-right">{moneyARS(r.transferOut)}</td>
                            <td className="p-3 text-right">{moneyARS(r.net)}</td>
                            <td className="p-3 text-right font-semibold">{moneyARS(end)}</td>
                            <td
                              className={cn(
                                "p-3 text-right font-semibold",
                                delta >= 0 ? "text-emerald-700" : "text-red-700"
                              )}
                            >
                              {moneyARS(delta)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardBody>
            </Card>
          </>
        )}
      </div>
    </AdminProtected>
  );
}

/* ===================== */
/* Small components */
/* ===================== */

function Summary({
  label,
  value,
  icon: Icon,
  emphasis,
}: {
  label: string;
  value: string;
  icon: any;
  emphasis?: "good" | "bad";
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-zinc-500">{label}</span>
        <Icon className="h-4 w-4 text-zinc-400" />
      </div>
      <div
        className={cn(
          "mt-1 text-lg font-bold",
          emphasis === "good" && "text-emerald-700",
          emphasis === "bad" && "text-red-700"
        )}
      >
        {value}
      </div>
    </div>
  );
}
