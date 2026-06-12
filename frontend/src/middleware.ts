import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const DEFAULT_MARKETING_HOST = "tenderlens.co.za";
const DEFAULT_APP_HOST = "app.tenderlens.co.za";

function hostFromUrl(value: string | undefined, fallback: string) {
  if (!value) return fallback;
  try {
    return new URL(value).host;
  } catch {
    return value.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  }
}

function stripPort(host: string) {
  return host.toLowerCase().replace(/:\d+$/, "");
}

function withHost(request: NextRequest, host: string, pathname?: string) {
  const url = new URL(request.url);
  url.protocol = "https:";
  url.hostname = host;
  url.port = "";
  if (pathname) url.pathname = pathname;
  return url;
}

function isAssetPath(pathname: string) {
  return (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/api/") ||
    pathname === "/favicon.ico" ||
    pathname === "/Logo.svg" ||
    pathname === "/Logo.png" ||
    pathname === "/icon.svg" ||
    /\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|txt|xml|json)$/.test(pathname)
  );
}

function isMarketingPath(pathname: string) {
  return (
    pathname === "/" ||
    pathname === "/blog" ||
    pathname.startsWith("/blog/")
  );
}

function isAuthOrUtilityPath(pathname: string) {
  return (
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/billing/") ||
    pathname.startsWith("/invites/")
  );
}

export function middleware(request: NextRequest) {
  const { nextUrl } = request;

  if (process.env.NODE_ENV !== "development") {
    const rawHost = request.headers.get("host") ?? nextUrl.host;
    const host = stripPort(rawHost);
    const marketingHost = stripPort(
      hostFromUrl(process.env.NEXT_PUBLIC_MARKETING_URL, DEFAULT_MARKETING_HOST),
    );
    const appHost = stripPort(
      hostFromUrl(process.env.NEXT_PUBLIC_APP_URL, DEFAULT_APP_HOST),
    );
    const marketingHosts = new Set([marketingHost, `www.${marketingHost}`]);

    if (isAssetPath(nextUrl.pathname)) {
      return NextResponse.next();
    }

    if (marketingHosts.has(host)) {
      if (isMarketingPath(nextUrl.pathname)) {
        return NextResponse.next();
      }

      return NextResponse.redirect(
        withHost(request, appHost, nextUrl.pathname),
      );
    }

    if (host === appHost) {
      if (nextUrl.pathname === "/") {
        return NextResponse.redirect(withHost(request, appHost, "/dashboard"));
      }

      if (isMarketingPath(nextUrl.pathname) && !isAuthOrUtilityPath(nextUrl.pathname)) {
        return NextResponse.redirect(
          withHost(request, marketingHost, nextUrl.pathname),
        );
      }
    }

    return NextResponse.next();
  }

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
