"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Protected } from "@/components/Protected";
import { useAuth } from "@/app/providers/AuthProvider";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";

function hasRole(user: any, role: string) {
  return Array.isArray(user?.roles) && user.roles.includes(role);
}

function getHomeByRole(user: any) {
  const isAdmin = hasRole(user, "ADMIN");
  const isManager = hasRole(user, "MANAGER");
  const isCashier = hasRole(user, "CASHIER");

  if (isAdmin) return "/admin";
  if (isManager) return "/manager";
  if (isCashier) return "/cashier";
  return "/user";
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, logout } = useAuth();

  const isAdmin = hasRole(user, "ADMIN");
  const isManager = hasRole(user, "MANAGER");
  const isUser = !!user;

  const canSeeAdmin = isAdmin;
  const canSeeManager = isAdmin || isManager;
  const canSeeUserPanel = isUser;

  const home = useMemo(() => (user ? getHomeByRole(user) : null), [user]);

  // ✅ Redirect automático al "home" según rol
  useEffect(() => {
    if (!user) return;
    router.replace(home!);
  }, [user, home, router]);

  return (
    <Protected>
      <div className="min-h-screen bg-zinc-50">
        <div className="mx-auto max-w-5xl px-4 py-8">
          {/* Fallback mientras redirige */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="text-sm text-zinc-500">Redirigiendo…</div>
            <div className="mt-2 text-lg font-semibold text-zinc-900">
              {user?.email}
            </div>
            <div className="mt-1 text-xs text-zinc-500">
              Roles: <span className="font-medium">{user?.roles?.join(", ")}</span>
            </div>

            {/* Por si querés dejar accesos manuales si algo falla */}
            <div className="mt-4 flex flex-wrap gap-2">
              {canSeeUserPanel && (
                <Link href="/user">
                  <Button variant="secondary">Mi Panel</Button>
                </Link>
              )}

              {canSeeManager && (
                <>
                  <Link href="/manager">
                    <Button variant="secondary">Panel Manager</Button>
                  </Link>
                  <Link href="/manager/attendance">
                    <Button variant="secondary">Asistencia</Button>
                  </Link>
                  <Link href="/manager/production">
                    <Button variant="secondary">Producción</Button>
                  </Link>
                </>
              )}

              <Link href="/stock">
                <Button variant="secondary">Conteo de stock</Button>
              </Link>

              {canSeeAdmin && (
                <>
                  <Link href="/admin">
                    <Button variant="secondary">Admin Home</Button>
                  </Link>
                  <Link href="/admin/users">
                    <Button variant="secondary">Admin Usuarios</Button>
                  </Link>
                </>
              )}

              <Button variant="danger" onClick={logout}>
                Logout
              </Button>
            </div>
          </div>

          {/* Si querés, podés dejar esto como “Dashboard fallback”,
              pero con redirect casi nunca se va a ver. */}
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader title="Sesión" subtitle="Datos del usuario" />
              <CardBody>
                <div className="grid gap-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Email</span>
                    <span className="font-medium text-zinc-900">{user?.email}</span>
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
              <CardHeader title="Destino" subtitle="Home según rol" />
              <CardBody>
                <div className="text-sm text-zinc-700">
                  Te llevamos a:{" "}
                  <span className="font-semibold text-zinc-900">{home ?? "—"}</span>
                </div>
              </CardBody>
            </Card>
          </div>
        </div>
      </div>
    </Protected>
  );
}
