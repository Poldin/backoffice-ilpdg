import { NextResponse } from 'next/server'
import { getSupabaseServer } from '@/app/lib/supabase/server'

export async function POST(req: Request) {
  try {
    const { access_token, refresh_token } = await req.json()

    if (!access_token || !refresh_token) {
      return NextResponse.json({ error: 'Missing tokens' }, { status: 400 })
    }

    const supabase = await getSupabaseServer()
    const { error } = await supabase.auth.setSession({ access_token, refresh_token })
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || 'Unexpected error' }, { status: 500 })
  }
}


