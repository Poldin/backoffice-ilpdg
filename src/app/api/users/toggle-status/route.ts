import { NextRequest, NextResponse } from "next/server"
import { createClient } from '@supabase/supabase-js'

// Supabase admin client per operazioni di gestione utenti
function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { userId, banned } = body

    if (!userId) {
      return NextResponse.json({ error: "UserId è obbligatorio" }, { status: 400 })
    }

    const supabaseAdmin = getSupabaseAdmin()

    // Se banned è true, imposta una data futura per il ban
    // Se banned è false, rimuove il ban
    const banUntil = banned ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() : null

    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      ban_duration: banned ? "876000h" : "none" // 876000h = ~100 anni per ban permanente
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true, banned })

  } catch (error) {
    return NextResponse.json({ error: "Errore interno del server" }, { status: 500 })
  }
}
