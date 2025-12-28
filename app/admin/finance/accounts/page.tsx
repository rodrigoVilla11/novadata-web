"use client";

import React, { useMemo, useState } from "react";
import { AdminProtected } from "@/components/AdminProtected";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Field";
import {
  FinanceAccountType,
  useCreateFinanceAccountMutation,
  useGetFinanceAccountsQuery,
  useUpdateFinanceAccountMutation,
} from "@/redux/services/financeApi";
import { RefreshCcw, Plus } from "lucide-react";

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
    return <span className={cn(base, "border-emerald-200 bg-emerald-50 text-emerald-700")}>Efectivo</span>;
  if (t === "BANK")
    return <span className={cn(base, "border-blue-200 bg-blue-50 text-blue-700")}>Banco</span>;
  return <span className={cn(base, "border-violet-200 bg-violet-50 text-violet-700")}>Billetera</span>;
}

function getActiveFlag(a: any): boolean {
  if (typeof a?.isActive === "boolean") return a.isActive;
  if (typeof a?.active === "boolean") return a.active;
  return true;
}

export default function FinanceAccountsPage() {
  const [q, setQ] = useState("");
  const [type, setType] = useState<FinanceAccountType | "">("");
  const [activeFilter, setActiveFilter] =
    useState<"active" | "inactive" | "all">("active");

  const activeParam = useMemo(() => {
    if (activeFilter === "all") return undefined;
    if (activeFilter === "inactive") return false;
    return true;
  }, [activeFilter]);

  const { data, isLoading, isFetching, error, refetch } =
    useGetFinanceAccountsQuery({
      q: q.trim() || undefined,
      type: (type || undefined) as any,
      active: activeParam,
    });

  const [createAccount, createState] = useCreateFinanceAccountMutation();
  const [updateAccount, updateState] = useUpdateFinanceAccountMutation();

  // Create
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [createType, setCreateType] = useState<FinanceAccountType>("CASH");
  const [currency, setCurrency] = useState("ARS");
  const [openingBalance, setOpeningBalance] = useState("0");
  const [notes, setNotes] = useState("");

  const rows = useMemo(() => data || [], [data]);

  const stats = useMemo(() => {
    const total = rows.length;
    const active = rows.filter((r) => getActiveFlag(r)).length;
    const inactive = total - active;
    const sumOpening = rows.reduce(
      (acc, r: any) => acc + (Number(r.openingBalance ?? 0) || 0),
      0
    );
    return { total, active, inactive, sumOpening };
  }, [rows]);

  async function onCreate() {
    await createAccount({
      name: name.trim(),
      type: createType,
      currency: currency.trim().toUpperCase(),
      openingBalance: parseNumberLoose(openingBalance),
      notes: notes.trim() || null,
    }).unwrap();

    setName("");
    setCreateType("CASH");
    setCurrency("ARS");
    setOpeningBalance("0");
    setNotes("");
    setShowCreate(false);
    refetch();
  }

  async function toggleActive(a: any) {
    const next = !getActiveFlag(a);
    if (
      !window.confirm(
        next
          ? `¿Activar "${a.name}"?`
          : `¿Desactivar "${a.name}"?\n\nNo se borra, solo se oculta.`
      )
    )
      return;

    await updateAccount({ id: a.id, isActive: next } as any).unwrap();
    refetch();
  }

  return (
    <AdminProtected>
      <div className="space-y-6">
        {/* Header */}
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-zinc-900">
                Finance · Cuentas
              </h1>
              <p className="mt-1 text-sm text-zinc-500">
                Efectivo, bancos y billeteras.
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={refetch}
                loading={isFetching}
                disabled={isLoading}
              >
                <RefreshCcw className="h-4 w-4" />
              </Button>
              <Button onClick={() => setShowCreate((v) => !v)}>
                <Plus className="h-4 w-4" />
                Nueva cuenta
              </Button>
            </div>
          </div>

          {/* Stats */}
          <div className="mt-4 flex flex-wrap gap-2 text-zinc-500">
            <span className="rounded-full border px-3 py-1 text-xs font-semibold">
              Total: {stats.total}
            </span>
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              Activas: {stats.active}
            </span>
            <span className="rounded-full border px-3 py-1 text-xs font-semibold">
              Inactivas: {stats.inactive}
            </span>
            <span className="rounded-full border px-3 py-1 text-xs font-semibold">
              Σ Inicial: {stats.sumOpening.toLocaleString("es-AR")}
            </span>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardBody>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <Field label="Buscar">
                <Input value={q} onChange={(e) => setQ(e.target.value)} />
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
                    setActiveFilter(e.target.value as any)
                  }
                >
                  <option value="active">Activas</option>
                  <option value="inactive">Inactivas</option>
                  <option value="all">Todas</option>
                </Select>
              </Field>
            </div>
          </CardBody>
        </Card>

        {/* Table */}
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-zinc-50">
              <tr>
                <th className="text-zinc-500 px-4 py-3 text-left">Nombre</th>
                <th className="text-zinc-500 px-4 py-3 text-left">Tipo</th>
                <th className="text-zinc-500 px-4 py-3 text-left">Moneda</th>
                <th className="text-zinc-500 px-4 py-3 text-right">Saldo inicial</th>
                <th className="text-zinc-500 px-4 py-3 text-left">Notas</th>
                <th className="text-zinc-500 px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-zinc-100">
              {rows.map((a: any) => {
                const isActive = getActiveFlag(a);
                return (
                  <tr key={a.id} className={!isActive ? "opacity-60" : ""}>
                    <td className="px-4 py-3 font-semibold">{a.name}</td>
                    <td className="px-4 py-3">{typeBadge(a.type)}</td>
                    <td className="px-4 py-3">{a.currency}</td>
                    <td className="px-4 py-3 text-right">
                      {Number(a.openingBalance ?? 0).toLocaleString("es-AR")}
                    </td>
                    <td className="px-4 py-3">{a.notes || "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant={isActive ? "danger" : "secondary"}
                        onClick={() => toggleActive(a)}
                        loading={updateState.isLoading}
                      >
                        {isActive ? "Desactivar" : "Activar"}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </AdminProtected>
  );
}
