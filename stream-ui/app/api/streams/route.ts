import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { createStream, listStreams } from "@/lib/streams";
import { parseStreamInput } from "@/lib/validate";

export const dynamic = "force-dynamic";

// Public read — the lineup/playlist needs it. Mutations are admin-only.
export async function GET() {
  return NextResponse.json({ streams: listStreams() });
}

export async function POST(req: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let parsed;
  try {
    parsed = parseStreamInput(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invalid input" },
      { status: 400 },
    );
  }
  const stream = createStream(parsed);
  return NextResponse.json({ stream }, { status: 201 });
}
