import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/app/lib/database.type"
import { hasAccess, PUBLIC_ROUTES, isValidRole, getDefaultRoute, type UserRole } from "@/app/lib/acl"

// Public routes that do not require auth
const PUBLIC_PATHS = new Set<string>(PUBLIC_ROUTES)

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const requestId = Math.random().toString(36).slice(2, 8)
  const { pathname, search } = req.nextUrl
  const cookieNamesPresent = req.cookies.getAll().map((c) => c.name)
  console.log('[MW]', requestId, 'start', {
    method: req.method,
    pathname,
    search,
    cookieNamesPresent,
  })
  
  try {
    // Create Supabase client for middleware
    const supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          storage: {
            getItem: (key: string) => {
              const cookie = req.cookies.get(key)
              console.log('[MW]', requestId, 'storage.getItem', {
                key,
                found: Boolean(cookie?.value),
              })
              return cookie?.value || null
            },
            setItem: (key: string, value: string) => {
              console.log('[MW]', requestId, 'storage.setItem', { key, valueLength: value?.length ?? 0 })
              res.cookies.set(key, value, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                path: '/',
                maxAge: 60 * 60 * 24 * 7 // 7 days
              })
            },
            removeItem: (key: string) => {
              console.log('[MW]', requestId, 'storage.removeItem', { key })
              res.cookies.delete(key)
            },
          },
          flowType: 'pkce',
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true
        },
      }
    )

    console.log('[MW]', requestId, 'supabase client created', {
      hasUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      hasAnonKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    })

    const {
      data: { session },
      error
    } = await supabase.auth.getSession()

    const isPublic = PUBLIC_PATHS.has(pathname)
    console.log('[MW]', requestId, 'auth.getSession result', {
      hasSession: Boolean(session),
      userId: session?.user?.id,
      isPublic,
    })

    // Ottieni il ruolo utente se la sessione esiste
    let userRole: UserRole | null = null
    if (session?.user?.id) {
      try {
        const { data: profile } = await supabase
          .from('profile')
          .select('role')
          .eq('user_id', session.user.id)
          .single()
        
        if (profile?.role && isValidRole(profile.role)) {
          userRole = profile.role
        }
        
        console.log('[MW]', requestId, 'user role', {
          userId: session.user.id,
          role: userRole,
        })
      } catch (roleError) {
        console.error('[MW]', requestId, 'error fetching user role', roleError)
      }
    }

    // If there's an error getting session, clear cookies and allow access to public routes
    if (error) {
      console.error('[MW]', requestId, 'auth.getSession error', {
        name: (error as Error)?.name,
        message: (error as Error)?.message,
      })
      // Clear potentially corrupted auth cookies
      const cookieNames = ['sb-access-token', 'sb-refresh-token']
      cookieNames.forEach(name => {
        res.cookies.delete(name)
      })
      
      if (!isPublic) {
        const url = req.nextUrl.clone()
        url.pathname = "/login"
        url.searchParams.set("redirect", pathname)
        console.log('[MW]', requestId, 'redirecting due to error to /login', { redirectFrom: pathname })
        return NextResponse.redirect(url)
      }
      console.log('[MW]', requestId, 'allowing response due to public route despite error', { pathname })
      return res
    }

    // If the user is authenticated and hits login or register, redirect to their default route
    if (isPublic && (pathname === "/login" || pathname === "/register") && session && userRole) {
      const url = req.nextUrl.clone()
      url.pathname = getDefaultRoute(userRole)
      console.log('[MW]', requestId, 'redirect authenticated user away from auth pages', {
        role: userRole,
        redirectTo: url.pathname
      })
      return NextResponse.redirect(url)
    }

    // If the route is protected and there is no session, redirect to /login
    if (!isPublic && !session) {
      const url = req.nextUrl.clone()
      url.pathname = "/login"
      url.searchParams.set("redirect", pathname)
      console.log('[MW]', requestId, 'redirect unauthenticated user to /login', { redirectFrom: pathname })
      return NextResponse.redirect(url)
    }

    // Check role-based access control for authenticated users
    if (session && !hasAccess(userRole, pathname)) {
      const url = req.nextUrl.clone()
      // Redirect to their default allowed route
      if (userRole) {
        url.pathname = getDefaultRoute(userRole)
      } else {
        url.pathname = "/login"
      }
      console.log('[MW]', requestId, 'access denied - redirecting', {
        userId: session.user.id,
        role: userRole,
        requestedPath: pathname,
        redirectTo: url.pathname
      })
      return NextResponse.redirect(url)
    }

    console.log('[MW]', requestId, 'pass-through', { pathname })
    return res
  } catch (error) {
    console.error('[MW]', requestId, 'middleware caught error', {
      name: (error as Error)?.name,
      message: (error as Error)?.message,
    })
    // In case of any error, allow access to public routes and redirect protected ones
    const isPublic = PUBLIC_PATHS.has(pathname)
    
    if (!isPublic) {
      const url = req.nextUrl.clone()
      url.pathname = "/login"
      url.searchParams.set("redirect", pathname)
      console.log('[MW]', requestId, 'redirect due to catch-all error to /login', { redirectFrom: pathname })
      return NextResponse.redirect(url)
    }
    
    console.log('[MW]', requestId, 'allowing response on public route after catch-all error', { pathname })
    return res
  }
}

export const config = {
  matcher: [
    // Run middleware on all routes except static files and api routes
    "/((?!_next/static|_next/image|favicon.ico|.*\\.svg|.*\\.png|.*\\.jpg|api).*)",
  ],
}