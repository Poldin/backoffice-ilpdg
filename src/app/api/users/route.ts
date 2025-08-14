import { NextRequest, NextResponse } from "next/server"
import { getSupabaseServer } from "@/app/lib/supabase/server"
import { createClient } from '@supabase/supabase-js'

// Supabase admin client per operazioni di gestione utenti
function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, // Questa chiave ha privilegi admin
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )
}

export async function GET() {
  try {
    const supabase = await getSupabaseServer()
    const supabaseAdmin = getSupabaseAdmin()
    
    // Ottieni tutti gli utenti usando l'admin client
    const { data: users, error: usersError } = await supabaseAdmin.auth.admin.listUsers()
    
    if (usersError) {
      return NextResponse.json({ error: usersError.message }, { status: 500 })
    }

    // Ottieni i profili associati
    const { data: profiles, error: profilesError } = await supabase
      .from("profile")
      .select("*")
    
    if (profilesError) {
      return NextResponse.json({ error: profilesError.message }, { status: 500 })
    }

    // Combina utenti e profili
    const usersWithProfiles = users.users.map(user => {
      const profile = profiles.find(p => p.user_id === user.id)
      return {
        user,
        profile: profile || null
      }
    })

    return NextResponse.json(usersWithProfiles)
  } catch (error) {
    return NextResponse.json({ error: "Errore interno del server" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { email, nome, bio, role, img_url } = body

    if (!email || !nome) {
      return NextResponse.json({ error: "Email e nome sono obbligatori" }, { status: 400 })
    }

    const supabase = await getSupabaseServer()
    const supabaseAdmin = getSupabaseAdmin()

    // Crea l'utente usando l'admin client
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
      email,
      email_confirm: false, // L'utente dovrà confermare l'email
      user_metadata: {
        nome,
        bio: bio || null
      }
    })

    if (userError) {
      return NextResponse.json({ error: userError.message }, { status: 400 })
    }

    // Crea il profilo associato
    const { data: profileData, error: profileError } = await supabase
      .from("profile")
      .insert({
        user_id: userData.user.id,
        nome,
        bio: bio || null,
        role: role || "expert",
        img_url: img_url || null
      })
      .select("*")
      .single()

    if (profileError) {
      // Se fallisce la creazione del profilo, elimina l'utente
      await supabaseAdmin.auth.admin.deleteUser(userData.user.id)
      return NextResponse.json({ error: profileError.message }, { status: 400 })
    }

    // Invia email di conferma/invito
    const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`
    })

    if (inviteError) {
      console.warn("Errore nell'invio dell'email di invito:", inviteError.message)
      // Non fallire l'operazione se l'email non viene inviata
    }

    return NextResponse.json({ 
      user: userData.user, 
      profile: profileData 
    }, { status: 201 })

  } catch (error) {
    return NextResponse.json({ error: "Errore interno del server" }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { userId, email, nome, bio, role, img_url } = body

    if (!userId || !nome) {
      return NextResponse.json({ error: "UserId e nome sono obbligatori" }, { status: 400 })
    }

    const supabase = await getSupabaseServer()
    const supabaseAdmin = getSupabaseAdmin()

    // Aggiorna i metadati dell'utente se necessario
    if (email) {
      const { error: userError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        email,
        user_metadata: {
          nome,
          bio: bio || null
        }
      })

      if (userError) {
        return NextResponse.json({ error: userError.message }, { status: 400 })
      }
    }

    // Prima trova il profilo esistente
    const { data: existingProfile } = await supabase
      .from("profile")
      .select("id")
      .eq("user_id", userId)
      .single()

    let profileData, profileError

    if (existingProfile) {
      // Aggiorna il profilo esistente
      const result = await supabase
        .from("profile")
        .update({
          nome,
          bio: bio || null,
          role: role || "expert",
          img_url: img_url || null,
          edited_at: new Date().toISOString()
        })
        .eq("user_id", userId)
        .select("*")
        .single()
      
      profileData = result.data
      profileError = result.error
    } else {
      // Crea un nuovo profilo se non esiste
      const result = await supabase
        .from("profile")
        .insert({
          user_id: userId,
          nome,
          bio: bio || null,
          role: role || "expert",
          img_url: img_url || null
        })
        .select("*")
        .single()
      
      profileData = result.data
      profileError = result.error
    }

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 400 })
    }

    return NextResponse.json({ profile: profileData })

  } catch (error) {
    return NextResponse.json({ error: "Errore interno del server" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get("userId")

    if (!userId) {
      return NextResponse.json({ error: "UserId è obbligatorio" }, { status: 400 })
    }

    const supabase = await getSupabaseServer()
    const supabaseAdmin = getSupabaseAdmin()

    // Prima elimina il profilo
    const { error: profileError } = await supabase
      .from("profile")
      .delete()
      .eq("user_id", userId)

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 400 })
    }

    // Poi elimina l'utente
    const { error: userError } = await supabaseAdmin.auth.admin.deleteUser(userId)

    if (userError) {
      return NextResponse.json({ error: userError.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true })

  } catch (error) {
    return NextResponse.json({ error: "Errore interno del server" }, { status: 500 })
  }
}
