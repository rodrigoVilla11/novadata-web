"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/app/providers/AuthProvider";
import { apiFetchAuthed } from "@/lib/apiAuthed";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import {
  Plus,
  RefreshCcw,
  Save,
  Trash2,
  Undo2,
  X,
  Search,
  Shield,
  UserPlus,
} from "lucide-react";
import { TIMEZONES } from "@/lib/timezones";

type BranchPlan = "FREE" | "BASIC" | "STANDARD" | "PRO";

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

type BranchRow = {
  id: string;
  name: string;
  description: string | null;
  plan: BranchPlan;
  planStartedAt?: string | null;
  isActive: boolean;

  address: string | null;
  city: string | null;
  postalCode: string | null;
  phone: string | null;
  whatsapp: string | null;
  gps: string | null;

  timezone: string;
  schedule: WeekSchedule;

  notes: string | null;

  deletedAt: string | null;
  createdAt?: string;
  updatedAt?: string;
};

type Role = "SUPERADMIN" | "ADMIN" | "MANAGER" | "CASHIER" | "USER";
type UserRow = {
  id: string;
  email: string;
  username: string | null;
  roles: Role[];
  branchId: string | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

const DAYS: Array<{ key: keyof WeekSchedule; label: string }> = [
  { key: "mon", label: "Lunes" },
  { key: "tue", label: "Martes" },
  { key: "wed", label: "Miércoles" },
  { key: "thu", label: "Jueves" },
  { key: "fri", label: "Viernes" },
  { key: "sat", label: "Sábado" },
  { key: "sun", label: "Domingo" },
];

function emptyDay(): DaySchedule {
  return { enabled: true, ranges: [] };
}
function emptyWeek(): WeekSchedule {
  return {
    mon: emptyDay(),
    tue: emptyDay(),
    wed: emptyDay(),
    thu: emptyDay(),
    fri: emptyDay(),
    sat: emptyDay(),
    sun: emptyDay(),
  };
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function Pill({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "good" | "warn" | "info";
}) {
  const cls =
    tone === "good"
      ? "bg-emerald-50 text-emerald-800 border-emerald-100"
      : tone === "warn"
      ? "bg-amber-50 text-amber-800 border-amber-100"
      : tone === "info"
      ? "bg-indigo-50 text-indigo-800 border-indigo-100"
      : "bg-neutral-100 text-neutral-700 border-neutral-200";

  return (
    <span className={cn("text-xs px-2 py-1 rounded-full border", cls)}>
      {children}
    </span>
  );
}

export default function SuperAdminBranchesPage() {
  const { getAccessToken } = useAuth();

  const [rows, setRows] = useState<BranchRow[]>([]);
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [q, setQ] = useState("");

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: "",
    plan: "FREE" as BranchPlan,
    timezone: "America/Argentina/Buenos_Aires",
  });

  // Drawer (edición)
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [draft, setDraft] = useState<BranchRow | null>(null);

  // ✅ Admin de la branch (crear + listar)
  const [adminsLoading, setAdminsLoading] = useState(false);
  const [admins, setAdmins] = useState<UserRow[]>([]);
  const [creatingAdmin, setCreatingAdmin] = useState(false);
  const [adminMsg, setAdminMsg] = useState<string | null>(null);
  const [adminErr, setAdminErr] = useState<string | null>(null);
  const [adminForm, setAdminForm] = useState({
    email: "",
    password: "",
    username: "",
  });

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const base = rows;
    if (!needle) return base;
    return base.filter((b) => {
      const hay = `${b.name} ${b.id} ${b.timezone} ${b.plan}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [rows, q]);

  async function load() {
    setLoading(true);
    try {
      const qs = includeDeleted ? "?includeDeleted=true" : "";
      const data = await apiFetchAuthed<BranchRow[]>(
        getAccessToken,
        `/branches${qs}`,
      );
      setRows(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeDeleted]);

  async function loadBranchAdmins(branchId: string) {
    setAdminsLoading(true);
    setAdminErr(null);
    try {
      // Endpoint del controller nuevo: GET /users?branchId=...&role=ADMIN
      const data = await apiFetchAuthed<UserRow[]>(
        getAccessToken,
        `/users?branchId=${encodeURIComponent(branchId)}&role=ADMIN`,
      );
      setAdmins(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setAdmins([]);
      setAdminErr(
        e?.message ||
          "No se pudo cargar los admins de la sucursal (revisá permisos / endpoint).",
      );
    } finally {
      setAdminsLoading(false);
    }
  }

  function openDrawer(b: BranchRow) {
    const nextDraft: BranchRow = {
      ...b,
      timezone: b.timezone || "America/Argentina/Buenos_Aires",
      schedule: b.schedule || emptyWeek(),
    };
    setDraft(nextDraft);
    setDrawerOpen(true);

    // reset UI admin
    setAdminForm({ email: "", password: "", username: "" });
    setAdminMsg(null);
    setAdminErr(null);
    setAdmins([]);

    // cargar admins de esa branch
    loadBranchAdmins(nextDraft.id);
  }

  function closeDrawer() {
    setDrawerOpen(false);
    setDraft(null);
  }

  function patchDraft(p: Partial<BranchRow>) {
    setDraft((prev) => (prev ? { ...prev, ...p } : prev));
  }

  async function create() {
    const name = createForm.name.trim();
    if (!name) return;

    setCreating(true);
    try {
      await apiFetchAuthed(getAccessToken, "/branches", {
        method: "POST",
        body: JSON.stringify({
          name,
          plan: createForm.plan,
          timezone: createForm.timezone,
          schedule: emptyWeek(),
          isActive: true,
        }),
      });

      setCreateForm((f) => ({ ...f, name: "" }));
      await load();
    } finally {
      setCreating(false);
    }
  }

  async function saveDrawer() {
    if (!draft) return;

    setSaving(true);
    try {
      await apiFetchAuthed(getAccessToken, `/branches/${draft.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: draft.name,
          description: draft.description,
          plan: draft.plan,
          isActive: draft.isActive,

          address: draft.address,
          city: draft.city,
          postalCode: draft.postalCode,
          phone: draft.phone,
          whatsapp: draft.whatsapp,
          gps: draft.gps,

          timezone: draft.timezone,
          schedule: draft.schedule,

          notes: draft.notes,
        }),
      });

      await load();
      closeDrawer();
    } finally {
      setSaving(false);
    }
  }

  async function softDelete(id: string) {
    await apiFetchAuthed(getAccessToken, `/branches/${id}`, { method: "DELETE" });
    await load();
  }

  async function restore(id: string) {
    await apiFetchAuthed(getAccessToken, `/branches/${id}/restore`, {
      method: "PATCH",
    });
    await load();
  }

  async function createBranchAdmin() {
    if (!draft) return;

    const email = adminForm.email.trim().toLowerCase();
    const password = adminForm.password;
    const username = adminForm.username.trim() || null;

    setAdminMsg(null);
    setAdminErr(null);

    if (!email || !password) {
      setAdminErr("Email y password son obligatorios.");
      return;
    }

    setCreatingAdmin(true);
    try {
      // Endpoint del controller nuevo: POST /users
      await apiFetchAuthed(getAccessToken, "/users", {
        method: "POST",
        body: JSON.stringify({
          email,
          password,
          roles: ["ADMIN"],
          branchId: draft.id, // ✅ SUPERADMIN asigna branch del admin
          username,
        }),
      });

      setAdminMsg("✅ Admin creado correctamente.");
      setAdminForm({ email: "", password: "", username: "" });
      await loadBranchAdmins(draft.id);
    } catch (e: any) {
      setAdminErr(
        e?.message ||
          "No se pudo crear el admin. Revisá que estés logueado como SUPERADMIN y que el endpoint /users exista.",
      );
    } finally {
      setCreatingAdmin(false);
    }
  }

  return (
    <div>
      <div className="space-y-6">
        {/* Header row */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="flex-1">
            <h1 className="text-xl font-semibold">Branches (SuperAdmin)</h1>
            <p className="text-sm text-neutral-500">
              Lista + edición en drawer. Incluye estado, plan, timezone y horarios por día.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <label className="text-sm flex items-center gap-2">
              <input
                type="checkbox"
                checked={includeDeleted}
                onChange={(e) => setIncludeDeleted(e.target.checked)}
              />
              Ver borradas
            </label>

            <Button variant="secondary" onClick={load} disabled={loading}>
              <RefreshCcw className="h-4 w-4 mr-2" />
              Recargar
            </Button>
          </div>
        </div>

        {/* Create + Search */}
        <Card>
          <CardHeader title="Crear y buscar" />
          <CardBody>
            <div className="md:col-span-4">
              <Field label="Nombre">
                <Input
                  value={createForm.name}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, name: e.target.value }))
                  }
                  placeholder="Nova Sushi - Nueva Córdoba"
                />
              </Field>
            </div>

            <div className="md:col-span-2">
              <Field label="Plan">
                <Select
                  value={createForm.plan}
                  onChange={(e) =>
                    setCreateForm((f) => ({
                      ...f,
                      plan: e.target.value as BranchPlan,
                    }))
                  }
                >
                  <option value="FREE">FREE</option>
                  <option value="BASIC">BASIC</option>
                  <option value="STANDARD">STANDARD</option>
                  <option value="PRO">PRO</option>
                </Select>
              </Field>
            </div>

            <div className="md:col-span-4">
              <Field label="Timezone">
                <Input
                  list="tz-list"
                  value={createForm.timezone}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, timezone: e.target.value }))
                  }
                  placeholder="America/Argentina/Buenos_Aires"
                />
                <datalist id="tz-list">
                  {TIMEZONES.map((tz) => (
                    <option key={tz} value={tz} />
                  ))}
                </datalist>
              </Field>
            </div>

            <div className="md:col-span-2 flex items-end">
              <Button
                onClick={create}
                disabled={creating || !createForm.name.trim()}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Crear
              </Button>
            </div>

            <div className="md:col-span-12">
              <Field label="Buscar">
                <div className="relative">
                  <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                  <Input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Buscar por nombre, id, timezone o plan..."
                    className="pl-9"
                  />
                </div>
              </Field>
            </div>
          </CardBody>
        </Card>

        {/* List */}
        <Card>
          <CardHeader title={`Sucursales (${filtered.length})`} />
          <CardBody>
            {filtered.length === 0 ? (
              <div className="text-sm text-neutral-500">No hay sucursales.</div>
            ) : (
              filtered.map((b) => (
                <div
                  key={b.id}
                  className="rounded-2xl border bg-white p-4 flex items-center gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="font-medium truncate">{b.name}</div>

                      {b.deletedAt ? (
                        <Pill>Borrada</Pill>
                      ) : b.isActive ? (
                        <Pill tone="good">Activa</Pill>
                      ) : (
                        <Pill tone="warn">Inactiva</Pill>
                      )}

                      <Pill tone="info">{b.plan}</Pill>

                      <span className="text-xs text-neutral-500 truncate">
                        {b.timezone}
                      </span>
                    </div>

                    <div className="text-xs text-neutral-500 truncate">{b.id}</div>
                  </div>

                  <Button
                    variant="secondary"
                    onClick={() => openDrawer(b)}
                    disabled={!!b.deletedAt}
                    title={b.deletedAt ? "No se puede editar una branch borrada" : "Editar"}
                  >
                    Editar
                  </Button>

                  {!b.deletedAt ? (
                    <Button variant="danger" onClick={() => softDelete(b.id)}>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Borrar
                    </Button>
                  ) : (
                    <Button variant="secondary" onClick={() => restore(b.id)}>
                      <Undo2 className="h-4 w-4 mr-2" />
                      Restaurar
                    </Button>
                  )}
                </div>
              ))
            )}
          </CardBody>
        </Card>
      </div>

      {/* Drawer */}
      {drawerOpen && draft && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 bg-black/30 z-40" onClick={closeDrawer} />

          {/* Panel */}
          <div className="fixed right-0 top-0 h-full w-full max-w-2xl bg-white z-50 shadow-xl border-l">
            <div className="h-full flex flex-col">
              {/* Header */}
              <div className="p-4 border-b flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-neutral-500">Editar Branch</div>
                  <div className="font-semibold truncate">{draft.name}</div>
                  <div className="text-xs text-neutral-500 truncate">{draft.id}</div>
                </div>

                <Button variant="secondary" onClick={closeDrawer}>
                  <X className="h-4 w-4 mr-2" />
                  Cerrar
                </Button>

                <Button onClick={saveDrawer} disabled={saving}>
                  <Save className="h-4 w-4 mr-2" />
                  Guardar
                </Button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-auto p-4 space-y-6">
                {/* ✅ NUEVO: Admin de la sucursal */}
                <Card>
                  <CardHeader title="Admin de la sucursal" />
                  <CardBody>
                    <div className="md:col-span-12 flex items-center gap-2">
                      <Pill tone="info">
                        <span className="inline-flex items-center gap-2">
                          <Shield className="h-4 w-4" /> ADMIN
                        </span>
                      </Pill>
                      <span className="text-xs text-neutral-500">
                        Solo SUPERADMIN puede crear admins. Se asigna automáticamente a esta branch.
                      </span>
                    </div>

                    <Field label="Email (admin)">
                      <Input
                        value={adminForm.email}
                        onChange={(e) =>
                          setAdminForm((p) => ({ ...p, email: e.target.value }))
                        }
                        placeholder="admin@sucursal.com"
                      />
                    </Field>

                    <Field label="Password">
                      <Input
                        type="password"
                        value={adminForm.password}
                        onChange={(e) =>
                          setAdminForm((p) => ({ ...p, password: e.target.value }))
                        }
                        placeholder="********"
                      />
                    </Field>

                    <Field label="Username (opcional)">
                      <Input
                        value={adminForm.username}
                        onChange={(e) =>
                          setAdminForm((p) => ({ ...p, username: e.target.value }))
                        }
                        placeholder="Admin Nueva Córdoba"
                      />
                    </Field>

                    <div className="md:col-span-12 flex flex-col gap-2">
                      <Button
                        onClick={createBranchAdmin}
                        disabled={creatingAdmin || !adminForm.email.trim() || !adminForm.password}
                      >
                        <UserPlus className="h-4 w-4 mr-2" />
                        Crear admin para esta branch
                      </Button>

                      {adminErr && (
                        <div className="text-sm text-red-600">{adminErr}</div>
                      )}
                      {adminMsg && (
                        <div className="text-sm text-emerald-700">{adminMsg}</div>
                      )}
                    </div>

                    <div className="md:col-span-12 mt-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-medium">Admins actuales</div>
                        <Button
                          variant="secondary"
                          onClick={() => loadBranchAdmins(draft.id)}
                          disabled={adminsLoading}
                        >
                          <RefreshCcw className="h-4 w-4 mr-2" />
                          Recargar
                        </Button>
                      </div>

                      {adminsLoading ? (
                        <div className="text-sm text-neutral-500 mt-2">Cargando...</div>
                      ) : admins.length === 0 ? (
                        <div className="text-sm text-neutral-500 mt-2">
                          No hay admins asignados a esta branch.
                        </div>
                      ) : (
                        <div className="mt-2 space-y-2">
                          {admins.map((u) => (
                            <div
                              key={u.id}
                              className="rounded-2xl border p-3 flex items-center gap-3"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="font-medium truncate">
                                  {u.username || u.email}
                                </div>
                                <div className="text-xs text-neutral-500 truncate">
                                  {u.email} · {u.id}
                                </div>
                              </div>
                              {u.isActive ? (
                                <Pill tone="good">Activo</Pill>
                              ) : (
                                <Pill tone="warn">Inactivo</Pill>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardBody>
                </Card>

                <Card>
                  <CardHeader title="Estado y plan" />
                  <CardBody>
                    <Field label="Activa">
                      <Select
                        value={String(draft.isActive)}
                        onChange={(e) =>
                          patchDraft({ isActive: e.target.value === "true" })
                        }
                      >
                        <option value="true">Sí</option>
                        <option value="false">No</option>
                      </Select>
                    </Field>

                    <Field label="Plan">
                      <Select
                        value={draft.plan}
                        onChange={(e) =>
                          patchDraft({ plan: e.target.value as BranchPlan })
                        }
                      >
                        <option value="FREE">FREE</option>
                        <option value="BASIC">BASIC</option>
                        <option value="STANDARD">STANDARD</option>
                        <option value="PRO">PRO</option>
                      </Select>
                    </Field>

                    <Field label="Timezone">
                      <Input
                        list="tz-list"
                        value={draft.timezone}
                        onChange={(e) => patchDraft({ timezone: e.target.value })}
                        placeholder="America/Argentina/Buenos_Aires"
                      />
                    </Field>
                  </CardBody>
                </Card>

                <Card>
                  <CardHeader title="Datos" />
                  <CardBody>
                    <Field label="Nombre">
                      <Input
                        value={draft.name}
                        onChange={(e) => patchDraft({ name: e.target.value })}
                      />
                    </Field>

                    <Field label="Descripción">
                      <Input
                        value={draft.description ?? ""}
                        onChange={(e) =>
                          patchDraft({ description: e.target.value })
                        }
                      />
                    </Field>

                    <Field label="Dirección">
                      <Input
                        value={draft.address ?? ""}
                        onChange={(e) => patchDraft({ address: e.target.value })}
                      />
                    </Field>

                    <Field label="Ciudad">
                      <Input
                        value={draft.city ?? ""}
                        onChange={(e) => patchDraft({ city: e.target.value })}
                      />
                    </Field>

                    <Field label="WhatsApp">
                      <Input
                        value={draft.whatsapp ?? ""}
                        onChange={(e) =>
                          patchDraft({ whatsapp: e.target.value })
                        }
                      />
                    </Field>

                    <Field label="GPS (lat, lon)">
                      <Input
                        value={draft.gps ?? ""}
                        onChange={(e) => patchDraft({ gps: e.target.value })}
                        placeholder="-31.6572, -64.4289"
                      />
                    </Field>

                    <div className="md:col-span-2">
                      <Field label="Notas">
                        <Input
                          value={draft.notes ?? ""}
                          onChange={(e) => patchDraft({ notes: e.target.value })}
                        />
                      </Field>
                    </div>
                  </CardBody>
                </Card>

                <Card>
                  <CardHeader title="Horarios por día" />
                  <CardBody>
                    {DAYS.map(({ key, label }) => {
                      const day = draft.schedule?.[key] || emptyDay();

                      return (
                        <div key={String(key)} className="rounded-2xl border p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="font-medium">{label}</div>

                            <label className="text-sm flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={!!day.enabled}
                                onChange={(e) => {
                                  const next = {
                                    ...draft.schedule,
                                    [key]: { ...day, enabled: e.target.checked },
                                  } as WeekSchedule;
                                  patchDraft({ schedule: next });
                                }}
                              />
                              Abierto
                            </label>
                          </div>

                          <div className="mt-3 space-y-2">
                            {(day.ranges || []).map((r, idx) => (
                              <div
                                key={idx}
                                className="grid gap-2 md:grid-cols-5 items-center"
                              >
                                <div className="md:col-span-2">
                                  <Input
                                    value={r.open}
                                    onChange={(e) => {
                                      const nextRanges = [...day.ranges];
                                      nextRanges[idx] = {
                                        ...nextRanges[idx],
                                        open: e.target.value,
                                      };
                                      const next = {
                                        ...draft.schedule,
                                        [key]: { ...day, ranges: nextRanges },
                                      } as WeekSchedule;
                                      patchDraft({ schedule: next });
                                    }}
                                    placeholder="HH:mm"
                                  />
                                </div>

                                <div className="md:col-span-2">
                                  <Input
                                    value={r.close}
                                    onChange={(e) => {
                                      const nextRanges = [...day.ranges];
                                      nextRanges[idx] = {
                                        ...nextRanges[idx],
                                        close: e.target.value,
                                      };
                                      const next = {
                                        ...draft.schedule,
                                        [key]: { ...day, ranges: nextRanges },
                                      } as WeekSchedule;
                                      patchDraft({ schedule: next });
                                    }}
                                    placeholder="HH:mm"
                                  />
                                </div>

                                <div className="flex justify-end">
                                  <Button
                                    variant="secondary"
                                    onClick={() => {
                                      const nextRanges = day.ranges.filter(
                                        (_, i) => i !== idx,
                                      );
                                      const next = {
                                        ...draft.schedule,
                                        [key]: { ...day, ranges: nextRanges },
                                      } as WeekSchedule;
                                      patchDraft({ schedule: next });
                                    }}
                                  >
                                    Quitar
                                  </Button>
                                </div>
                              </div>
                            ))}

                            <div className="flex justify-end">
                              <Button
                                variant="secondary"
                                onClick={() => {
                                  const nextRanges = [
                                    ...(day.ranges || []),
                                    { open: "19:00", close: "00:00" },
                                  ];
                                  const next = {
                                    ...draft.schedule,
                                    [key]: { ...day, ranges: nextRanges },
                                  } as WeekSchedule;
                                  patchDraft({ schedule: next });
                                }}
                              >
                                + Agregar rango
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </CardBody>
                </Card>
              </div>

              {/* Sticky footer */}
              <div className="p-4 border-t bg-white flex items-center justify-end gap-2">
                <Button variant="secondary" onClick={closeDrawer}>
                  Cerrar
                </Button>
                <Button onClick={saveDrawer} disabled={saving}>
                  <Save className="h-4 w-4 mr-2" />
                  Guardar cambios
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
