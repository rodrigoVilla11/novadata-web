"use client";

import React, { useMemo, useState } from "react";
import { AdminProtected } from "@/components/AdminProtected";
import { useAuth } from "@/app/providers/AuthProvider";
import { todayKeyArgentina } from "@/lib/adminCash/cashUtils";
import { useCashDay } from "@/lib/adminCash/useCashDay";

import CashHeader from "@/components/admin/cash/CashHeader";
import CashSummaryCards from "@/components/admin/cash/CashSummaryCards";
import CashMovementForm from "@/components/admin/cash/CashMovementForm";
import CashFilters from "@/components/admin/cash/CashFilters";
import CashMovementsTable from "@/components/admin/cash/CashMovementsTable";
import OpenCashModal from "@/components/admin/cash/OpenCashModal";
import CloseCashModal from "@/components/admin/cash/CloseCashModal";
import VoidMovementModal from "@/components/admin/cash/VoidMovementModal";

export default function AdminCashPage() {
  const { getAccessToken, user } = useAuth() as any;

  const roles = useMemo(
    () => (user?.roles ?? []).map((r: any) => String(r).toUpperCase()),
    [user?.roles]
  );
  const isAdmin = roles.includes("ADMIN");

  // ✅ branchId desde JWT/payload
  const branchIdFromUser = useMemo(() => {
    const b = user?.branchId ?? null;
    return b ? String(b) : null;
  }, [user?.branchId]);

  const [dateKey, setDateKey] = useState(todayKeyArgentina());

  /**
   * ✅ Recomendación:
   * - No-admin: branchId = null (NO se manda al backend)
   * - Admin: podés mandar branchId si querés filtrar por sucursal (si luego agregás selector)
   */
  const cash = useCashDay({
    dateKey,
    getAccessToken,
    isAdmin,
    branchId: isAdmin ? branchIdFromUser : null,
  });

  return (
    <AdminProtected>
      <div className="space-y-6">
        <CashHeader
          dateKey={dateKey}
          setDateKey={setDateKey}
          day={cash.day}
          summary={cash.summary}
          loading={cash.loading}
          busy={cash.busy}
          err={cash.err}
          ok={cash.ok}
          onRefresh={cash.refresh}
          onOpenOpeningModal={cash.openOpeningModal}
          onOpenClose={cash.openClose}
        />

        <CashSummaryCards day={cash.day} summary={cash.summary} />

        <CashMovementForm
          canWrite={!!cash.canWrite}
          busy={cash.busy}
          type={cash.type}
          setType={cash.setType}
          method={cash.method}
          setMethod={cash.setMethod}
          amount={cash.amount}
          setAmount={cash.setAmount}
          categoryId={cash.categoryId}
          setCategoryId={cash.setCategoryId}
          concept={cash.concept}
          setConcept={cash.setConcept}
          note={cash.note}
          setNote={cash.setNote}
          activeCategories={cash.activeCategories}
          onCreate={cash.createMovement}
        />

        <CashFilters
          q={cash.q}
          setQ={cash.setQ}
          filterType={cash.filterType}
          setFilterType={cash.setFilterType}
          filterMethod={cash.filterMethod}
          setFilterMethod={cash.setFilterMethod}
          filterCategory={cash.filterCategory}
          setFilterCategory={cash.setFilterCategory}
          showVoided={cash.showVoided}
          setShowVoided={cash.setShowVoided}
          activeCategories={cash.activeCategories}
          filteredCount={cash.filteredMovements.length}
          filteredNet={cash.filteredTotals.net}
        />

        <CashMovementsTable
          loading={cash.loading}
          busy={cash.busy}
          isAdmin={isAdmin}
          canWrite={!!cash.canWrite}
          movementsTotal={cash.movements.length}
          rows={cash.filteredMovements}
          categoryNameById={cash.categoryNameById}
          onVoid={cash.openVoid}
          footerTotals={cash.filteredTotals}
        />
      </div>

      {/* Modals */}
      <OpenCashModal
        open={cash.openOpenModal}
        busy={cash.busy}
        openingCashDraft={cash.openingCashDraft}
        setOpeningCashDraft={cash.setOpeningCashDraft}
        onClose={() => !cash.busy && cash.setOpenOpenModal(false)}
        onConfirm={cash.confirmOpenCashDay}
      />

      <CloseCashModal
        open={cash.openCloseModal}
        busy={cash.busy}
        isAdmin={isAdmin}
        day={cash.day}
        countedCash={cash.countedCash}
        setCountedCash={cash.setCountedCash}
        adminOverride={cash.adminOverride}
        setAdminOverride={cash.setAdminOverride}
        closeNote={cash.closeNote}
        setCloseNote={cash.setCloseNote}
        onClose={() => !cash.busy && cash.setOpenCloseModal(false)}
        onConfirm={cash.confirmCloseCashDay}
      />

      <VoidMovementModal
        open={cash.openVoidModal}
        busy={cash.busy}
        target={cash.voidTarget}
        reason={cash.voidReasonDraft}
        setReason={cash.setVoidReasonDraft}
        onClose={() => !cash.busy && cash.setOpenVoidModal(false)}
        onConfirm={cash.confirmVoidMovement}
      />
    </AdminProtected>
  );
}
