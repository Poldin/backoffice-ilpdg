import { NextRequest, NextResponse } from "next/server"
import { getSupabaseServer } from "@/app/lib/supabase/server"

// Search experts by name, only profiles with role = 'expert' and with an image
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get("q")?.trim() || ""
  const id = searchParams.get("id")?.trim() || ""
  const supabase = await getSupabaseServer()

  if (id) {
    const { data, error } = await supabase
      .from("profile")
      .select("id,nome,img_url")
      .eq("id", id)
      .eq("role", "expert")
      .not("img_url", "is", null)
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(data ? [data] : [])
  }

  let query = supabase
    .from("profile")
    .select("id,nome,img_url")
    .eq("role", "expert")
    .not("img_url", "is", null)
    .order("created_at", { ascending: false })
    .limit(20)

  if (q) {
    query = query.ilike("nome", `%${q}%`)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data || [])
}


