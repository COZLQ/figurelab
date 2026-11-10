import { getConnectionStatus } from "@/lib/ai/server";

export const runtime = "nodejs";
export function GET() {
  return Response.json(getConnectionStatus(), { headers: { "Cache-Control": "no-store" } });
}
