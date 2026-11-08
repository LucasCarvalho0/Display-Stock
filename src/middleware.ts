import { NextRequest, NextResponse } from "next/server";
// Barreira de UX apenas: a autorização real é feita no backend (route()) e no layout do servidor.
export function middleware(req: NextRequest) {
  const has = req.cookies.has("dsc_session");
  const { pathname } = req.nextUrl;
  const open = pathname.startsWith("/login") || pathname.startsWith("/esqueci-senha") || pathname.startsWith("/redefinir-senha");
  if (!has && !open) return NextResponse.redirect(new URL("/login", req.url));
  if (has && pathname === "/login") return NextResponse.redirect(new URL("/dashboard", req.url));
  return NextResponse.next();
}
export const config = {
  matcher: [
    "/((?!api|_next|favicon.ico|manifest.json|sw.js|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico)).*)",
  ],
};
