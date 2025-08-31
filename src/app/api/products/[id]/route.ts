import { NextRequest, NextResponse } from "next/server"
import { getSupabaseServer } from "@/app/lib/supabase/server"

interface TokenData {
  profile_id: string
}

interface ProductUpdateData {
  name?: string
  description?: string | null
  price?: number | null
  price_currency?: string | null
  selling_url?: string | null
  fee_perc?: number | null
  edited_at: string
}

// PUT /api/products/[id] - Modifica prodotto esistente
export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
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

    // Ottieni l'ID del prodotto
    const { id: productId } = await context.params
    if (!productId) {
      return NextResponse.json({ error: "ID prodotto mancante" }, { status: 400 })
    }

    // Verifica che il prodotto esista e appartenga al profilo
    const { data: existingProduct, error: fetchError } = await supabase
      .from('products')
      .select('id, profile_id')
      .eq('id', productId)
      .eq('profile_id', profileId)
      .single()

    if (fetchError || !existingProduct) {
      return NextResponse.json({ error: "Prodotto non trovato o non autorizzato" }, { status: 404 })
    }

    // Parse del body
    const body = await req.json().catch(() => ({}))
    
    // Preparazione dati di aggiornamento
    const updateData: ProductUpdateData = {
      edited_at: new Date().toISOString()
    }

    // Aggiorna solo i campi forniti
    if (body.name !== undefined) {
      if (typeof body.name !== 'string' || body.name.trim() === '') {
        return NextResponse.json({ error: "Il campo 'name' deve essere una stringa non vuota" }, { status: 400 })
      }
      updateData.name = body.name.trim()
    }

    if (body.description !== undefined) {
      updateData.description = body.description
    }

    if (body.price !== undefined) {
      if (body.price !== null) {
        const price = parseFloat(body.price)
        if (isNaN(price) || price < 0) {
          return NextResponse.json({ error: "Il prezzo deve essere un numero valido >= 0" }, { status: 400 })
        }
        updateData.price = price
      } else {
        updateData.price = null
      }
    }

    if (body.price_currency !== undefined) {
      updateData.price_currency = body.price_currency
    }

    if (body.selling_url !== undefined) {
      updateData.selling_url = body.selling_url
    }

    if (body.fee_perc !== undefined) {
      if (body.fee_perc !== null) {
        const feePerc = parseFloat(body.fee_perc)
        if (isNaN(feePerc) || feePerc < 0 || feePerc > 100) {
          return NextResponse.json({ error: "La percentuale fee deve essere tra 0 e 100" }, { status: 400 })
        }
        updateData.fee_perc = feePerc
      } else {
        updateData.fee_perc = null
      }
    }

    // Aggiornamento nel database
    const { data: updatedProduct, error: updateError } = await supabase
      .from('products')
      .update(updateData)
      .eq('id', productId)
      .eq('profile_id', profileId)
      .select('id, name, description, price, price_currency, selling_url, fee_perc, created_at, edited_at')
      .single()

    if (updateError) {
      throw updateError
    }

    return NextResponse.json(updatedProduct)

  } catch (error) {
    console.error('Error in PUT /api/products/[id]:', error)
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    )
  }
}

// GET /api/products/[id] - Recupera singolo prodotto (opzionale)
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
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

    // Ottieni l'ID del prodotto
    const { id: productId } = await context.params
    if (!productId) {
      return NextResponse.json({ error: "ID prodotto mancante" }, { status: 400 })
    }

    // Recupera il prodotto
    const { data: product, error: fetchError } = await supabase
      .from('products')
      .select('id, name, description, price, price_currency, selling_url, fee_perc, created_at, edited_at')
      .eq('id', productId)
      .eq('profile_id', profileId)
      .single()

    if (fetchError || !product) {
      return NextResponse.json({ error: "Prodotto non trovato" }, { status: 404 })
    }

    return NextResponse.json(product)

  } catch (error) {
    console.error('Error in GET /api/products/[id]:', error)
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    )
  }
}