import { NextResponse } from "next/server";
import { getTuner } from "@/lib/tvheadend";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const inputs = await getTuner();
    return NextResponse.json({ inputs });
  } catch {
    return NextResponse.json(
      { inputs: [], error: "TVHeadend unreachable" },
      { status: 502 },
    );
  }
}
