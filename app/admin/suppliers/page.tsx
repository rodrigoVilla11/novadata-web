"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminProtected } from "@/components/AdminProtected";
import { useAuth } from "@/app/providers/AuthProvider";
import { apiFetchAuthed } from "@/lib/apiAuthed";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import {
  RefreshCcw,
  Search,
  Plus,
  Power,
  CheckCircle2,
  AlertTriangle,
  Truck,
} from "lucide-react";

type Supplier = {
  id: string;
  name: string;
  isActive: boolean;
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function StatusPill({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold border",
        active
          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
          : "bg-zinc-100 text-zinc-600 border-zinc-200"
      )}
    >
      {active ? "ACTIVO" : "INACTIVO"}
    </span>
  );
}

function Notice({
  tone,
  children,
}: {
  tone: "error" | "ok";
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border px-3 py-2 text-sm",
        tone === "error"
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-emerald-200 bg-emerald-50 text-emerald-700"
      )}
    >
      <span className="inline-flex items-center gap-2">
        {tone === "error" ? (
          <AlertTriangle className="h-4 w-4" />
        ) : (
          <CheckCircle2 className="h-4 w-4" />
        )}
        {children}
      </span>
    </div>
  );
}

export default function AdminSuppliersPage() {
  const { getAccessToken } = useAuth();

  const [items, setItems] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  // create
  const [name, setName] = useState("");

  // search
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return items;
    return items.filter((s) => s.name.toLowerCase().includes(qq));
  }, [items, q]);

  const totals = useMemo(() => {
    const total = items.length;
    const active = items.filter((s) => s.isActive).length;
    return { total, active, inactive: total - active };
  }, [items]);

  function flashOk(msg: string) {
    setOk(msg);
    window.setTimeout(() => setOk(null), 1600);
  }

  async function load() {
    setErr(null);
    setOk(null);
    setLoading(true);
    try {
      const data = await apiFetchAuthed<Supplier[]>(
        getAccessToken,
        "/suppliers"
      );
      setItems(data);
      flashOk("Datos actualizados ✔");
    } catch (e: any) {
      setErr(e?.message || "Error cargando proveedores");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function create() {
    if (!name.trim()) return;

    setErr(null);
    setOk(null);
    setBusy(true);
    try {
      await apiFetchAuthed(getAccessToken, "/suppliers", {
        method: "POST",
        body: JSON.stringify({ name: name.trim() }),
      });

      setName("");
      flashOk("Proveedor creado ✔");
      await load();
    } catch (e: any) {
      setErr(e?.message || "Error creando proveedor");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(s: Supplier) {
    const next = !s.isActive;
    const confirmMsg = next
      ? `¿Reactivar "${s.name}"?`
      : `¿Desactivar "${s.name}"?\n\nNo aparecerá para cargar conteos.`;
    if (!window.confirm(confirmMsg)) return;

    setErr(null);
    setOk(null);
    setBusy(true);
    try {
      await apiFetchAuthed(getAccessToken, `/suppliers/${s.id}/active`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: next }),
      });

      flashOk(next ? "Proveedor reactivado ✔" : "Proveedor desactivado ✔");
      await load();
    } catch (e: any) {
      setErr(e?.message || "Error actualizando proveedor");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminProtected>
      <div className="space-y-6">
        {/* Header */}
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
                Proveedores
              </h1>
              <p className="mt-1 text-sm text-zinc-500">
                Creá y activá/desactivá proveedores para compras y conteos.
              </p>

              <div className="mt-4 flex flex-wrap gap-4 text-sm">
                <span className="text-zinc-700">
                  Total: <b>{totals.total}</b>
                </span>
                <span className="text-emerald-700">
                  Activos: <b>{totals.active}</b>
                </span>
                <span className="text-zinc-600">
                  Inactivos: <b>{totals.inactive}</b>
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                onClick={load}
                loading={loading}
                disabled={busy}
              >
                <span className="inline-flex items-center gap-2">
                  <RefreshCcw className="h-4 w-4" />
                </span>
              </Button>
            </div>
          </div>
        </div>

        {/* Notices */}
        {(err || ok) && (
          <div className="grid gap-2">
            {err && <Notice tone="error">{err}</Notice>}
            {!err && ok && <Notice tone="ok">{ok}</Notice>}
          </div>
        )}

        {/* Toolbar (Search) */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-4">
          <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar proveedor…"
                className="pl-9"
              />
            </div>

            <div className="text-sm text-zinc-500">
              {q.trim()
                ? `${filtered.length} de ${items.length}`
                : `${items.length} proveedor(es)`}
            </div>
          </div>
        </div>

        {/* Create */}
        <Card>
          <CardHeader title="Crear proveedor" subtitle="Nombre único" />
          <CardBody>
            <div className="grid gap-3 md:grid-cols-[1fr_160px]">
              <Field label="Nombre">
                <div className="relative">
                  <Truck className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ej: Proveedor A"
                    className="pl-9"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") create();
                    }}
                  />
                </div>
              </Field>

              <div className="flex items-end">
                <Button
                  className="w-full"
                  onClick={create}
                  loading={busy}
                  disabled={busy || !name.trim()}
                >
                  <span className="inline-flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Crear
                  </span>
                </Button>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* List */}
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-100 px-5 py-4">
            <h2 className="text-lg font-semibold text-zinc-900">Listado</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Los proveedores inactivos no aparecen en conteos ni selecciones.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Nombre
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Estado
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Acciones
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-zinc-100">
                {loading && (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-sm text-zinc-500">
                      Cargando…
                    </td>
                  </tr>
                )}

                {!loading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-sm text-zinc-500">
                      No hay proveedores.
                    </td>
                  </tr>
                )}

                {!loading &&
                  filtered.map((s) => (
                    <tr key={s.id} className="hover:bg-zinc-50 transition">
                      <td className="px-4 py-3 text-sm font-semibold text-zinc-900">
                        {s.name}
                      </td>

                      <td className="px-4 py-3">
                        <StatusPill active={s.isActive} />
                      </td>

                      <td className="px-4 py-3">
                        <Button
                          variant={s.isActive ? "danger" : "secondary"}
                          disabled={busy}
                          onClick={() => toggleActive(s)}
                        >
                          <span className="inline-flex items-center gap-2">
                            <Power className="h-4 w-4" />
                            {s.isActive ? "Desactivar" : "Reactivar"}
                          </span>
                        </Button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          <div className="border-t border-zinc-100 px-5 py-4 text-xs text-zinc-500">
            Tip: después le metemos “Orden / Alias / CUIT / Contacto” si querés
            y queda pro para compras.
          </div>
        </div>
      </div>
    </AdminProtected>
  );
}
