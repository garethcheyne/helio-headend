import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { deleteStream, getStream, updateStream } from "@/lib/streams";
import { parseStreamInput } from "@/lib/validate";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

async function requireAdmin() {
  return isAuthenticated();
}

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const stream = getStream(Number(id));
  if (!stream) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ stream });
}

export async function PUT(req: Request, { params }: Params) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  let parsed;
  try {
    parsed = parseStreamInput(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invalid input" },
      { status: 400 },
    );
  }
  const stream = updateStream(Number(id), parsed);
  if (!stream) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ stream });
}

export async function DELETE(_req: Request, { params }: Params) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const ok = deleteStream(Number(id));
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
