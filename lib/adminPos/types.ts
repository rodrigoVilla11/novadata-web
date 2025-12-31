// src/app/admin/pos/_lib/types.ts
export type PaymentMethod = "CASH" | "TRANSFER" | "CARD" | "OTHER";
export type Fulfillment = "DINE_IN" | "TAKEAWAY" | "DELIVERY";

export type Product = {
  id: string;
  name: string;
  salePrice?: number | null;
  computed?: { suggestedPrice?: number | null } | null;
  isActive?: boolean;
  sellable?: boolean;
};

export type PosCartItem = {
  productId: string;
  name: string;
  unitPrice: number;
  qty: number;
  note?: string | null;
  lineTotal: number;
};

export type PosPaymentDraft = {
  method: PaymentMethod;
  amount: number;
  note?: string | null;
};

export type SaleRow = {
  id: string;
  status: "DRAFT" | "PENDING" | "PAID" | "VOIDED";
  total: number;
  dateKey?: string | null;
  paidDateKey?: string | null;
  createdAt: string;
  voidReason?: string | null;
};

export type CheckoutResult = { order: any; sale: any };

export type FinanceCategory = {
  id: string;
  name: string;
  type?: string;
  isActive?: boolean;
};

export type CustomerSnapshot = {
  name?: string | null;
  phone?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  notes?: string | null;
};
