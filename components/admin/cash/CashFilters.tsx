"use client";

import React, { useMemo, useState } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Field";
import {
  Eye,
  EyeOff,
  Filter,
  Search,
  X,
  ChevronDown,
  RotateCcw,
} from "lucide-react";
import type { CashMovement, FinanceCategory } from "@/lib/adminCash/types";
import { cn, moneyARS } from "@/lib/adminCash/cashUtils";

export default function CashFilters({
  q,
  setQ,
  filterType,
  setFilterType,
  filterMethod,
  setFilterMethod,
  filterCategory,
  setFilterCategory,
  showVoided,
  setShowVoided,
  activeCategories,
  filteredCount,
  filteredNet,
}: {
  q: string;
  setQ: (v: string) => void;
  filterType: "" | CashMovement["type"];
  setFilterType: (v: "" | CashMovement["type"]) => void;
  filterMethod: "" | CashMovement["method"];
  setFilterMethod: (v: "" | CashMovement["method"]) => void;
  filterCategory: string;
  setFilterCategory: (v: string) => void;
  showVoided: boolean;
  setShowVoided: (v: boolean) => void;
  activeCategories: FinanceCategory[];
  filteredCount: number;
  filteredNet: number;
}) {
  // Colapsable en mobile (mejor uso de espacio)
  const [openMobile, setOpenMobile] = useState(false);

  const hasFilters = useMemo(() => {
    return (
      !!q.trim() ||
      !!filterType ||
      !!filterMethod ||
      !!filterCategory ||
      showVoided
    );
  }, [q, filterType, filterMethod, filterCategory, showVoided]);

  const canClear = hasFilters;

  const netTone =
    filteredNet === 0
      ? "text-zinc-900"
      : filteredNet > 0
      ? "text-emerald-700"
      : "text-rose-700";

  const clearAll = () => {
    setQ("");
    setFilterType("");
    setFilterMethod("");
    setFilterCategory("");
    setShowVoided(false);
  };

  const summaryPill = (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-2xl border px-3 py-2",
        hasFilters
          ? "border-zinc-200 bg-white"
          : "border-zinc-200 bg-zinc-50"
      )}
    >
      <span className="inline-flex items-center gap-2 text-sm text-zinc-700">
        <Filter className="h-4 w-4 text-zinc-500" />
        <span className="font-semibold">{filteredCount}</span>
        <span className="text-zinc-500">mov.</span>
      </span>

      <span className={cn("text-sm font-semibold", netTone)}>
        Neto: {moneyARS(filteredNet)}
      </span>
    </div>
  );

  return (
    <Card>
      <CardHeader title="Filtros" subtitle="Encontrá movimientos rápido" />

      <CardBody>
        {/* Top row: resumen + acciones (mobile primero) */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          {summaryPill}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowVoided(!showVoided)}
              className={cn(
                "h-10 flex-1 sm:flex-none rounded-2xl border px-3 text-sm font-semibold inline-flex items-center justify-center gap-2 transition",
                showVoided
                  ? "border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50"
                  : "border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100"
              )}
              aria-pressed={showVoided}
              title={showVoided ? "Se muestran anulados" : "Se ocultan anulados"}
            >
              {showVoided ? (
                <Eye className="h-4 w-4" />
              ) : (
                <EyeOff className="h-4 w-4" />
              )}
              <span className="hidden xs:inline">
                {showVoided ? "Anulados: ON" : "Anulados: OFF"}
              </span>
              <span className="xs:hidden">
                {showVoided ? "ON" : "OFF"}
              </span>
            </button>

            <button
              type="button"
              onClick={clearAll}
              disabled={!canClear}
              className={cn(
                "h-10 flex-1 sm:flex-none rounded-2xl border px-3 text-sm font-semibold inline-flex items-center justify-center gap-2 transition",
                canClear
                  ? "border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50"
                  : "border-zinc-200 bg-zinc-50 text-zinc-400 cursor-not-allowed"
              )}
              title="Volver a valores por defecto"
            >
              <RotateCcw className="h-4 w-4" />
              <span className="hidden sm:inline">Limpiar</span>
              <span className="sm:hidden">Reset</span>
            </button>

            {/* Toggle filtros en mobile */}
            <button
              type="button"
              onClick={() => setOpenMobile((v) => !v)}
              className={cn(
                "h-10 sm:hidden rounded-2xl border border-zinc-200 bg-white px-3 text-sm font-semibold inline-flex items-center justify-center gap-2 hover:bg-zinc-50 transition"
              )}
              aria-expanded={openMobile}
              aria-controls="cash-filters-panel"
              title="Mostrar/ocultar filtros"
            >
              <span>Filtros</span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform",
                  openMobile ? "rotate-180" : "rotate-0"
                )}
              />
            </button>
          </div>
        </div>

        {/* Panel filtros: siempre visible en >=sm, colapsable en mobile */}
        <div
          id="cash-filters-panel"
          className={cn(
            "mt-3",
            "sm:block",
            openMobile ? "block" : "hidden"
          )}
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-12">
            {/* Buscar ocupa más */}
            <div className="lg:col-span-5">
              <Field label="Buscar">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                  <Input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Concepto, nota, categoría…"
                    className="pl-9 pr-10"
                    inputMode="search"
                  />
                  {!!q.trim() && (
                    <button
                      type="button"
                      onClick={() => setQ("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl border border-zinc-200 bg-white p-1.5 text-zinc-700 hover:bg-zinc-50"
                      title="Limpiar búsqueda"
                      aria-label="Limpiar búsqueda"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                {!hasFilters ? (
                  <div className="mt-1 text-[11px] text-zinc-500">
                    Tip: buscá por nota o concepto (ej: “alquiler”, “caja”, “proveedor”).
                  </div>
                ) : null}
              </Field>
            </div>

            <div className="lg:col-span-2">
              <Field label="Tipo">
                <Select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as any)}
                >
                  <option value="">Todos</option>
                  <option value="INCOME">Ingreso</option>
                  <option value="EXPENSE">Egreso</option>
                </Select>
              </Field>
            </div>

            <div className="lg:col-span-2">
              <Field label="Método">
                <Select
                  value={filterMethod}
                  onChange={(e) => setFilterMethod(e.target.value as any)}
                >
                  <option value="">Todos</option>
                  <option value="CASH">Efectivo</option>
                  <option value="TRANSFER">Transferencia</option>
                  <option value="CARD">Tarjeta</option>
                  <option value="OTHER">Otro</option>
                </Select>
              </Field>
            </div>

            <div className="lg:col-span-3">
              <Field label="Categoría">
                <Select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                >
                  <option value="">Todas</option>
                  {activeCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>

                {activeCategories.length === 0 ? (
                  <div className="mt-1 text-xs text-zinc-500">
                    No hay categorías activas.
                  </div>
                ) : null}
              </Field>
            </div>
          </div>

          {/* Chips/resumen de filtros activos */}
          {hasFilters ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {!!q.trim() && (
                <span className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs text-zinc-700">
                  Buscar: <span className="font-semibold">{q.trim()}</span>
                  <button
                    type="button"
                    onClick={() => setQ("")}
                    className="rounded-full p-0.5 hover:bg-zinc-50"
                    aria-label="Quitar búsqueda"
                    title="Quitar búsqueda"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              )}

              {!!filterType && (
                <span className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs text-zinc-700">
                  Tipo:{" "}
                  <span className="font-semibold">
                    {filterType === "INCOME" ? "Ingreso" : "Egreso"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setFilterType("")}
                    className="rounded-full p-0.5 hover:bg-zinc-50"
                    aria-label="Quitar tipo"
                    title="Quitar tipo"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              )}

              {!!filterMethod && (
                <span className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs text-zinc-700">
                  Método:{" "}
                  <span className="font-semibold">
                    {filterMethod === "CASH"
                      ? "Efectivo"
                      : filterMethod === "TRANSFER"
                      ? "Transferencia"
                      : filterMethod === "CARD"
                      ? "Tarjeta"
                      : "Otro"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setFilterMethod("")}
                    className="rounded-full p-0.5 hover:bg-zinc-50"
                    aria-label="Quitar método"
                    title="Quitar método"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              )}

              {!!filterCategory && (
                <span className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs text-zinc-700">
                  Categoría
                  <button
                    type="button"
                    onClick={() => setFilterCategory("")}
                    className="rounded-full p-0.5 hover:bg-zinc-50"
                    aria-label="Quitar categoría"
                    title="Quitar categoría"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              )}

              {showVoided && (
                <span className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs text-zinc-700">
                  Anulados: <span className="font-semibold">ON</span>
                  <button
                    type="button"
                    onClick={() => setShowVoided(false)}
                    className="rounded-full p-0.5 hover:bg-zinc-50"
                    aria-label="Ocultar anulados"
                    title="Ocultar anulados"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              )}
            </div>
          ) : null}
        </div>
      </CardBody>
    </Card>
  );
}
