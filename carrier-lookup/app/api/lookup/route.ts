import { LookupError, lookupAddress } from "@/lib/lookup";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const address = url.searchParams.get("address") ?? "";
  const block = url.searchParams.get("block") ?? undefined;

  try {
    const result = await lookupAddress(address, block);
    return Response.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof LookupError) {
      return Response.json(
        { error: error.message, code: error.code },
        { status: error.status, headers: { "Cache-Control": "no-store" } },
      );
    }
    return Response.json(
      {
        error: "Something went wrong looking up that address.",
        code: "upstream",
      },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
