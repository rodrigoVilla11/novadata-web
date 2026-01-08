"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AdminProtected } from "@/components/AdminProtected";
import { useAuth } from "@/app/providers/AuthProvider";
import { apiFetchAuthed } from "@/lib/apiAuthed";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Save, RefreshCcw, Eye, Settings as SettingsIcon } from "lucide-react";

/* =============================================================================
 * Types
 * ========================================================================== */

type SettingsScope = "GLOBAL" | "BRANCH" | "SUBBRANCH";

type BranchRow = {
  id?: string;
  _id?: string;
  name?: string;
};

type SettingsDoc = {
  _id?: string;

  scope: SettingsScope;
  branchId?: any | null;
  subBranchId?: any | null;

  businessName?: string;
  currency?: "ARS" | "USD";
  timezone?: string;

  trackStock?: boolean;
  allowNegativeStock?: boolean;
  stockAlertDays?: number;

  allowManualDiscount?: boolean;
  paymentMethods?: string[];

  allowUserRegister?: boolean;
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

function safeNum(v: any, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

const DEFAULTS: SettingsDoc = {
  scope: "GLOBAL",
  businessName: "Mi Negocio",
  currency: "ARS",
  timezone: "America/Argentina/Buenos_Aires",
  trackStock: true,
  allowNegativeStock: false,
  stockAlertDays: 5,
  allowManualDiscount: true,
  paymentMethods: ["CASH", "TRANSFER", "CARD"],
  allowUserRegister: false,
};

/* =============================================================================
 * Page
 * ========================================================================== */

export default function AdminSettingsPage() {
  const { getAccessToken } = useAuth();

  const [scope, setScope] = useState<SettingsScope>("GLOBAL");
  const [branches, setBranches] = useState<BranchRow[]>([]);
  const [branchId, setBranchId] = useState<string>("");
  const [subBranchId, setSubBranchId] = useState<string>("");

  const [data, setData] = useState<SettingsDoc | null>(null);
  const [effective, setEffective] = useState<SettingsDoc | null>(null);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [viewingEffective, setViewingEffective] = useState(false);

  const canPickBranch = scope === "BRANCH" || scope === "SUBBRANCH";
  const canPickSubBranch = scope === "SUBBRANCH";

  /* -------------------------------------------------------------------------
   * Load branches
   * ----------------------------------------------------------------------- */

  useEffect(() => {
    apiFetchAuthed<BranchRow[]>(getAccessToken, "/branches")
      .then((rows) => setBranches(Array.isArray(rows) ? rows : []))
      .catch(() => setBranches([]));
  }, [getAccessToken]);

  const branchOptions = useMemo(() => {
    return branches
      .map((b) => ({
        id: pickId(b),
        label: b?.name ? `${b.name} (${pickId(b)})` : pickId(b),
      }))
      .filter((x) => x.id);
  }, [branches]);

  /* -------------------------------------------------------------------------
   * Load settings for selected scope (edit mode)
   * ----------------------------------------------------------------------- */

  async function loadEditable() {
    setLoading(true);
    setEffective(null);

    try {
      if (scope === "GLOBAL") {
        const global = await apiFetchAuthed<SettingsDoc>(
          getAccessToken,
          "/admin/settings/global"
        );
        setData({ ...DEFAULTS, ...global, scope: "GLOBAL" });
        return;
      }

      const qs = new URLSearchParams();
      if (branchId) qs.set("branchId", branchId);
      if (canPickSubBranch && subBranchId) qs.set("subBranchId", subBranchId);

      const eff = await apiFetchAuthed<SettingsDoc>(
        getAccessToken,
        `/admin/settings/effective?${qs.toString()}`
      );

      setData({
        ...DEFAULTS,
        ...eff,
        scope,
      });
    } catch {
      setData({ ...DEFAULTS, scope });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (canPickBranch && !branchId) {
      setData(null);
      setEffective(null);
      return;
    }

    loadEditable();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, branchId, subBranchId, getAccessToken]);

  /* -------------------------------------------------------------------------
   * Mutations
   * ----------------------------------------------------------------------- */

  function update(key: keyof SettingsDoc, value: any) {
    setData((d) => (d ? { ...d, [key]: value } : d));
  }

  async function save() {
    if (!data) return;
    if (canPickBranch && !branchId) return;

    setSaving(true);
    try {
      await apiFetchAuthed(getAccessToken, "/admin/settings/scope", {
        method: "PATCH",
        body: JSON.stringify({
          scope,
          branchId: canPickBranch ? branchId : null,
          subBranchId: canPickSubBranch ? subBranchId || null : null,
          data: {
            businessName: data.businessName,
            currency: data.currency,
            timezone: data.timezone,
            trackStock: data.trackStock,
            allowNegativeStock: data.allowNegativeStock,
            stockAlertDays: data.stockAlertDays,
            allowManualDiscount: data.allowManualDiscount,
            paymentMethods: data.paymentMethods,
            allowUserRegister: data.allowUserRegister,
          },
        }),
      });

      await loadEditable();
    } finally {
      setSaving(false);
    }
  }

  async function viewEffective() {
    if (scope === "GLOBAL") {
      setEffective(data);
      return;
    }
    if (!branchId) return;

    setViewingEffective(true);
    try {
      const qs = new URLSearchParams();
      qs.set("branchId", branchId);
      if (canPickSubBranch && subBranchId) qs.set("subBranchId", subBranchId);

      const eff = await apiFetchAuthed<SettingsDoc>(
        getAccessToken,
        `/admin/settings/effective?${qs.toString()}`
      );
      setEffective(eff);
    } finally {
      setViewingEffective(false);
    }
  }

  /* -------------------------------------------------------------------------
   * UI
   * ----------------------------------------------------------------------- */

  return (
    <AdminProtected>
      <div className="space-y-6 max-w-4xl">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl border bg-white flex items-center justify-center">
            <SettingsIcon className="h-5 w-5" />
          </div>

          <div className="flex-1">
            <h1 className="text-xl font-semibold">Admin / Settings</h1>
            <p className="text-sm text-neutral-500">
              Configuración global y por sucursal / sub-sucursal
            </p>
          </div>

          <Button variant="secondary" onClick={loadEditable} disabled={loading}>
            <RefreshCcw className="h-4 w-4 mr-2" />
            Recargar
          </Button>

          <Button onClick={save} disabled={saving || loading || !data}>
            <Save className="h-4 w-4 mr-2" />
            Guardar
          </Button>
        </div>
 {/* Scope picker */}
        <Card>
          <CardHeader title="Contexto (Scope)" />
          <CardBody>
            <Field label="Scope">
              <Select
                value={scope}
                onChange={(e) => {
                  const next = e.target.value as SettingsScope;
                  setScope(next);
                  setEffective(null);
                }}
              >
                <option value="GLOBAL">GLOBAL</option>
                <option value="BRANCH">BRANCH</option>
                <option value="SUBBRANCH">SUBBRANCH</option>
              </Select>
            </Field>

            <Field label="Branch" >
              <Select
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                disabled={!canPickBranch}
              >
                <option value="">{canPickBranch ? "Seleccionar..." : "—"}</option>
                {branchOptions.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="SubBranch"
            >
              <Input
                value={subBranchId}
                onChange={(e) => setSubBranchId(e.target.value)}
                placeholder={canPickSubBranch ? "Pegá el subBranchId..." : "—"}
                disabled={!canPickSubBranch}
              />
            </Field>

            <div className="md:col-span-3 flex justify-end">
              <Button
                variant="secondary"
                onClick={viewEffective}
                disabled={viewingEffective || loading || (!data && scope === "GLOBAL")}
              >
                <Eye className="h-4 w-4 mr-2" />
                Ver settings efectivos
              </Button>
            </div>
          </CardBody>
        </Card>

        {/* Editable settings */}
        <Card>
          <CardHeader title="Configuración" />
          <CardBody>
            {!data ? (
              <div className="text-sm text-neutral-500">
                {canPickBranch && !branchId
                  ? "Seleccioná una sucursal para editar settings en este scope."
                  : "Cargando..."}
              </div>
            ) : (
              <>
                {/* GENERAL */}
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="md:col-span-3">
                    <h3 className="text-sm font-semibold text-neutral-700">
                      General
                    </h3>
                  </div>

                  <Field label="Nombre del negocio">
                    <Input
                      value={data.businessName ?? ""}
                      onChange={(e) => update("businessName", e.target.value)}
                    />
                  </Field>

                  <Field label="Moneda">
                    <Select
                      value={data.currency ?? "ARS"}
                      onChange={(e) => update("currency", e.target.value)}
                    >
                      <option value="ARS">ARS</option>
                      <option value="USD">USD</option>
                    </Select>
                  </Field>

                  <Field label="Timezone">
                    <Input
                      value={data.timezone ?? ""}
                      onChange={(e) => update("timezone", e.target.value)}
                    />
                  </Field>
                </div>

                {/* STOCK */}
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="md:col-span-3">
                    <h3 className="text-sm font-semibold text-neutral-700">
                      Stock
                    </h3>
                  </div>

                  <Field label="Controlar stock">
                    <Select
                      value={String(!!data.trackStock)}
                      onChange={(e) =>
                        update("trackStock", safeBool(e.target.value, true))
                      }
                    >
                      <option value="true">Sí</option>
                      <option value="false">No</option>
                    </Select>
                  </Field>

                  <Field label="Permitir stock negativo">
                    <Select
                      value={String(!!data.allowNegativeStock)}
                      onChange={(e) =>
                        update("allowNegativeStock", safeBool(e.target.value, false))
                      }
                    >
                      <option value="false">No</option>
                      <option value="true">Sí</option>
                    </Select>
                  </Field>

                  <Field label="Días alerta stock">
                    <Input
                      type="number"
                      value={String(data.stockAlertDays ?? 5)}
                      onChange={(e) =>
                        update("stockAlertDays", safeNum(e.target.value, 5))
                      }
                    />
                  </Field>
                </div>

                {/* POS */}
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="md:col-span-3">
                    <h3 className="text-sm font-semibold text-neutral-700">
                      POS / Ventas
                    </h3>
                  </div>

                  <Field label="Permitir descuento manual">
                    <Select
                      value={String(!!data.allowManualDiscount)}
                      onChange={(e) =>
                        update("allowManualDiscount", safeBool(e.target.value, true))
                      }
                    >
                      <option value="true">Sí</option>
                      <option value="false">No</option>
                    </Select>
                  </Field>

                  <Field label="Métodos de pago (CSV)">
                    <Input
                      value={(data.paymentMethods ?? []).join(",")}
                      onChange={(e) =>
                        update(
                          "paymentMethods",
                          e.target.value
                            .split(",")
                            .map((s) => s.trim())
                            .filter(Boolean)
                        )
                      }
                      placeholder="CASH, TRANSFER, CARD"
                    />
                  </Field>
                </div>

                {/* USERS */}
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="md:col-span-3">
                    <h3 className="text-sm font-semibold text-neutral-700">
                      Usuarios
                    </h3>
                  </div>

                  <Field label="Permitir registro de usuarios">
                    <Select
                      value={String(!!data.allowUserRegister)}
                      onChange={(e) =>
                        update("allowUserRegister", safeBool(e.target.value, false))
                      }
                    >
                      <option value="false">No</option>
                      <option value="true">Sí</option>
                    </Select>
                  </Field>
                </div>
              </>
            )}
          </CardBody>
        </Card>

        {/* Effective preview */}
        <Card>
          <CardHeader title="Preview: Settings efectivos" />
          <CardBody>
            {!effective ? (
              <div className="text-sm text-neutral-500">
                Tocá “Ver settings efectivos” para ver el resultado final con
                fallback (GLOBAL → BRANCH → SUBBRANCH).
              </div>
            ) : (
              <pre className="text-xs bg-neutral-50 border rounded-2xl p-4 overflow-auto">
                {JSON.stringify(effective, null, 2)}
              </pre>
            )}
          </CardBody>
        </Card>
      </div>
    </AdminProtected>
  );
}
