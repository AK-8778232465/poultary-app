import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthenticatedRequest } from "@/lib/session";
import { createOrder } from "@/lib/supabase";

const createOrderSchema = z.object({
  shopId: z.uuid(),
  quantityKg: z.number().positive(),
  notes: z.string().trim().max(240).optional().default(""),
});

export async function POST(request: Request) {
  const authError = await requireAuthenticatedRequest();

  if (authError) {
    return authError;
  }

  try {
    const body = await request.json();
    const payload = createOrderSchema.parse(body);
    const order = await createOrder(payload);

    return NextResponse.json({ order }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to create the order.",
      },
      { status: 400 },
    );
  }
}
