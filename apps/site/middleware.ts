import { NextResponse, type NextRequest } from "next/server";
import { isValidShareId } from "@serenity/shared/share";

export const config = {
  matcher: ["/s/:shareId*", "/api/og/:shareId*"],
};

export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const shareId = path.startsWith("/api/og/")
    ? path.split("/api/og/")[1]?.split("/")[0]
    : path.split("/s/")[1]?.split("/")[0];

  if (!shareId || !isValidShareId(shareId)) {
    return new NextResponse(null, { status: 404 });
  }

  return NextResponse.next();
}
