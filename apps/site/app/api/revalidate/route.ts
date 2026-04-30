import { timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

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
  const secret = process.env.REVALIDATE_SECRET;
  const provided = request.headers.get("x-revalidate-secret") ?? "";

  if (
    !secret ||
    provided.length === 0 ||
    provided.length !== secret.length ||
    !timingSafeEqual(Buffer.from(provided), Buffer.from(secret))
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

  revalidateTag(result.data.tag);

  return NextResponse.json({ revalidated: true });
}
