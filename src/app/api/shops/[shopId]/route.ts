import { NextResponse } from "next/server";
import { requireAuthenticatedRequest } from "@/lib/session";
import { archiveShop } from "@/lib/supabase";

export async function PATCH(
  _request: Request,
  context: { params: Promise<{ shopId: string }> },
) {
  const authError = await requireAuthenticatedRequest();

  if (authError) {
    return authError;
  }

  try {
    const { shopId } = await context.params;
    await archiveShop(shopId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to archive the shop.",
      },
      { status: 409 },
    );
  }
}
