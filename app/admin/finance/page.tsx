"use client";

import React from "react";
import Link from "next/link";
import { AdminProtected } from "@/components/AdminProtected";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ArrowRight, FolderTree, Wallet } from "lucide-react";

export default function FinancePage() {
  return (
    <AdminProtected>
      <div className="p-4 min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="max-w-4xl mx-auto space-y-4">
          <Card>
            <CardHeader
              title="Finance"
              subtitle="Configuración base: categorías y cuentas. Después sumamos movimientos, reportes y cierres."
            />
            <CardBody>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Link href="/admin/finance/categories" className="block">
                  <div className="rounded-2xl border bg-white shadow-sm p-5 hover:shadow-md transition">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-gray-100 flex items-center justify-center">
                          <FolderTree className="w-6 h-6 text-gray-700" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-gray-900">
                            Categorías
                          </h3>
                          <p className="text-sm text-gray-600">
                            Ingresos / Egresos y jerarquía padre-hijo.
                          </p>
                        </div>
                      </div>
                      <ArrowRight className="w-5 h-5 text-gray-400 mt-1" />
                    </div>

                    <div className="mt-4">
                      <Button variant="secondary" className="w-full">
                        Ir a categorías
                      </Button>
                    </div>
                  </div>
                </Link>

                <Link href="/admin/finance/accounts" className="block">
                  <div className="rounded-2xl border bg-white shadow-sm p-5 hover:shadow-md transition">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-gray-100 flex items-center justify-center">
                          <Wallet className="w-6 h-6 text-gray-700" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-gray-900">
                            Cuentas
                          </h3>
                          <p className="text-sm text-gray-600">
                            Efectivo / Banco / Billetera con saldo inicial.
                          </p>
                        </div>
                      </div>
                      <ArrowRight className="w-5 h-5 text-gray-400 mt-1" />
                    </div>

                    <div className="mt-4">
                      <Button variant="secondary" className="w-full">
                        Ir a cuentas
                      </Button>
                    </div>
                  </div>
                </Link>

                <Link href="/admin/finance/movements" className="block">
                  <div className="rounded-2xl border bg-white shadow-sm p-5 hover:shadow-md transition">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-gray-100 flex items-center justify-center">
                          <Wallet className="w-6 h-6 text-gray-700" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-gray-900">
                            Movimientos
                          </h3>
                          <p className="text-sm text-gray-600">
                            Ingresos y egresos asociados a categorías y cuentas.
                          </p>
                        </div>
                      </div>
                      <ArrowRight className="w-5 h-5 text-gray-400 mt-1" />
                    </div>

                    <div className="mt-4">
                      <Button variant="secondary" className="w-full">
                        Ir a movimientos
                      </Button>
                    </div>
                  </div>
                </Link>

                  <Link href="/admin/finance/stats" className="block">
                  <div className="rounded-2xl border bg-white shadow-sm p-5 hover:shadow-md transition">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-gray-100 flex items-center justify-center">
                          <Wallet className="w-6 h-6 text-gray-700" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-gray-900">
                            Estadisticas
                          </h3>
                          <p className="text-sm text-gray-600">
                            Resumen visual de ingresos, egresos y balances.
                          </p>
                        </div>
                      </div>
                      <ArrowRight className="w-5 h-5 text-gray-400 mt-1" />
                    </div>

                    <div className="mt-4">
                      <Button variant="secondary" className="w-full">
                        Ir a estadisticas
                      </Button>
                    </div>
                  </div>
                </Link>

                  <Link href="/admin/finance/transfer" className="block">
                  <div className="rounded-2xl border bg-white shadow-sm p-5 hover:shadow-md transition">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-gray-100 flex items-center justify-center">
                          <Wallet className="w-6 h-6 text-gray-700" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-gray-900">
                            Transferencia entre cuentas
                          </h3>
                          <p className="text-sm text-gray-600">
                            Mover dinero entre tus distintas cuentas.
                          </p>
                        </div>
                      </div>
                      <ArrowRight className="w-5 h-5 text-gray-400 mt-1" />
                    </div>

                    <div className="mt-4">
                      <Button variant="secondary" className="w-full">
                        Ir a Transferencias
                      </Button>
                    </div>
                  </div>
                </Link>
              </div>

              <div className="mt-6 rounded-2xl border bg-white p-4">
                <h4 className="font-semibold text-gray-900">
                  Próximos módulos (después)
                </h4>
                <ul className="mt-2 text-sm text-gray-700 list-disc pl-5 space-y-1">
                  <li>
                    Movimientos (ingresos/egresos) con categorías y cuentas
                  </li>
                  <li>Transferencias entre cuentas</li>
                  <li>Reportes por período / categoría / cuenta</li>
                  <li>Cierres (semanal/mensual) y export</li>
                </ul>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </AdminProtected>
  );
}
