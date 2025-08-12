import { NextRequest, NextResponse } from "next/server"
import { getSupabaseServer } from "@/app/lib/supabase/server"

export async function GET() {
  const supabase = await getSupabaseServer()
  const [cats, items] = await Promise.all([
    supabase
      .from("products_categories")
      .select("id,created_at,name,is_public,expert_id,category_description, expert:profile!products_categories_expert_id_fkey(id,nome,img_url)")
      .order("created_at", { ascending: false }),
    supabase
      .from("products_categories_items")
      .select("*")
      .order("created_at", { ascending: false }),
  ])
  if (cats.error) return NextResponse.json({ error: cats.error.message }, { status: 500 })
  if (items.error) return NextResponse.json({ error: items.error.message }, { status: 500 })
  return NextResponse.json({ categories: cats.data, items: items.data })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const supabase = await getSupabaseServer()
  // Validate expert if provided
  if (body?.expert_id) {
    const { data: expert, error: expertErr } = await supabase
      .from("profile")
      .select("id")
      .eq("id", body.expert_id)
      .eq("role", "expert")
      .not("img_url", "is", null)
      .single()
    if (expertErr || !expert) return NextResponse.json({ error: "Esperto non valido" }, { status: 400 })
  }
  if (body?.type === "item") {
    const { data, error } = await supabase
      .from("products_categories_items")
      .insert({
        category_id: body?.category_id ?? null,
        name: body?.name ?? null,
        description: body?.description ?? null,
        image_url: body?.image_url ?? null,
        is_public: body?.is_public ?? true,
      })
      .select("*")
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(data, { status: 201 })
  }
  const { data, error } = await supabase
    .from("products_categories")
    .insert({
      name: body?.name ?? null,
      is_public: body?.is_public ?? true,
      expert_id: body?.expert_id ?? null,
      category_description: body?.category_description ?? null,
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
  if (body?.type === "item") {
    const { data, error } = await supabase
      .from("products_categories_items")
      .update({
        category_id: body?.category_id,
        name: body?.name,
        description: body?.description,
        image_url: body?.image_url,
        is_public: body?.is_public,
      })
      .eq("id", body.id)
      .select("*")
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(data)
  }
  // Validate expert if being set/changed
  if (Object.prototype.hasOwnProperty.call(body, "expert_id")) {
    if (body.expert_id) {
      const { data: expert, error: expertErr } = await supabase
        .from("profile")
        .select("id")
        .eq("id", body.expert_id)
        .eq("role", "expert")
        .not("img_url", "is", null)
        .single()
      if (expertErr || !expert) return NextResponse.json({ error: "Esperto non valido" }, { status: 400 })
    }
  }
  const patch: Record<string, unknown> = {}
  if (Object.prototype.hasOwnProperty.call(body, "name")) patch.name = body.name
  if (Object.prototype.hasOwnProperty.call(body, "is_public")) patch.is_public = body.is_public
  if (Object.prototype.hasOwnProperty.call(body, "expert_id")) patch.expert_id = body.expert_id
  if (Object.prototype.hasOwnProperty.call(body, "category_description")) patch.category_description = body.category_description
  const { data, error } = await supabase
    .from("products_categories")
    .update(patch)
    .eq("id", body.id)
    .select("*")
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id")
  const type = searchParams.get("type")
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })
  const supabase = await getSupabaseServer()
  if (type === "item") {
    const { error } = await supabase.from("products_categories_items").delete().eq("id", id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true })
  }
  // Delete dependent items first, then category
  const delItems = await supabase.from("products_categories_items").delete().eq("category_id", id)
  if (delItems.error) return NextResponse.json({ error: delItems.error.message }, { status: 400 })
  const delCat = await supabase.from("products_categories").delete().eq("id", id)
  if (delCat.error) return NextResponse.json({ error: delCat.error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}


