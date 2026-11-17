import { suggestAddresses } from "@/lib/lookup";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q") ?? "";
  const suggestions = await suggestAddresses(query);
  return Response.json(
    { suggestions },
    { headers: { "Cache-Control": "no-store" } },
  );
}
