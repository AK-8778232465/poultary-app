"use client";

import {
  FormEvent,
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  computeDashboardMetrics,
  formatChartDate,
  formatHistoryGroups,
  getCurrentRateLabel,
} from "@/lib/dashboard";
import { formatCurrency, formatDateLong, formatKg } from "@/lib/format";
import type {
  BootstrapPayload,
  DashboardTab,
  HistoryFilter,
  HistoryOrder,
  RatePayload,
  ShopSummary,
} from "@/lib/types";

const tabs: Array<{ id: DashboardTab; label: string }> = [
  { id: "new-order", label: "New Order" },
  { id: "today", label: "Today" },
  { id: "history", label: "History" },
  { id: "shops", label: "Shops" },
];

const historyFilters: Array<{ id: HistoryFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "week", label: "This week" },
  { id: "month", label: "This month" },
  { id: "shop", label: "By shop" },
];

const emptyRate: RatePayload = {
  value: "",
};

const emptyShopDraft = {
  name: "",
  phone: "",
};

const emptyOrderDraft = {
  paymentAmount: "",
  quantityKg: "",
  shopId: "",
};

const emptyEditingOrderDraft = {
  paymentAmount: "",
  quantityKg: "",
  ratePerKg: "",
  shopId: "",
};

const emptyShops: ShopSummary[] = [];
const emptyOrders: HistoryOrder[] = [];

type Banner = {
  tone: "success" | "error";
  text: string;
};

type ConfirmDialog = {
  actionLabel: string;
  body: string;
  title: string;
};

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

function toCurrencyInput(value: number) {
  return Number.isFinite(value) && value > 0 ? String(value) : "";
}

function toSafeNumber(value: string) {
  const numeric = Number(value || 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function clampPaymentAmount(value: string, totalAmount: number) {
  return Math.min(toSafeNumber(value), totalAmount);
}

async function readJson<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & { error?: string };

  if (!response.ok) {
    throw new Error(payload.error ?? "Something went wrong.");
  }

  return payload;
}

export default function PoultryDashboard() {
  const [activeTab, setActiveTab] = useState<DashboardTab>("new-order");
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog | null>(null);
  const [confirmAction, setConfirmAction] = useState<(() => Promise<void>) | null>(
    null,
  );
  const [expandedShopIds, setExpandedShopIds] = useState<Record<string, boolean>>({});
  const [payload, setPayload] = useState<BootstrapPayload | null>(null);
  const [orderDraft, setOrderDraft] = useState(emptyOrderDraft);
  const [shopDraft, setShopDraft] = useState(emptyShopDraft);
  const [rateDraft, setRateDraft] = useState<RatePayload>(emptyRate);
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>("all");
  const [historyShopFilter, setHistoryShopFilter] = useState("");
  const deferredHistoryShopFilter = useDeferredValue(historyShopFilter);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [editingOrderDraft, setEditingOrderDraft] = useState(emptyEditingOrderDraft);

  const refreshData = useCallback(async (message?: Banner) => {
    const response = await fetch("/api/bootstrap", {
      cache: "no-store",
    });
    const nextPayload = await readJson<BootstrapPayload>(response);

    setPayload(nextPayload);
    setRateDraft({
      value: nextPayload.currentRate ? String(nextPayload.currentRate.ratePerKg) : "",
    });

    setOrderDraft((current) => ({
      ...current,
      shopId:
        current.shopId ||
        (nextPayload.shops.length ? nextPayload.shops[0]?.id || "" : ""),
    }));

    if (message) {
      setBanner(message);
    }
  }, []);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        await refreshData();
      } catch (error) {
        setBanner({
          tone: "error",
          text: getErrorMessage(
            error,
            "Unable to load live data. Please verify your server setup.",
          ),
        });
      } finally {
        setIsBootstrapping(false);
      }
    };

    bootstrap();
  }, [refreshData]);

  const shops = payload?.shops ?? emptyShops;
  const orders = payload?.orders ?? emptyOrders;
  const todayLabel = payload ? formatDateLong(payload.todayDate) : "";
  const currentRateValue = Number(payload?.currentRate?.ratePerKg || 0);
  const currentRateLabel = getCurrentRateLabel(payload?.currentRate?.ratePerKg ?? null);
  const selectedShop = shops.find((shop) => shop.id === orderDraft.shopId) ?? null;
  const liveTotal = Number((toSafeNumber(orderDraft.quantityKg) * currentRateValue).toFixed(2));
  const livePaymentAmount = clampPaymentAmount(orderDraft.paymentAmount, liveTotal);
  const liveBalanceDue = Number(Math.max(liveTotal - livePaymentAmount, 0).toFixed(2));
  const editingTotalAmount = Number(
    (toSafeNumber(editingOrderDraft.quantityKg) * toSafeNumber(editingOrderDraft.ratePerKg)).toFixed(
      2,
    ),
  );
  const editingPaymentAmount = clampPaymentAmount(
    editingOrderDraft.paymentAmount,
    editingTotalAmount,
  );
  const editingBalanceDue = Number(
    Math.max(editingTotalAmount - editingPaymentAmount, 0).toFixed(2),
  );

  const metrics = useMemo(() => {
    return computeDashboardMetrics(orders, historyFilter, deferredHistoryShopFilter);
  }, [orders, historyFilter, deferredHistoryShopFilter]);

  const groupedHistory = useMemo(() => {
    return formatHistoryGroups(metrics.filteredOrders);
  }, [metrics.filteredOrders]);

  const todayOrders = useMemo(() => {
    if (!payload) {
      return [];
    }

    return orders.filter((order) => order.orderDate === payload.todayDate);
  }, [orders, payload]);

  const shopOrders = useMemo(() => {
    return shops.reduce<Record<string, HistoryOrder[]>>((map, shop) => {
      map[shop.id] = orders.filter((order) => order.shopId === shop.id);
      return map;
    }, {});
  }, [orders, shops]);

  const clearBanner = () => {
    setBanner(null);
  };

  const closeConfirmDialog = () => {
    setConfirmDialog(null);
    setConfirmAction(null);
  };

  const openConfirmDialog = (
    dialog: ConfirmDialog,
    action: () => Promise<void>,
  ) => {
    setConfirmDialog(dialog);
    setConfirmAction(() => action);
  };

  const handleConfirmAction = async () => {
    if (!confirmAction) {
      return;
    }

    closeConfirmDialog();
    await confirmAction();
  };

  const handleTabChange = (tab: DashboardTab) => {
    startTransition(() => {
      setActiveTab(tab);
    });
  };

  const submitOrder = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsBusy(true);
    clearBanner();

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          paymentAmount: livePaymentAmount,
          quantityKg: toSafeNumber(orderDraft.quantityKg),
          shopId: orderDraft.shopId,
        }),
      });

      await readJson(response);
      await refreshData({
        tone: "success",
        text: "Order saved successfully.",
      });

      setOrderDraft({
        paymentAmount: "",
        quantityKg: "",
        shopId: orderDraft.shopId,
      });

      setActiveTab("today");
    } catch (error) {
      setBanner({
        tone: "error",
        text: getErrorMessage(error, "Unable to save the order."),
      });
    } finally {
      setIsBusy(false);
    }
  };

  const submitShop = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsBusy(true);
    clearBanner();

    try {
      const response = await fetch("/api/shops", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(shopDraft),
      });

      await readJson(response);
      await refreshData({
        tone: "success",
        text: "Shop added successfully.",
      });
      setShopDraft(emptyShopDraft);
    } catch (error) {
      setBanner({
        tone: "error",
        text: getErrorMessage(error, "Unable to add the shop."),
      });
    } finally {
      setIsBusy(false);
    }
  };

  const submitRate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsBusy(true);
    clearBanner();

    try {
      const response = await fetch("/api/rates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ratePerKg: Number(rateDraft.value),
        }),
      });

      await readJson(response);
      await refreshData({
        tone: "success",
        text: "Rate updated for new orders.",
      });
    } catch (error) {
      setBanner({
        tone: "error",
        text: getErrorMessage(error, "Unable to update the rate."),
      });
    } finally {
      setIsBusy(false);
    }
  };

  const beginEdit = (order: HistoryOrder) => {
    setEditingOrderId(order.id);
    setEditingOrderDraft({
      paymentAmount: toCurrencyInput(order.paymentAmount),
      quantityKg: String(order.quantityKg),
      ratePerKg: String(order.ratePerKg),
      shopId: order.shopId,
    });
  };

  const cancelEdit = () => {
    setEditingOrderId(null);
    setEditingOrderDraft(emptyEditingOrderDraft);
  };

  const saveEdit = async (orderId: string) => {
    setIsBusy(true);
    clearBanner();

    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          paymentAmount: editingPaymentAmount,
          quantityKg: toSafeNumber(editingOrderDraft.quantityKg),
          ratePerKg: toSafeNumber(editingOrderDraft.ratePerKg),
          shopId: editingOrderDraft.shopId,
        }),
      });

      await readJson(response);
      await refreshData({
        tone: "success",
        text: "Order updated successfully.",
      });
      cancelEdit();
    } catch (error) {
      setBanner({
        tone: "error",
        text: getErrorMessage(error, "Unable to update the order."),
      });
    } finally {
      setIsBusy(false);
    }
  };

  const deleteOrder = async (orderId: string) => {
    setIsBusy(true);
    clearBanner();

    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: "DELETE",
      });

      await readJson(response);
      await refreshData({
        tone: "success",
        text: "Order deleted successfully.",
      });
      if (editingOrderId === orderId) {
        cancelEdit();
      }
    } catch (error) {
      setBanner({
        tone: "error",
        text: getErrorMessage(error, "Unable to delete the order."),
      });
    } finally {
      setIsBusy(false);
    }
  };

  const archiveShop = async (shopId: string) => {
    setIsBusy(true);
    clearBanner();

    try {
      const response = await fetch(`/api/shops/${shopId}`, {
        method: "PATCH",
      });

      await readJson(response);
      await refreshData({
        tone: "success",
        text: "Shop archived successfully.",
      });
    } catch (error) {
      setBanner({
        tone: "error",
        text: getErrorMessage(error, "Unable to archive the shop."),
      });
    } finally {
      setIsBusy(false);
    }
  };

  const confirmDeleteOrder = (order: HistoryOrder) => {
    openConfirmDialog(
      {
        actionLabel: "Delete order",
        body: `${order.shopName} on ${formatDateLong(order.orderDate)} will be removed from today, history, and due totals.`,
        title: "Delete this order?",
      },
      () => deleteOrder(order.id),
    );
  };

  const confirmArchiveShop = (shop: ShopSummary) => {
    openConfirmDialog(
      {
        actionLabel: "Archive shop",
        body: "Archive this shop only after its active orders are deleted. If orders still exist, you will see a warning.",
        title: `Archive ${shop.name}?`,
      },
      () => archiveShop(shop.id),
    );
  };

  const toggleShop = (shopId: string) => {
    setExpandedShopIds((current) => ({
      ...current,
      [shopId]: !current[shopId],
    }));
  };

  if (isBootstrapping) {
    return (
      <main className="mx-auto flex min-h-screen max-w-[23rem] items-center px-3 py-4">
        <div className="w-full rounded-[1.4rem] bg-[rgba(255,252,246,0.88)] p-4 shadow-[0_18px_42px_rgba(33,37,23,0.12)]">
          <p className="text-[11px] uppercase tracking-[0.18em] text-[rgba(26,33,19,0.56)]">
            Loading dashboard
          </p>
          <h1 className="display-heading mt-2.5 text-[2rem] text-[var(--primary)]">
            Gaikwad Poultry
          </h1>
          <div className="mt-5 space-y-2.5">
            <div className="h-4 animate-pulse rounded-full bg-[rgba(24,61,29,0.08)]" />
            <div className="h-18 animate-pulse rounded-[1.15rem] bg-[rgba(24,61,29,0.08)]" />
            <div className="h-44 animate-pulse rounded-[1.15rem] bg-[rgba(24,61,29,0.08)]" />
          </div>
        </div>
      </main>
    );
  }

  return (
    <>
      <main className="mx-auto min-h-screen max-w-[23rem] px-2 py-2 sm:px-3 sm:py-3">
        <div className="rounded-[1.4rem] border border-white/55 bg-[rgba(255,252,246,0.84)] shadow-[0_18px_42px_rgba(33,37,23,0.12)] backdrop-blur">
          <header className="rounded-t-[1.4rem] bg-[linear-gradient(180deg,#16381a_0%,#204925_100%)] px-3.5 pb-3.5 pt-3.5 text-white">
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[0.24em] text-white/70">
                Poultry orders
              </p>
              <h1 className="display-heading mt-1.5 text-[1.95rem]">
                Gaikwad Poultry
              </h1>
              <p className="mt-1.5 text-[12px] text-white/74">{todayLabel}</p>
            </div>

            <section className="mt-3 rounded-[1.15rem] bg-[rgba(255,255,255,0.1)] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[12px] text-white/72">Today&apos;s rate</p>
                  <strong className="mt-1 block text-[1.95rem] font-medium text-white">
                    {currentRateLabel}
                  </strong>
                  <p className="mt-1.5 text-[9px] uppercase tracking-[0.12em] text-white/58">
                    {payload?.currentRate
                      ? `Updated ${formatChartDate(payload.currentRate.effectiveDate)}`
                      : "Add a rate to start taking orders"}
                  </p>
                </div>
              </div>

              <form className="mt-3 flex gap-2" onSubmit={submitRate}>
                <label className="flex-1">
                  <span className="sr-only">Rate per kg</span>
                  <input
                    className="min-h-10 rounded-[0.95rem] px-3 text-[13px]"
                    inputMode="decimal"
                    onChange={(event) =>
                      setRateDraft({
                        value: event.target.value,
                      })
                    }
                    placeholder="Enter rate"
                    value={rateDraft.value}
                  />
                </label>
                <button
                  className="min-h-10 rounded-[0.95rem] bg-white px-3 text-[12px] font-semibold text-[var(--primary)] disabled:opacity-60"
                  disabled={isBusy}
                  type="submit"
                >
                  Edit Rate
                </button>
              </form>
            </section>
          </header>

          <nav className="grid grid-cols-4 gap-1 border-b border-[var(--border)] bg-[rgba(255,254,249,0.92)] px-2 py-1">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;

              return (
                <button
                  className={`rounded-[0.9rem] px-1 py-1.5 text-center text-[12px] font-medium transition ${
                    isActive
                      ? "bg-[rgba(24,61,29,0.1)] text-[var(--primary)]"
                      : "text-[rgba(26,33,19,0.66)]"
                  }`}
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  type="button"
                >
                  {tab.label}
                </button>
              );
            })}
          </nav>

          {banner ? (
            <div
              className={`mx-3 mt-2.5 rounded-[0.95rem] border px-3 py-2 text-[12px] ${
                banner.tone === "success"
                  ? "border-[rgba(34,108,71,0.16)] bg-[rgba(34,108,71,0.09)] text-[var(--success)]"
                  : "border-[rgba(187,79,67,0.16)] bg-[rgba(187,79,67,0.08)] text-[var(--danger)]"
              }`}
            >
              {banner.text}
            </div>
          ) : null}

          <section className="px-3 pb-4 pt-3">
            {activeTab === "new-order" ? (
              <div className="space-y-4">
                <form className="space-y-3.5" onSubmit={submitOrder}>
                  <label className="block">
                    <span className="mb-1.5 block text-[12px] font-medium text-[rgba(26,33,19,0.72)]">
                      Select shop
                    </span>
                    <select
                      className="min-h-10 rounded-[0.95rem] px-3 text-[13px]"
                      onChange={(event) =>
                        setOrderDraft((current) => ({
                          ...current,
                          shopId: event.target.value,
                        }))
                      }
                      value={orderDraft.shopId}
                    >
                      {shops.map((shop) => (
                        <option key={shop.id} value={shop.id}>
                          {shop.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="mb-1.5 block text-[12px] font-medium text-[rgba(26,33,19,0.72)]">
                      Quantity (kg)
                    </span>
                    <input
                      className="min-h-10 rounded-[0.95rem] px-3 text-[13px]"
                      inputMode="decimal"
                      onChange={(event) =>
                        setOrderDraft((current) => ({
                          ...current,
                          quantityKg: event.target.value,
                        }))
                      }
                      placeholder="Enter kg"
                      value={orderDraft.quantityKg}
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1.5 block text-[12px] font-medium text-[rgba(26,33,19,0.72)]">
                      Payment Amount
                    </span>
                    <input
                      className="min-h-10 rounded-[0.95rem] px-3 text-[13px]"
                      inputMode="decimal"
                      onChange={(event) =>
                        setOrderDraft((current) => ({
                          ...current,
                          paymentAmount: event.target.value,
                        }))
                      }
                      placeholder="Enter paid amount"
                      value={orderDraft.paymentAmount}
                    />
                  </label>

                  <section className="rounded-[1.1rem] bg-[linear-gradient(135deg,rgba(223,233,201,0.84),rgba(255,247,223,0.96))] p-3">
                    <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[rgba(26,33,19,0.48)]">
                      Order total
                    </p>
                    <div className="mt-2.5 flex items-end justify-between gap-3">
                      <div>
                        <p className="text-[12px] text-[rgba(26,33,19,0.68)]">
                          {selectedShop ? selectedShop.name : "Select a shop"}
                        </p>
                        <strong className="mt-1 block text-[1.65rem] text-[var(--primary)]">
                          {formatCurrency(liveTotal)}
                        </strong>
                      </div>
                      <div className="text-right text-[11px] text-[rgba(26,33,19,0.62)]">
                        <p>{currentRateLabel}</p>
                        <p>{formatKg(orderDraft.quantityKg || 0)}</p>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <div className="rounded-[0.95rem] bg-white/70 px-3 py-2">
                        <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[rgba(26,33,19,0.48)]">
                          Payment
                        </p>
                        <strong className="mt-1 block text-[1rem] text-[var(--primary)]">
                          {formatCurrency(livePaymentAmount)}
                        </strong>
                      </div>
                      <div className="rounded-[0.95rem] bg-white/70 px-3 py-2">
                        <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[rgba(26,33,19,0.48)]">
                          Balance Due
                        </p>
                        <strong className="mt-1 block text-[1rem] text-[var(--danger)]">
                          {formatCurrency(liveBalanceDue)}
                        </strong>
                      </div>
                    </div>
                  </section>

                  <button
                    className="min-h-10 w-full rounded-[0.95rem] bg-[var(--primary)] px-4 text-[13px] font-semibold text-white disabled:opacity-60"
                    disabled={isBusy || !shops.length}
                    type="submit"
                  >
                    Save Order
                  </button>
                </form>
              </div>
            ) : null}

            {activeTab === "today" ? (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-2.5">
                  <MetricCard label="Orders" value={String(todayOrders.length)} />
                  <MetricCard
                    label="Total kg"
                    value={formatKg(
                      todayOrders.reduce((sum, order) => sum + order.quantityKg, 0),
                    )}
                  />
                  <MetricCard
                    label="Revenue"
                    value={formatCurrency(
                      todayOrders.reduce((sum, order) => sum + order.totalAmount, 0),
                    )}
                  />
                </div>

                {todayOrders.length ? (
                  <div className="space-y-2.5">
                    {todayOrders.map((order) => {
                      const isEditing = editingOrderId === order.id;

                      return (
                        <article
                          className="rounded-[1.1rem] border border-[var(--border)] bg-[var(--surface)] p-3"
                          key={order.id}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <h3 className="text-[14px] font-semibold text-[var(--primary)]">
                                {order.shopName}
                              </h3>
                              <p className="mt-0.5 text-[12px] text-[rgba(26,33,19,0.64)]">
                                {formatKg(order.quantityKg)} @ {formatCurrency(order.ratePerKg)}
                              </p>
                            </div>
                            <strong className="text-[16px] text-[var(--primary)]">
                              {formatCurrency(order.totalAmount)}
                            </strong>
                          </div>

                          {isEditing ? (
                            <div className="mt-4 space-y-3">
                              <select
                                onChange={(event) =>
                                  setEditingOrderDraft((current) => ({
                                    ...current,
                                    shopId: event.target.value,
                                  }))
                                }
                                value={editingOrderDraft.shopId}
                              >
                                {shops.map((shop) => (
                                  <option key={shop.id} value={shop.id}>
                                    {shop.name}
                                  </option>
                                ))}
                              </select>
                              <input
                                inputMode="decimal"
                                onChange={(event) =>
                                  setEditingOrderDraft((current) => ({
                                    ...current,
                                    quantityKg: event.target.value,
                                  }))
                                }
                                placeholder="Quantity (kg)"
                                value={editingOrderDraft.quantityKg}
                              />
                              <input
                                inputMode="decimal"
                                onChange={(event) =>
                                  setEditingOrderDraft((current) => ({
                                    ...current,
                                    ratePerKg: event.target.value,
                                  }))
                                }
                                placeholder="Rate per kg"
                                value={editingOrderDraft.ratePerKg}
                              />
                              <input
                                inputMode="decimal"
                                onChange={(event) =>
                                  setEditingOrderDraft((current) => ({
                                    ...current,
                                    paymentAmount: event.target.value,
                                  }))
                                }
                                placeholder="Payment amount"
                                value={editingOrderDraft.paymentAmount}
                              />
                              <div className="grid grid-cols-2 gap-2">
                                <MetricMini label="Total" value={formatCurrency(editingTotalAmount)} />
                                <MetricMini
                                  label="Balance Due"
                                  value={formatCurrency(editingBalanceDue)}
                                />
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <button
                                  className="min-h-10 rounded-[0.95rem] bg-[var(--primary)] px-3 text-[12px] font-semibold text-white"
                                  disabled={isBusy}
                                  onClick={() => saveEdit(order.id)}
                                  type="button"
                                >
                                  Save
                                </button>
                                <button
                                  className="min-h-10 rounded-[0.95rem] border border-[var(--border)] bg-white px-3 text-[12px] font-semibold text-[var(--primary)]"
                                  onClick={cancelEdit}
                                  type="button"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="mt-3 grid grid-cols-2 gap-2">
                                <MetricMini
                                  label="Payment"
                                  value={formatCurrency(order.paymentAmount)}
                                />
                                <MetricMini
                                  label="Balance Due"
                                  value={formatCurrency(order.balanceDue)}
                                />
                              </div>
                              <div className="mt-3 grid grid-cols-2 gap-2">
                                <button
                                  className="flex min-h-9 items-center justify-center gap-2 rounded-[0.95rem] bg-[var(--primary)] px-3 text-[12px] font-semibold text-white"
                                  onClick={() => beginEdit(order)}
                                  type="button"
                                >
                                  <span aria-hidden="true">✎</span>
                                  <span>Edit</span>
                                </button>
                                <button
                                  className="flex min-h-9 items-center justify-center gap-2 rounded-[0.95rem] border border-[rgba(187,79,67,0.22)] bg-[rgba(187,79,67,0.06)] px-3 text-[12px] font-semibold text-[var(--danger)]"
                                  onClick={() => confirmDeleteOrder(order)}
                                  type="button"
                                >
                                  <span aria-hidden="true">🗑</span>
                                  <span>Delete</span>
                                </button>
                              </div>
                            </>
                          )}
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <EmptyState
                    body="No orders yet for today. Add the first order from the New Order tab."
                    title="Today is clear"
                  />
                )}
              </div>
            ) : null}

            {activeTab === "history" ? (
              <div className="space-y-3.5">
                <div className="grid grid-cols-3 gap-2.5">
                  <MetricCard label="Days" value={String(metrics.dayCount)} />
                  <MetricCard label="Total kg" value={formatKg(metrics.totalKg)} />
                  <MetricCard
                    label="Revenue"
                    value={formatCurrency(metrics.totalRevenue)}
                  />
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {historyFilters.map((filter) => (
                    <button
                      className={`rounded-full px-3 py-1.5 text-[12px] font-semibold ${
                        historyFilter === filter.id
                          ? "bg-[var(--primary)] text-white"
                          : "bg-white text-[var(--primary)]"
                      }`}
                      key={filter.id}
                      onClick={() => setHistoryFilter(filter.id)}
                      type="button"
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>

                {historyFilter === "shop" ? (
                  <select
                    onChange={(event) => setHistoryShopFilter(event.target.value)}
                    value={historyShopFilter}
                  >
                    <option value="">All shops</option>
                    {shops.map((shop) => (
                      <option key={shop.id} value={shop.id}>
                        {shop.name}
                      </option>
                    ))}
                  </select>
                ) : null}

                {groupedHistory.length ? (
                  <div className="space-y-3">
                    {groupedHistory.map((group) => (
                      <section
                        className="rounded-[1.1rem] border border-[var(--border)] bg-[var(--surface)] p-3"
                        key={group.date}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="display-heading text-[1.35rem] text-[var(--primary)]">
                              {formatDateLong(group.date)}
                            </h3>
                            <p className="mt-0.5 text-[12px] text-[rgba(26,33,19,0.66)]">
                              {group.orders.length} orders · {formatKg(group.totalKg)}
                            </p>
                          </div>
                          <strong className="text-[15px] text-[var(--primary)]">
                            {formatCurrency(group.totalRevenue)}
                          </strong>
                        </div>

                        <div className="mt-3 space-y-2.5">
                          {group.orders.map((order) => (
                            <div
                              className="rounded-[0.95rem] bg-white px-3 py-2.5"
                              key={order.id}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-[13px] font-semibold text-[var(--primary)]">
                                    {order.shopName}
                                  </p>
                                  <p className="mt-0.5 text-[12px] text-[rgba(26,33,19,0.64)]">
                                    {formatKg(order.quantityKg)} @ {formatCurrency(order.ratePerKg)}
                                  </p>
                                </div>
                                <strong className="text-[13px] text-[var(--primary)]">
                                  {formatCurrency(order.totalAmount)}
                                </strong>
                              </div>
                              <div className="mt-2 grid grid-cols-2 gap-2">
                                <MetricMini
                                  label="Payment"
                                  value={formatCurrency(order.paymentAmount)}
                                />
                                <MetricMini
                                  label="Balance Due"
                                  value={formatCurrency(order.balanceDue)}
                                />
                              </div>
                              <button
                                className="mt-2 flex min-h-9 w-full items-center justify-center gap-2 rounded-[0.95rem] border border-[rgba(187,79,67,0.22)] bg-[rgba(187,79,67,0.06)] px-3 text-[12px] font-semibold text-[var(--danger)]"
                                onClick={() => confirmDeleteOrder(order)}
                                type="button"
                              >
                                <span aria-hidden="true">🗑</span>
                                <span>Delete</span>
                              </button>
                            </div>
                          ))}
                        </div>
                      </section>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    body="No historical orders match this filter yet."
                    title="History will appear here"
                  />
                )}
              </div>
            ) : null}

            {activeTab === "shops" ? (
              <div className="space-y-4">
                <form
                  className="rounded-[1.1rem] border border-[var(--border)] bg-[var(--surface)] p-3"
                  onSubmit={submitShop}
                >
                  <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[rgba(26,33,19,0.52)]">
                    Add new shop
                  </p>
                  <div className="mt-3 space-y-2.5">
                    <input
                      className="min-h-10 rounded-[0.95rem] px-3 text-[13px]"
                      onChange={(event) =>
                        setShopDraft((current) => ({
                          ...current,
                          name: event.target.value,
                        }))
                      }
                      placeholder="Enter shop name"
                      value={shopDraft.name}
                    />
                    <input
                      className="min-h-10 rounded-[0.95rem] px-3 text-[13px]"
                      inputMode="tel"
                      onChange={(event) =>
                        setShopDraft((current) => ({
                          ...current,
                          phone: event.target.value,
                        }))
                      }
                      placeholder="Phone number (optional)"
                      value={shopDraft.phone}
                    />
                  </div>
                  <button
                    className="mt-3 min-h-9 rounded-[0.95rem] bg-[var(--primary)] px-4 text-[12px] font-semibold text-white disabled:opacity-60"
                    disabled={isBusy}
                    type="submit"
                  >
                    Add Shop
                  </button>
                </form>

                <div className="space-y-3">
                  {shops.length ? (
                    shops.map((shop) => (
                      <ShopAccordionCard
                        isBusy={isBusy}
                        isExpanded={Boolean(expandedShopIds[shop.id])}
                        key={shop.id}
                        onArchive={() => confirmArchiveShop(shop)}
                        onToggle={() => toggleShop(shop.id)}
                        orders={shopOrders[shop.id] ?? []}
                        shop={shop}
                      />
                    ))
                  ) : (
                    <EmptyState
                      body="Add the shops you supply to begin taking daily orders."
                      title="No shops added yet"
                    />
                  )}
                </div>
              </div>
            ) : null}
          </section>
        </div>
      </main>

      <ConfirmSheet
        dialog={confirmDialog}
        isBusy={isBusy}
        onCancel={closeConfirmDialog}
        onConfirm={handleConfirmAction}
      />
    </>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-[1rem] border border-[var(--border)] bg-[var(--surface)] p-2.5">
      <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[rgba(26,33,19,0.48)]">
        {label}
      </p>
      <strong className="mt-1 block text-[1.05rem] text-[var(--primary)]">{value}</strong>
    </article>
  );
}

function MetricMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[0.95rem] bg-[rgba(24,61,29,0.05)] px-3 py-2">
      <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[rgba(26,33,19,0.48)]">
        {label}
      </p>
      <strong className="mt-1 block text-[0.95rem] text-[var(--primary)]">{value}</strong>
    </div>
  );
}

function EmptyState({ body, title }: { body: string; title: string }) {
  return (
    <section className="rounded-[1.1rem] border border-dashed border-[var(--border-strong)] bg-[rgba(255,252,246,0.5)] px-3.5 py-6 text-center">
      <h2 className="display-heading text-[1.45rem] text-[var(--primary)]">{title}</h2>
      <p className="mx-auto mt-2.5 max-w-xs text-[12px] leading-5 text-[rgba(26,33,19,0.66)]">
        {body}
      </p>
    </section>
  );
}

function ShopAccordionCard({
  isBusy,
  isExpanded,
  onArchive,
  onToggle,
  orders,
  shop,
}: {
  isBusy: boolean;
  isExpanded: boolean;
  onArchive: () => void;
  onToggle: () => void;
  orders: HistoryOrder[];
  shop: ShopSummary;
}) {
  const initials = shop.name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <article className="rounded-[1.1rem] border border-[var(--border)] bg-[var(--surface)] p-3">
      <div className="flex items-start gap-2.5">
        <button
          className="flex min-w-0 flex-1 items-start gap-2.5 text-left"
          onClick={onToggle}
          type="button"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--primary-tint)] text-[13px] font-semibold text-[var(--primary)]">
            {initials || "S"}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <h3 className="truncate text-[14px] font-semibold text-[var(--primary)]">
                {shop.name}
              </h3>
              <span className="text-[12px] text-[rgba(26,33,19,0.56)]">
                {isExpanded ? "−" : "+"}
              </span>
            </div>
            <p className="mt-0.5 text-[12px] text-[rgba(26,33,19,0.66)]">
              {shop.phone || "No phone"} · {shop.totalOrders} orders · {formatKg(shop.totalKg)}
            </p>
          </div>
        </button>
        <button
          className="flex min-h-9 items-center justify-center gap-2 rounded-[0.95rem] border border-[rgba(187,79,67,0.22)] bg-[rgba(187,79,67,0.06)] px-3 text-[12px] font-semibold text-[var(--danger)] disabled:opacity-60"
          disabled={isBusy}
          onClick={onArchive}
          type="button"
        >
          <span aria-hidden="true">🗑</span>
          <span>Archive</span>
        </button>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <MetricMini label="Revenue" value={formatCurrency(shop.totalRevenue)} />
        <MetricMini label="Paid" value={formatCurrency(shop.totalPaid)} />
        <MetricMini label="Due" value={formatCurrency(shop.totalDue)} />
      </div>

      {isExpanded ? (
        <div className="mt-3 space-y-2.5 border-t border-[var(--border)] pt-3">
          {orders.length ? (
            orders.map((order) => (
              <div
                className="rounded-[0.95rem] bg-white px-3 py-2.5"
                key={order.id}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[12px] font-semibold text-[var(--primary)]">
                      {formatDateLong(order.orderDate)}
                    </p>
                    <p className="mt-0.5 text-[12px] text-[rgba(26,33,19,0.64)]">
                      {formatKg(order.quantityKg)} @ {formatCurrency(order.ratePerKg)}
                    </p>
                  </div>
                  <strong className="text-[13px] text-[var(--primary)]">
                    {formatCurrency(order.totalAmount)}
                  </strong>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <MetricMini label="Payment" value={formatCurrency(order.paymentAmount)} />
                  <MetricMini label="Pending Due" value={formatCurrency(order.balanceDue)} />
                </div>
              </div>
            ))
          ) : (
            <p className="text-[12px] text-[rgba(26,33,19,0.66)]">
              No payment history for this shop yet.
            </p>
          )}
        </div>
      ) : null}
    </article>
  );
}

function ConfirmSheet({
  dialog,
  isBusy,
  onCancel,
  onConfirm,
}: {
  dialog: ConfirmDialog | null;
  isBusy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!dialog) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(24,26,20,0.45)] px-3 pb-3 pt-10 sm:items-center sm:p-6">
      <div className="w-full max-w-sm rounded-[1.35rem] bg-[var(--surface-strong)] p-4 shadow-[var(--shadow)]">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--danger)]">
          Warning
        </p>
        <h2 className="mt-2 text-[1.1rem] font-semibold text-[var(--primary)]">
          {dialog.title}
        </h2>
        <p className="mt-2 text-[13px] leading-5 text-[rgba(26,33,19,0.72)]">
          {dialog.body}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            className="min-h-11 rounded-[0.95rem] border border-[var(--border)] bg-white px-4 text-[13px] font-semibold text-[var(--primary)]"
            disabled={isBusy}
            onClick={onCancel}
            type="button"
          >
            Cancel
          </button>
          <button
            className="min-h-11 rounded-[0.95rem] bg-[var(--danger)] px-4 text-[13px] font-semibold text-white disabled:opacity-60"
            disabled={isBusy}
            onClick={onConfirm}
            type="button"
          >
            {dialog.actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
