import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthenticatedRequest } from "@/lib/session";
import { setDailyRate } from "@/lib/supabase";

const rateSchema = z.object({
  ratePerKg: z.number().positive(),
});

export async function POST(request: Request) {
  const authError = await requireAuthenticatedRequest();

  if (authError) {
    return authError;
  }

  try {
    const body = await request.json();
    const payload = rateSchema.parse(body);
    const rate = await setDailyRate(payload.ratePerKg);

    return NextResponse.json({ rate }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to update the rate.",
      },
      { status: 400 },
    );
  }
}
