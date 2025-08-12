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
    <div className="p-4 max-w-5xl mx-auto">
      <h1 className="text-xl font-semibold mb-4">Cover</h1>

      <div className="mb-6 flex items-center justify-between">
        <button className="inline-flex items-center gap-2 rounded-md border px-3 py-2" onClick={openAdd}>
          <Plus className="h-4 w-4" />
          <span>Nuova immagine</span>
        </button>
      </div>

      {loading ? (
        <div>Caricamento…</div>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.id} className="border rounded-md p-3">
              <div className="flex items-center gap-3 justify-between">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="h-16 w-28 shrink-0 rounded-md bg-black/5 dark:bg-white/10 overflow-hidden flex items-center justify-center">
                    {item.image_url ? (
                      // use img tag to avoid next/image domain config
                      <img
                        src={item.image_url}
                        alt={item.name ?? "Cover"}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="text-xs text-black/50 dark:text-white/50">N/A</div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium truncate">{item.name}</div>
                    {item.product_id && (
                      <div className="text-sm text-gray-700 dark:text-gray-300 truncate">
                        Prodotto: {productIdToName[item.product_id] || "(sconosciuto)"}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button className="p-2 rounded-md border" title="Su" onClick={() => moveUp(item.id)}>
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button className="p-2 rounded-md border" title="Giù" onClick={() => moveDown(item.id)}>
                    <ArrowDown className="h-4 w-4" />
                  </button>
                  <button
                    className="p-2 rounded-md border"
                    title={item.is_public ? "Nascondi" : "Pubblica"}
                    onClick={() => update(item.id, { is_public: !item.is_public })}
                  >
                    {item.is_public ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                  <button className="p-2 rounded-md border" title="Elimina" onClick={() => remove(item.id)}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {isAddOpen && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" role="button" tabIndex={-1} onClick={closeAdd} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-lg rounded-lg bg-white dark:bg-black border border-black/10 dark:border-white/10 overflow-hidden">
              <div className="p-4 border-b border-black/10 dark:border-white/10 flex items-center justify-between">
                <h3 className="font-semibold">Aggiungi immagine cover</h3>
                <button className="rounded-md border p-2" title="Chiudi" onClick={closeAdd}><X className="h-4 w-4" /></button>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-20 w-32 rounded bg-black/5 dark:bg-white/10 overflow-hidden flex items-center justify-center">
                    {draft.image_url ? (
                      <img src={draft.image_url} alt={draft.name || "Cover"} className="h-full w-full object-cover" />
                    ) : (
                      <div className="text-xs text-black/50 dark:text-white/50">N/A</div>
                    )}
                  </div>
                  <label className="inline-flex items-center gap-2 rounded-md border px-3 py-2 cursor-pointer" title="Carica">
                    <Upload className="h-4 w-4" />
                    <span className="text-sm">Carica</span>
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
                <label className="block text-sm">
                  <div className="mb-1 text-gray-700 dark:text-gray-300">Nome</div>
                  <input className="w-full rounded-md border px-3 py-2 bg-transparent" value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
                </label>
                <div className="block text-sm">
                  <div className="mb-1 text-gray-700 dark:text-gray-300">Prodotto collegato</div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="rounded-md border px-3 py-2"
                      onClick={() => setIsProductPickerOpen(true)}
                    >
                      {draft.product_id
                        ? (productIdToName[draft.product_id] || "Cambia prodotto")
                        : "Seleziona un prodotto…"}
                    </button>
                    {draft.product_id && (
                      <button
                        type="button"
                        className="rounded-md border px-2 py-2"
                        title="Rimuovi selezione"
                        onClick={() => setDraft((d) => ({ ...d, product_id: "" }))}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  {productOptions.length === 0 && (
                    <div className="mt-1 text-xs text-black/60 dark:text-white/60">Nessun prodotto disponibile. Crea prima un prodotto in Categorie.</div>
                  )}
                </div>
              </div>
              <div className="p-4 border-t border-black/10 dark:border-white/10 flex items-center justify-end gap-2">
                <button className="rounded-md border p-2" title="Chiudi" onClick={closeAdd}><X className="h-4 w-4" /></button>
                <button
                  className="rounded-md bg-indigo-600 text-white p-2 disabled:opacity-50"
                  title="Salva"
                  onClick={saveAdd}
                  disabled={!draft.name || !draft.image_url || !draft.product_id || draft.uploading}
                >
                  <Save className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {isProductPickerOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-40"
            role="button"
            tabIndex={-1}
            onClick={() => setIsProductPickerOpen(false)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-2xl rounded-lg bg-white dark:bg-black border border-black/10 dark:border-white/10 overflow-hidden">
              <div className="p-4 border-b border-black/10 dark:border-white/10 flex items-center justify-between">
                <h3 className="font-semibold">Seleziona prodotto</h3>
                <button className="rounded-md border p-2" title="Chiudi" onClick={() => setIsProductPickerOpen(false)}><X className="h-4 w-4" /></button>
              </div>
              <div className="p-4 space-y-3">
                <input
                  autoFocus
                  placeholder="Cerca per nome…"
                  className="w-full rounded-md border px-3 py-2 bg-transparent"
                  value={productQuery}
                  onChange={(e) => setProductQuery(e.target.value)}
                />
                <div className="max-h-80 overflow-auto border rounded-md divide-y divide-black/10 dark:divide-white/10">
                  {/* Results will be filled below */}
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
    return <div className="p-3 text-sm text-black/60 dark:text-white/60">Caricamento…</div>
  }
  if (results.length === 0) {
    return <div className="p-3 text-sm text-black/60 dark:text-white/60">Nessun risultato</div>
  }
  return (
    <div>
      {results.map((r) => (
        <button
          key={r.id}
          className="w-full text-left px-3 py-2 hover:bg-black/5 dark:hover:bg-white/10"
          onClick={() => onPick(r)}
        >
          {formatProductLabel(r)}
        </button>
      ))}
    </div>
  )
}


