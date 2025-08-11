"use client"

import { useEffect, useRef, useState } from "react"
import { Eye, EyeOff, Trash2, Save, X, Upload, Plus } from "lucide-react"
import { toast } from "sonner"
import { getSupabaseBrowser } from "@/app/lib/supabase/client"

type Category = {
  id: string
  created_at: string
  name: string | null
  is_public: boolean | null
}
type CategoryItem = {
  id: string
  created_at: string
  category_id: string | null
  name: string | null
  description: string | null
  image_url: string | null
  is_public: boolean | null
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [items, setItems] = useState<CategoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const selectedItem = items.find((i) => i.id === selectedItemId) || null
  const [draft, setDraft] = useState<Partial<CategoryItem>>({})
  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false)
  const [categoryDraft, setCategoryDraft] = useState<{ name: string; is_public: boolean }>({
    name: "",
    is_public: true,
  })
  const [isAddItemOpen, setIsAddItemOpen] = useState(false)
  const [itemDraft, setItemDraft] = useState<{
    category_id: string
    name: string
    description: string
    image_url: string
    is_public: boolean
    uploading: boolean
  }>({ category_id: "", name: "", description: "", image_url: "", is_public: true, uploading: false })
  const [detailsWidth, setDetailsWidth] = useState<number>(560)
  const isResizingRef = useRef(false)
  const startXRef = useRef(0)
  const startWidthRef = useRef(560)

  // creation forms moved to modal CTAs

  useEffect(() => {
    ;(async () => {
      const res = await fetch("/api/categories")
      const data = await res.json()
      setCategories(data.categories)
      setItems(data.items)
      setLoading(false)
    })()
  }, [])

  useEffect(() => {
    // load saved details width
    try {
      const stored = localStorage.getItem("categories:detailsWidth")
      if (stored) setDetailsWidth(Math.min(800, Math.max(360, parseInt(stored))))
    } catch {}
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem("categories:detailsWidth", String(detailsWidth))
    } catch {}
  }, [detailsWidth])

  useEffect(() => {
    if (selectedItem) {
      setDraft({
        id: selectedItem.id,
        category_id: selectedItem.category_id ?? "",
        name: selectedItem.name ?? "",
        description: selectedItem.description ?? "",
        image_url: selectedItem.image_url ?? "",
        is_public: !!selectedItem.is_public,
      })
    } else {
      setDraft({})
    }
  }, [selectedItemId])

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!isResizingRef.current) return
      const delta = (startXRef.current - e.clientX) * -1 // dragging from left edge to right
      const next = Math.min(800, Math.max(360, startWidthRef.current + delta))
      setDetailsWidth(next)
    }
    function onUp() {
      isResizingRef.current = false
      document.body.style.cursor = ""
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup", onUp)
    }
    if (isResizingRef.current) {
      window.addEventListener("mousemove", onMove)
      window.addEventListener("mouseup", onUp)
    }
    return () => {
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup", onUp)
    }
  }, [isResizingRef.current])

  async function createCategory(payload: { name: string; is_public: boolean }) {
    const res = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: payload.name, is_public: payload.is_public }),
    })
    const created = await res.json()
    setCategories((prev) => [created, ...prev])
    toast.success("Categoria creata")
  }

  function sanitizeFileName(name: string): string {
    // Remove diacritics, keep only safe chars, collapse dashes, limit length
    const withoutDiacritics = name
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
    const safe = withoutDiacritics
      .replace(/[^a-zA-Z0-9._-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+/, "")
      .replace(/\.+$/, "")
      .toLowerCase()
    // keep extension if present
    const match = safe.match(/^(.*?)(\.[a-z0-9]+)$/i)
    const base = match ? match[1] : safe
    const ext = match ? match[2] : ""
    const trimmedBase = base.slice(-100)
    return `${trimmedBase}${ext}`
  }

  async function toggleCategoryVisibility(id: string, current: boolean | null) {
    const res = await fetch("/api/categories", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, is_public: !current }),
    })
    const updated = await res.json()
    setCategories((prev) => prev.map((c) => (c.id === id ? updated : c)))
    toast.success(updated.is_public ? "Categoria pubblicata" : "Categoria nascosta")
  }

  async function removeCategory(id: string) {
    const ok = window.confirm("Confermi l'eliminazione della categoria? I prodotti collegati verranno rimossi.")
    if (!ok) return
    await fetch(`/api/categories?id=${id}`, { method: "DELETE" })
    setCategories((prev) => prev.filter((c) => c.id !== id))
    setItems((prev) => prev.filter((i) => i.category_id !== id))
    toast.success("Categoria eliminata")
  }

  async function createItem(payload: {
    category_id: string
    name: string
    description: string
    image_url: string
    is_public: boolean
  }) {
    const res = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, type: "item" }),
    })
    const created = await res.json()
    setItems((prev) => [created, ...prev])
    toast.success("Prodotto creato")
  }

  async function toggleItemVisibility(id: string, current: boolean | null) {
    const res = await fetch("/api/categories", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, is_public: !current, type: "item" }),
    })
    const updated = await res.json()
    setItems((prev) => prev.map((i) => (i.id === id ? updated : i)))
    toast.success(updated.is_public ? "Prodotto pubblicato" : "Prodotto nascosto")
  }

  async function removeItem(id: string) {
    const ok = window.confirm("Confermi l'eliminazione del prodotto?")
    if (!ok) return
    await fetch(`/api/categories?id=${id}&type=item`, { method: "DELETE" })
    setItems((prev) => prev.filter((i) => i.id !== id))
    if (selectedItemId === id) setSelectedItemId(null)
    toast.success("Prodotto eliminato")
  }

  function openDetails(item: CategoryItem) {
    setSelectedItemId(item.id)
  }

  function closeDetails() {
    setSelectedItemId(null)
  }

  async function saveDetails() {
    if (!draft.id) return
    const res = await fetch("/api/categories", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "item",
        id: draft.id,
        category_id: draft.category_id || null,
        name: draft.name ?? null,
        description: draft.description ?? null,
        image_url: draft.image_url ?? null,
        is_public: draft.is_public ?? true,
      }),
    })
    const updated = await res.json()
    setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)))
    toast.success("Dettagli salvati")
  }

  function openAddCategory() {
    setCategoryDraft({ name: "", is_public: true })
    setIsAddCategoryOpen(true)
    toast.message("Compila i campi e salva")
  }
  function closeAddCategory() {
    setIsAddCategoryOpen(false)
  }
  async function saveAddCategory() {
    if (!categoryDraft.name) return
    await createCategory({ name: categoryDraft.name, is_public: categoryDraft.is_public })
    setIsAddCategoryOpen(false)
  }

  function openAddItem(categoryId: string) {
    setItemDraft({ category_id: categoryId, name: "", description: "", image_url: "", is_public: true, uploading: false })
    setIsAddItemOpen(true)
    toast.message("Carica un'immagine e compila i campi")
  }
  function closeAddItem() {
    setIsAddItemOpen(false)
  }
  async function saveAddItem() {
    if (!itemDraft.category_id || !itemDraft.name) return
    await createItem({
      category_id: itemDraft.category_id,
      name: itemDraft.name,
      description: itemDraft.description,
      image_url: itemDraft.image_url,
      is_public: itemDraft.is_public,
    })
    setIsAddItemOpen(false)
  }

  async function uploadItemImage(file: File) {
    setItemDraft((d) => ({ ...d, uploading: true }))
    const supabase = getSupabaseBrowser()
    const safeName = sanitizeFileName(file.name)
    const path = `products/${itemDraft.category_id}/${Date.now()}-${safeName}`
    const { error } = await supabase.storage.from("images").upload(path, file, {
      cacheControl: "3600",
      upsert: true,
      contentType: file.type,
    })
    if (error) {
      toast.error(`Upload fallito: ${error.message}`)
      setItemDraft((d) => ({ ...d, uploading: false }))
      return
    }
    const { data } = supabase.storage.from("images").getPublicUrl(path)
    setItemDraft((d) => ({ ...d, image_url: data.publicUrl, uploading: false }))
    toast.success("Immagine caricata")
  }

  function extractStoragePath(publicUrl?: string | null): string | null {
    if (!publicUrl) return null
    const base = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/images/`
    if (publicUrl.startsWith(base)) return publicUrl.slice(base.length)
    return null
  }

  async function uploadImage(file: File) {
    if (!selectedItemId) return
    const supabase = getSupabaseBrowser()
    const safeName = sanitizeFileName(file.name)
    const path = `products/${selectedItemId}/${Date.now()}-${safeName}`
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
    setDraft((d) => ({ ...d, image_url: data.publicUrl }))
    toast.success("Immagine aggiornata")
  }

  async function removeImageFromStorage() {
    const supabase = getSupabaseBrowser()
    const path = extractStoragePath(draft.image_url || undefined)
    if (!path) {
      setDraft((d) => ({ ...d, image_url: "" }))
      return
    }
    await supabase.storage.from("images").remove([path])
    setDraft((d) => ({ ...d, image_url: "" }))
    toast.success("Immagine rimossa")
  }

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <h1 className="text-xl font-semibold mb-4">Categorie</h1>

      <div className="mb-6 flex items-center justify-between">
        <button className="inline-flex items-center gap-2 rounded-md border px-3 py-2" onClick={openAddCategory}>
          <Plus className="h-4 w-4" />
          <span>Nuova categoria</span>
        </button>
      </div>

      {loading ? (
        <div>Caricamento…</div>
      ) : (
        <div>

          <ul className="space-y-3">
            {categories.map((c) => {
              const related = items.filter((i) => i.category_id === c.id)
              return (
                <li key={c.id} className="border rounded-md">
                  <details>
                    <summary className="cursor-pointer select-none p-3 flex items-center justify-between">
                      <div className="truncate">
                        <span className="font-medium">{c.name}</span>
                        <span className="ml-2 text-xs px-2 py-0.5 rounded-full border">
                          {related.length} prodotti
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          className="p-2 rounded-md border"
                          title="Nuovo prodotto"
                          onClick={(e) => { e.preventDefault(); openAddItem(c.id) }}
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                        <button
                          className="p-2 rounded-md border"
                          title={c.is_public ? "Nascondi" : "Pubblica"}
                          onClick={(e) => {
                            e.preventDefault()
                            toggleCategoryVisibility(c.id, c.is_public)
                          }}
                        >
                          {c.is_public ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                        <button
                          className="p-2 rounded-md border"
                          title="Elimina"
                          onClick={(e) => {
                            e.preventDefault()
                            removeCategory(c.id)
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </summary>
                    <div className="p-3 pt-0">
                      {related.length === 0 ? (
                        <div className="text-sm text-black/60 dark:text-white/60">Nessun prodotto</div>
                      ) : (
                        <ul className="space-y-2">
                          {related.map((i) => (
                            <li key={i.id} className="border rounded-md p-3 flex items-center justify-between gap-3">
                              <div className="flex items-start gap-3 min-w-0 flex-1">
                                <div className="h-12 w-16 shrink-0 rounded bg-black/5 dark:bg-white/10 overflow-hidden flex items-center justify-center">
                                  {i.image_url ? (
                                    <img src={i.image_url} alt={i.name ?? "Prodotto"} className="h-full w-full object-cover" />
                                  ) : (
                                    <div className="text-[10px] text-black/50 dark:text-white/50">N/A</div>
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <button className="font-medium underline underline-offset-4" onClick={() => openDetails(i)}>
                                    {i.name}
                                  </button>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <button className="p-2 rounded-md border" title={i.is_public ? "Nascondi" : "Pubblica"} onClick={() => toggleItemVisibility(i.id, i.is_public)}>
                                  {i.is_public ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                                <button className="p-2 rounded-md border" title="Elimina" onClick={() => removeItem(i.id)}>
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </details>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {selectedItem && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-40"
            role="button"
            tabIndex={-1}
            onClick={closeDetails}
          />
          <aside
            className="fixed top-0 right-0 h-screen bg-white dark:bg-black border-l border-black/10 dark:border-white/10 z-50 flex flex-col"
            style={{ width: detailsWidth }}
          >
            <div
              className="absolute left-0 top-0 h-full w-1 cursor-col-resize bg-transparent"
              onMouseDown={(e) => {
                isResizingRef.current = true
                startXRef.current = e.clientX
                startWidthRef.current = detailsWidth
                document.body.style.cursor = "col-resize"
              }}
            />
            <div className="p-4 border-b border-black/10 dark:border-white/10 flex items-center justify-between">
              <h3 className="font-semibold">Dettagli prodotto</h3>
              <button className="rounded-md border p-2" title="Chiudi" onClick={closeDetails}><X className="h-4 w-4" /></button>
            </div>
            <div className="p-4 space-y-3 overflow-auto">
              <div className="flex items-center gap-3">
                <div className="h-16 w-24 rounded bg-black/5 dark:bg-white/10 overflow-hidden flex items-center justify-center">
                  {draft.image_url ? (
                    <img src={draft.image_url} alt={String(draft.name || "Prodotto")} className="h-full w-full object-cover" />
                  ) : (
                    <div className="text-xs text-black/50 dark:text-white/50">N/A</div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <label className="inline-flex items-center gap-2 rounded-md border px-2 py-1 cursor-pointer" title="Carica">
                    <Upload className="h-4 w-4" />
                    <span className="text-sm">Carica</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) uploadImage(file)
                      }}
                    />
                  </label>
                  {draft.image_url && (
                    <button className="rounded-md border px-2 py-1" title="Rimuovi immagine" onClick={removeImageFromStorage}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
              <label className="block text-sm">
                <div className="mb-1">Nome</div>
                <input className="w-full rounded-md border px-3 py-2 bg-transparent" value={draft.name ?? ""} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
              </label>
              <label className="block text-sm">
                <div className="mb-1">Descrizione</div>
                <textarea className="w-full rounded-md border px-3 py-2 bg-transparent" rows={4} value={draft.description ?? ""} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} />
              </label>
              <label className="block text-sm">
                <div className="mb-1">URL immagine</div>
                <input className="w-full rounded-md border px-3 py-2 bg-transparent" value={draft.image_url ?? ""} onChange={(e) => setDraft((d) => ({ ...d, image_url: e.target.value }))} />
              </label>
              <label className="block text-sm">
                <div className="mb-1">Categoria</div>
                <select className="w-full rounded-md border px-3 py-2 bg-transparent" value={draft.category_id ?? ""} onChange={(e) => setDraft((d) => ({ ...d, category_id: e.target.value }))}>
                  <option value="">—</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>
              <label className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" checked={!!draft.is_public} onChange={(e) => setDraft((d) => ({ ...d, is_public: e.target.checked }))} />
                <span>Pubblico</span>
              </label>
            </div>
            <div className="p-4 mt-auto border-t border-black/10 dark:border-white/10 flex items-center justify-end gap-2">
              <button className="rounded-md border p-2" title="Chiudi" onClick={closeDetails}><X className="h-4 w-4" /></button>
              <button className="rounded-md bg-indigo-600 text-white p-2 disabled:opacity-50" title="Salva" onClick={saveDetails} disabled={!draft.name || !draft.id}>
                <Save className="h-4 w-4" />
              </button>
            </div>
          </aside>
        </>
      )}

      {isAddCategoryOpen && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" role="button" tabIndex={-1} onClick={closeAddCategory} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-lg bg-white dark:bg-black border border-black/10 dark:border-white/10 overflow-hidden">
              <div className="p-4 border-b border-black/10 dark:border-white/10 flex items-center justify-between">
                <h3 className="font-semibold">Nuova categoria</h3>
                <button className="rounded-md border p-2" title="Chiudi" onClick={closeAddCategory}><X className="h-4 w-4" /></button>
              </div>
              <div className="p-4 space-y-3">
                <label className="block text-sm">
                  <div className="mb-1">Nome</div>
                  <input className="w-full rounded-md border px-3 py-2 bg-transparent" value={categoryDraft.name} onChange={(e) => setCategoryDraft((d) => ({ ...d, name: e.target.value }))} />
                </label>
                <label className="inline-flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={!!categoryDraft.is_public} onChange={(e) => setCategoryDraft((d) => ({ ...d, is_public: e.target.checked }))} />
                  <span>Pubblica</span>
                </label>
              </div>
              <div className="p-4 border-t border-black/10 dark:border-white/10 flex items-center justify-end gap-2">
                <button className="rounded-md border p-2" title="Chiudi" onClick={closeAddCategory}><X className="h-4 w-4" /></button>
                <button className="rounded-md bg-indigo-600 text-white p-2 disabled:opacity-50" title="Salva" onClick={saveAddCategory} disabled={!categoryDraft.name}>
                  <Save className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {isAddItemOpen && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" role="button" tabIndex={-1} onClick={closeAddItem} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-lg rounded-lg bg-white dark:bg-black border border-black/10 dark:border-white/10 overflow-hidden">
              <div className="p-4 border-b border-black/10 dark:border-white/10 flex items-center justify-between">
                <h3 className="font-semibold">Nuovo prodotto</h3>
                <button className="rounded-md border p-2" title="Chiudi" onClick={closeAddItem}><X className="h-4 w-4" /></button>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-20 w-32 rounded bg-black/5 dark:bg-white/10 overflow-hidden flex items-center justify-center">
                    {itemDraft.image_url ? (
                      <img src={itemDraft.image_url} alt={itemDraft.name || "Prodotto"} className="h-full w-full object-cover" />
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
                        if (file) uploadItemImage(file)
                      }}
                    />
                  </label>
                </div>
                <label className="block text-sm">
                  <div className="mb-1">Nome</div>
                  <input className="w-full rounded-md border px-3 py-2 bg-transparent" value={itemDraft.name} onChange={(e) => setItemDraft((d) => ({ ...d, name: e.target.value }))} />
                </label>
                <label className="block text-sm">
                  <div className="mb-1">Descrizione</div>
                  <textarea className="w-full rounded-md border px-3 py-2 bg-transparent" rows={3} value={itemDraft.description} onChange={(e) => setItemDraft((d) => ({ ...d, description: e.target.value }))} />
                </label>
                <label className="inline-flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={!!itemDraft.is_public} onChange={(e) => setItemDraft((d) => ({ ...d, is_public: e.target.checked }))} />
                  <span>Pubblico</span>
                </label>
              </div>
              <div className="p-4 border-t border-black/10 dark:border-white/10 flex items-center justify-end gap-2">
                <button className="rounded-md border p-2" title="Chiudi" onClick={closeAddItem}><X className="h-4 w-4" /></button>
                <button className="rounded-md bg-indigo-600 text-white p-2 disabled:opacity-50" title="Salva" onClick={saveAddItem} disabled={!itemDraft.name || !itemDraft.category_id || itemDraft.uploading}>
                  <Save className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}


