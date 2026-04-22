import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServiceRoleKey, getSupabaseUrl } from "@/lib/env";
import type {
  BootstrapPayload,
  DailyRate,
  HistoryOrder,
  ShopSummary,
} from "@/lib/types";

type ShopRow = {
  id: string;
  name: string;
  phone: string | null;
};

type RateRow = {
  id: string;
  effective_date: string;
  rate_per_kg: number;
};

type OrderRow = {
  id: string;
  shop_id: string;
  order_date: string;
  quantity_kg: number;
  rate_per_kg: number;
  total_amount: number;
  payment_amount: number;
  balance_due: number;
  notes: string | null;
  shops: {
    name: string;
  } | null;
};

let supabase: SupabaseClient | null = null;

function getSupabase() {
  if (!supabase) {
    supabase = createClient(getSupabaseUrl(), getSupabaseServiceRoleKey(), {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return supabase;
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function mapRate(rate: RateRow | null): DailyRate | null {
  if (!rate) {
    return null;
  }

  return {
    id: rate.id,
    effectiveDate: rate.effective_date,
    ratePerKg: Number(rate.rate_per_kg),
  };
}

async function listCurrentRate() {
  const client = getSupabase();
  const { data, error } = await client
    .from("daily_rates")
    .select("id, effective_date, rate_per_kg")
    .lte("effective_date", todayDate())
    .order("effective_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<RateRow>();

  if (error) {
    throw new Error(error.message);
  }

  return mapRate(data);
}

async function listOrderTotalsByShop() {
  const client = getSupabase();
  const { data, error } = await client
    .from("orders")
    .select("shop_id, quantity_kg, total_amount, payment_amount, balance_due")
    .is("deleted_at", null)
    .returns<
      Array<{
        shop_id: string;
        quantity_kg: number;
        total_amount: number;
        payment_amount: number;
        balance_due: number;
      }>
    >();

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).reduce((map, row) => {
    const current = map.get(row.shop_id) ?? {
      totalDue: 0,
      totalKg: 0,
      totalOrders: 0,
      totalPaid: 0,
      totalRevenue: 0,
    };
    current.totalDue += Number(row.balance_due);
    current.totalKg += Number(row.quantity_kg);
    current.totalOrders += 1;
    current.totalPaid += Number(row.payment_amount);
    current.totalRevenue += Number(row.total_amount);
    map.set(row.shop_id, current);
    return map;
  }, new Map<
    string,
    {
      totalDue: number;
      totalKg: number;
      totalOrders: number;
      totalPaid: number;
      totalRevenue: number;
    }
  >());
}

async function listShops() {
  const client = getSupabase();
  const { data, error } = await client
    .from("shops")
    .select("id, name, phone")
    .eq("is_active", true)
    .order("name", { ascending: true })
    .returns<ShopRow[]>();

  if (error) {
    throw new Error(error.message);
  }

  const orderTotals = await listOrderTotalsByShop();

  return (data ?? []).map<ShopSummary>((shop) => {
    const totals = orderTotals.get(shop.id) ?? {
      totalDue: 0,
      totalKg: 0,
      totalOrders: 0,
      totalPaid: 0,
      totalRevenue: 0,
    };

    return {
      id: shop.id,
      name: shop.name,
      phone: shop.phone,
      totalDue: totals.totalDue,
      totalKg: totals.totalKg,
      totalOrders: totals.totalOrders,
      totalPaid: totals.totalPaid,
      totalRevenue: totals.totalRevenue,
    };
  });
}

async function listOrders() {
  const client = getSupabase();
  const { data, error } = await client
    .from("orders")
    .select(
      "id, shop_id, order_date, quantity_kg, rate_per_kg, total_amount, payment_amount, balance_due, notes, shops(name)",
    )
    .is("deleted_at", null)
    .order("order_date", { ascending: false })
    .order("created_at", { ascending: false })
    .returns<OrderRow[]>();

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map<HistoryOrder>((order) => ({
    id: order.id,
    shopId: order.shop_id,
    shopName: order.shops?.name ?? "Unknown shop",
    orderDate: order.order_date,
    quantityKg: Number(order.quantity_kg),
    ratePerKg: Number(order.rate_per_kg),
    totalAmount: Number(order.total_amount),
    paymentAmount: Number(order.payment_amount),
    balanceDue: Number(order.balance_due),
    notes: order.notes,
  }));
}

export async function getBootstrapData(): Promise<BootstrapPayload> {
  const [currentRate, shops, orders] = await Promise.all([
    listCurrentRate(),
    listShops(),
    listOrders(),
  ]);

  return {
    todayDate: todayDate(),
    currentRate,
    shops,
    orders,
  };
}

async function requireActiveShop(shopId: string) {
  const client = getSupabase();
  const { data, error } = await client
    .from("shops")
    .select("id, is_active")
    .eq("id", shopId)
    .eq("is_active", true)
    .maybeSingle<{ id: string; is_active: boolean }>();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("Selected shop is not available.");
  }
}

export async function createOrder(payload: {
  shopId: string;
  quantityKg: number;
  paymentAmount?: number;
}) {
  await requireActiveShop(payload.shopId);

  const currentRate = await listCurrentRate();

  if (!currentRate) {
    throw new Error("Set today’s rate before saving an order.");
  }

  const client = getSupabase();
  const totalAmount = Number((payload.quantityKg * currentRate.ratePerKg).toFixed(2));
  const paymentAmount = Number(
    Math.min(payload.paymentAmount ?? 0, totalAmount).toFixed(2),
  );
  const balanceDue = Number((totalAmount - paymentAmount).toFixed(2));
  const { data, error } = await client
    .from("orders")
    .insert({
      balance_due: balanceDue,
      shop_id: payload.shopId,
      order_date: todayDate(),
      payment_amount: paymentAmount,
      quantity_kg: payload.quantityKg,
      rate_per_kg: currentRate.ratePerKg,
      total_amount: totalAmount,
      notes: null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function updateOrder(
  orderId: string,
  payload: {
    shopId: string;
    quantityKg: number;
    ratePerKg: number;
    paymentAmount?: number;
  },
) {
  await requireActiveShop(payload.shopId);

  const client = getSupabase();
  const totalAmount = Number((payload.quantityKg * payload.ratePerKg).toFixed(2));
  const paymentAmount = Number(
    Math.min(payload.paymentAmount ?? 0, totalAmount).toFixed(2),
  );
  const balanceDue = Number((totalAmount - paymentAmount).toFixed(2));
  const { data, error } = await client
    .from("orders")
    .update({
      balance_due: balanceDue,
      shop_id: payload.shopId,
      payment_amount: paymentAmount,
      quantity_kg: payload.quantityKg,
      rate_per_kg: payload.ratePerKg,
      total_amount: totalAmount,
      notes: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId)
    .is("deleted_at", null)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function archiveOrder(orderId: string) {
  const client = getSupabase();
  const { error } = await client
    .from("orders")
    .update({
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId)
    .is("deleted_at", null);

  if (error) {
    throw new Error(error.message);
  }
}

export async function createShop(payload: { name: string; phone?: string }) {
  const client = getSupabase();
  const { data, error } = await client
    .from("shops")
    .insert({
      name: payload.name.trim(),
      phone: payload.phone?.trim() || null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function archiveShop(shopId: string) {
  const client = getSupabase();
  const { count, error: countError } = await client
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("shop_id", shopId)
    .is("deleted_at", null);

  if (countError) {
    throw new Error(countError.message);
  }

  if (count && count > 0) {
    throw new Error(
      "This shop still has active orders. Archive those orders first.",
    );
  }

  const { error } = await client
    .from("shops")
    .update({ is_active: false })
    .eq("id", shopId)
    .eq("is_active", true);

  if (error) {
    throw new Error(error.message);
  }
}

export async function setDailyRate(ratePerKg: number) {
  const client = getSupabase();
  const { data, error } = await client
    .from("daily_rates")
    .insert({
      effective_date: todayDate(),
      rate_per_kg: ratePerKg,
    })
    .select("id, effective_date, rate_per_kg")
    .single<RateRow>();

  if (error) {
    throw new Error(error.message);
  }

  return mapRate(data);
}
