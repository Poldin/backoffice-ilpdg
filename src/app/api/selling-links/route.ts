import { NextRequest, NextResponse } from "next/server"
import { getSupabaseServer } from "@/app/lib/supabase/server"

type SellingLink = {
  id: string
  name: string | null
  link: string | null
  descrizione: string | null
  img_url: string | null
  calltoaction: string | null
  created_at: string
}

type CategoryReference = {
  id: string
  name: string | null
}

type ItemReference = {
  id: string
  name: string | null
}

type LinkCategoryRow = {
  sellinglink: SellingLink | null
}

type LinkItemRow = {
  sellinglink: SellingLink | null
}

type CategoryLinkRow = {
  category: CategoryReference | null
}

type ItemLinkRow = {
  item: ItemReference | null
}

type AttachBody = {
  type: "attach"
  target: "category" | "item"
  target_id: string
  selling_link_id: string
}

type CreateLinkBody = {
  name?: string | null
  link?: string | null
  descrizione?: string | null
  img_url?: string | null
  calltoaction?: string | null
}

type UpdateLinkBody = CreateLinkBody & {
  id: string
}

// GET /api/selling-links
// Optional filters:
//  - ?q=...                 search by name
//  - ?category_id=...       list links attached to a category
//  - ?item_id=...           list links attached to an item
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get("q")?.trim() || ""
  const categoryId = searchParams.get("category_id")?.trim() || ""
  const itemId = searchParams.get("item_id")?.trim() || ""
  const sellingLinkId = searchParams.get("selling_link_id")?.trim() || ""
  const supabase = await getSupabaseServer()

  try {
    if (categoryId) {
      // Get links attached to a category
      const { data, error } = await supabase
        .from("link_category_sellinglink")
        .select("sellinglink:selling_link_id ( id, name, link, descrizione, img_url, calltoaction, created_at )")
        .eq("category_id", categoryId)
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      const links = (data as LinkCategoryRow[] || [])
        .map((row) => row.sellinglink)
        .filter(Boolean)
      return NextResponse.json(links)
    }
    if (itemId) {
      // Get links attached to an item
      const { data, error } = await supabase
        .from("link_items_sellinglinks")
        .select("sellinglink:sellinglink_id ( id, name, link, descrizione, img_url, calltoaction, created_at )")
        .eq("item_id", itemId)
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      const links = (data as LinkItemRow[] || [])
        .map((row) => row.sellinglink)
        .filter(Boolean)
      return NextResponse.json(links)
    }

    if (sellingLinkId) {
      // Return where a selling link is attached
      const [cats, items] = await Promise.all([
        supabase
          .from("link_category_sellinglink")
          .select("category:category_id ( id, name )")
          .eq("selling_link_id", sellingLinkId),
        supabase
          .from("link_items_sellinglinks")
          .select("item:item_id ( id, name )")
          .eq("sellinglink_id", sellingLinkId),
      ])
      if (cats.error) return NextResponse.json({ error: cats.error.message }, { status: 400 })
      if (items.error) return NextResponse.json({ error: items.error.message }, { status: 400 })
      const categories = (cats.data as CategoryLinkRow[] || []).map((r) => r.category).filter(Boolean)
      const products = (items.data as ItemLinkRow[] || []).map((r) => r.item).filter(Boolean)
      return NextResponse.json({ categories, products })
    }

    // Otherwise list all (with optional search)
    let query = supabase
      .from("selling_links")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100)

    if (q) {
      query = query.ilike("name", `%${q}%`)
    }

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(data || [])
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error)?.message || "Unknown error" }, { status: 500 })
  }
}

// POST /api/selling-links
// - Create new link { name, link, descrizione, img_url, calltoaction }
// - Or attach: { type: "attach", target: "category"|"item", target_id, selling_link_id }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as unknown
  const supabase = await getSupabaseServer()

  // Type guard for attach body
  const isAttachBody = (obj: unknown): obj is AttachBody => {
    return (
      obj !== null &&
      typeof obj === 'object' && 
      'type' in obj && 
      (obj as Record<string, unknown>).type === "attach"
    )
  }

  if (isAttachBody(body)) {
    if (!body.target || !body.target_id || !body.selling_link_id) {
      return NextResponse.json({ error: "Missing attach parameters" }, { status: 400 })
    }
    if (body.target === "category") {
      const { data, error } = await supabase
        .from("link_category_sellinglink")
        .insert({ category_id: body.target_id, selling_link_id: body.selling_link_id })
        .select("*")
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      return NextResponse.json(data, { status: 201 })
    }
    if (body.target === "item") {
      const { data, error } = await supabase
        .from("link_items_sellinglinks")
        .insert({ item_id: body.target_id, sellinglink_id: body.selling_link_id })
        .select("*")
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      return NextResponse.json(data, { status: 201 })
    }
    return NextResponse.json({ error: "Invalid target" }, { status: 400 })
  }

  // Create selling link - cast to CreateLinkBody
  const createBody = body as CreateLinkBody
  const { data, error } = await supabase
    .from("selling_links")
    .insert({
      name: createBody?.name ?? null,
      link: createBody?.link ?? null,
      descrizione: createBody?.descrizione ?? null,
      img_url: createBody?.img_url ?? null,
      calltoaction: createBody?.calltoaction ?? null,
    })
    .select("*")
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data, { status: 201 })
}

// PUT /api/selling-links { id, ...fields }
export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as UpdateLinkBody
  if (!body?.id) return NextResponse.json({ error: "Missing id" }, { status: 400 })
  const supabase = await getSupabaseServer()

  const patch: Record<string, unknown> = {}
  if (Object.prototype.hasOwnProperty.call(body, "name")) patch.name = body.name
  if (Object.prototype.hasOwnProperty.call(body, "link")) patch.link = body.link
  if (Object.prototype.hasOwnProperty.call(body, "descrizione")) patch.descrizione = body.descrizione
  if (Object.prototype.hasOwnProperty.call(body, "img_url")) patch.img_url = body.img_url
  if (Object.prototype.hasOwnProperty.call(body, "calltoaction")) patch.calltoaction = body.calltoaction

  const { data, error } = await supabase
    .from("selling_links")
    .update(patch)
    .eq("id", body.id)
    .select("*")
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

// DELETE /api/selling-links?id=...
// Or detach: /api/selling-links?type=detach&target=category|item&target_id=...&selling_link_id=...
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const type = searchParams.get("type") || ""
  const supabase = await getSupabaseServer()

  if (type === "detach") {
    const target = searchParams.get("target") || ""
    const targetId = searchParams.get("target_id") || ""
    const sellingLinkId = searchParams.get("selling_link_id") || ""
    if (!target || !targetId || !sellingLinkId) {
      return NextResponse.json({ error: "Missing detach parameters" }, { status: 400 })
    }
    if (target === "category") {
      const { error } = await supabase
        .from("link_category_sellinglink")
        .delete()
        .eq("category_id", targetId)
        .eq("selling_link_id", sellingLinkId)
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      return NextResponse.json({ ok: true })
    }
    if (target === "item") {
      const { error } = await supabase
        .from("link_items_sellinglinks")
        .delete()
        .eq("item_id", targetId)
        .eq("sellinglink_id", sellingLinkId)
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      return NextResponse.json({ ok: true })
    }
    return NextResponse.json({ error: "Invalid target" }, { status: 400 })
  }

  const id = searchParams.get("id")
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })

  // Remove links from pivot tables first
  const del1 = await supabase.from("link_category_sellinglink").delete().eq("selling_link_id", id)
  if (del1.error) return NextResponse.json({ error: del1.error.message }, { status: 400 })
  const del2 = await supabase.from("link_items_sellinglinks").delete().eq("sellinglink_id", id)
  if (del2.error) return NextResponse.json({ error: del2.error.message }, { status: 400 })
  const del = await supabase.from("selling_links").delete().eq("id", id)
  if (del.error) return NextResponse.json({ error: del.error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}


