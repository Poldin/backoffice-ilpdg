"use client"

import { useEffect, useMemo, useState } from "react"
import { Eye, EyeOff, Trash2, Upload, Plus, Save, X, ArrowUp, ArrowDown } from "lucide-react"
import { getSupabaseBrowser } from "@/app/lib/supabase/client"
import { toast } from "sonner"

type Cover = {
  id: string
  created_at: string
  name: string | null
  image_url: string | null
  is_public: boolean | null
  product_id: string | null
  order: number | null
}

type Product = {
  id: string
  name: string | null
}

function formatProductLabel(p: Product): string {
  const base = p.name && p.name.trim().length > 0 ? p.name : "(senza nome)"
  const shortId = p.id.slice(0, 6)
  return `${base} — ${shortId}`
}

export default function CoverPage() {
  const [items, setItems] = useState<Cover[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<Partial<Cover>>({ name: "", image_url: "", is_public: true })
  const [products, setProducts] = useState<Product[]>([])
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [draft, setDraft] = useState<{ name: string; image_url: string; product_id: string; uploading: boolean }>(
    { name: "", image_url: "", product_id: "", uploading: false }
  )
  const [isProductPickerOpen, setIsProductPickerOpen] = useState(false)
  const [productQuery, setProductQuery] = useState("")

  const productOptions = useMemo(() => products.map((p) => ({ value: p.id, label: formatProductLabel(p) })), [products])

  const productIdToName = useMemo(() => {
    const map: Record<string, string> = {}
    for (const p of products) map[p.id] = p.name ?? "(senza nome)"
    return map
  }, [products])

  useEffect(() => {
    ;(async () => {
      const coverRes = await fetch("/api/cover")
      const coverData = await coverRes.json()
      setItems(coverData)

      // initial load: first 20 newest
      try {
        const res = await fetch(`/api/products-search`)
        const data = await res.json()
        setProducts(Array.isArray(data) ? data : [])
      } catch {
        setProducts([])
      }
      setLoading(false)
    })()
  }, [])

  async function create(payload: { name: string; image_url: string; product_id: string }) {
    const res = await fetch("/api/cover", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: payload.name, image_url: payload.image_url, is_public: true, product_id: payload.product_id }),
    })
    const data = await res.json()
    setItems((prev) => [...prev, data])
    toast.success("Cover creata")
  }

  async function uploadImage(file: File) {
    const supabase = getSupabaseBrowser()
    const safeName = sanitizeFileName(file.name)
    const path = `cover/${Date.now()}-${safeName}`
    const { error } = await supabase.storage.from("images").upload(path, file, {
      cacheControl: "3600",
      upsert: true,
      contentType: file.type,
    })
    if (error) {
      toast.error(`Upload fallito: ${error.message}`)
      return
    }
    const { data } = supabase.storage.from("images").getPublicUrl(path)
    setForm((f) => ({ ...f, image_url: data.publicUrl }))
    toast.success("Immagine caricata")
  }

  async function uploadImageToDraft(file: File) {
    setDraft((d) => ({ ...d, uploading: true }))
    const supabase = getSupabaseBrowser()
    const safeName = sanitizeFileName(file.name)
    const path = `cover/${Date.now()}-${safeName}`
    const { error } = await supabase.storage.from("images").upload(path, file, {
      cacheControl: "3600",
      upsert: true,
      contentType: file.type,
    })
    if (error) {
      toast.error(`Upload fallito: ${error.message}`)
      setDraft((d) => ({ ...d, uploading: false }))
      return
    }
    const { data } = supabase.storage.from("images").getPublicUrl(path)
    setDraft((d) => ({ ...d, image_url: data.publicUrl, uploading: false }))
    toast.success("Immagine caricata")
  }

  function openAdd() {
    setDraft({ name: "", image_url: "", product_id: "", uploading: false })
    setIsAddOpen(true)
  }
  function closeAdd() {
    setIsAddOpen(false)
  }
  async function saveAdd() {
    if (!draft.name || !draft.image_url || !draft.product_id) return
    await create({ name: draft.name, image_url: draft.image_url, product_id: draft.product_id })
    setIsAddOpen(false)
    toast.success("Cover salvata")
  }

  async function update(id: string, patch: Partial<Cover>) {
    const res = await fetch("/api/cover", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...patch }),
    })
    const updated = await res.json()
    setItems((prev) => prev.map((i) => (i.id === id ? updated : i)))
    toast.success("Cover aggiornata")
  }

  async function persistNewOrder(nextItems: Cover[]) {
    await Promise.all(
      nextItems.map((it, idx) =>
        fetch("/api/cover", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: it.id, order: idx + 1 }),
        })
      )
    )
  }

  function moveUp(id: string) {
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.id === id)
      if (idx <= 0) return prev
      const next = [...prev]
      ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
      const withOrder = next.map((it, i) => ({ ...it, order: i + 1 }))
      persistNewOrder(withOrder)
      return withOrder
    })
  }

  function moveDown(id: string) {
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.id === id)
      if (idx === -1 || idx >= prev.length - 1) return prev
      const next = [...prev]
      ;[next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]
      const withOrder = next.map((it, i) => ({ ...it, order: i + 1 }))
      persistNewOrder(withOrder)
      return withOrder
    })
  }

  async function remove(id: string) {
    const ok = window.confirm("Confermi l'eliminazione di questa immagine della cover?")
    if (!ok) return
    await fetch(`/api/cover?id=${id}`, { method: "DELETE" })
    setItems((prev) => prev.filter((i) => i.id !== id))
    toast.success("Cover eliminata")
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-medium text-gray-900 mb-2">Cover</h1>
          <p className="text-gray-600">Gestisci le immagini di copertina collegate ai prodotti</p>
        </div>

        <div className="mb-8">
          <button 
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg font-medium transition-colors duration-200 shadow-sm" 
            onClick={openAdd}
          >
            <Plus className="h-4 w-4" />
            <span>Nuova immagine</span>
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-gray-700">Caricamento…</div>
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <div className="text-gray-700 mb-4">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Nessuna immagine cover</h3>
              <p className="text-sm text-gray-700">Inizia aggiungendo la tua prima immagine di copertina.</p>
            </div>
            <button
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200"
              onClick={openAdd}
            >
              <Plus className="h-4 w-4" />
              <span>Aggiungi immagine</span>
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((item) => (
              <div key={item.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <div className="flex items-center gap-6 justify-between">
                  <div className="flex items-center gap-6 min-w-0 flex-1">
                    <div className="h-20 w-32 shrink-0 rounded-lg bg-gray-100 overflow-hidden flex items-center justify-center">
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.name ?? "Cover"}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="text-xs text-gray-700">N/A</div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-lg font-medium text-gray-900 truncate mb-1">{item.name}</h3>
                      {item.product_id && (
                        <p className="text-sm text-gray-600 truncate">
                          Prodotto: {productIdToName[item.product_id] || "(sconosciuto)"}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        {item.is_public && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Pubblica
                          </span>
                        )}
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          Ordine: {item.order || 0}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      className="inline-flex items-center p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors duration-200" 
                      title="Sposta su" 
                      onClick={() => moveUp(item.id)}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </button>
                    <button 
                      className="inline-flex items-center p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors duration-200" 
                      title="Sposta giù" 
                      onClick={() => moveDown(item.id)}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </button>
                    <button
                      className="inline-flex items-center p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors duration-200"
                      title={item.is_public ? "Nascondi" : "Pubblica"}
                      onClick={() => update(item.id, { is_public: !item.is_public })}
                    >
                      {item.is_public ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                    <button 
                      className="inline-flex items-center p-1.5 text-red-400 hover:text-red-600 rounded-md hover:bg-red-50 transition-colors duration-200" 
                      title="Elimina" 
                      onClick={() => remove(item.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {isAddOpen && (
        <>
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 z-40" role="button" tabIndex={-1} onClick={closeAdd} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-lg rounded-xl bg-white border border-gray-200 shadow-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">Aggiungi immagine cover</h3>
                <button className="inline-flex items-center p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100" title="Chiudi" onClick={closeAdd}>
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="px-6 py-6 space-y-6">
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-3">Immagine cover</h4>
                  <div className="flex items-start gap-4">
                    <div className="h-24 w-32 rounded-lg bg-gray-100 overflow-hidden flex items-center justify-center">
                      {draft.image_url ? (
                        <img src={draft.image_url} alt={draft.name || "Cover"} className="h-full w-full object-cover" />
                      ) : (
                        <div className="text-xs text-gray-700">Nessuna immagine</div>
                      )}
                    </div>
                    <label className="inline-flex items-center gap-2 bg-white border border-gray-300 rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer transition-colors duration-200">
                      <Upload className="h-4 w-4" />
                      <span>Carica immagine</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) uploadImageToDraft(file)
                        }}
                      />
                    </label>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Nome</label>
                  <input 
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors duration-200" 
                    value={draft.name} 
                    onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} 
                    placeholder="Nome dell'immagine cover"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Prodotto collegato</label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors duration-200"
                      onClick={() => setIsProductPickerOpen(true)}
                    >
                      {draft.product_id
                        ? (productIdToName[draft.product_id] || "Cambia prodotto")
                        : "Seleziona un prodotto…"}
                    </button>
                    {draft.product_id && (
                      <button
                        type="button"
                        className="inline-flex items-center p-1.5 text-red-400 hover:text-red-600 rounded-md hover:bg-red-50 transition-colors duration-200"
                        title="Rimuovi selezione"
                        onClick={() => setDraft((d) => ({ ...d, product_id: "" }))}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  {productOptions.length === 0 && (
                    <div className="mt-2 text-xs text-gray-600">Nessun prodotto disponibile. Crea prima un prodotto in Categorie.</div>
                  )}
                </div>
              </div>
              <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                <button 
                  className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors duration-200" 
                  onClick={closeAdd}
                >
                  Annulla
                </button>
                <button
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors duration-200"
                  onClick={saveAdd}
                  disabled={!draft.name || !draft.image_url || !draft.product_id || draft.uploading}
                >
                  <Save className="h-4 w-4" />
                  Salva cover
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {isProductPickerOpen && (
        <>
          <div
            className="fixed inset-0 bg-gray-500 bg-opacity-75 z-40"
            role="button"
            tabIndex={-1}
            onClick={() => setIsProductPickerOpen(false)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-2xl rounded-xl bg-white border border-gray-200 shadow-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">Seleziona prodotto</h3>
                <button className="inline-flex items-center p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100" title="Chiudi" onClick={() => setIsProductPickerOpen(false)}>
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="px-6 py-4 space-y-4">
                <input
                  autoFocus
                  placeholder="Cerca per nome…"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors duration-200"
                  value={productQuery}
                  onChange={(e) => setProductQuery(e.target.value)}
                />
                <div className="max-h-80 overflow-auto border border-gray-200 rounded-lg divide-y divide-gray-200">
                  <ProductSearchResults
                    query={productQuery}
                    onPick={(p) => {
                      setDraft((d) => ({ ...d, product_id: p.id }))
                      setIsProductPickerOpen(false)
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function sanitizeFileName(name: string): string {
  const withoutDiacritics = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
  const safe = withoutDiacritics
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+/, "")
    .replace(/\.+$/, "")
    .toLowerCase()
  const match = safe.match(/^(.*?)(\.[a-z0-9]+)$/i)
  const base = match ? match[1] : safe
  const ext = match ? match[2] : ""
  const trimmedBase = base.slice(-100)
  return `${trimmedBase}${ext}`
}

function ProductSearchResults({ query, onPick }: { query: string; onPick: (p: Product) => void }) {
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<Product[]>([])

  useEffect(() => {
    let active = true
    setLoading(true)
    const controller = new AbortController()
    const timeout = setTimeout(async () => {
      try {
        const url = query.trim() ? `/api/products-search?q=${encodeURIComponent(query.trim())}` : `/api/products-search`
        const res = await fetch(url, { signal: controller.signal })
        const data = await res.json()
        if (!active) return
        setResults(Array.isArray(data) ? data : [])
      } catch {
        if (!active) return
        setResults([])
      } finally {
        if (active) setLoading(false)
      }
    }, 250)

    return () => {
      active = false
      controller.abort()
      clearTimeout(timeout)
    }
  }, [query])

  if (loading) {
    return <div className="p-4 text-sm text-gray-700">Caricamento…</div>
  }
  if (results.length === 0) {
    return <div className="p-4 text-sm text-gray-700">Nessun risultato</div>
  }
  return (
    <div>
      {results.map((r) => (
        <button
          key={r.id}
          className="w-full text-left px-4 py-3 hover:bg-gray-50 text-sm font-medium text-gray-900 transition-colors duration-200"
          onClick={() => onPick(r)}
        >
          {formatProductLabel(r)}
        </button>
      ))}
    </div>
  )
}


