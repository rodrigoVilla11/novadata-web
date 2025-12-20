import React from "react";
import AdminShell from "@/components/admin/AdminShell";
import { AdminProtected } from "@/components/AdminProtected";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminProtected allow={["ADMIN", "MANAGER"]}>
      <AdminShell>{children}</AdminShell>
    </AdminProtected>
  );
}
