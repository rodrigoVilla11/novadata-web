import React from "react";
import ManagerShell from "@/components/manager/ManagerShell";
import { AdminProtected } from "@/components/AdminProtected";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Manager",
  description: "Panel de gestión para managers",
  robots: {
    index: false,
    follow: false,
  },
};
export default function ManagerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminProtected allow={["ADMIN", "MANAGER"]}>
      <ManagerShell>{children}</ManagerShell>
    </AdminProtected>
  );
}
