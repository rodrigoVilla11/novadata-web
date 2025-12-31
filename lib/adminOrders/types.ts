/* =============================================================================
 * Types (mínimos)
 * ========================================================================== */

export type Fulfillment = "DINE_IN" | "TAKEAWAY" | "DELIVERY";
export type PaymentMethod = "CASH" | "TRANSFER" | "CARD";

export type Product = {
  id: string;
  name: string;
  salePrice?: number | null;
  computed?: { suggestedPrice?: number | null } | null;
  isActive?: boolean;
  sellable?: boolean;
};

export type OrderItem = {
  productId: string;
  qty: number;
  note?: string | null;

  // opcional si backend lo devuelve
  name?: string;
  unitPrice?: number;
  lineTotal?: number;
};

export type CustomerSnapshot = {
  name?: string | null;
  phone?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  notes?: string | null;
};

export type OrderRow = {
  id: string;
  status: string;
  source?: "POS" | "ONLINE";
  fulfillment?: Fulfillment | string;
  customerId?: string | null;
  customerSnapshot?: CustomerSnapshot | null;
  note?: string | null;
  itemsCount?: number;
  total?: number; // si lo tenés
  createdAt?: string;
  updatedAt?: string;
};

export type OrderDetail = OrderRow & {
  items: OrderItem[];
  rejectedReason?: string | null;
};

export type SaleLite = {
  id: string;
  status: "DRAFT" | "PAID" | "VOIDED" | string;
  orderId?: string | null;
  total?: number;
  paidAt?: string | null;
  createdAt?: string | null;
};

export type SalePayDraft = {
  method: PaymentMethod;
  amount: number;
  note?: string | null;
};

export type OrderPaidMeta = {
  saleId?: string | null;
  saleStatus?: string | null;
  paidAt?: string | null;
};
