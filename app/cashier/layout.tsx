import React from "react";
import CashierShell from "@/components/cashier/CashierShell";
import { AdminProtected } from "@/components/AdminProtected";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cashier • Panel",
  description: "Panel de caja: carga diaria, movimientos y cierre.",
};

export default function CashierLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminProtected allow={["ADMIN", "CASHIER"]}>
      <CashierShell>{children}</CashierShell>
    </AdminProtected>
  );
}
