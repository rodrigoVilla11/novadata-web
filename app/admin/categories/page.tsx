"use client";

import React, { useEffect, useMemo, useState } from "react";
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
  Save,
  Power,
  CheckCircle2,
  AlertTriangle,
  Tags,
  Image as ImageIcon,
  ArrowUpDown,
} from "lucide-react";

/* ============================================================================
 * Types
 * ========================================================================== */

type Category = {
  id: string;
  name: string;
  branchId: string | null;
  description: string | null;
  imageUrl: string | null;
  tags: string[];
  sortOrder: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

/* ============================================================================
 * Helpers
 * ========================================================================== */

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function toNum(raw: string) {
  if (raw == null || raw === "") return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function parseTags(raw: string) {
  return raw
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => x.toLowerCase());
}

function joinTags(tags: string[]) {
  return (tags || []).join(", ");
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
      {active ? "ACTIVA" : "INACTIVA"}
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

/* ============================================================================
 * Page
 * ========================================================================== */

export default function AdminCategoriesPage() {
  const { getAccessToken } = useAuth();

  const [items, setItems] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  // create
  const [createOpen, setCreateOpen] = useState(true);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [tagsRaw, setTagsRaw] = useState("");
  const [sortOrder, setSortOrder] = useState("0");

  // filters
  const [q, setQ] = useState("");
  const [onlyActive, setOnlyActive] = useState(false);

  // inline edit drafts
  const [draftById, setDraftById] = useState<
    Record<
      string,
      {
        name: string;
        description: string;
        imageUrl: string;
        tagsRaw: string;
        sortOrder: string;
      }
    >
  >({});

  const [savingById, setSavingById] = useState<Record<string, boolean>>({});

  const filtered = useMemo(() => {
    let base = items;
    if (onlyActive) base = base.filter((c) => c.isActive);
    const qq = q.trim().toLowerCase();
    if (!qq) return base;
    return base.filter((c) => {
      const hay =
        (c.name || "").toLowerCase().includes(qq) ||
        (c.description || "").toLowerCase().includes(qq) ||
        (c.tags || []).some((t) => (t || "").toLowerCase().includes(qq));
      return hay;
    });
  }, [items, q, onlyActive]);

  const totals = useMemo(() => {
    const total = items.length;
    const active = items.filter((x) => x.isActive).length;
    return { total, active, inactive: total - active };
  }, [items]);

  /* ============================================================================
   * Load
   * ========================================================================== */

  async function loadAll() {
    setErr(null);
    setOk(null);
    setLoading(true);

    try {
      const data = await apiFetchAuthed<Category[]>(
        getAccessToken,
        `/categories${onlyActive ? "?onlyActive=true" : ""}`
      );

      setItems(data);

      setDraftById((prev) => {
        const next = { ...prev };
        for (const c of data) {
          if (!next[c.id]) {
            next[c.id] = {
              name: c.name ?? "",
              description: c.description ?? "",
              imageUrl: c.imageUrl ?? "",
              tagsRaw: joinTags(c.tags ?? []),
              sortOrder: String(c.sortOrder ?? 0),
            };
          }
        }
        return next;
      });

      setOk("Datos actualizados ✔");
      setTimeout(() => setOk(null), 1500);
    } catch (e: any) {
      setErr(e?.message || "Error cargando categorías");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ============================================================================
   * Actions
   * ========================================================================== */

  async function create() {
    if (!name.trim()) return;

    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      imageUrl: imageUrl.trim() || null,
      tags: parseTags(tagsRaw),
      sortOrder: toNum(sortOrder),
    };

    setBusy(true);
    setErr(null);
    setOk(null);

    try {
      await apiFetchAuthed(getAccessToken, "/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      setName("");
      setDescription("");
      setImageUrl("");
      setTagsRaw("");
      setSortOrder("0");

      setOk("Categoría creada ✔");
      setTimeout(() => setOk(null), 1500);

      await loadAll();
    } catch (e: any) {
      setErr(e?.message || "Error creando categoría");
    } finally {
      setBusy(false);
    }
  }

  function setDraft(id: string, patch: Partial<(typeof draftById)[string]>) {
    setDraftById((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  async function saveRow(id: string) {
    const d = draftById[id];
    if (!d) return;

    const payload = {
      name: (d.name || "").trim(),
      description: (d.description || "").trim() || null,
      imageUrl: (d.imageUrl || "").trim() || null,
      tags: parseTags(d.tagsRaw || ""),
      sortOrder: toNum(d.sortOrder || "0"),
    };

    if (!payload.name) {
      setErr("El nombre es obligatorio.");
      return;
    }

    setSavingById((prev) => ({ ...prev, [id]: true }));
    setErr(null);
    setOk(null);

    try {
      await apiFetchAuthed(getAccessToken, `/categories/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      setOk("Guardado ✔");
      setTimeout(() => setOk(null), 1200);
      await loadAll();
    } catch (e: any) {
      setErr(e?.message || "Error guardando categoría");
    } finally {
      setSavingById((prev) => ({ ...prev, [id]: false }));
    }
  }

  async function toggleActive(c: Category) {
    const next = !c.isActive;

    if (
      !window.confirm(
        next
          ? `¿Reactivar categoría "${c.name}"?`
          : `¿Desactivar categoría "${c.name}"?\n\nNo se podrá usar para productos si filtrás solo activas.`
      )
    ) {
      return;
    }

    setBusy(true);
    setErr(null);

    try {
      await apiFetchAuthed(getAccessToken, `/categories/${c.id}/active`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: next }),
      });
      await loadAll();
    } catch (e: any) {
      setErr(e?.message || "Error actualizando estado");
    } finally {
      setBusy(false);
    }
  }

  /* ============================================================================
   * Render
   * ========================================================================== */

  return (
    <AdminProtected allow={["ADMIN", "MANAGER"]}>
      <div className="space-y-6">
        {/* Header */}
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
                Categorías
              </h1>
              <p className="mt-1 text-sm text-zinc-500">
                Creá y mantené categorías para organizar Productos.
              </p>

              <div className="mt-3 flex flex-wrap gap-4 text-sm">
                <span>
                  Totales: <b>{totals.total}</b>
                </span>
                <span className="text-emerald-700">
                  Activas: <b>{totals.active}</b>
                </span>
                <span className="text-zinc-600">
                  Inactivas: <b>{totals.inactive}</b>
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={loadAll} loading={loading}>
                <RefreshCcw className="h-4 w-4" />
                Actualizar
              </Button>
            </div>
          </div>
        </div>

        {(err || ok) && (
          <div className="grid gap-2">
            {err && <Notice tone="error">{err}</Notice>}
            {!err && ok && <Notice tone="ok">{ok}</Notice>}
          </div>
        )}

        {/* Filters */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-4">
          <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar por nombre, descripción o tags…"
                className="pl-9"
              />
            </div>

            <button
              type="button"
              onClick={() => setOnlyActive((v) => !v)}
              className={cn(
                "h-10 rounded-xl border px-3 text-sm font-semibold inline-flex items-center gap-2",
                onlyActive
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50"
              )}
            >
              <ArrowUpDown className="h-4 w-4" />
              {onlyActive ? "Solo activas" : "Todas"}
            </button>
          </div>
        </div>

        {/* Create */}
        <Card>
          <CardHeader
            title="Crear categoría"
            subtitle="Nombre, tags, orden e imagen"
          />
          <div className="flex items-start justify-between px-5 pt-2">
            <div className="text-sm text-zinc-500">
              Tip: tags en formato <b>coma-separado</b>. SortOrder define el orden.
            </div>
            <button
              onClick={() => setCreateOpen((v) => !v)}
              className="rounded-xl border px-3 py-2 text-sm hover:bg-zinc-50"
            >
              {createOpen ? "Ocultar" : "Mostrar"}
            </button>
          </div>

          {createOpen && (
            <CardBody>
              <div className="grid gap-4 md:grid-cols-6">
                <Field label="Nombre">
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                </Field>

                <Field label="Descripción">
                  <Input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Opcional"
                  />
                </Field>

                <Field label="Image URL">
                  <div className="relative">
                    <ImageIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                    <Input
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      placeholder="https://..."
                      className="pl-9"
                    />
                  </div>
                </Field>

                <Field label="Tags">
                  <div className="relative">
                    <Tags className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                    <Input
                      value={tagsRaw}
                      onChange={(e) => setTagsRaw(e.target.value)}
                      placeholder="sushi, promo, combos"
                      className="pl-9"
                    />
                  </div>
                </Field>

                <Field label="SortOrder">
                  <Input
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value)}
                    inputMode="numeric"
                  />
                </Field>

                <div className="flex items-end">
                  <Button onClick={create} disabled={busy || !name.trim()}>
                    <Plus className="h-4 w-4" />
                    Crear
                  </Button>
                </div>
              </div>
            </CardBody>
          )}
        </Card>

        {/* List */}
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <table className="min-w-full">
            <thead className="bg-zinc-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">
                  Nombre
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">
                  Descripción
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">
                  Tags
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">
                  Sort
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">
                  Estado
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">
                  Acciones
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-zinc-100">
              {filtered.map((c) => {
                const d = draftById[c.id] || {
                  name: c.name ?? "",
                  description: c.description ?? "",
                  imageUrl: c.imageUrl ?? "",
                  tagsRaw: joinTags(c.tags ?? []),
                  sortOrder: String(c.sortOrder ?? 0),
                };
                const saving = !!savingById[c.id];

                return (
                  <tr key={c.id} className="hover:bg-zinc-50">
                    <td className="px-4 py-3">
                      <div className="grid gap-2">
                        <Input
                          value={d.name}
                          onChange={(e) => setDraft(c.id, { name: e.target.value })}
                        />
                        <div className="text-xs text-zinc-500">
                          {c.imageUrl ? (
                            <span className="inline-flex items-center gap-2">
                              <ImageIcon className="h-3.5 w-3.5" />
                              <span className="truncate max-w-[260px]">{c.imageUrl}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-2">
                              <ImageIcon className="h-3.5 w-3.5" />
                              Sin imagen
                            </span>
                          )}
                        </div>

                        <Input
                          value={d.imageUrl}
                          onChange={(e) => setDraft(c.id, { imageUrl: e.target.value })}
                          placeholder="Image URL (opcional)"
                        />
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <Input
                        value={d.description}
                        onChange={(e) =>
                          setDraft(c.id, { description: e.target.value })
                        }
                        placeholder="Opcional"
                      />
                    </td>

                    <td className="px-4 py-3">
                      <Input
                        value={d.tagsRaw}
                        onChange={(e) => setDraft(c.id, { tagsRaw: e.target.value })}
                        placeholder="coma-separado"
                      />
                      <div className="mt-1 text-xs text-zinc-500">
                        {(parseTags(d.tagsRaw).slice(0, 4) || []).map((t) => (
                          <span
                            key={t}
                            className="mr-1 inline-flex rounded-full border px-2 py-0.5"
                          >
                            {t}
                          </span>
                        ))}
                        {parseTags(d.tagsRaw).length > 4 && (
                          <span className="text-zinc-400">
                            +{parseTags(d.tagsRaw).length - 4}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <Input
                        value={d.sortOrder}
                        onChange={(e) =>
                          setDraft(c.id, { sortOrder: e.target.value })
                        }
                        inputMode="numeric"
                        className="w-24"
                      />
                    </td>

                    <td className="px-4 py-3">
                      <StatusPill active={c.isActive} />
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="secondary"
                          loading={saving}
                          onClick={() => saveRow(c.id)}
                          disabled={busy}
                        >
                          <Save className="h-4 w-4" />
                          Guardar
                        </Button>

                        <Button
                          variant={c.isActive ? "danger" : "secondary"}
                          onClick={() => toggleActive(c)}
                          disabled={busy}
                        >
                          <Power className="h-4 w-4" />
                          {c.isActive ? "Desactivar" : "Reactivar"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-sm text-zinc-500">
                    No hay categorías para mostrar.
                  </td>
                </tr>
              )}

              {loading && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-sm text-zinc-500">
                    Cargando…
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="text-xs text-zinc-500">
          Mostrando <b>{filtered.length}</b> de <b>{items.length}</b> categorías.
        </div>
      </div>
    </AdminProtected>
  );
}
