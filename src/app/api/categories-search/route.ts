import { NextRequest, NextResponse } from "next/server"
import { getSupabaseServer } from "@/app/lib/supabase/server"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get("q")?.trim() || ""
  const id = searchParams.get("id")?.trim() || ""
  const supabase = await getSupabaseServer()

  if (id) {
    const { data, error } = await supabase
      .from("products_categories")
      .select("id,name")
      .eq("id", id)
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(data ? [data] : [])
  }

  let query = supabase
    .from("products_categories")
    .select("id,name")
    .order("created_at", { ascending: false })
    .limit(20)

  if (q) {
    query = query.ilike("name", `%${q}%`)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data || [])
}


