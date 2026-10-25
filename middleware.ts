import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { adminMfaDestination, adminMfaState } from "@/lib/admin-mfa";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  if (path === "/signup/totp" || path === "/login/verify") {
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
    response.headers.set("Referrer-Policy", "no-referrer");
  }
  const protectedPage = path === "/dashboard" || path.startsWith("/dashboard/")
    || path === "/rooms/new" || /^\/rooms\/[^/]+\/settings(?:\/|$)/.test(path);
  if (protectedPage) {
    try {
      const state = await adminMfaState(supabase, user);
      if (state !== "ready") {
        const redirect = NextResponse.redirect(new URL(adminMfaDestination(state), request.url));
        response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
        return redirect;
      }
    } catch {
      return NextResponse.json({ error: "SERVICE_UNAVAILABLE" }, { status: 503 });
    }
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
