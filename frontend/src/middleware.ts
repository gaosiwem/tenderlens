import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.next();
  }

  const { nextUrl } = request;
  if (nextUrl.hostname !== "127.0.0.1") {
    return NextResponse.next();
  }

  const redirectUrl = nextUrl.clone();
  redirectUrl.hostname = "localhost";
  return NextResponse.redirect(redirectUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
