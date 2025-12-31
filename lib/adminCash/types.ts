export type CashDay = {
  id: string;
  dateKey: string;
  status: "OPEN" | "CLOSED";
  openingCash: number;
  expectedCash: number;
  countedCash: number | null;
  diffCash: number;
  openedAt: string | null;
  closedAt: string | null;
  closeNote?: string;
};

export type CashMovement = {
  id: string;
  cashDayId: string;
  type: "INCOME" | "EXPENSE";
  method: "CASH" | "TRANSFER" | "CARD" | "OTHER";
  amount: number;
  categoryId: string | null;
  concept: string;
  note: string;
  voided: boolean;
  voidReason?: string;
  createdAt: string;
};

export type FinanceCategory = {
  id: string;
  name: string;
  type?: string;
  isActive?: boolean;
};

export type CashSummary = {
  day: CashDay;
  totals: { income: number; expense: number; net: number; cashNet: number };
  byMethod: Array<{
    method: CashMovement["method"];
    income: number;
    expense: number;
    net: number;
    countIncome: number;
    countExpense: number;
  }>;
  byCategory: Array<{
    categoryId: string;
    name: string;
    type: string | null;
    income: number;
    expense: number;
    net: number;
    countIncome: number;
    countExpense: number;
  }>;
};
