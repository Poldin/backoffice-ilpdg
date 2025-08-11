import { NextResponse, type NextRequest } from "next/server"
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs"
import type { Database } from "@/app/lib/database.type"

// Public routes that do not require auth
const PUBLIC_PATHS = new Set<string>(["/", "/login", "/reset-password", "/auth/callback"])

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient<Database>({ req, res })
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const { pathname } = req.nextUrl
  const isPublic = PUBLIC_PATHS.has(pathname)

  // If the user is authenticated and hits login, redirect to profile
  if (isPublic && pathname === "/login" && session) {
    const url = req.nextUrl.clone()
    url.pathname = "/profile"
    return NextResponse.redirect(url)
  }

  // If the route is protected and there is no session, redirect to /login
  if (!isPublic && !session) {
    const url = req.nextUrl.clone()
    url.pathname = "/login"
    url.searchParams.set("redirect", pathname)
    return NextResponse.redirect(url)
  }

  return res
}

export const config = {
  matcher: [
    // Run middleware on all routes except static files and api routes
    "/((?!_next/static|_next/image|favicon.ico|.*\\.svg|.*\\.png|.*\\.jpg|api).*)",
  ],
}


