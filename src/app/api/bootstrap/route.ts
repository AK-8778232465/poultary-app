import { NextResponse } from "next/server";
import { requireAuthenticatedRequest } from "@/lib/session";
import { getBootstrapData } from "@/lib/supabase";

export async function GET() {
  const authError = await requireAuthenticatedRequest();

  if (authError) {
    return authError;
  }

  try {
    const payload = await getBootstrapData();
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load dashboard data.",
      },
      { status: 500 },
    );
  }
}
