import { getAuditStore } from "@/lib/audit-store";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const audit = await getAuditStore();

  return NextResponse.json(audit);
}
