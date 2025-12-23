"use client";

import React, { useMemo, useState } from "react";
import { AdminProtected } from "@/components/AdminProtected";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
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
} from "lucide-react";

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

const PERIODS: Array<{ label: string; value: PeriodType }> = [
  { label: "Día", value: "day" },
  { label: "Semana", value: "week" },
  { label: "Mes", value: "month" },
  { label: "Año", value: "year" },
  { label: "Custom", value: "custom" },
];

type ChartMode = "DAILY" | "CUMULATIVE";
type SummaryCard = {
  label: string;
  value: string;
  icon: any; // o React.ComponentType<any>
  hint: string;
  emphasis?: "good" | "bad";
};

export default function FinanceStatsPage() {
  const [periodType, setPeriodType] = useState<PeriodType>("month");
  const [dateKey, setDateKey] = useState(todayKeyAR());
  const [from, setFrom] = useState(todayKeyAR());
  const [to, setTo] = useState(todayKeyAR());

  // UI extras
  const [chartMode, setChartMode] = useState<ChartMode>("DAILY");
  const [highlightAccountId, setHighlightAccountId] = useState<string>("");

  const params = useMemo(() => {
    if (periodType === "custom") return { periodType, from, to };
    if (periodType === "day") return { periodType, dateKey };
    return { periodType };
  }, [periodType, dateKey, from, to]);

  const q = useGetFinanceStatsQuery(params);
  // ✅ para stats conviene poder ver todas, activas o no (si querés lo dejamos active:true)
  const { data: accounts = [] } = useGetFinanceAccountsQuery({
    active: undefined as any,
  } as any);

  const accountNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of accounts)
      m.set(a.id, `${a.name} (${a.type}) ${a.currency}`);
    return m;
  }, [accounts]);

  const topIncomeCats = useMemo(() => {
    const rows = (q.data?.byCategory || []).filter((c) => c.type === "INCOME");
    return rows
      .slice()
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [q.data]);

  const topExpenseCats = useMemo(() => {
    const rows = (q.data?.byCategory || []).filter((c) => c.type === "EXPENSE");
    return rows
      .slice()
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [q.data]);

  const maxIncomeCat = useMemo(
    () => Math.max(1, ...topIncomeCats.map((x) => Number(x.total || 0))),
    [topIncomeCats]
  );
  const maxExpenseCat = useMemo(
    () => Math.max(1, ...topExpenseCats.map((x) => Number(x.total || 0))),
    [topExpenseCats]
  );

  const seriesForChart = useMemo(() => {
    const base = (q.data?.seriesDaily || []).map((r) => ({
      dateKey: r.dateKey,
      income: Number(r.income || 0),
      expense: Number(r.expense || 0),
      net: Number(r.net || 0),
    }));

    if (chartMode === "DAILY") return base;

    let accIncome = 0;
    let accExpense = 0;
    let accNet = 0;
    return base.map((r) => {
      accIncome += r.income;
      accExpense += r.expense;
      accNet += r.net;
      return {
        ...r,
        income: accIncome,
        expense: accExpense,
        net: accNet,
      };
    });
  }, [q.data, chartMode]);

  const totals = q.data?.totals;
  const summaryCards = useMemo<SummaryCard[] | null>(() => {
    if (!totals) return null;

    const net = Number(totals.net || 0);

    return [
      {
        label: "Ingresos",
        value: moneyARS(totals.income),
        icon: TrendingUp,
        hint: "Total de ingresos del período",
      },
      {
        label: "Egresos",
        value: moneyARS(totals.expense),
        icon: TrendingDown,
        hint: "Total de egresos del período",
      },
      {
        label: "Neto",
        value: moneyARS(net),
        icon: Wallet,
        hint: "Ingresos - Egresos",
        emphasis: net >= 0 ? "good" : "bad",
      },
      {
        label: "Transfer Out",
        value: moneyARS(totals.transferOut),
        icon: ArrowRightLeft,
        hint: "Transferencias salientes",
      },
      {
        label: "Transfer In",
        value: moneyARS(totals.transferIn),
        icon: ArrowRightLeft,
        hint: "Transferencias entrantes",
      },
    ];
  }, [totals]);

  return (
    <AdminProtected>
      <div className="p-4 min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="max-w-6xl mx-auto space-y-4">
          <Card>
            <CardHeader
              title="Finance · Stats"
              subtitle="Resumen por período (ingresos, egresos, neto, transferencias y balances por cuenta)."
              right={
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => q.refetch()}
                    loading={q.isFetching}
                  >
                    <span className="inline-flex items-center gap-2">
                      <RefreshCcw className="h-4 w-4" />
                      Refrescar
                    </span>
                  </Button>
                </div>
              }
            />
            <CardBody>
              {/* filtros */}
              <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                <Field label="Período">
                  <Select
                    value={periodType}
                    onChange={(e) =>
                      setPeriodType(e.target.value as PeriodType)
                    }
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
                  <>
                    <Field label="Rango resuelto">
                      <Input
                        value={
                          q.data
                            ? `${q.data.range.from} → ${q.data.range.to}`
                            : ""
                        }
                        disabled
                      />
                    </Field>
                    <Field label=" ">
                      <Input value="" disabled />
                    </Field>
                  </>
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

                <Field label="Resaltar cuenta">
                  <Select
                    value={highlightAccountId}
                    onChange={(e) => setHighlightAccountId(e.target.value)}
                  >
                    <option value="">(Ninguna)</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.type}) {a.currency}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>

              {/* estado */}
              {q.isLoading ? (
                <p className="mt-4 text-sm text-gray-600">Cargando...</p>
              ) : q.error ? (
                <p className="mt-4 text-sm text-red-600">
                  {String((q.error as any)?.data?.message || "Error")}
                </p>
              ) : !q.data ? (
                <p className="mt-4 text-sm text-gray-600">Sin datos</p>
              ) : (
                <>
                  {/* rango */}
                  <div className="mt-4 text-sm text-gray-600">
                    Rango:{" "}
                    <span className="font-semibold">{q.data.range.from}</span> →{" "}
                    <span className="font-semibold">{q.data.range.to}</span>
                  </div>

                  {/* cards */}
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-5 gap-3">
                    {(summaryCards || []).map((c) => {
                      const Icon = c.icon;
                      return (
                        <div
                          key={c.label}
                          className="rounded-2xl bg-white border p-4"
                        >
                          <div className="flex items-center justify-between">
                            <div className="text-xs text-gray-500">
                              {c.label}
                            </div>
                            <Icon className="h-4 w-4 text-gray-400" />
                          </div>

                          <div
                            className={cn(
                              "mt-1 text-lg font-bold",
                              c.emphasis === "good" && "text-emerald-700",
                              c.emphasis === "bad" && "text-red-700"
                            )}
                          >
                            {c.value}
                          </div>

                          <div className="mt-1 text-[11px] text-gray-500">
                            {c.hint}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* chart */}
                  <div className="mt-4 rounded-2xl bg-white border p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <BarChart3 className="h-4 w-4 text-gray-500" />
                        <h3 className="font-semibold text-gray-900">
                          Serie diaria
                        </h3>
                      </div>
                      <span className="text-xs text-gray-500">
                        {chartMode === "DAILY" ? "daily" : "cumulative"} ·
                        income / expense / net
                      </span>
                    </div>

                    <div style={{ width: "100%", height: 320 }}>
                      <ResponsiveContainer>
                        <LineChart data={seriesForChart}>
                          <XAxis dataKey="dateKey" />
                          <YAxis
                            tickFormatter={(v) =>
                              Intl.NumberFormat("es-AR", {
                                notation: "compact",
                              }).format(Number(v || 0))
                            }
                          />
                          <Tooltip
                            formatter={(v: any) => moneyARS(Number(v || 0))}
                          />
                          <Legend />
                          <Line type="monotone" dataKey="income" />
                          <Line type="monotone" dataKey="expense" />
                          <Line type="monotone" dataKey="net" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* byAccount */}
                  <div className="mt-4 rounded-2xl bg-white border overflow-auto">
                    <div className="p-4 border-b">
                      <h3 className="font-semibold text-gray-900">
                        Por cuenta
                      </h3>
                      <p className="text-sm text-gray-600">
                        startBalance = saldo hasta día anterior al inicio del
                        rango · endBalance = saldo hasta fin del rango · delta =
                        end - start
                      </p>
                    </div>

                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left p-3">Cuenta</th>
                          <th className="text-right p-3">Start</th>
                          <th className="text-right p-3">Ingresos</th>
                          <th className="text-right p-3">Egresos</th>
                          <th className="text-right p-3">Neto</th>
                          <th className="text-right p-3">Transf Out</th>
                          <th className="text-right p-3">Transf In</th>
                          <th className="text-right p-3">End</th>
                          <th className="text-right p-3">Δ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {q.data.byAccount
                          .filter(
                            (r) =>
                              !highlightAccountId ||
                              r.accountId === highlightAccountId
                          )
                          .map((r) => {
                            const delta =
                              Number(r.endBalance || 0) -
                              Number(r.startBalance || 0);
                            return (
                              <tr key={r.accountId} className="border-t">
                                <td className="p-3 font-medium">
                                  {accountNameById.get(r.accountId) ||
                                    r.accountId}
                                </td>
                                <td className="p-3 text-right">
                                  {moneyARS(r.startBalance)}
                                </td>
                                <td className="p-3 text-right">
                                  {moneyARS(r.income)}
                                </td>
                                <td className="p-3 text-right">
                                  {moneyARS(r.expense)}
                                </td>
                                <td className="p-3 text-right">
                                  {moneyARS(r.net)}
                                </td>
                                <td className="p-3 text-right">
                                  {moneyARS(r.transferOut)}
                                </td>
                                <td className="p-3 text-right">
                                  {moneyARS(r.transferIn)}
                                </td>
                                <td className="p-3 text-right font-semibold">
                                  {moneyARS(r.endBalance)}
                                </td>
                                <td
                                  className={cn(
                                    "p-3 text-right font-semibold",
                                    delta >= 0
                                      ? "text-emerald-700"
                                      : "text-red-700"
                                  )}
                                >
                                  {moneyARS(delta)}
                                </td>
                              </tr>
                            );
                          })}

                        {q.data.byAccount.length === 0 && (
                          <tr>
                            <td colSpan={9} className="p-3 text-gray-500">
                              Sin cuentas.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* byCategory top */}
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-2xl bg-white border p-4">
                      <h3 className="font-semibold text-gray-900">
                        Top categorías · Ingresos
                      </h3>
                      <div className="mt-3 space-y-2">
                        {topIncomeCats.map((c, idx) => {
                          const pct = Math.round(
                            (Number(c.total || 0) / maxIncomeCat) * 100
                          );
                          return (
                            <div
                              key={`${c.categoryId}-${idx}`}
                              className="text-sm"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-gray-700">
                                  {c.nameSnapshot ||
                                    c.categoryId ||
                                    "(sin categoría)"}
                                </span>
                                <span className="font-semibold">
                                  {moneyARS(c.total)}
                                </span>
                              </div>
                              <div className="mt-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                                <div
                                  className="h-2 bg-gray-800"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                        {topIncomeCats.length === 0 && (
                          <p className="text-sm text-gray-500 mt-2">
                            Sin ingresos.
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="rounded-2xl bg-white border p-4">
                      <h3 className="font-semibold text-gray-900">
                        Top categorías · Egresos
                      </h3>
                      <div className="mt-3 space-y-2">
                        {topExpenseCats.map((c, idx) => {
                          const pct = Math.round(
                            (Number(c.total || 0) / maxExpenseCat) * 100
                          );
                          return (
                            <div
                              key={`${c.categoryId}-${idx}`}
                              className="text-sm"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-gray-700">
                                  {c.nameSnapshot ||
                                    c.categoryId ||
                                    "(sin categoría)"}
                                </span>
                                <span className="font-semibold">
                                  {moneyARS(c.total)}
                                </span>
                              </div>
                              <div className="mt-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                                <div
                                  className="h-2 bg-gray-800"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                        {topExpenseCats.length === 0 && (
                          <p className="text-sm text-gray-500 mt-2">
                            Sin egresos.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </AdminProtected>
  );
}
