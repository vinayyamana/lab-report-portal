import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { importCsv } from "@/lib/import";

export async function POST(req: Request) {
  const s = await getSession();
  if (!s || s.role !== "FRONT_DESK") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const text = await req.text();
  if (!text || text.length > 2_000_000) return NextResponse.json({ error: "Invalid file" }, { status: 400 });
  return NextResponse.json(await importCsv(text));
}