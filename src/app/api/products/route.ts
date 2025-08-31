import { NextRequest, NextResponse } from "next/server"
import { getSupabaseServer } from "@/app/lib/supabase/server"

interface TokenData {
  profile_id: string
}

interface ProductInsertData {
  name: string
  description: string | null
  price: number | null
  price_currency: string | null
  selling_url: string | null
  fee_perc: number | null
  profile_id: string
  created_at: string
}

// GET /api/products - Recupera prodotti con paginazione
export async function GET(req: NextRequest) {
  try {
    const supabase = await getSupabaseServer()
    
    // Verifica autenticazione tramite token
    const authHeader = req.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: "Token di autorizzazione mancante" }, { status: 401 })
    }

    const token = authHeader.substring(7) // Rimuovi "Bearer "
    
    // Verifica il token nel database
    const { data: tokenData, error: tokenError } = await supabase
      .from('profile_token')
      .select('profile_id')
      .eq('token', token)
      .single()

    if (tokenError || !tokenData?.profile_id) {
      return NextResponse.json({ error: "Token non valido" }, { status: 401 })
    }

    const profileId = tokenData.profile_id

    // Parametri query
    const url = new URL(req.url)
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '100')))
    const search = url.searchParams.get('search') || ''

    // Query per contare il totale
    let countQuery = supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('profile_id', profileId)

    if (search) {
      countQuery = countQuery.or(`name.ilike.%${search}%,description.ilike.%${search}%`)
    }

    const { count: totalCount, error: countError } = await countQuery

    if (countError) {
      throw countError
    }

    // Query per i dati
    const from = (page - 1) * limit
    const to = from + limit - 1

    let dataQuery = supabase
      .from('products')
      .select('id, name, description, price, price_currency, selling_url, fee_perc, created_at, edited_at')
      .eq('profile_id', profileId)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (search) {
      dataQuery = dataQuery.or(`name.ilike.%${search}%,description.ilike.%${search}%`)
    }

    const { data: products, error: dataError } = await dataQuery

    if (dataError) {
      throw dataError
    }

    const totalPages = Math.ceil((totalCount || 0) / limit)

    return NextResponse.json({
      products: products || [],
      pagination: {
        current_page: page,
        total_pages: totalPages,
        total_count: totalCount || 0,
        per_page: limit,
        has_next: page < totalPages,
        has_prev: page > 1
      }
    })

  } catch (error) {
    console.error('Error in GET /api/products:', error)
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    )
  }
}

// POST /api/products - Crea nuovo prodotto
export async function POST(req: NextRequest) {
  try {
    const supabase = await getSupabaseServer()
    
    // Verifica autenticazione tramite token
    const authHeader = req.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: "Token di autorizzazione mancante" }, { status: 401 })
    }

    const token = authHeader.substring(7)
    
    // Verifica il token nel database
    const { data: tokenData, error: tokenError } = await supabase
      .from('profile_token')
      .select('profile_id')
      .eq('token', token)
      .single()

    if (tokenError || !tokenData?.profile_id) {
      return NextResponse.json({ error: "Token non valido" }, { status: 401 })
    }

    const profileId = tokenData.profile_id

    // Parse del body
    const body = await req.json().catch(() => ({}))
    
    // Validazione campi obbligatori
    if (!body.name || typeof body.name !== 'string' || body.name.trim() === '') {
      return NextResponse.json({ error: "Il campo 'name' è obbligatorio" }, { status: 400 })
    }

    // Preparazione dati
    const productData: ProductInsertData = {
      name: body.name.trim(),
      description: body.description || null,
      price: body.price ? parseFloat(body.price) : null,
      price_currency: body.price_currency || null,
      selling_url: body.selling_url || null,
      fee_perc: body.fee_perc ? parseFloat(body.fee_perc) : null,
      profile_id: profileId,
      created_at: new Date().toISOString()
    }

    // Validazione dei numeri
    if (productData.price !== null && (isNaN(productData.price) || productData.price < 0)) {
      return NextResponse.json({ error: "Il prezzo deve essere un numero valido >= 0" }, { status: 400 })
    }

    if (productData.fee_perc !== null && (isNaN(productData.fee_perc) || productData.fee_perc < 0 || productData.fee_perc > 100)) {
      return NextResponse.json({ error: "La percentuale fee deve essere tra 0 e 100" }, { status: 400 })
    }

    // Inserimento nel database
    const { data: product, error: insertError } = await supabase
      .from('products')
      .insert(productData)
      .select('id, name, description, price, price_currency, selling_url, fee_perc, created_at, edited_at')
      .single()

    if (insertError) {
      throw insertError
    }

    return NextResponse.json(product, { status: 201 })

  } catch (error) {
    console.error('Error in POST /api/products:', error)
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    )
  }
}