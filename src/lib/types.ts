export type DashboardTab = "new-order" | "today" | "history" | "shops";
export type HistoryFilter = "all" | "week" | "month" | "shop";

export type ShopSummary = {
  id: string;
  name: string;
  phone: string | null;
  totalKg: number;
  totalOrders: number;
  totalRevenue: number;
  totalPaid: number;
  totalDue: number;
};

export type DailyRate = {
  id: string;
  effectiveDate: string;
  ratePerKg: number;
};

export type HistoryOrder = {
  id: string;
  shopId: string;
  shopName: string;
  orderDate: string;
  quantityKg: number;
  ratePerKg: number;
  totalAmount: number;
  paymentAmount: number;
  balanceDue: number;
  notes: string | null;
};

export type BootstrapPayload = {
  todayDate: string;
  currentRate: DailyRate | null;
  shops: ShopSummary[];
  orders: HistoryOrder[];
};

export type RatePayload = {
  value: string;
};
