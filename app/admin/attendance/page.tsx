"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/app/providers/AuthProvider";
import { apiFetchAuthed } from "@/lib/apiAuthed";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Field";
import { RefreshCcw } from "lucide-react";

/* ============================================================================
 * Types
 * ========================================================================== */

type EmployeeRow = {
  id: string;
  fullName: string;
  hourlyRate: number;
  isActive: boolean;
};

type SummaryItem = {
  employeeId: string;
  fullName: string;
  hourlyRate: number;
  isActive: boolean;
  totalHours: number;
  totalPay: number;
  daysWorked: number;
};

type SummaryResponse = {
  range: { from: string; to: string };
  totals: { totalHours: number; totalPay: number };
  items: SummaryItem[];
};

type AttendanceRow = {
  id: string;
  dateKey: string;
  employeeId: string;
  employeeName?: string;
  checkInAt?: string | null;
  checkOutAt?: string | null;
  notes?: string | null;
};

type Period = "day" | "week" | "biweek" | "month" | "custom";

/* ============================================================================
 * Helpers
 * ========================================================================== */

function todayKeyArgentina() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Cordoba",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function moneyARS(n: number) {
  return n.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
}

function hoursFmt(h: number) {
  return `${(Math.round(h * 100) / 100).toLocaleString("es-AR")} h`;
}

function fmtShort(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-AR", {
    timeZone: "America/Argentina/Cordoba",
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getRangeForPeriod(period: Period, baseDateKey: string) {
  const [y, m, d] = baseDateKey.split("-").map(Number);
  const base = new Date(y, (m ?? 1) - 1, d ?? 1);

  if (period === "day") return { from: baseDateKey, to: baseDateKey };

  if (period === "week") {
    const day = base.getDay();
    const diffToMonday = (day === 0 ? -6 : 1) - day;
    const monday = new Date(base);
    monday.setDate(base.getDate() + diffToMonday);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    return {
      from: `${monday.getFullYear()}-${pad(monday.getMonth() + 1)}-${pad(
        monday.getDate()
      )}`,
      to: `${sunday.getFullYear()}-${pad(sunday.getMonth() + 1)}-${pad(
        sunday.getDate()
      )}`,
    };
  }

  if (period === "biweek") {
    const yyyy = base.getFullYear();
    const mm = base.getMonth();
    const dayNum = base.getDate();
    const lastDay = new Date(yyyy, mm + 1, 0).getDate();
    const fromDay = dayNum <= 15 ? 1 : 16;
    const toDay = dayNum <= 15 ? 15 : lastDay;
    return {
      from: `${yyyy}-${pad(mm + 1)}-${pad(fromDay)}`,
      to: `${yyyy}-${pad(mm + 1)}-${pad(toDay)}`,
    };
  }

  if (period === "month") {
    const yyyy = base.getFullYear();
    const mm = base.getMonth();
    const lastDay = new Date(yyyy, mm + 1, 0).getDate();
    return {
      from: `${yyyy}-${pad(mm + 1)}-01`,
      to: `${yyyy}-${pad(mm + 1)}-${pad(lastDay)}`,
    };
  }

  return { from: baseDateKey, to: baseDateKey };
}

/* ============================================================================
 * Page
 * ========================================================================== */

export default function AdminAttendancesPage() {
  const { getAccessToken } = useAuth();

  const [tab, setTab] = useState<"summary" | "day">("summary");
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [onlyActive, setOnlyActive] = useState(true);
  const [employeeId, setEmployeeId] = useState("");
  const [q, setQ] = useState("");

  // summary
  const [period, setPeriod] = useState<Period>("biweek");
  const [baseDate, setBaseDate] = useState(todayKeyArgentina());
  const [customFrom, setCustomFrom] = useState(todayKeyArgentina());
  const [customTo, setCustomTo] = useState(todayKeyArgentina());
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  // day
  const [dateKey, setDateKey] = useState(todayKeyArgentina());
  const [dayRows, setDayRows] = useState<AttendanceRow[]>([]);
  const [dayLoading, setDayLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const range = useMemo(() => {
    if (period === "custom") return { from: customFrom, to: customTo };
    return getRangeForPeriod(period, baseDate);
  }, [period, baseDate, customFrom, customTo]);

  const employeeOptions = useMemo(() => {
    const list = onlyActive ? employees.filter((e) => e.isActive) : employees;
    return list.sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [employees, onlyActive]);

  const filteredItems = useMemo(() => {
    const items = summary?.items ?? [];
    if (!q.trim()) return items;
    return items.filter((i) =>
      i.fullName.toLowerCase().includes(q.toLowerCase())
    );
  }, [summary, q]);

  /* ============================================================================
   * Loaders
   * ========================================================================== */

  async function loadEmployees() {
    const emps = await apiFetchAuthed<EmployeeRow[]>(
      getAccessToken,
      "/employees"
    );
    setEmployees(emps);
  }

  async function loadSummary() {
    setSummaryLoading(true);
    try {
      const params = new URLSearchParams({
        from: range.from,
        to: range.to,
        onlyActive: String(onlyActive),
      });
      if (employeeId) params.set("employeeId", employeeId);

      const data = await apiFetchAuthed<SummaryResponse>(
        getAccessToken,
        `/attendance/summary?${params.toString()}`
      );
      setSummary(data);
    } catch (e: any) {
      setError(e?.message || "Error cargando resumen");
      setSummary(null);
    } finally {
      setSummaryLoading(false);
    }
  }

  async function loadDay() {
    setDayLoading(true);
    try {
      const data = await apiFetchAuthed<AttendanceRow[]>(
        getAccessToken,
        `/attendance/day/${encodeURIComponent(dateKey)}`
      );
      setDayRows(data);
    } catch (e: any) {
      setError(e?.message || "Error cargando día");
      setDayRows([]);
    } finally {
      setDayLoading(false);
    }
  }

  useEffect(() => {
    (async () => {
      setBusy(true);
      try {
        await loadEmployees();
        await loadSummary();
        await loadDay();
      } finally {
        setBusy(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.from, range.to, employeeId, onlyActive]);

  useEffect(() => {
    loadDay();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateKey]);

  /* ============================================================================
   * Render
   * ========================================================================== */

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          Asistencias
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Control de horas trabajadas y cálculo de pagos.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            variant={tab === "summary" ? "primary" : "secondary"}
            onClick={() => setTab("summary")}
          >
            Resumen / Payroll
          </Button>
          <Button
            variant={tab === "day" ? "primary" : "secondary"}
            onClick={() => setTab("day")}
          >
            Detalle del día
          </Button>
          <Button
            variant="secondary"
            onClick={async () => {
              setBusy(true);
              try {
                await loadEmployees();
                await loadSummary();
                await loadDay();
              } finally {
                setBusy(false);
              }
            }}
            loading={busy}
          >
            <RefreshCcw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Shared filters */}
      <Card>
        <CardHeader title="Filtros globales" subtitle="Aplican al resumen." />
        <CardBody>
          <div className="grid gap-3 md:grid-cols-4">
            <Field label="Empleado">
              <Select
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
              >
                <option value="">Todos</option>
                {employeeOptions.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.fullName}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Empleados">
              <Select
                value={onlyActive ? "active" : "all"}
                onChange={(e) => setOnlyActive(e.target.value === "active")}
              >
                <option value="active">Solo activos</option>
                <option value="all">Todos</option>
              </Select>
            </Field>

            <Field label="Buscar (Resumen)">
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar por nombre…"
              />
            </Field>

            <div className="flex items-end">
              <div className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2">
                <div className="text-xs text-zinc-500">Rango</div>
                <div className="mt-1 text-sm font-semibold text-zinc-900">
                  {range.from} → {range.to}
                </div>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* SUMMARY */}
      {tab === "summary" && (
        <>
          <Card>
            <CardHeader title="Periodo" />
            <CardBody>
              <div className="grid gap-3 md:grid-cols-5">
                <Field label="Tipo">
                  <Select
                    value={period}
                    onChange={(e) => setPeriod(e.target.value as Period)}
                  >
                    <option value="day">Día</option>
                    <option value="week">Semana</option>
                    <option value="biweek">Quincena</option>
                    <option value="month">Mes</option>
                    <option value="custom">Custom</option>
                  </Select>
                </Field>

                {period !== "custom" ? (
                  <Field label="Fecha base">
                    <Input
                      type="date"
                      value={baseDate}
                      onChange={(e) => setBaseDate(e.target.value)}
                    />
                  </Field>
                ) : (
                  <>
                    <Field label="Desde">
                      <Input
                        type="date"
                        value={customFrom}
                        onChange={(e) => setCustomFrom(e.target.value)}
                      />
                    </Field>
                    <Field label="Hasta">
                      <Input
                        type="date"
                        value={customTo}
                        onChange={(e) => setCustomTo(e.target.value)}
                      />
                    </Field>
                  </>
                )}

                <div className="md:col-span-2 flex items-end">
                  <div className="w-full rounded-2xl border border-zinc-200 bg-white p-4">
                    <div className="text-xs text-zinc-500">Total a pagar</div>
                    <div className="mt-1 text-lg font-bold text-zinc-900">
                      {summaryLoading || !summary
                        ? "—"
                        : moneyARS(summary.totals.totalPay)}
                    </div>
                    <div className="mt-1 text-sm text-zinc-600">
                      {summaryLoading || !summary
                        ? ""
                        : `${hoursFmt(summary.totals.totalHours)} totales`}
                    </div>
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>

          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <table className="min-w-full">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-zinc-500">
                    Empleado
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-zinc-500">
                    $/hora
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-zinc-500">
                    Días
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-zinc-500">
                    Horas
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-zinc-500">
                    Total
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-zinc-100">
                {!summaryLoading &&
                  filteredItems.map((it) => (
                    <tr key={it.employeeId} className="hover:bg-zinc-50">
                      <td className="px-4 py-3 font-semibold">
                        {it.fullName}
                      </td>
                      <td className="px-4 py-3">
                        {moneyARS(it.hourlyRate).replace(",00", "")}
                      </td>
                      <td className="px-4 py-3">{it.daysWorked}</td>
                      <td className="px-4 py-3">
                        {hoursFmt(it.totalHours)}
                      </td>
                      <td className="px-4 py-3 font-bold">
                        {moneyARS(it.totalPay)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* DAY */}
      {tab === "day" && (
        <>
          <Card>
            <CardHeader title="Detalle por día" />
            <CardBody>
              <Field label="Fecha">
                <Input
                  type="date"
                  value={dateKey}
                  onChange={(e) => setDateKey(e.target.value)}
                />
              </Field>
            </CardBody>
          </Card>

          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <table className="min-w-full">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-zinc-500">
                    Empleado
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-zinc-500">
                    Check-in
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-zinc-500">
                    Check-out
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-zinc-500">
                    Notas
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-zinc-100">
                {!dayLoading &&
                  dayRows.map((r) => (
                    <tr key={r.id} className="hover:bg-zinc-50">
                      <td className="px-4 py-3 font-semibold">
                        {r.employeeName || r.employeeId}
                      </td>
                      <td className="px-4 py-3">{fmtShort(r.checkInAt)}</td>
                      <td className="px-4 py-3">{fmtShort(r.checkOutAt)}</td>
                      <td className="px-4 py-3">
                        {r.notes?.trim() || "—"}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
