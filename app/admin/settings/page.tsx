"use client";

import React, { useEffect, useState } from "react";
import { AdminProtected } from "@/components/AdminProtected";
import { useAuth } from "@/app/providers/AuthProvider";
import { apiFetchAuthed } from "@/lib/apiAuthed";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Save, RefreshCcw, Settings as SettingsIcon } from "lucide-react";

/* =============================================================================
 * Types (Branch)
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
 * Helpers
 * ========================================================================== */

function pickId(x: any) {
  return String(x?.id || x?._id || x || "");
}

function safeBool(v: any, fallback = false) {
  if (typeof v === "boolean") return v;
  if (v === "true") return true;
  if (v === "false") return false;
  return fallback;
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
function safeHHMM(v: string, fallback: string) {
  const s = String(v ?? "").trim();
  return HHMM.test(s) ? s : fallback;
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
    const ranges: TimeRange[] = rangesRaw
      .map((r: any) => ({
        open: safeHHMM(r?.open, "09:00"),
        close: safeHHMM(r?.close, "18:00"),
      }))
      .filter((r: any) => HHMM.test(r.open) && HHMM.test(r.close));

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

/* =============================================================================
 * Page (ADMIN only, edits own branch)
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

  async function load() {
    setLoading(true);
    try {
      // ✅ Siempre: mi sucursal
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
  }

  function updateScheduleDay(
    day: keyof WeekSchedule,
    next: Partial<DaySchedule>
  ) {
    setData((d) => {
      if (!d) return d;
      return {
        ...d,
        schedule: {
          ...d.schedule,
          [day]: { ...d.schedule[day], ...next },
        },
      };
    });
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
        open: safeHHMM(patch.open ?? prev.open, prev.open),
        close: safeHHMM(patch.close ?? prev.close, prev.close),
      };
      return {
        ...d,
        schedule: { ...d.schedule, [day]: { ...curr, ranges } },
      };
    });
  }

  function removeRange(day: keyof WeekSchedule, idx: number) {
    setData((d) => {
      if (!d) return d;
      const curr = d.schedule[day];
      const ranges = [...(curr?.ranges ?? [])];
      ranges.splice(idx, 1);
      return {
        ...d,
        schedule: { ...d.schedule, [day]: { ...curr, ranges } },
      };
    });
  }

  async function save() {
    if (!data) return;

    setSaving(true);
    try {
      // ✅ Siempre: patch a mi sucursal
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
        schedule: data.schedule,
        notes: data.notes ?? null,
      };

      await apiFetchAuthed(getAccessToken, "/branches/me", {
        method: "PATCH",
        body: JSON.stringify(payload),
      });

      await load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminProtected>
      <div className="space-y-6 max-w-4xl">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl border bg-white flex items-center justify-center">
            <SettingsIcon className="h-5 w-5" />
          </div>

          <div className="flex-1">
            <h1 className="text-xl font-semibold">Settings / Sucursal</h1>
            <p className="text-sm text-neutral-500">
              Editás únicamente los datos de tu sucursal.
            </p>
          </div>

          <Button variant="secondary" onClick={load} disabled={loading}>
            <RefreshCcw className="h-4 w-4 mr-2" />
            Recargar
          </Button>

          <Button onClick={save} disabled={saving || loading || !data}>
            <Save className="h-4 w-4 mr-2" />
            Guardar
          </Button>
        </div>

        {/* Branch meta (siempre visible) */}
        <Card>
          <CardHeader title="Tu sucursal" />
          <CardBody>
            {!branchMeta ? (
              <div className="text-sm text-neutral-500">
                No se pudo cargar la sucursal.
              </div>
            ) : (
              <div className="text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-neutral-500">Nombre:</span>
                  <span className="font-medium">{branchMeta.name}</span>
                </div>

                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className="text-neutral-500">ID:</span>
                  <span className="font-mono text-xs">{branchMeta.id}</span>
                </div>

                <div className="mt-2 text-xs text-neutral-500">
                  Esta página usa{" "}
                  <span className="font-mono">/branches/me</span> para leer y
                  guardar.
                </div>
              </div>
            )}
          </CardBody>
        </Card>

        {/* Form */}
        <Card>
          <CardHeader title="Datos de la sucursal" />
          <CardBody>
            {!data ? (
              <div className="text-sm text-neutral-500">Cargando...</div>
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="md:col-span-3">
                    <h3 className="text-sm font-semibold text-neutral-700">
                      Identidad / contacto
                    </h3>
                  </div>

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

                  <Field label="Activa">
                    <Select
                      value={String(!!data.isActive)}
                      onChange={(e) =>
                        update("isActive", safeBool(e.target.value, true))
                      }
                    >
                      <option value="true">Sí</option>
                      <option value="false">No</option>
                    </Select>
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

                {/* Schedule */}
                <div className="mt-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-neutral-700">
                      Horarios
                    </h3>
                    <p className="text-xs text-neutral-500">
                      Cada día puede tener múltiples rangos.
                    </p>
                  </div>

                  <div className="mt-4 space-y-4">
                    {(Object.keys(DAY_LABEL) as Array<keyof WeekSchedule>).map(
                      (day) => {
                        const d = data.schedule?.[day] ?? makeEmptyDay();
                        return (
                          <Card key={day}>
                            <CardHeader title={DAY_LABEL[day]} />
                            <CardBody>
                              <div className="grid gap-3 md:grid-cols-3 items-end">
                                <Field label="Habilitado">
                                  <Select
                                    value={String(!!d.enabled)}
                                    onChange={(e) =>
                                      updateScheduleDay(day, {
                                        enabled: safeBool(e.target.value, true),
                                      })
                                    }
                                  >
                                    <option value="true">Sí</option>
                                    <option value="false">No</option>
                                  </Select>
                                </Field>

                                <div className="md:col-span-2 flex justify-end">
                                  <Button
                                    variant="secondary"
                                    onClick={() => addRange(day)}
                                    disabled={!d.enabled}
                                  >
                                    + Agregar rango
                                  </Button>
                                </div>

                                <div className="md:col-span-3 space-y-3">
                                  {d.ranges.length === 0 ? (
                                    <div className="text-sm text-neutral-500">
                                      Sin rangos
                                    </div>
                                  ) : (
                                    d.ranges.map((r, idx) => (
                                      <div
                                        key={`${day}-${idx}`}
                                        className="grid gap-3 md:grid-cols-3 items-end"
                                      >
                                        <Field label="Open (HH:mm)">
                                          <Input
                                            value={r.open}
                                            onChange={(e) =>
                                              updateRange(day, idx, {
                                                open: e.target.value,
                                              })
                                            }
                                            placeholder="09:00"
                                            disabled={!d.enabled}
                                          />
                                        </Field>

                                        <Field label="Close (HH:mm)">
                                          <Input
                                            value={r.close}
                                            onChange={(e) =>
                                              updateRange(day, idx, {
                                                close: e.target.value,
                                              })
                                            }
                                            placeholder="18:00"
                                            disabled={!d.enabled}
                                          />
                                        </Field>

                                        <div className="flex justify-end">
                                          <Button
                                            variant="secondary"
                                            onClick={() =>
                                              removeRange(day, idx)
                                            }
                                            disabled={!d.enabled}
                                          >
                                            Quitar
                                          </Button>
                                        </div>
                                      </div>
                                    ))
                                  )}
                                </div>
                              </div>
                            </CardBody>
                          </Card>
                        );
                      }
                    )}
                  </div>
                </div>
              </>
            )}
          </CardBody>
        </Card>
      </div>
    </AdminProtected>
  );
}
