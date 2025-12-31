"use client";

import React from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { PlusCircle, Search } from "lucide-react";
import { Product } from "@/lib/adminPos/types";
import { getUnitPrice, moneyARS } from "@/lib/adminOrders/helpers";

export default function ProductsCard({
  canUsePos,
  busy,
  q,
  setQ,
  products,
  loadingProducts,
  onSearchClick,
  onSearchKeyDown,
  onAddToCart,
}: {
  canUsePos: boolean;
  busy: boolean;
  q: string;
  setQ: (v: string) => void;
  products: Product[];
  loadingProducts: boolean;
  onSearchClick: () => void;
  onSearchKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onAddToCart: (p: Product) => void;
}) {
  return (
    <Card>
      <CardHeader title="Productos" subtitle="Buscar y agregar al carrito" />
      <CardBody>
        <div className="flex gap-2">
          <div className="flex-1">
            <Field label="Buscar">
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={onSearchKeyDown}
                placeholder="Ej: sushi burger, combo, bebida… (Enter agrega el 1°)"
                disabled={!canUsePos || busy}
              />
            </Field>
          </div>
          <div className="mt-6">
            <Button
              variant="secondary"
              onClick={onSearchClick}
              disabled={!canUsePos || busy}
            >
              <Search className="h-4 w-4" />
              Buscar
            </Button>
          </div>
        </div>

        <div className="mt-4 max-h-[420px] overflow-auto pr-1 space-y-2">
          {loadingProducts ? (
            <div className="text-sm text-zinc-500">Buscando…</div>
          ) : products.length === 0 ? (
            <div className="text-sm text-zinc-500">Sin resultados.</div>
          ) : (
            products.map((p) => {
              const price = getUnitPrice(p);
              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-zinc-900 truncate">
                      {p.name}
                    </div>
                    <div className="text-xs text-zinc-500">
                      Precio: <b>{moneyARS(price)}</b>
                    </div>
                  </div>

                  <Button
                    onClick={() => onAddToCart(p)}
                    disabled={!canUsePos || busy}
                    title="Agregar al carrito"
                  >
                    <PlusCircle className="h-4 w-4" />
                    Agregar
                  </Button>
                </div>
              );
            })
          )}
        </div>
      </CardBody>
    </Card>
  );
}
