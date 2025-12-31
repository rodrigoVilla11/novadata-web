import { CashMovement } from "./types";

export const AR_TZ = "America/Argentina/Cordoba";

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function todayKeyArgentina() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: AR_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function moneyARS(n: number) {
  const v = Number(n ?? 0) || 0;
  return v.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
}

export function isValidNumberDraft(v: string) {
  return v === "" || /^[0-9]*([.][0-9]*)?$/.test(v);
}

export function looksForbidden(msg: string) {
  const m = (msg || "").toLowerCase();
  return (
    m.includes("forbidden") ||
    m.includes("sin permisos") ||
    m.includes("prohibido")
  );
}

export function fmtMethodLabel(m: CashMovement["method"]) {
  switch (m) {
    case "CASH":
      return "Efectivo";
    case "TRANSFER":
      return "Transferencia";
    case "CARD":
      return "Tarjeta";
    case "OTHER":
      return "Otro";
    default:
      return String(m);
  }
}

export function fmtTypeLabel(t: CashMovement["type"]) {
  return t === "INCOME" ? "Ingreso" : "Egreso";
}

export function fmtDateTimeAR(iso: string) {
  try {
    return new Date(iso).toLocaleString("es-AR", { timeZone: AR_TZ });
  } catch {
    return iso;
  }
}
