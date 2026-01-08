"use client";

import Link from "next/link";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Store, Shield } from "lucide-react";

export default function SuperAdminHomePage() {
  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <div className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1 text-xs font-semibold text-zinc-700">
          <Shield className="h-3.5 w-3.5" />
          SUPERADMIN
        </div>

        <h1 className="mt-3 text-xl font-semibold">SuperAdmin</h1>
        <p className="text-sm text-neutral-500">
          Gestión global del sistema (planes, sucursales y configuración por
          branch).
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Link href="/superadmin/branches" className="block">
          <Card >
            <CardHeader title="Sucursales (Branches)" />
            <CardBody>
              <Store className="h-5 w-5 mt-0.5" />
              <div>
                <div className="font-medium text-neutral-800">
                  Administrar sucursales
                </div>
                <div className="text-neutral-500">
                  Crear, editar, desactivar y administrar planes por sucursal.
                </div>
              </div>
            </CardBody>
          </Card>
        </Link>
      </div>
    </div>
  );
}
