import { timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

const REVALIDATE_SECRET: string = (() => {
  const value = process.env.REVALIDATE_SECRET;
  if (!value) {
    throw new Error("[api/revalidate] Missing required env: REVALIDATE_SECRET");
  }
  return value;
})();

const RevalidateBody = z
  .object({
    tag: z.string().regex(/^board:[A-Za-z0-9_-]{10}$/),
  })
  .strict();

export async function POST(request: Request) {
  // Content-Type validation
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return NextResponse.json(
      { error: "Unsupported Media Type" },
      { status: 415 },
    );
  }

  // Secret verification via timing-safe comparison
  const provided = request.headers.get("x-revalidate-secret") ?? "";

  if (
    provided.length === 0 ||
    provided.length !== REVALIDATE_SECRET.length ||
    !timingSafeEqual(Buffer.from(provided), Buffer.from(REVALIDATE_SECRET))
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Body parsing + Zod validation
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const result = RevalidateBody.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: "Bad Request" }, { status: 400 });
  }

  revalidateTag(result.data.tag, "max");

  return NextResponse.json({ revalidated: true });
}
