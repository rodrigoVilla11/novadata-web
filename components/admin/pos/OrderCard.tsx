"use client";

import React from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Field";
import { MapPin, Phone, User } from "lucide-react";
import { CustomerSnapshot, Fulfillment } from "@/lib/adminPos/types";
import { cn } from "@/lib/adminOrders/helpers";

export default function OrderCard({
  canUsePos,
  busy,
  fulfillment,
  setFulfillment,
  customerSnapshot,
  setCustomerSnapshot,
  deliveryNeedsData,
  customerId,
  setCustomerId,
}: {
  canUsePos: boolean;
  busy: boolean;
  fulfillment: Fulfillment;
  setFulfillment: (v: Fulfillment) => void;
  customerSnapshot: CustomerSnapshot;
  setCustomerSnapshot: React.Dispatch<React.SetStateAction<CustomerSnapshot>>;
  deliveryNeedsData: boolean;
  customerId: string;
  setCustomerId: (v: string) => void;
}) {
  return (
    <Card>
      <CardHeader
        title="Pedido"
        subtitle="Tipo + datos rápidos del cliente (snapshot)"
      />
      <CardBody>
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <Field label="Tipo">
              <Select
                value={fulfillment}
                onChange={(e) => setFulfillment(e.target.value as Fulfillment)}
                disabled={!canUsePos || busy}
              >
                <option value="DINE_IN">Salón</option>
                <option value="TAKEAWAY">Take-away</option>
                <option value="DELIVERY">Delivery</option>
              </Select>
            </Field>

            <div className="mt-3 text-xs text-zinc-500">
              Reglas:
              <ul className="mt-1 list-disc pl-4 space-y-1">
                <li>Crear pedido: no requiere pagos.</li>
                <li>Delivery: nombre + dirección requeridos.</li>
                <li>Cobrar: pagos deben cubrir el total.</li>
              </ul>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Nombre (rápido)">
                <div className="relative">
                  <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                  <Input
                    className="pl-9"
                    value={String(customerSnapshot.name ?? "")}
                    onChange={(e) =>
                      setCustomerSnapshot((p) => ({ ...p, name: e.target.value }))
                    }
                    placeholder="Ej: Rodrigo"
                    disabled={!canUsePos || busy}
                  />
                </div>
              </Field>

              <Field label="Teléfono (rápido)">
                <div className="relative">
                  <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                  <Input
                    className="pl-9"
                    value={String(customerSnapshot.phone ?? "")}
                    onChange={(e) =>
                      setCustomerSnapshot((p) => ({ ...p, phone: e.target.value }))
                    }
                    placeholder="Ej: 351..."
                    disabled={!canUsePos || busy}
                  />
                </div>
              </Field>
            </div>

            {fulfillment === "DELIVERY" && (
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <Field label="Dirección (requerido para delivery)">
                  <div className="relative">
                    <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                    <Input
                      className={cn("pl-9", deliveryNeedsData && "ring-1 ring-rose-200")}
                      value={String(customerSnapshot.addressLine1 ?? "")}
                      onChange={(e) =>
                        setCustomerSnapshot((p) => ({
                          ...p,
                          addressLine1: e.target.value,
                        }))
                      }
                      placeholder="Calle y número"
                      disabled={!canUsePos || busy}
                    />
                  </div>
                  {deliveryNeedsData && (
                    <div className="mt-1 text-xs text-rose-700">
                      Necesario para crear/cobrar delivery.
                    </div>
                  )}
                </Field>

                <Field label="Piso / Depto / Referencia">
                  <Input
                    value={String(customerSnapshot.addressLine2 ?? "")}
                    onChange={(e) =>
                      setCustomerSnapshot((p) => ({
                        ...p,
                        addressLine2: e.target.value,
                      }))
                    }
                    placeholder="Opcional"
                    disabled={!canUsePos || busy}
                  />
                </Field>

                <div className="md:col-span-2">
                  <Field label="Notas (delivery)">
                    <Input
                      value={String(customerSnapshot.notes ?? "")}
                      onChange={(e) =>
                        setCustomerSnapshot((p) => ({ ...p, notes: e.target.value }))
                      }
                      placeholder="Ej: timbre roto / dejar en portería…"
                      disabled={!canUsePos || busy}
                    />
                  </Field>
                </div>
              </div>
            )}

            <div className="mt-4">
              <Field label="CustomerId (DB) opcional">
                <Input
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  placeholder="ObjectId si querés vincular a Customer existente"
                  disabled={!canUsePos || busy}
                />
              </Field>
            </div>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
