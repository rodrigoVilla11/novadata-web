"use client";

import Link from "next/link";
import { Protected } from "@/components/Protected";
import { useAuth } from "@/app/providers/AuthProvider";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const isAdmin = user?.roles?.includes("ADMIN");

  return (
    <Protected>
      <div className="min-h-screen bg-zinc-50">
        <div className="mx-auto max-w-5xl px-4 py-8">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-zinc-900">Dashboard</h1>
              <p className="mt-1 text-sm text-zinc-500">
                Bienvenido,{" "}
                <span className="font-medium text-zinc-800">{user?.email}</span>
              </p>
            </div>

            <div className="flex gap-2">
              {isAdmin && (
                <>
                  <Link href="/admin/users">
                    <Button variant="secondary">Admin Usuarios</Button>
                  </Link>
                  <Link href="/admin/suppliers">
                    <Button variant="secondary">Admin Proveedores</Button>
                  </Link>

                  <Link href="/admin/products">
                    <Button variant="secondary">Admin Productos</Button>
                  </Link>
                </>
              )}
              <Link href="/stock">
                <Button variant="secondary">Conteo de stock</Button>
              </Link>
              <Button variant="danger" onClick={logout}>
                Logout
              </Button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader
                title="Sesión"
                subtitle="Datos básicos del usuario autenticado"
              />
              <CardBody>
                <div className="grid gap-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Email</span>
                    <span className="font-medium text-zinc-900">
                      {user?.email}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Roles</span>
                    <span className="font-medium text-zinc-900">
                      {user?.roles?.join(", ")}
                    </span>
                  </div>
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader
                title="Próximos pasos"
                subtitle="Features que suman rápido"
              />
              <CardBody>
                <ul className="list-disc space-y-2 pl-5 text-sm text-zinc-700">
                  <li>Middleware para proteger rutas server-side</li>
                  <li>CRUD de usuarios: reset password / desactivar</li>
                  <li>Auditoría: quién cambió roles y cuándo</li>
                </ul>
              </CardBody>
            </Card>
          </div>
        </div>
      </div>
    </Protected>
  );
}
