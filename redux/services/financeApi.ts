// src/redux/services/financeApi.ts
import { baseApi } from "@/redux/services/baseApi";

export type PeriodType = "day" | "week" | "month" | "year" | "custom";

export type FinanceStatsResponse = {
  range: { from: string; to: string };
  totals: {
    income: number;
    expense: number;
    net: number;
    transferOut: number;
    transferIn: number;
  };
  byAccount: Array<{
    accountId: string;
    income: number;
    expense: number;
    net: number;
    transferOut: number;
    transferIn: number;
    startBalance: number;
    endBalance: number;
  }>;
  byCategory: Array<{
    categoryId: string | null;
    type: "INCOME" | "EXPENSE";
    total: number;
    count: number;
    nameSnapshot: string | null;
  }>;
  seriesDaily: Array<{
    dateKey: string;
    income: number;
    expense: number;
    net: number;
  }>;
};

type GetFinanceStatsParams =
  | {
      periodType?: PeriodType;
      dateKey?: string;
      from?: string;
      to?: string;
    }
  | undefined;

export type FinanceMovementType = "INCOME" | "EXPENSE" | "TRANSFER";

export type FinanceMovement = {
  id: string;
  dateKey: string; // YYYY-MM-DD
  type: FinanceMovementType;
  amount: number;
  accountId: string | null;
  toAccountId: string | null;
  categoryId: string | null;
  providerId: string | null;
  notes: string | null;
  status: "POSTED" | "VOID";
  accountNameSnapshot: string | null;
  categoryNameSnapshot: string | null;
  createdByUserId: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type CreateFinanceMovementDto = {
  dateKey: string; // YYYY-MM-DD
  type: FinanceMovementType;
  amount: number; // positivo
  accountId: string;
  toAccountId?: string | null; // requerido si TRANSFER
  categoryId?: string | null;
  providerId?: string | null;
  notes?: string | null;
};

export type UpdateFinanceMovementDto = Partial<CreateFinanceMovementDto> & {
  status?: "POSTED" | "VOID";
};

export type MovementsListResponse = {
  items: FinanceMovement[];
  page: number;
  limit: number;
  total: number;
};

type GetMovementsParams =
  | {
      from?: string;
      to?: string;
      type?: FinanceMovementType;
      accountId?: string;
      categoryId?: string;
      q?: string;
      limit?: number;
      page?: number;
    }
  | undefined;

export type FinanceCategoryType = "INCOME" | "EXPENSE" | "BOTH";
export type FinanceAccountType = "CASH" | "BANK" | "WALLET";

export type FinanceCategory = {
  id: string;
  name: string;
  type: FinanceCategoryType;
  parentId: string | null;
  order: number;
  isActive: boolean;
  createdByUserId?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type CreateFinanceCategoryDto = {
  name: string;
  type: FinanceCategoryType;
  parentId?: string | null;
  order?: number;
};

export type FinanceAccount = {
  id: string;
  name: string;
  type: FinanceAccountType;
  currency: string;
  openingBalance: number;
  isActive: boolean;
  notes: string | null;
  createdByUserId?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type CreateFinanceAccountDto = {
  name: string;
  type: FinanceAccountType;
  currency?: string;
  openingBalance?: number;
  notes?: string | null;
};

export type UpdateFinanceAccountDto = {
  id: string;

  name?: string;
  type?: FinanceAccountType;
  currency?: string;
  openingBalance?: number;
  notes?: string | null;

  // ✅ toggle active (elegí uno)
  isActive?: boolean;
  // active?: boolean;
};

export type GetFinanceMovementsParams = {
  from?: string;
  to?: string;
  type?: FinanceMovementType;
  accountId?: string;
  categoryId?: string;
  q?: string;
  page?: number;
  limit?: number;
  includeVoided?: boolean; // ✅ nuevo
  status?: FinanceMovementStatus | "ALL";
};
export type FinanceMovementStatus = "POSTED" | "VOID";

export type FinanceMovementRow = {
  id: string;
  dateKey: string; // YYYY-MM-DD
  type: FinanceMovementType;
  amount: number;

  accountId: string | null;
  toAccountId: string | null;

  categoryId: string | null;
  providerId: string | null;

  notes: string | null;

  status: FinanceMovementStatus;

  accountNameSnapshot: string | null;
  categoryNameSnapshot: string | null;

  createdByUserId: string | null;

  createdAt?: string;
  updatedAt?: string;
};

export type FinanceMovementsPagedResponse = {
  items: FinanceMovementRow[];
  page: number;
  limit: number;
  total: number;
};

export const financeApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // ---------- CATEGORIES ----------
    getFinanceCategories: builder.query<
      FinanceCategory[],
      {
        type?: FinanceCategoryType;
        active?: boolean;
        parentId?: string | null;
        q?: string;
      } | void
    >({
      query: (params) => ({
        url: "/finance/categories",
        method: "GET",
        params: params ?? undefined, // ✅ clave
      }),
    }),
    createFinanceCategory: builder.mutation<
      FinanceCategory,
      CreateFinanceCategoryDto
    >({
      query: (body) => ({
        url: "/finance/categories",
        method: "POST",
        body,
      }),
      invalidatesTags: [{ type: "FinanceCategories", id: "LIST" }],
    }),

    // ---------- ACCOUNTS ----------
    getFinanceAccounts: builder.query<
      FinanceAccount[],
      { active?: boolean; type?: FinanceAccountType; q?: string } | void
    >({
      query: (params) => ({
        url: "/finance/accounts",
        method: "GET",
        params: params ?? undefined,
      }),
    }),
    createFinanceAccount: builder.mutation<
      FinanceAccount,
      CreateFinanceAccountDto
    >({
      query: (body) => ({
        url: "/finance/accounts",
        method: "POST",
        body,
      }),
      invalidatesTags: [{ type: "FinanceAccounts", id: "LIST" }],
    }),
    getFinanceMovements: builder.query<
      FinanceMovementsPagedResponse,
      GetFinanceMovementsParams
    >({
      query: (params) => {
        const status = params?.status;

        // ✅ backend param
        // - status=ALL -> includeVoids=true
        // - status=VOID -> includeVoids=true + status=VOID
        // - status=POSTED (default) -> no includeVoids, y si mandás status=POSTED sirve también
        const finalParams: any = {
          ...params,
          status: status && status !== "ALL" ? status : undefined,
          includeVoids:
            status === "ALL" || status === "VOID" ? true : undefined,
        };

        return {
          url: "/finance/movements",
          method: "GET",
          params: finalParams,
        };
      },
      providesTags: ["FinanceMovements"],
    }),

    createFinanceMovement: builder.mutation<
      FinanceMovement,
      CreateFinanceMovementDto
    >({
      query: (body) => ({
        url: "/finance/movements",
        method: "POST",
        body,
      }),
      invalidatesTags: [{ type: "FinanceMovements", id: "LIST" }],
    }),

    voidFinanceMovement: builder.mutation<{ ok: true }, { id: string }>({
      query: ({ id }) => ({
        url: `/finance/movements/${id}/void`,
        method: "POST",
      }),
      invalidatesTags: [{ type: "FinanceMovements", id: "LIST" }],
    }),
    getFinanceStats: builder.query<FinanceStatsResponse, GetFinanceStatsParams>(
      {
        query: (params = {}) => {
          console.group("[financeApi] GET /finance/stats");
          console.log("params recibidos:", params);

          const finalParams = {
            ...params,
          };

          console.log("params enviados:", finalParams);
          console.groupEnd();

          return {
            url: "/finance/stats",
            method: "GET",
            params: finalParams,
          };
        },
        providesTags: [{ type: "FinanceStats", id: "CURRENT" }],
      }
    ),
    updateFinanceAccount: builder.mutation<
      FinanceAccount,
      UpdateFinanceAccountDto
    >({
      query: ({ id, ...body }) => ({
        url: `/finance/accounts/${encodeURIComponent(id)}`,
        method: "PATCH",
        body,
      }),
      // si tenés tags:
      invalidatesTags: [{ type: "FinanceAccount" as any, id: "LIST" }],
    }),
    updateFinanceCategory: builder.mutation<
      // ⬅️ Response (la categoría actualizada)
      {
        id: string;
        name: string;
        type: "INCOME" | "EXPENSE" | "BOTH";
        parentId: string | null;
        order: number;
        isActive?: boolean;
      },
      // ⬅️ Payload
      {
        id: string;

        name?: string;
        type?: "INCOME" | "EXPENSE" | "BOTH";
        parentId?: string | null;
        order?: number;
        isActive?: boolean;
      }
    >({
      query: ({ id, ...body }) => ({
        url: `/finance/categories/${id}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: ["FinanceCategories"],
    }),
    updateFinanceMovement: builder.mutation<
      any,
      { id: string } & Record<string, any>
    >({
      query: ({ id, ...body }) => ({
        url: `/finance/movements/${id}`,
        method: "PATCH",
        body, // ✅ ahora siempre manda el body correcto
      }),
      invalidatesTags: ["FinanceMovements"],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetFinanceCategoriesQuery,
  useCreateFinanceCategoryMutation,
  useGetFinanceAccountsQuery,
  useCreateFinanceAccountMutation,
  useGetFinanceMovementsQuery,
  useCreateFinanceMovementMutation,
  useVoidFinanceMovementMutation,
  useGetFinanceStatsQuery,
  useUpdateFinanceAccountMutation,
  useUpdateFinanceCategoryMutation,
  useUpdateFinanceMovementMutation,
} = financeApi;
