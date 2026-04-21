import type { HistoryFilter, HistoryOrder, ShopSummary } from "@/lib/types";

export function computeFrequentShops(
  shops: ShopSummary[],
  orders: HistoryOrder[],
): ShopSummary[] {
  const usage = new Map<string, { count: number; latestDate: string }>();

  for (const order of orders) {
    const existing = usage.get(order.shopId);
    usage.set(order.shopId, {
      count: (existing?.count ?? 0) + 1,
      latestDate:
        !existing || existing.latestDate < order.orderDate
          ? order.orderDate
          : existing.latestDate,
    });
  }

  return [...shops].sort((first, second) => {
    const firstUsage = usage.get(first.id);
    const secondUsage = usage.get(second.id);

    if (firstUsage && secondUsage) {
      if (secondUsage.count !== firstUsage.count) {
        return secondUsage.count - firstUsage.count;
      }

      return secondUsage.latestDate.localeCompare(firstUsage.latestDate);
    }

    if (firstUsage) {
      return -1;
    }

    if (secondUsage) {
      return 1;
    }

    return first.name.localeCompare(second.name);
  });
}

export function computeDashboardMetrics(
  orders: HistoryOrder[],
  filter: HistoryFilter,
  shopId?: string,
) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - 6);
  const monthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

  const filteredOrders = orders.filter((order) => {
    if (filter === "week") {
      return new Date(`${order.orderDate}T00:00:00`) >= weekStart;
    }

    if (filter === "month") {
      return order.orderDate.startsWith(monthKey);
    }

    if (filter === "shop" && shopId) {
      return order.shopId === shopId;
    }

    return true;
  });

  const uniqueDays = new Set(filteredOrders.map((order) => order.orderDate));
  const totalKg = filteredOrders.reduce((sum, order) => sum + order.quantityKg, 0);
  const totalRevenue = filteredOrders.reduce(
    (sum, order) => sum + order.totalAmount,
    0,
  );

  return {
    dayCount: uniqueDays.size,
    filteredOrders,
    totalKg,
    totalRevenue,
  };
}

export function formatHistoryGroups(orders: HistoryOrder[]) {
  const groups = new Map<
    string,
    {
      date: string;
      orders: HistoryOrder[];
      totalKg: number;
      totalRevenue: number;
    }
  >();

  const sortedOrders = [...orders].sort((first, second) => {
    if (first.orderDate !== second.orderDate) {
      return second.orderDate.localeCompare(first.orderDate);
    }

    return second.id.localeCompare(first.id);
  });

  for (const order of sortedOrders) {
    const existing = groups.get(order.orderDate);

    if (existing) {
      existing.orders.push(order);
      existing.totalKg += order.quantityKg;
      existing.totalRevenue += order.totalAmount;
      continue;
    }

    groups.set(order.orderDate, {
      date: order.orderDate,
      orders: [order],
      totalKg: order.quantityKg,
      totalRevenue: order.totalAmount,
    });
  }

  return [...groups.values()];
}

export function getCurrentRateLabel(ratePerKg: number | null) {
  return ratePerKg ? `₹${ratePerKg}/kg` : "Rate not set";
}

export function formatChartDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
  }).format(new Date(`${value}T00:00:00`));
}
