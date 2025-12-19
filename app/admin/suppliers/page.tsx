"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminProtected } from "@/components/AdminProtected";
import { useAuth } from "@/app/providers/AuthProvider";
import { apiFetchAuthed } from "@/lib/apiAuthed";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";

type Supplier = {
  id: string;
  name: string;
  isActive: boolean;
};

export default function AdminSuppliersPage() {
  const { getAccessToken } = useAuth();

  const [items, setItems] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return items;
    return items.filter((s) => s.name.toLowerCase().includes(qq));
  }, [items, q]);

  async function load() {
    setErr(null);
    setOk(null);
    setLoading(true);
    try {
      const data = await apiFetchAuthed<Supplier[]>(getAccessToken, "/suppliers");
      setItems(data);
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
      setOk("Proveedor creado ✔");
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
      setOk(next ? "Proveedor reactivado ✔" : "Proveedor desactivado ✔");
      await load();
    } catch (e: any) {
      setErr(e?.message || "Error actualizando proveedor");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminProtected>
      <div className="min-h-screen bg-zinc-50">
        <div className="mx-auto max-w-5xl px-4 py-8">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-zinc-900">Admin • Proveedores</h1>
              <p className="mt-1 text-sm text-zinc-500">Creá y activá/desactivá proveedores.</p>
            </div>
            <Button variant="secondary" onClick={load} loading={loading} disabled={busy}>
              Refrescar
            </Button>
          </div>

          <Card>
            <CardHeader title="Crear proveedor" subtitle="Nombre único" />
            <CardBody>
              <div className="grid gap-3 md:grid-cols-[1fr_160px]">
                <Field label="Nombre">
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Proveedor A" />
                </Field>
                <div className="flex items-end">
                  <Button className="w-full" onClick={create} loading={busy} disabled={busy || !name.trim()}>
                    Crear
                  </Button>
                </div>
              </div>

              {(err || ok) && (
                <div
                  className={[
                    "mt-4 rounded-xl border px-3 py-2 text-sm",
                    err
                      ? "border-red-200 bg-red-50 text-red-700"
                      : "border-emerald-200 bg-emerald-50 text-emerald-700",
                  ].join(" ")}
                >
                  {err || ok}
                </div>
              )}
            </CardBody>
          </Card>

          <div className="mt-6 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <div className="border-b border-zinc-100 px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-zinc-900">Listado</h2>
                  <p className="mt-1 text-sm text-zinc-500">{filtered.length} proveedor(es)</p>
                </div>
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar..." />
              </div>
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
                      <td colSpan={3} className="px-4 py-6 text-sm text-zinc-500">
                        No hay proveedores.
                      </td>
                    </tr>
                  )}

                  {!loading &&
                    filtered.map((s) => (
                      <tr key={s.id} className="hover:bg-zinc-50/60">
                        <td className="px-4 py-3 text-sm font-medium text-zinc-900">{s.name}</td>
                        <td className="px-4 py-3">
                          <span
                            className={[
                              "rounded-full px-2.5 py-1 text-xs font-semibold border",
                              s.isActive
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-zinc-100 text-zinc-600 border-zinc-200",
                            ].join(" ")}
                          >
                            {s.isActive ? "ACTIVO" : "INACTIVO"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Button
                            variant={s.isActive ? "danger" : "secondary"}
                            disabled={busy}
                            onClick={() => toggleActive(s)}
                          >
                            {s.isActive ? "Desactivar" : "Reactivar"}
                          </Button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </AdminProtected>
  );
}
