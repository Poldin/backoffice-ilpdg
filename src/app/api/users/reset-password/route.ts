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
    const { email } = body

    if (!email) {
      return NextResponse.json({ error: "Email è obbligatoria" }, { status: 400 })
    }

    const supabaseAdmin = getSupabaseAdmin()

    // Invia email per il reset della password
    const { error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/reset-password`
      }
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true })

  } catch (error) {
    return NextResponse.json({ error: "Errore interno del server" }, { status: 500 })
  }
}
