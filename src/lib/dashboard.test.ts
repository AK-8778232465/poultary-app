import {
  computeDashboardMetrics,
  computeFrequentShops,
  formatHistoryGroups,
} from "@/lib/dashboard";
import type { HistoryOrder, ShopSummary } from "@/lib/types";

const shops: ShopSummary[] = [
  { id: "a", name: "Alpha Meats", phone: null, totalKg: 42, totalOrders: 2 },
  { id: "b", name: "Beta Chicken", phone: null, totalKg: 25, totalOrders: 1 },
];

const orders: HistoryOrder[] = [
  {
    id: "3",
    shopId: "a",
    shopName: "Alpha Meats",
    orderDate: "2026-04-22",
    quantityKg: 12,
    ratePerKg: 220,
    totalAmount: 2640,
    notes: null,
  },
  {
    id: "2",
    shopId: "b",
    shopName: "Beta Chicken",
    orderDate: "2026-04-21",
    quantityKg: 10,
    ratePerKg: 221,
    totalAmount: 2210,
    notes: null,
  },
  {
    id: "1",
    shopId: "a",
    shopName: "Alpha Meats",
    orderDate: "2026-04-21",
    quantityKg: 30,
    ratePerKg: 221,
    totalAmount: 6630,
    notes: null,
  },
];

describe("dashboard helpers", () => {
  it("sorts frequent shops by usage and recent activity", () => {
    expect(computeFrequentShops(shops, orders).map((shop) => shop.id)).toEqual([
      "a",
      "b",
    ]);
  });

  it("groups history by date with totals", () => {
    const groups = formatHistoryGroups(orders);

    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({
      date: "2026-04-22",
      totalKg: 12,
      totalRevenue: 2640,
    });
    expect(groups[1]).toMatchObject({
      date: "2026-04-21",
      totalKg: 40,
      totalRevenue: 8840,
    });
  });

  it("filters metrics by shop", () => {
    const metrics = computeDashboardMetrics(orders, "shop", "a");

    expect(metrics.dayCount).toBe(2);
    expect(metrics.totalKg).toBe(42);
    expect(metrics.totalRevenue).toBe(9270);
  });
});
