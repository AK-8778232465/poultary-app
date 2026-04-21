import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthenticatedRequest } from "@/lib/session";
import { createShop } from "@/lib/supabase";

const createShopSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().max(20).optional().default(""),
});

export async function POST(request: Request) {
  const authError = await requireAuthenticatedRequest();

  if (authError) {
    return authError;
  }

  try {
    const body = await request.json();
    const payload = createShopSchema.parse(body);
    const shop = await createShop(payload);

    return NextResponse.json({ shop }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to create the shop.",
      },
      { status: 400 },
    );
  }
}
