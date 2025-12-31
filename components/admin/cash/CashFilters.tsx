"use client";

import React from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Field";
import { Eye, EyeOff, Filter, Search } from "lucide-react";
import { CashMovement, FinanceCategory } from "@/lib/adminCash/types";
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
  return (
    <Card>
      <CardHeader title="Filtros" subtitle="Encontrá movimientos rápido" />
      <CardBody>
        <div className="grid gap-3 md:grid-cols-6">
          <Field label="Buscar">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Concepto, nota, categoría…"
                className="pl-9"
              />
            </div>
          </Field>

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
          </Field>

          <Field label="Anulados">
            <button
              type="button"
              className={cn(
                "h-10 rounded-xl border px-3 text-sm font-semibold inline-flex items-center justify-center gap-2 w-full",
                showVoided
                  ? "border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50"
                  : "border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100"
              )}
              onClick={() => setShowVoided(!showVoided)}
            >
              {showVoided ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              {showVoided ? "Mostrar" : "Ocultar"}
            </button>
          </Field>

          <Field label="Resumen filtros">
            <div className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-xs flex items-center justify-between">
              <span className="inline-flex items-center gap-2 text-zinc-600">
                <Filter className="h-4 w-4" />
                {filteredCount} mov.
              </span>
              <span className="font-semibold text-zinc-900">
                Neto: {moneyARS(filteredNet)}
              </span>
            </div>
          </Field>
        </div>
      </CardBody>
    </Card>
  );
}
