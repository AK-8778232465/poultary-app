import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthenticatedRequest } from "@/lib/session";
import { archiveOrder, updateOrder } from "@/lib/supabase";

const updateOrderSchema = z.object({
  shopId: z.uuid(),
  quantityKg: z.number().positive(),
  ratePerKg: z.number().positive(),
  notes: z.string().trim().max(240).optional().default(""),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ orderId: string }> },
) {
  const authError = await requireAuthenticatedRequest();

  if (authError) {
    return authError;
  }

  try {
    const { orderId } = await context.params;
    const body = await request.json();
    const payload = updateOrderSchema.parse(body);
    const order = await updateOrder(orderId, payload);

    return NextResponse.json({ order });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to update the order.",
      },
      { status: 400 },
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ orderId: string }> },
) {
  const authError = await requireAuthenticatedRequest();

  if (authError) {
    return authError;
  }

  try {
    const { orderId } = await context.params;
    await archiveOrder(orderId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to archive the order.",
      },
      { status: 400 },
    );
  }
}
