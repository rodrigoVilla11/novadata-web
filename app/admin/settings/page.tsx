"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AdminProtected } from "@/components/AdminProtected";
import { useAuth } from "@/app/providers/AuthProvider";
import { apiFetchAuthed } from "@/lib/apiAuthed";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import {
  Save,
  RefreshCcw,
  Settings as SettingsIcon,
  Copy,
  Plus,
  Trash2,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Zap,
  XCircle,
} from "lucide-react";

/* =============================================================================
 * Types
 * ========================================================================== */

type TimeRange = { open: string; close: string };
type DaySchedule = { enabled: boolean; ranges: TimeRange[] };
type WeekSchedule = {
  mon: DaySchedule;
  tue: DaySchedule;
  wed: DaySchedule;
  thu: DaySchedule;
  fri: DaySchedule;
  sat: DaySchedule;
  sun: DaySchedule;
};

type BranchDoc = {
  _id?: string;
  id?: string;

  name: string;
  description?: string | null;

  isActive: boolean;

  address?: string | null;
  city?: string | null;
  postalCode?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  gps?: string | null;

  timezone: string;
  schedule: WeekSchedule;

  notes?: string | null;
};

/* =============================================================================
 * Utils
 * ========================================================================== */

function cn(...parts: Array<string | undefined | null | false>) {
  return parts.filter(Boolean).join(" ");
}

function pickId(x: any) {
  return String(x?.id || x?._id || x || "");
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

function safeHHMM(v: string, fallback: string) {
  const s = String(v ?? "").trim();
  return HHMM.test(s) ? s : fallback;
}

function timeToMin(t: string) {
  const [h, m] = String(t || "")
    .split(":")
    .map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return NaN;
  return h * 60 + m;
}

function isValidRange(r: TimeRange) {
  if (!HHMM.test(r.open) || !HHMM.test(r.close)) return false;
  const a = timeToMin(r.open);
  const b = timeToMin(r.close);
  return Number.isFinite(a) && Number.isFinite(b) && b > a;
}

function sortRanges(ranges: TimeRange[]) {
  return [...ranges].sort((a, b) => timeToMin(a.open) - timeToMin(b.open));
}

function hasOverlap(ranges: TimeRange[]) {
  const rs = sortRanges(ranges).filter(isValidRange);
  for (let i = 0; i < rs.length - 1; i++) {
    const endA = timeToMin(rs[i].close);
    const startB = timeToMin(rs[i + 1].open);
    if (startB < endA) return true;
  }
  return false;
}

function makeEmptyDay(): DaySchedule {
  return { enabled: true, ranges: [] };
}

function normalizeWeekSchedule(input: any): WeekSchedule {
  const base: WeekSchedule = {
    mon: makeEmptyDay(),
    tue: makeEmptyDay(),
    wed: makeEmptyDay(),
    thu: makeEmptyDay(),
    fri: makeEmptyDay(),
    sat: makeEmptyDay(),
    sun: makeEmptyDay(),
  };

  const w = input ?? {};
  (Object.keys(base) as Array<keyof WeekSchedule>).forEach((k) => {
    const d = w?.[k] ?? {};
    const enabled =
      typeof d?.enabled === "boolean" ? d.enabled : base[k].enabled;

    const rangesRaw = Array.isArray(d?.ranges) ? d.ranges : [];
    const ranges: TimeRange[] = rangesRaw.map((r: any) => ({
      open: String(r?.open ?? ""),
      close: String(r?.close ?? ""),
    }));

    base[k] = { enabled, ranges };
  });

  return base;
}

const DEFAULT_BRANCH: BranchDoc = {
  name: "Mi Sucursal",
  description: null,
  isActive: true,
  address: null,
  city: null,
  postalCode: null,
  phone: null,
  whatsapp: null,
  gps: null,
  timezone: "America/Argentina/Buenos_Aires",
  schedule: normalizeWeekSchedule(null),
  notes: null,
};

const DAY_LABEL: Record<keyof WeekSchedule, string> = {
  mon: "Lunes",
  tue: "Martes",
  wed: "Miércoles",
  thu: "Jueves",
  fri: "Viernes",
  sat: "Sábado",
  sun: "Domingo",
};

const DAY_KEYS = Object.keys(DAY_LABEL) as Array<keyof WeekSchedule>;

function scheduleSummary(d: DaySchedule) {
  if (!d.enabled) return "Cerrado";
  if (!d.ranges?.length) return "Sin rangos";
  const rs = sortRanges(d.ranges)
    .filter((r) => HHMM.test(r.open) && HHMM.test(r.close))
    .map((r) => `${r.open}–${r.close}`);
  return rs.length ? rs.join(" · ") : "Sin rangos";
}

/* =============================================================================
 * Tiny UI bits
 * ========================================================================== */

function Pill({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "success" | "danger" | "warning";
}) {
  const cls =
    tone === "success"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : tone === "danger"
      ? "bg-red-50 text-red-700 border-red-200"
      : tone === "warning"
      ? "bg-amber-50 text-amber-700 border-amber-200"
      : "bg-neutral-50 text-neutral-700 border-neutral-200";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs",
        cls
      )}
    >
      {children}
    </span>
  );
}

function Switch({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={cn(
        "inline-flex items-center gap-2 select-none",
        disabled && "opacity-60 cursor-not-allowed"
      )}
      aria-pressed={checked}
    >
      <span
        className={cn(
          "relative inline-flex h-6 w-10 items-center rounded-full border transition",
          checked ? "bg-zinc-900 border-zinc-900" : "bg-white border-zinc-200"
        )}
      >
        <span
          className={cn(
            "inline-block h-5 w-5 rounded-full bg-white shadow-sm transition",
            checked ? "translate-x-4" : "translate-x-0.5"
          )}
        />
      </span>
      {label ? <span className="text-sm text-zinc-700">{label}</span> : null}
    </button>
  );
}

function IconDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={cn(
        "inline-block h-2 w-2 rounded-full",
        ok ? "bg-emerald-500" : "bg-red-500"
      )}
    />
  );
}

/* =============================================================================
 * Page
 * ========================================================================== */

export default function AdminBranchSettingsPage() {
  const { getAccessToken } = useAuth();

  const [data, setData] = useState<BranchDoc | null>(null);
  const [branchMeta, setBranchMeta] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<{
    type: "ok" | "err";
    msg: string;
  } | null>(null);
  const [openDay, setOpenDay] = useState<keyof WeekSchedule | null>(null);

  function toggleOpenDay(day: keyof WeekSchedule) {
    setOpenDay((prev) => (prev === day ? null : day));
  }

  function touch(key: string) {
    setTouched((t) => ({ ...t, [key]: true }));
  }

  function showToast(type: "ok" | "err", msg: string) {
    setToast({ type, msg });
    window.clearTimeout((showToast as any)._t);
    (showToast as any)._t = window.setTimeout(() => setToast(null), 2500);
  }

  async function load() {
    setLoading(true);
    try {
      const me = await apiFetchAuthed<BranchDoc>(
        getAccessToken,
        "/branches/me"
      );
      const meId = pickId(me);

      setBranchMeta({ id: meId, name: me?.name || "Sucursal" });

      setData({
        ...DEFAULT_BRANCH,
        ...me,
        _id: me?._id ?? me?.id ?? DEFAULT_BRANCH._id,
        schedule: normalizeWeekSchedule(me?.schedule),
      });
    } catch {
      setBranchMeta(null);
      setData({ ...DEFAULT_BRANCH });
      showToast("err", "No se pudo cargar la sucursal.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getAccessToken]);

  function update<K extends keyof BranchDoc>(key: K, value: BranchDoc[K]) {
    setData((d) => (d ? { ...d, [key]: value } : d));
    touch(`branch.${String(key)}`);
  }

  function updateScheduleDay(
    day: keyof WeekSchedule,
    next: Partial<DaySchedule>
  ) {
    setData((d) => {
      if (!d) return d;
      return {
        ...d,
        schedule: { ...d.schedule, [day]: { ...d.schedule[day], ...next } },
      };
    });
    touch(`schedule.${String(day)}`);
  }

  function addRange(day: keyof WeekSchedule) {
    setData((d) => {
      if (!d) return d;
      const curr = d.schedule[day];
      const nextRanges = [
        ...(curr?.ranges ?? []),
        { open: "09:00", close: "18:00" },
      ];
      return {
        ...d,
        schedule: { ...d.schedule, [day]: { ...curr, ranges: nextRanges } },
      };
    });
    touch(`schedule.${String(day)}`);
  }

  function updateRange(
    day: keyof WeekSchedule,
    idx: number,
    patch: Partial<TimeRange>
  ) {
    setData((d) => {
      if (!d) return d;
      const curr = d.schedule[day];
      const ranges = [...(curr?.ranges ?? [])];
      const prev = ranges[idx] ?? { open: "09:00", close: "18:00" };
      ranges[idx] = {
        open: patch.open ?? prev.open,
        close: patch.close ?? prev.close,
      };
      return { ...d, schedule: { ...d.schedule, [day]: { ...curr, ranges } } };
    });
    touch(`schedule.${String(day)}`);
  }

  function coerceRange(day: keyof WeekSchedule, idx: number) {
    setData((d) => {
      if (!d) return d;
      const curr = d.schedule[day];
      const ranges = [...(curr?.ranges ?? [])];
      const prev = ranges[idx] ?? { open: "09:00", close: "18:00" };
      ranges[idx] = {
        open: safeHHMM(prev.open, "09:00"),
        close: safeHHMM(prev.close, "18:00"),
      };
      return { ...d, schedule: { ...d.schedule, [day]: { ...curr, ranges } } };
    });
  }

  function removeRange(day: keyof WeekSchedule, idx: number) {
    setData((d) => {
      if (!d) return d;
      const curr = d.schedule[day];
      const ranges = [...(curr?.ranges ?? [])];
      ranges.splice(idx, 1);
      return { ...d, schedule: { ...d.schedule, [day]: { ...curr, ranges } } };
    });
    touch(`schedule.${String(day)}`);
  }

  function copyDayToAll(from: keyof WeekSchedule) {
    setData((d) => {
      if (!d) return d;
      const next = { ...d.schedule } as WeekSchedule;
      DAY_KEYS.forEach((to) => {
        if (to === from) return;
        next[to] = {
          ...next[to],
          enabled: d.schedule[from].enabled,
          ranges: [...d.schedule[from].ranges],
        };
      });
      return { ...d, schedule: next };
    });
    touch("schedule.all");
    showToast("ok", `Copiado ${DAY_LABEL[from]} → toda la semana`);
  }

  function setAllClosed() {
    setData((d) => {
      if (!d) return d;
      const next: any = { ...d.schedule };
      DAY_KEYS.forEach((day) => (next[day] = { enabled: false, ranges: [] }));
      return { ...d, schedule: next };
    });
    touch("schedule.all");
    showToast("ok", "Semana marcada como cerrada.");
  }

  function setAllDefault() {
    setData((d) => {
      if (!d) return d;
      const next: any = { ...d.schedule };
      DAY_KEYS.forEach(
        (day) =>
          (next[day] = {
            enabled: true,
            ranges: [{ open: "09:00", close: "18:00" }],
          })
      );
      return { ...d, schedule: next };
    });
    touch("schedule.all");
    showToast("ok", "Reseteado a 09:00–18:00.");
  }

  function setDay24h(day: keyof WeekSchedule) {
    updateScheduleDay(day, {
      enabled: true,
      ranges: [{ open: "00:00", close: "23:59" }],
    });
    showToast("ok", `${DAY_LABEL[day]}: 24hs`);
  }

  const scheduleIssues = useMemo(() => {
    const issues: Record<
      keyof WeekSchedule,
      { invalid: number; overlap: boolean; ok: boolean }
    > = {} as any;
    if (!data) return issues;

    DAY_KEYS.forEach((day) => {
      const d = data.schedule?.[day];
      if (!d || !d.enabled) {
        issues[day] = { invalid: 0, overlap: false, ok: true };
        return;
      }
      const rs = d.ranges ?? [];
      const invalid = rs.filter((r) => !isValidRange(r)).length;
      const overlap = hasOverlap(rs);
      issues[day] = { invalid, overlap, ok: invalid === 0 && !overlap };
    });

    return issues;
  }, [data]);

  const hasAnyScheduleError = useMemo(() => {
    if (!data) return false;
    return DAY_KEYS.some(
      (day) => scheduleIssues[day] && !scheduleIssues[day].ok
    );
  }, [data, scheduleIssues]);

  const dirty = useMemo(() => Object.keys(touched).length > 0, [touched]);

  async function save() {
    if (!data) return;

    if (hasAnyScheduleError) {
      const t: Record<string, boolean> = {};
      DAY_KEYS.forEach((day) => (t[`schedule.${day}`] = true));
      setTouched((prev) => ({ ...prev, ...t }));
      showToast("err", "Hay errores en horarios. Revisá antes de guardar.");
      return;
    }

    setSaving(true);
    try {
      const normalizedSchedule: WeekSchedule = { ...data.schedule } as any;
      DAY_KEYS.forEach((day) => {
        const d = normalizedSchedule[day];
        if (!d) return;
        const ranges = (d.ranges ?? [])
          .map((r) => ({
            open: safeHHMM(r.open, "09:00"),
            close: safeHHMM(r.close, "18:00"),
          }))
          .filter((r) => HHMM.test(r.open) && HHMM.test(r.close))
          .filter((r) => timeToMin(r.close) > timeToMin(r.open));
        normalizedSchedule[day] = { ...d, ranges: sortRanges(ranges) };
      });

      const payload = {
        name: data.name,
        description: data.description ?? null,
        isActive: !!data.isActive,
        address: data.address ?? null,
        city: data.city ?? null,
        postalCode: data.postalCode ?? null,
        phone: data.phone ?? null,
        whatsapp: data.whatsapp ?? null,
        gps: data.gps ?? null,
        timezone: data.timezone,
        schedule: normalizedSchedule,
        notes: data.notes ?? null,
      };

      await apiFetchAuthed(getAccessToken, "/branches/me", {
        method: "PATCH",
        body: JSON.stringify(payload),
      });

      setTouched({});
      showToast("ok", "Guardado.");
      await load();
    } catch {
      showToast("err", "No se pudo guardar. Reintentá.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminProtected>
      {/* ✅ Shell ya pone paddings / max-w / topbar.
          Acá solo armamos el contenido (sin sticky header propio). */}
      <div className="space-y-6 w-full max-w-5xl">
        {/* Toast: lo bajamos un poco para no chocar con la topbar del Shell */}
        {toast ? (
          <div
            className={cn(
              "fixed right-5 top-20 z-50 rounded-2xl border px-4 py-3 shadow-lg text-sm flex items-start gap-2",
              toast.type === "ok"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-red-200 bg-red-50 text-red-800"
            )}
          >
            {toast.type === "ok" ? (
              <CheckCircle2 className="h-4 w-4 mt-0.5" />
            ) : (
              <AlertTriangle className="h-4 w-4 mt-0.5" />
            )}
            <div className="flex-1">{toast.msg}</div>
            <button
              className="opacity-70 hover:opacity-100"
              onClick={() => setToast(null)}
              aria-label="Cerrar"
            >
              <XCircle className="h-4 w-4" />
            </button>
          </div>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-2xl border bg-white flex items-center justify-center shrink-0">
              <SettingsIcon className="h-5 w-5" />
            </div>

            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-semibold truncate">
                Settings / Sucursal
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="text-sm text-neutral-500">
                  Editás únicamente los datos de tu sucursal.
                </span>
                {dirty ? (
                  <Pill tone="warning">Cambios sin guardar</Pill>
                ) : (
                  <Pill tone="success">Todo al día</Pill>
                )}
                {hasAnyScheduleError ? (
                  <Pill tone="danger">Horarios con errores</Pill>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex gap-2 sm:ml-auto">
            <Button
              variant="secondary"
              onClick={load}
              loading={loading}
              className="flex-1 sm:flex-none"
            >
              <div className="inline-flex items-center gap-2">
                <RefreshCcw className="h-4 w-4" />
                <span className="hidden sm:inline">Recargar</span>
              </div>
            </Button>

            <Button
              onClick={save}
              loading={saving}
              disabled={!data || loading}
              className="flex-1 sm:flex-none"
            >
              <div className="inline-flex items-center gap-2">
                <Save className="h-4 w-4" />
                <span className="hidden sm:inline">Guardar</span>
              </div>
            </Button>
          </div>
        </div>

        {/* Branch meta */}
        <Card>
          <CardHeader
            title="Tu sucursal"
            right={
              branchMeta ? (
                <Pill tone="neutral">
                  <span className="font-medium">{branchMeta.name}</span>
                </Pill>
              ) : null
            }
          />
          <CardBody>
            {!branchMeta ? (
              <div className="text-sm text-neutral-500">
                No se pudo cargar la sucursal.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                  <div className="text-sm font-semibold text-zinc-900">
                    ¿Qué podés configurar acá?
                  </div>
                  <ul className="mt-2 grid gap-2 text-sm text-zinc-700">
                    <li className="flex items-start gap-2">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-zinc-400" />
                      Datos de contacto (dirección, teléfono, WhatsApp, GPS)
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-zinc-400" />
                      Estado de la sucursal (activa / inactiva)
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-zinc-400" />
                      Horarios por día con múltiples rangos (ej. mañana y noche)
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-zinc-400" />
                      Zona horaria para reportes y horarios
                    </li>
                  </ul>

                  <div className="mt-3 text-xs text-zinc-500">
                    Tip: usá <span className="font-medium">“Copiar”</span> para
                    setear un día y replicarlo a toda la semana.
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs text-zinc-500">
                    Guarda los cambios con{" "}
                    <span className="font-medium">“Guardar”</span> arriba a la
                    derecha.
                  </div>
                </div>
              </div>
            )}
          </CardBody>
        </Card>

        {/* Datos básicos */}
        <Card>
          <CardHeader
            title="Datos de la sucursal"
            subtitle="Identidad y contacto"
            right={
              data ? (
                <Switch
                  checked={!!data.isActive}
                  onChange={(v) => update("isActive", v)}
                  disabled={saving || loading}
                  label={data.isActive ? "Activa" : "Inactiva"}
                />
              ) : null
            }
          />
          <CardBody>
            {!data ? (
              <div className="text-sm text-neutral-500">Cargando...</div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Nombre">
                  <Input
                    value={data.name ?? ""}
                    onChange={(e) => update("name", e.target.value)}
                  />
                </Field>

                <Field label="Timezone">
                  <Input
                    value={data.timezone ?? ""}
                    onChange={(e) => update("timezone", e.target.value)}
                  />
                </Field>

                <Field label="Descripción">
                  <Input
                    value={data.description ?? ""}
                    onChange={(e) => update("description", e.target.value)}
                    placeholder="Opcional"
                  />
                </Field>

                <Field label="Dirección">
                  <Input
                    value={data.address ?? ""}
                    onChange={(e) => update("address", e.target.value)}
                  />
                </Field>

                <Field label="Ciudad">
                  <Input
                    value={data.city ?? ""}
                    onChange={(e) => update("city", e.target.value)}
                  />
                </Field>

                <Field label="CP">
                  <Input
                    value={data.postalCode ?? ""}
                    onChange={(e) => update("postalCode", e.target.value)}
                  />
                </Field>

                <Field label="Teléfono">
                  <Input
                    value={data.phone ?? ""}
                    onChange={(e) => update("phone", e.target.value)}
                  />
                </Field>

                <Field label="WhatsApp">
                  <Input
                    value={data.whatsapp ?? ""}
                    onChange={(e) => update("whatsapp", e.target.value)}
                  />
                </Field>

                <Field label="GPS (lat, lon)">
                  <Input
                    value={data.gps ?? ""}
                    onChange={(e) => update("gps", e.target.value)}
                    placeholder="-31.65, -64.43"
                  />
                </Field>

                <Field label="Notas internas">
                  <Input
                    value={data.notes ?? ""}
                    onChange={(e) => update("notes", e.target.value)}
                  />
                </Field>
              </div>
            )}
          </CardBody>
        </Card>

        {/* Horarios */}
        <Card>
          <CardHeader
            title="Horarios"
            subtitle="Atención al público"
            right={
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end">
                <Button
                  variant="secondary"
                  onClick={setAllDefault}
                  disabled={loading || saving}
                  className="w-full sm:w-auto"
                  title="Resetear semana a 09:00–18:00"
                >
                  <span className="inline-flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    <span className="sm:inline">Reset 09–18</span>
                  </span>
                </Button>

                <Button
                  variant="secondary"
                  onClick={setAllClosed}
                  disabled={loading || saving}
                  className="w-full sm:w-auto"
                  title="Marcar toda la semana como cerrada"
                >
                  <span className="inline-flex items-center gap-2">
                    <span className="sm:inline">Cerrar todo</span>
                  </span>
                </Button>
              </div>
            }
          />

          <CardBody>
            {!data ? (
              <div className="text-sm text-neutral-500">Cargando...</div>
            ) : (
              <div className="space-y-4">
                {/* Tip */}
                <div className="flex items-start gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-neutral-700">
                  <Clock className="h-4 w-4 mt-0.5 shrink-0" />
                  <span className="leading-snug">
                    Tip: usá <span className="font-medium">“Copiar”</span> para
                    setear rápido toda la semana.
                  </span>
                </div>

                {/* Días */}
                <div className="grid gap-3 sm:grid-cols-2">
                  {DAY_KEYS.map((day) => {
                    const d = data.schedule?.[day] ?? makeEmptyDay();
                    const issues = scheduleIssues[day] ?? {
                      invalid: 0,
                      overlap: false,
                      ok: true,
                    };
                    const showIssues =
                      touched[`schedule.${day}`] || touched["schedule.all"];
                    const summary = scheduleSummary(d);
                    const expanded = openDay === day;

                    const showError = showIssues && d.enabled && !issues.ok;
                    const errorText = !d.enabled
                      ? null
                      : issues.overlap
                      ? "Tenés rangos solapados (se pisan)."
                      : issues.invalid
                      ? "Hay rangos inválidos (cierre debe ser mayor que apertura)."
                      : null;

                    return (
                      <div
                        key={day}
                        className={cn(
                          "rounded-2xl border bg-white shadow-sm overflow-hidden",
                          showError ? "border-red-200" : "border-zinc-200"
                        )}
                      >
                        {/* HEADER */}
                        <button
                          type="button"
                          onClick={() => toggleOpenDay(day)}
                          className={cn(
                            "w-full text-left p-4 transition",
                            "hover:bg-zinc-50/60",
                            expanded && "bg-zinc-50/60"
                          )}
                        >
                          {/* 🔥 responsive: en mobile apila */}
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-3">
                            {/* Left */}
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className="text-sm font-semibold text-zinc-900">
                                  {DAY_LABEL[day]}
                                </h4>

                                <Pill tone={d.enabled ? "success" : "neutral"}>
                                  <IconDot ok={d.enabled} />
                                  {d.enabled ? "Abierto" : "Cerrado"}
                                </Pill>

                                {d.enabled &&
                                d.ranges.length > 0 &&
                                !showError ? (
                                  <span className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                                    OK
                                  </span>
                                ) : null}

                                {showError ? (
                                  <span className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
                                    Revisar
                                  </span>
                                ) : null}
                              </div>

                              <div className="mt-1 flex items-center gap-2 min-w-0">
                                <span className="text-xs text-zinc-600 truncate">
                                  {summary}
                                </span>
                                <span className="text-xs text-zinc-400">·</span>
                                <span className="text-xs text-zinc-500">
                                  {expanded ? "Ocultar" : "Editar"}
                                </span>
                              </div>

                              {showError && errorText ? (
                                <div className="mt-2 text-xs text-red-700">
                                  {errorText}
                                </div>
                              ) : null}
                            </div>

                            {/* Right: acciones */}
                            <div className="shrink-0 flex flex-wrap items-center justify-start sm:justify-end gap-2">
                              <Switch
                                checked={!!d.enabled}
                                onChange={(v) =>
                                  updateScheduleDay(day, { enabled: v })
                                }
                                disabled={saving || loading}
                                label={undefined}
                              />

                              <Button
                                variant="secondary"
                                className="px-3"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setDay24h(day);
                                }}
                                disabled={saving || loading}
                                title="24hs"
                              >
                                <span className="inline-flex items-center gap-2">
                                  <Clock className="h-4 w-4" />
                                  <span className="hidden sm:inline">24hs</span>
                                </span>
                              </Button>

                              <Button
                                variant="secondary"
                                className="px-3"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  copyDayToAll(day);
                                }}
                                disabled={saving || loading}
                                title="Copiar este día a toda la semana"
                              >
                                <span className="inline-flex items-center gap-2">
                                  <Copy className="h-4 w-4" />
                                  <span className="hidden sm:inline">
                                    Copiar
                                  </span>
                                </span>
                              </Button>
                            </div>
                          </div>
                        </button>

                        {/* BODY */}
                        {expanded ? (
                          <div
                            className={cn(
                              "border-t",
                              showError ? "border-red-100" : "border-zinc-100"
                            )}
                          >
                            <div className="p-4 space-y-3">
                              {/* Barra superior: Rangos + Agregar */}
                              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <div className="text-xs font-medium text-zinc-600">
                                  Rangos
                                </div>

                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
                                  <Button
                                    variant="secondary"
                                    onClick={() => addRange(day)}
                                    disabled={!d.enabled || saving || loading}
                                    className="w-full sm:w-auto"
                                    title="Agregar rango"
                                  >
                                    <span className="inline-flex items-center gap-2">
                                      <Plus className="h-4 w-4" />
                                      <span>Agregar</span>
                                    </span>
                                  </Button>

                                  <Button
                                    variant="ghost"
                                    onClick={() =>
                                      updateScheduleDay(day, { ranges: [] })
                                    }
                                    disabled={
                                      saving ||
                                      loading ||
                                      !d.enabled ||
                                      d.ranges.length === 0
                                    }
                                    className="w-full sm:w-auto"
                                    title="Limpiar rangos"
                                  >
                                    Limpiar
                                  </Button>
                                </div>
                              </div>

                              {/* Empty states */}
                              {!d.enabled ? (
                                <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-600">
                                  Este día está cerrado. Activá el switch para
                                  cargar rangos.
                                </div>
                              ) : d.ranges.length === 0 ? (
                                <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-600">
                                  No hay rangos todavía. Tocá{" "}
                                  <span className="font-medium">Agregar</span>.
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  {d.ranges.map((r, idx) => {
                                    const rangeValid = isValidRange(r);
                                    const showBad =
                                      (touched[`schedule.${day}`] ||
                                        touched["schedule.all"]) &&
                                      !rangeValid;

                                    return (
                                      <div
                                        key={`${day}-${idx}`}
                                        className={cn(
                                          "rounded-xl border p-3",
                                          showBad
                                            ? "border-red-200 bg-red-50"
                                            : "border-zinc-200 bg-white"
                                        )}
                                      >
                                        {/* 🔥 responsive: en mobile queda vertical, recién en lg se pone en fila */}
                                        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                                          <div className="grid gap-3 sm:grid-cols-2 flex-1">
                                            <Field
                                              label="Apertura"
                                              error={
                                                showBad
                                                  ? "Revisá este rango"
                                                  : null
                                              }
                                            >
                                              <Input
                                                type="time"
                                                step={60}
                                                value={r.open}
                                                onChange={(e) =>
                                                  updateRange(day, idx, {
                                                    open: e.target.value,
                                                  })
                                                }
                                                onBlur={() =>
                                                  coerceRange(day, idx)
                                                }
                                                disabled={
                                                  !d.enabled ||
                                                  saving ||
                                                  loading
                                                }
                                              />
                                            </Field>

                                            <Field label="Cierre">
                                              <Input
                                                type="time"
                                                step={60}
                                                value={r.close}
                                                onChange={(e) =>
                                                  updateRange(day, idx, {
                                                    close: e.target.value,
                                                  })
                                                }
                                                onBlur={() =>
                                                  coerceRange(day, idx)
                                                }
                                                disabled={
                                                  !d.enabled ||
                                                  saving ||
                                                  loading
                                                }
                                              />
                                            </Field>
                                          </div>

                                          <div className="flex items-center justify-between lg:justify-end gap-2">
                                            {showBad ? (
                                              <Pill tone="danger">
                                                <AlertTriangle className="h-3.5 w-3.5" />
                                                inválido
                                              </Pill>
                                            ) : (
                                              <span className="text-xs text-zinc-500 hidden lg:inline">
                                                #{idx + 1}
                                              </span>
                                            )}

                                            <Button
                                              variant="secondary"
                                              onClick={() =>
                                                removeRange(day, idx)
                                              }
                                              disabled={
                                                !d.enabled || saving || loading
                                              }
                                              className="w-full lg:w-auto"
                                              title="Eliminar rango"
                                            >
                                              <span className="inline-flex items-center gap-2">
                                                <Trash2 className="h-4 w-4" />
                                                <span className="lg:inline">
                                                  Quitar
                                                </span>
                                              </span>
                                            </Button>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>

                <div className="text-xs text-neutral-500">
                  * No se guardará si hay rangos inválidos o solapados (ej:
                  10:00–12:00 y 11:30–13:00).
                </div>

                {hasAnyScheduleError ? (
                  <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Hay errores en horarios. Revisá los días marcados.
                  </div>
                ) : null}

                {/* Footer acciones */}
                <div className="mt-6 flex flex-col gap-3 rounded-2xl border bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-xs text-neutral-500">
                    {dirty
                      ? "Tenés cambios sin guardar."
                      : "Sin cambios pendientes."}
                  </div>

                  <div className="flex w-full gap-2 sm:w-auto">
                    <Button
                      variant="secondary"
                      onClick={load}
                      loading={loading}
                      className="flex-1 sm:flex-none"
                    >
                      <span className="inline-flex items-center gap-2">
                        <RefreshCcw className="h-4 w-4" />
                        <span className="hidden sm:inline">Recargar</span>
                      </span>
                    </Button>

                    <Button
                      onClick={save}
                      loading={saving}
                      disabled={!data || loading}
                      className="flex-1 sm:flex-none"
                    >
                      <span className="inline-flex items-center gap-2">
                        <Save className="h-4 w-4" />
                        <span className="hidden sm:inline">
                          Guardar cambios
                        </span>
                      </span>
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </AdminProtected>
  );
}
