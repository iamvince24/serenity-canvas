import { ImageResponse } from "next/og";
import { getBoardByShareId } from "@/lib/board";
import { isValidShareId } from "@serenity/shared/share";
import { BoardOg } from "./BoardOg";

export const runtime = "edge";

// Module-level font promise — fetched once on cold start, reused across requests
const fontPromise = fetch(
  new URL("./NotoSansTC-Regular.ttf", import.meta.url),
).then((r) => r.arrayBuffer());

export async function GET(
  request: Request,
  { params }: { params: Promise<{ shareId: string }> },
) {
  const { shareId } = await params;

  // Defense-in-depth (middleware already validates)
  if (!isValidShareId(shareId)) {
    return new Response("Bad Request", { status: 400 });
  }

  const data = await getBoardByShareId(shareId);

  // Missing / private / fallback → redirect to static PNG (no Satori = no DoS)
  if (!data || data.fallback) {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL!;
    return Response.redirect(`${siteUrl}/og-fallback.png`, 302);
  }

  const fontData = await fontPromise;
  const nodeCount = Object.keys(data.nodes).length;

  return new ImageResponse(
    <BoardOg title={data.board.title} count={nodeCount} />,
    {
      width: 1200,
      height: 630,
      fonts: [
        {
          name: "NotoSansTC",
          data: fontData,
          style: "normal" as const,
          weight: 400 as const,
        },
      ],
      headers: {
        "Cache-Control":
          "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
      },
    },
  );
}
