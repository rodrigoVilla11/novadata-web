"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { apiFetchAuthed } from "@/lib/apiAuthed";
import type {
  CashDay,
  CashMovement,
  CashSummary,
  FinanceCategory,
} from "@/lib/adminCash/types";
import { looksForbidden } from "@/lib/adminCash/cashUtils";

type UseCashDayArgs = {
  dateKey: string;
  getAccessToken: () => Promise<string | null>;
  isAdmin: boolean;
  branchId?: string | null; // ✅ NUEVO (si viene, lo usamos)
};

function withBranchQuery(url: string, branchId?: string | null) {
  if (!branchId) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}branchId=${encodeURIComponent(branchId)}`;
}

export function useCashDay({
  dateKey,
  getAccessToken,
  isAdmin,
  branchId,
}: UseCashDayArgs) {
  const [day, setDay] = useState<CashDay | null>(null);
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [summary, setSummary] = useState<CashSummary | null>(null);
  const [categories, setCategories] = useState<FinanceCategory[]>([]);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  // Create movement form
  const [type, setType] = useState<CashMovement["type"]>("INCOME");
  const [method, setMethod] = useState<CashMovement["method"]>("CASH");
  const [amount, setAmount] = useState("0");
  const [categoryId, setCategoryId] = useState<string>("");
  const [concept, setConcept] = useState("");
  const [note, setNote] = useState("");

  // Filters
  const [q, setQ] = useState("");
  const [filterType, setFilterType] = useState<"" | CashMovement["type"]>("");
  const [filterMethod, setFilterMethod] = useState<"" | CashMovement["method"]>(
    ""
  );
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [showVoided, setShowVoided] = useState(true);

  // Modals state
  const [openOpenModal, setOpenOpenModal] = useState(false);
  const [openingCashDraft, setOpeningCashDraft] = useState("0");

  const [openCloseModal, setOpenCloseModal] = useState(false);
  const [countedCash, setCountedCash] = useState("");
  const [adminOverride, setAdminOverride] = useState(false);
  const [closeNote, setCloseNote] = useState("");

  const [openVoidModal, setOpenVoidModal] = useState(false);
  const [voidTarget, setVoidTarget] = useState<CashMovement | null>(null);
  const [voidReasonDraft, setVoidReasonDraft] = useState("");

  // ✅ branch efectiva: solo si viene (normalmente: admin)
  const effectiveBranchId = branchId ? String(branchId) : null;

  const canWrite = useMemo(() => day?.status === "OPEN", [day]);

  const activeCategories = useMemo(
    () => categories.filter((c) => c.isActive !== false),
    [categories]
  );

  const categoryNameById = useMemo(() => {
    const map = new Map<string, string>();
    activeCategories.forEach((c) => map.set(c.id, c.name));
    summary?.byCategory.forEach((c) => map.set(c.categoryId, c.name));
    return map;
  }, [activeCategories, summary]);

  const reqIdRef = useRef(0);

  async function loadCategories() {
    const cats = await apiFetchAuthed<FinanceCategory[]>(
      getAccessToken,
      "/finance/categories"
    );
    setCategories(cats);
  }

  async function ensureDay(): Promise<CashDay> {
    // POST /cash/day/get-or-create  body: { dateKey, branchId? }
    const body: any = { dateKey };
    if (effectiveBranchId) body.branchId = effectiveBranchId;

    const d = await apiFetchAuthed<CashDay>(getAccessToken, "/cash/day/get-or-create", {
      method: "POST",
      body: JSON.stringify(body),
    });

    setDay(d);
    return d;
  }

  async function loadMovements(cashDayId: string) {
    const rows = await apiFetchAuthed<CashMovement[]>(
      getAccessToken,
      `/cash/movements/${encodeURIComponent(cashDayId)}`
    );
    setMovements(rows);
  }

  async function loadSummary() {
    // GET /cash/summary?dateKey=...&branchId=...
    const url = withBranchQuery(
      `/cash/summary?dateKey=${encodeURIComponent(dateKey)}`,
      effectiveBranchId
    );

    const s = await apiFetchAuthed<CashSummary>(getAccessToken, url);
    setSummary(s);
    setDay(s.day);
  }

  async function loadAll({ quiet }: { quiet?: boolean } = {}) {
    const reqId = ++reqIdRef.current;

    setErr(null);
    setOk(null);
    if (!quiet) setLoading(true);

    try {
      await loadCategories();
      const d = await ensureDay();

      await Promise.all([loadMovements(d.id), loadSummary()]);

      if (reqId !== reqIdRef.current) return;

      setOk("Datos actualizados ✔");
      window.setTimeout(() => setOk(null), 1400);
    } catch (e: any) {
      if (reqId !== reqIdRef.current) return;
      const msg = String(e?.message || "Error cargando caja");
      setErr(looksForbidden(msg) ? "Sin permisos para Caja." : msg);
    } finally {
      if (reqId === reqIdRef.current && !quiet) setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateKey, effectiveBranchId]);

  async function refresh() {
    setBusy(true);
    try {
      await loadAll({ quiet: true });
    } finally {
      setBusy(false);
    }
  }

  // Actions
  function openOpeningModal() {
    if (!day) return;
    setOpeningCashDraft(String(day.openingCash ?? 0));
    setOpenOpenModal(true);
  }

  async function confirmOpenCashDay() {
    if (!day) return;

    const n = Number(openingCashDraft);
    if (!Number.isFinite(n) || n < 0) {
      setErr("El efectivo inicial debe ser un número >= 0");
      return;
    }

    setBusy(true);
    setErr(null);
    try {
      const body: any = { dateKey, openingCash: n };
      if (effectiveBranchId) body.branchId = effectiveBranchId;

      await apiFetchAuthed(getAccessToken, "/cash/day/open", {
        method: "POST",
        body: JSON.stringify(body),
      });

      setOpenOpenModal(false);
      await refresh();
      setOk("Apertura actualizada ✔");
      window.setTimeout(() => setOk(null), 1400);
    } catch (e: any) {
      setErr(String(e?.message || "Error abriendo caja"));
    } finally {
      setBusy(false);
    }
  }

  async function createMovement() {
    if (!day) return;
    if (day.status !== "OPEN") {
      setErr("La caja está cerrada.");
      return;
    }

    const n = Number(amount || 0);
    if (!Number.isFinite(n) || n <= 0) {
      setErr("El monto debe ser un número > 0");
      return;
    }

    if (!concept.trim()) {
      setErr("Ingresá un concepto.");
      return;
    }

    setBusy(true);
    setErr(null);

    try {
      await apiFetchAuthed(getAccessToken, "/cash/movement", {
        method: "POST",
        body: JSON.stringify({
          cashDayId: day.id,
          type,
          method,
          amount: n,
          categoryId: categoryId || undefined,
          concept: concept.trim(),
          note: note.trim(),
        }),
      });

      setConcept("");
      setNote("");
      setAmount("0");
      setCategoryId("");

      await refresh();
      setOk("Movimiento creado ✔");
      window.setTimeout(() => setOk(null), 1400);
    } catch (e: any) {
      setErr(String(e?.message || "Error creando movimiento"));
    } finally {
      setBusy(false);
    }
  }

  function openVoid(m: CashMovement) {
    setVoidTarget(m);
    setVoidReasonDraft(m.voidReason || "");
    setOpenVoidModal(true);
  }

  async function confirmVoidMovement() {
    if (!voidTarget) return;

    setBusy(true);
    setErr(null);
    try {
      await apiFetchAuthed(
        getAccessToken,
        `/cash/movement/${voidTarget.id}/void`,
        {
          method: "POST",
          body: JSON.stringify({ reason: (voidReasonDraft ?? "").trim() }),
        }
      );
      setOpenVoidModal(false);
      setVoidTarget(null);
      setVoidReasonDraft("");
      await refresh();
      setOk("Movimiento anulado ✔");
      window.setTimeout(() => setOk(null), 1400);
    } catch (e: any) {
      setErr(String(e?.message || "Error anulando"));
    } finally {
      setBusy(false);
    }
  }

  function openClose() {
    setOpenCloseModal(true);
  }

  async function confirmCloseCashDay() {
    if (!day) return;
    if (day.status !== "OPEN") {
      setErr("La caja ya está cerrada.");
      return;
    }

    const raw = countedCash.trim();
    const counted = raw === "" ? null : Number(raw);

    if (!adminOverride) {
      if (counted == null || !Number.isFinite(counted) || counted < 0) {
        setErr("Ingresá el efectivo contado (>= 0) o activá override admin.");
        return;
      }
    } else {
      if (!isAdmin) {
        setErr("Solo ADMIN puede usar override.");
        return;
      }
      if (counted != null && (!Number.isFinite(counted) || counted < 0)) {
        setErr("El contado debe ser >= 0");
        return;
      }
    }

    setBusy(true);
    setErr(null);

    try {
      const body: any = {
        dateKey,
        countedCash: counted,
        adminOverride,
        note: closeNote,
      };
      if (effectiveBranchId) body.branchId = effectiveBranchId;

      await apiFetchAuthed(getAccessToken, "/cash/day/close", {
        method: "POST",
        body: JSON.stringify(body),
      });

      setCountedCash("");
      setAdminOverride(false);
      setCloseNote("");

      setOpenCloseModal(false);
      await refresh();

      setOk("Caja cerrada ✔");
      window.setTimeout(() => setOk(null), 1400);
    } catch (e: any) {
      setErr(String(e?.message || "Error cerrando caja"));
    } finally {
      setBusy(false);
    }
  }

  // Filtered movements + totals
  const filteredMovements = useMemo(() => {
    const qq = q.trim().toLowerCase();

    return movements.filter((m) => {
      if (!showVoided && m.voided) return false;
      if (filterType && m.type !== filterType) return false;
      if (filterMethod && m.method !== filterMethod) return false;
      if (filterCategory) {
        if ((m.categoryId || "") !== filterCategory) return false;
      }

      if (!qq) return true;
      const hay = `${m.concept || ""} ${m.note || ""} ${m.method} ${m.type}`.toLowerCase();
      const cat = m.categoryId ? categoryNameById.get(m.categoryId) || "" : "";
      return hay.includes(qq) || cat.toLowerCase().includes(qq);
    });
  }, [
    movements,
    showVoided,
    filterType,
    filterMethod,
    filterCategory,
    q,
    categoryNameById,
  ]);

  const filteredTotals = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const m of filteredMovements) {
      if (m.voided) continue;
      if (m.type === "INCOME") income += m.amount;
      else expense += m.amount;
    }
    return { income, expense, net: income - expense };
  }, [filteredMovements]);

  return {
    // core
    day,
    movements,
    summary,
    categories,
    activeCategories,
    categoryNameById,

    // state flags
    loading,
    busy,
    err,
    ok,
    canWrite,

    // date-based reload
    refresh,

    // create movement form state
    type,
    setType,
    method,
    setMethod,
    amount,
    setAmount,
    categoryId,
    setCategoryId,
    concept,
    setConcept,
    note,
    setNote,
    createMovement,

    // filters
    q,
    setQ,
    filterType,
    setFilterType,
    filterMethod,
    setFilterMethod,
    filterCategory,
    setFilterCategory,
    showVoided,
    setShowVoided,
    filteredMovements,
    filteredTotals,

    // modals: open day
    openOpenModal,
    setOpenOpenModal,
    openingCashDraft,
    setOpeningCashDraft,
    openOpeningModal,
    confirmOpenCashDay,

    // modals: close day
    openCloseModal,
    setOpenCloseModal,
    countedCash,
    setCountedCash,
    adminOverride,
    setAdminOverride,
    closeNote,
    setCloseNote,
    openClose,
    confirmCloseCashDay,

    // modals: void
    openVoidModal,
    setOpenVoidModal,
    voidTarget,
    voidReasonDraft,
    setVoidReasonDraft,
    openVoid,
    confirmVoidMovement,
  };
}
