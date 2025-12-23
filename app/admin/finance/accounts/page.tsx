"use client";

import React, { useMemo, useState } from "react";
import { AdminProtected } from "@/components/AdminProtected";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Field";
import {
  FinanceAccountType,
  useCreateFinanceAccountMutation,
  useGetFinanceAccountsQuery,
  // 👉 estas dos las tenés que tener en tu financeApi:
  // PATCH /finance/accounts/:id
  useUpdateFinanceAccountMutation,
} from "@/redux/services/financeApi";

const TYPE_OPTIONS: Array<{ label: string; value: FinanceAccountType }> = [
  { label: "Efectivo", value: "CASH" },
  { label: "Banco", value: "BANK" },
  { label: "Billetera", value: "WALLET" },
];

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function parseNumberLoose(v: string) {
  const s = String(v ?? "")
    .trim()
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function typeBadge(t: FinanceAccountType) {
  const base =
    "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold";
  if (t === "CASH")
    return (
      <span
        className={cn(
          base,
          "border-emerald-200 bg-emerald-50 text-emerald-700"
        )}
      >
        Efectivo
      </span>
    );
  if (t === "BANK")
    return (
      <span className={cn(base, "border-blue-200 bg-blue-50 text-blue-700")}>
        Banco
      </span>
    );
  return (
    <span
      className={cn(base, "border-violet-200 bg-violet-50 text-violet-700")}
    >
      Billetera
    </span>
  );
}

// 👇 Ajustá el nombre del flag si tu DTO usa otro (active / isActive)
function getActiveFlag(a: any): boolean {
  if (typeof a?.isActive === "boolean") return a.isActive;
  if (typeof a?.active === "boolean") return a.active;
  return true; // fallback
}

export default function FinanceAccountsPage() {
  const [q, setQ] = useState("");
  const [type, setType] = useState<FinanceAccountType | "">("");
  const [showCreate, setShowCreate] = useState(false);

  type ActiveFilter = "active" | "inactive" | "all";

  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("active");

  // ✅ toggle ver inactivas
  const [showInactive, setShowInactive] = useState(false);
  const activeParam = useMemo(() => {
    if (activeFilter === "all") return undefined; // ✅ no filtra
    if (activeFilter === "inactive") return false; // ✅ trae inactivas
    return true; // ✅ activas
  }, [activeFilter]);

  const { data, isLoading, isFetching, error, refetch } =
    useGetFinanceAccountsQuery({
      q: q.trim() || undefined,
      type: (type || undefined) as any,
      active: activeParam,
    });

  const [createAccount, createState] = useCreateFinanceAccountMutation();
  const [updateAccount, updateState] = useUpdateFinanceAccountMutation();

  // Create form
  const [name, setName] = useState("");
  const [createType, setCreateType] = useState<FinanceAccountType>("CASH");
  const [currency, setCurrency] = useState("ARS");
  const [openingBalance, setOpeningBalance] = useState("0");
  const [notes, setNotes] = useState("");

  const canCreate = name.trim().length > 0;

  // Edit modal state
  const [editing, setEditing] = useState<any | null>(null);
  const [eName, setEName] = useState("");
  const [eType, setEType] = useState<FinanceAccountType>("CASH");
  const [eCurrency, setECurrency] = useState("ARS");
  const [eOpeningBalance, setEOpeningBalance] = useState("0");
  const [eNotes, setENotes] = useState("");

  const stats = useMemo(() => {
    const rows = data || [];
    const count = rows.length;
    const sumOpening = rows.reduce(
      (acc, r: any) => acc + (Number(r.openingBalance ?? 0) || 0),
      0
    );
    const activeCount = rows.filter((r: any) => getActiveFlag(r)).length;
    const inactiveCount = count - activeCount;
    return { count, sumOpening, activeCount, inactiveCount };
  }, [data]);

  async function onCreate() {
    await createAccount({
      name: name.trim(),
      type: createType,
      currency: (currency || "ARS").trim().toUpperCase(),
      openingBalance: parseNumberLoose(openingBalance),
      notes: notes.trim() ? notes.trim() : null,
    }).unwrap();

    setName("");
    setCreateType("CASH");
    setCurrency("ARS");
    setOpeningBalance("0");
    setNotes("");
    setShowCreate(false);
    refetch();
  }

  function openEditModal(a: any) {
    setEditing(a);
    setEName(String(a?.name ?? ""));
    setEType((a?.type ?? "CASH") as FinanceAccountType);
    setECurrency(String(a?.currency ?? "ARS"));
    setEOpeningBalance(String(a?.openingBalance ?? 0));
    setENotes(String(a?.notes ?? ""));
  }

  async function onSaveEdit() {
    if (!editing) return;

    await updateAccount({
      id: editing.id,
      name: eName.trim(),
      type: eType,
      currency: (eCurrency || "ARS").trim().toUpperCase(),
      openingBalance: parseNumberLoose(eOpeningBalance),
      notes: eNotes.trim() ? eNotes.trim() : null,
    } as any).unwrap();

    setEditing(null);
    refetch();
  }

  async function onToggleActive(a: any) {
    const isActive = getActiveFlag(a);
    const next = !isActive;

    const ok = window.confirm(
      next
        ? `¿Activar la cuenta "${a.name}"?`
        : `¿Desactivar la cuenta "${a.name}"?\n\nNo se borra: solo queda inactiva.`
    );
    if (!ok) return;

    // 👇 Ajustá este campo si tu backend usa "active" en vez de "isActive"
    await updateAccount({
      id: a.id,
      isActive: next,
    } as any).unwrap();

    refetch();
  }

  const rows = useMemo(() => data || [], [data]);

  return (
    <AdminProtected>
      <div className="p-4 min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="max-w-5xl mx-auto space-y-4">
          <Card>
            <CardHeader
              title="Finance · Cuentas"
              subtitle="Crear, editar y activar/desactivar cuentas (Efectivo / Banco / Billetera)."
              right={
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => refetch()}
                    disabled={isLoading || isFetching}
                    loading={isFetching}
                  >
                    Refrescar
                  </Button>
                  <Button onClick={() => setShowCreate((s) => !s)}>
                    {showCreate ? "Cerrar" : "Nueva cuenta"}
                  </Button>
                </div>
              }
            />
            <CardBody>
              {/* Resumen */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
                <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                  <div className="text-xs text-zinc-500">Total</div>
                  <div className="mt-1 text-2xl font-bold text-zinc-900">
                    {isLoading ? "—" : stats.count}
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                  <div className="text-xs text-zinc-500">Activas</div>
                  <div className="mt-1 text-2xl font-bold text-zinc-900">
                    {isLoading ? "—" : stats.activeCount}
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                  <div className="text-xs text-zinc-500">Inactivas</div>
                  <div className="mt-1 text-2xl font-bold text-zinc-900">
                    {isLoading ? "—" : stats.inactiveCount}
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                  <div className="text-xs text-zinc-500">
                    Suma saldos iniciales
                  </div>
                  <div className="mt-1 text-2xl font-bold text-zinc-900">
                    {isLoading ? "—" : stats.sumOpening.toLocaleString("es-AR")}
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">
                    *openingBalance (no saldo real)
                  </div>
                </div>
              </div>

              {/* Filtros */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <Field label="Buscar">
                  <Input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Ej: Galicia / MP…"
                  />
                </Field>

                <Field label="Tipo">
                  <Select
                    value={type}
                    onChange={(e) => setType(e.target.value as any)}
                  >
                    <option value="">Todos</option>
                    {TYPE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field label="Estado">
                  <Select
                    value={activeFilter}
                    onChange={(e) =>
                      setActiveFilter(e.target.value as ActiveFilter)
                    }
                  >
                    <option value="active">Activas</option>
                    <option value="inactive">Inactivas</option>
                    <option value="all">Todas</option>
                  </Select>
                </Field>

                <Field label="Estado">
                  <Input value={isFetching ? "Actualizando…" : "Ok"} disabled />
                </Field>
              </div>

              {/* Crear */}
              {showCreate && (
                <div className="mt-4 p-4 rounded-2xl bg-white shadow-sm border border-zinc-200">
                  <div className="text-sm font-bold text-zinc-900">
                    Nueva cuenta
                  </div>
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-5 gap-3">
                    <Field label="Nombre *">
                      <Input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Ej: Santander"
                        onKeyDown={(e) => {
                          if (
                            e.key === "Enter" &&
                            canCreate &&
                            !createState.isLoading
                          )
                            onCreate();
                        }}
                      />
                    </Field>

                    <Field label="Tipo">
                      <Select
                        value={createType}
                        onChange={(e) => setCreateType(e.target.value as any)}
                      >
                        {TYPE_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </Select>
                    </Field>

                    <Field label="Moneda">
                      <Input
                        value={currency}
                        onChange={(e) =>
                          setCurrency(e.target.value.toUpperCase())
                        }
                        placeholder="ARS"
                      />
                    </Field>

                    <Field label="Saldo inicial">
                      <Input
                        value={openingBalance}
                        onChange={(e) => setOpeningBalance(e.target.value)}
                        placeholder="0"
                      />
                    </Field>

                    <Field label="Notas">
                      <Input
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Opcional"
                      />
                    </Field>
                  </div>

                  {createState.isError && (
                    <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                      {String(
                        (createState.error as any)?.data?.message ||
                          "Error creando cuenta"
                      )}
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      onClick={onCreate}
                      disabled={!canCreate || createState.isLoading}
                      loading={createState.isLoading}
                    >
                      Crear
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => setShowCreate(false)}
                      disabled={createState.isLoading}
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}

              {/* Tabla */}
              <div className="mt-4">
                {isLoading ? (
                  <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-500">
                    Cargando cuentas…
                  </div>
                ) : error ? (
                  <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                    {String((error as any)?.data?.message || "Error")}
                    <div className="mt-2">
                      <Button variant="secondary" onClick={() => refetch()}>
                        Reintentar
                      </Button>
                    </div>
                  </div>
                ) : rows.length === 0 ? (
                  <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                    <div className="text-lg font-bold text-zinc-900">
                      No hay cuentas
                    </div>
                    <div className="mt-1 text-sm text-zinc-500">
                      Creá tu primera cuenta para empezar a cargar movimientos.
                    </div>
                    <div className="mt-4">
                      <Button onClick={() => setShowCreate(true)}>
                        Crear cuenta
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="overflow-auto rounded-2xl border border-zinc-200 bg-white">
                    <table className="min-w-full text-sm">
                      <thead className="bg-zinc-50">
                        <tr>
                          <th className="text-left p-3">Nombre</th>
                          <th className="text-left p-3">Tipo</th>
                          <th className="text-left p-3">Moneda</th>
                          <th className="text-right p-3">Saldo inicial</th>
                          <th className="text-left p-3">Notas</th>
                          <th className="text-right p-3">Acciones</th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-zinc-100">
                        {rows.map((a: any) => {
                          const isActive = getActiveFlag(a);

                          return (
                            <tr
                              key={a.id}
                              className={cn(
                                "hover:bg-zinc-50/60",
                                !isActive && "opacity-70"
                              )}
                            >
                              <td className="p-3">
                                <div className="flex items-center gap-2">
                                  <div className="font-semibold text-zinc-900">
                                    {a.name}
                                  </div>
                                  <span
                                    className={cn(
                                      "text-[11px] font-bold px-2 py-0.5 rounded-full border",
                                      isActive
                                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                        : "border-zinc-200 bg-zinc-50 text-zinc-600"
                                    )}
                                  >
                                    {isActive ? "ACTIVA" : "INACTIVA"}
                                  </span>
                                </div>
                                <div className="text-xs text-zinc-500">
                                  {a.id}
                                </div>
                              </td>

                              <td className="p-3">{typeBadge(a.type)}</td>
                              <td className="p-3 text-zinc-700">
                                {a.currency}
                              </td>

                              <td className="p-3 text-right font-semibold text-zinc-900">
                                {Number(a.openingBalance ?? 0).toLocaleString(
                                  "es-AR"
                                )}
                              </td>

                              <td className="p-3 text-zinc-700">
                                {a.notes?.trim() ? a.notes : "—"}
                              </td>

                              <td className="p-3">
                                <div className="flex justify-end gap-2">
                                  <Button
                                    variant="secondary"
                                    onClick={() => openEditModal(a)}
                                    disabled={updateState.isLoading}
                                  >
                                    Editar
                                  </Button>

                                  <Button
                                    variant={isActive ? "danger" : "secondary"}
                                    onClick={() => onToggleActive(a)}
                                    loading={updateState.isLoading}
                                    disabled={updateState.isLoading}
                                  >
                                    {isActive ? "Desactivar" : "Activar"}
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {updateState.isError && (
                <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {String(
                    (updateState.error as any)?.data?.message ||
                      "Error actualizando cuenta"
                  )}
                </div>
              )}

              <div className="mt-3 text-xs text-zinc-500">
                *Desactivar no borra: solo oculta la cuenta para carga diaria
                (si filtrás “solo activas”).
              </div>
            </CardBody>
          </Card>

          {/* ========================= */}
          {/* EDIT MODAL */}
          {/* ========================= */}
          {editing && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
              <div className="w-full max-w-3xl rounded-2xl bg-white shadow-xl border border-zinc-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-zinc-100">
                  <div className="text-lg font-bold text-zinc-900">
                    Editar cuenta
                  </div>
                  <div className="text-sm text-zinc-500">
                    {editing.name} • {editing.id}
                  </div>
                </div>

                <div className="p-5">
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                    <Field label="Nombre *">
                      <Input
                        value={eName}
                        onChange={(e) => setEName(e.target.value)}
                      />
                    </Field>

                    <Field label="Tipo">
                      <Select
                        value={eType}
                        onChange={(e) => setEType(e.target.value as any)}
                      >
                        {TYPE_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </Select>
                    </Field>

                    <Field label="Moneda">
                      <Input
                        value={eCurrency}
                        onChange={(e) =>
                          setECurrency(e.target.value.toUpperCase())
                        }
                      />
                    </Field>

                    <Field label="Saldo inicial">
                      <Input
                        value={eOpeningBalance}
                        onChange={(e) => setEOpeningBalance(e.target.value)}
                      />
                    </Field>

                    <Field label="Notas">
                      <Input
                        value={eNotes}
                        onChange={(e) => setENotes(e.target.value)}
                      />
                    </Field>
                  </div>

                  <div className="mt-4 flex flex-wrap justify-end gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => setEditing(null)}
                      disabled={updateState.isLoading}
                    >
                      Cancelar
                    </Button>

                    <Button
                      onClick={onSaveEdit}
                      disabled={
                        updateState.isLoading || eName.trim().length === 0
                      }
                      loading={updateState.isLoading}
                    >
                      Guardar cambios
                    </Button>
                  </div>

                  {updateState.isError && (
                    <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                      {String(
                        (updateState.error as any)?.data?.message ||
                          "Error guardando cambios"
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminProtected>
  );
}
