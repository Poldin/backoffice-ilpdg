import { NextRequest, NextResponse } from "next/server"
import { getSupabaseServer } from "@/app/lib/supabase/server"

export async function GET() {
  const supabase = await getSupabaseServer()
  const { data, error } = await supabase
    .from("products_cover_items")
    .select("*")
    .order("order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const supabase = await getSupabaseServer()
  if (!body?.product_id) {
    return NextResponse.json({ error: "Missing product_id" }, { status: 400 })
  }
  // determine next order (max + 1)
  const last = await supabase
    .from("products_cover_items")
    .select("order")
    .order("order", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()
  if (last.error && last.error.code !== "PGRST116") {
    return NextResponse.json({ error: last.error.message }, { status: 400 })
  }
  const nextOrder = (last.data?.order ?? 0) + 1
  const { data, error } = await supabase
    .from("products_cover_items")
    .insert({
      name: body?.name ?? null,
      image_url: body?.image_url ?? null,
      is_public: body?.is_public ?? true,
      product_id: body?.product_id ?? null,
      order: nextOrder,
    })
    .select("*")
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data, { status: 201 })
}

export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  if (!body?.id) return NextResponse.json({ error: "Missing id" }, { status: 400 })
  const supabase = await getSupabaseServer()
  const { data, error } = await supabase
    .from("products_cover_items")
    .update({
      name: body?.name,
      image_url: body?.image_url,
      is_public: body?.is_public,
      product_id: body?.product_id,
      order: body?.order,
    })
    .eq("id", body.id)
    .select("*")
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id")
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })
  const supabase = await getSupabaseServer()
  const { error } = await supabase.from("products_cover_items").delete().eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}


