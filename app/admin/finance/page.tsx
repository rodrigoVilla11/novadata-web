"use client";

import React from "react";
import Link from "next/link";
import { AdminProtected } from "@/components/AdminProtected";
import { Card, CardBody } from "@/components/ui/Card";
import { ArrowRight, FolderTree, Wallet, BarChart3, ArrowLeftRight } from "lucide-react";

function ItemCard({
  href,
  title,
  description,
  icon: Icon,
}: {
  href: string;
  title: string;
  description: string;
  icon: React.ElementType;
}) {
  return (
    <Link href={href} className="group block">
      <div className="h-full rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:shadow-md hover:border-zinc-300">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-700 transition group-hover:bg-zinc-200">
              <Icon className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-zinc-900">
                {title}
              </h3>
              <p className="mt-0.5 text-sm text-zinc-500">
                {description}
              </p>
            </div>
          </div>

          <ArrowRight className="mt-1 h-5 w-5 text-zinc-400 transition group-hover:translate-x-0.5" />
        </div>
      </div>
    </Link>
  );
}

export default function FinancePage() {
  return (
    <AdminProtected>
      <div className="space-y-6">
        {/* Header */}
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            Finance
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Configuración base del módulo financiero. Categorías, cuentas y
            análisis.
          </p>
        </div>

        {/* Main grid */}
        <Card>
          <CardBody>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <ItemCard
                href="/admin/finance/categories"
                title="Categorías"
                description="Ingresos / Egresos y jerarquía padre-hijo."
                icon={FolderTree}
              />

              <ItemCard
                href="/admin/finance/accounts"
                title="Cuentas"
                description="Efectivo, banco y billeteras con saldo inicial."
                icon={Wallet}
              />

              <ItemCard
                href="/admin/finance/movements"
                title="Movimientos"
                description="Ingresos y egresos asociados a cuentas y categorías."
                icon={ArrowLeftRight}
              />

              <ItemCard
                href="/admin/finance/stats"
                title="Estadísticas"
                description="Resumen visual de ingresos, egresos y balances."
                icon={BarChart3}
              />

              <ItemCard
                href="/admin/finance/transfer"
                title="Transferencias"
                description="Mover dinero entre tus distintas cuentas."
                icon={Wallet}
              />
            </div>
          </CardBody>
        </Card>
      </div>
    </AdminProtected>
  );
}
