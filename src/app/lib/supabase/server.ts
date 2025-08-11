import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import type { Database } from '../database.type'

export async function getSupabaseServer() {
  const cookieStore = await cookies()
  
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        storage: {
          getItem: (key: string) => {
            const cookie = cookieStore.get(key)
            return cookie?.value || null
          },
          setItem: (key: string, value: string) => {
            try {
              cookieStore.set(key, value, { 
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                path: '/',
                maxAge: 60 * 60 * 24 * 7 // 7 days
              })
            } catch {
              // The `setItem` method was called from a Server Component.
              // This can be ignored if you have middleware refreshing
              // user sessions.
            }
          },
          removeItem: (key: string) => {
            try {
              cookieStore.delete(key)
            } catch {
              // The `removeItem` method was called from a Server Component.
              // This can be ignored if you have middleware refreshing
              // user sessions.
            }
          },
        },
        flowType: 'pkce',
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
      },
    }
  )
}