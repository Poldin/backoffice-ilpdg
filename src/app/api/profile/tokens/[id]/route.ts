import { NextRequest, NextResponse } from "next/server"
import { getSupabaseServer } from "@/app/lib/supabase/server"

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await getSupabaseServer()
    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 })
    }

    const { id: tokenId } = await context.params
    if (!tokenId) {
      return NextResponse.json({ error: "ID token mancante" }, { status: 400 })
    }

    // Ensure token belongs to current user's profile
    const { data: profile, error: profileError } = await supabase
      .from("profile")
      .select("id")
      .eq("user_id", userData.user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profilo non trovato" }, { status: 404 })
    }

    const { error } = await supabase
      .from("profile_token")
      .delete()
      .eq("id", tokenId)
      .eq("profile_id", profile.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Errore interno del server" }, { status: 500 })
  }
}


