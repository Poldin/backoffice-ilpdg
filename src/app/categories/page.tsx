"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Eye, EyeOff, Trash2, Save, X, Upload, Plus, Pencil, ExternalLink, Hash, Link2, Unlink } from "lucide-react"
import { toast } from "sonner"
import { getSupabaseBrowser } from "@/app/lib/supabase/client"
import { generateSlug } from "@/app/lib/utils/slug"

type Category = {
  id: string
  created_at: string
  name: string | null
  slug: string | null
  is_public: boolean | null
  expert_id?: string | null
  category_description?: string | null
  expert?: { id: string; nome: string | null; img_url: string | null } | null
}
type CategoryItem = {
  id: string
  created_at: string
  category_id: string | null
  name: string | null
  slug: string | null
  description: string | null
  image_url: string | null
  is_public: boolean | null
}

type SellingLink = {
  id: string
  created_at: string
  name: string | null
  link: string | null
  descrizione: string | null
  img_url: string | null
  calltoaction: string | null
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [items, setItems] = useState<CategoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const selectedItem = items.find((i) => i.id === selectedItemId) || null
  const [draft, setDraft] = useState<Partial<CategoryItem>>({})
  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false)
  const [categoryDraft, setCategoryDraft] = useState<{ name: string; slug: string; is_public: boolean; expert_id: string; category_description: string }>({
    name: "",
    slug: "",
    is_public: true,
    expert_id: "",
    category_description: "",
  })
  const [isAddItemOpen, setIsAddItemOpen] = useState(false)
  const [itemDraft, setItemDraft] = useState<{
    category_id: string
    name: string
    slug: string
    description: string
    image_url: string
    is_public: boolean
    uploading: boolean
  }>({ category_id: "", name: "", slug: "", description: "", image_url: "", is_public: true, uploading: false })
  const [detailsWidth, setDetailsWidth] = useState<number>(560)
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)
  const [isEditCategorySidebarOpen, setIsEditCategorySidebarOpen] = useState(false)
  const [originalCategoryData, setOriginalCategoryData] = useState<{ name: string; slug: string; is_public: boolean; expert_id: string; category_description: string } | null>(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [originalProductData, setOriginalProductData] = useState<Partial<CategoryItem> | null>(null)
  const [hasUnsavedProductChanges, setHasUnsavedProductChanges] = useState(false)
  const [categoryLinks, setCategoryLinks] = useState<SellingLink[]>([])
  const [productLinks, setProductLinks] = useState<SellingLink[]>([])
  const [isAttachCategoryOpen, setIsAttachCategoryOpen] = useState(false)
  const [isAttachProductOpen, setIsAttachProductOpen] = useState(false)
  const [attachCategoryQuery, setAttachCategoryQuery] = useState("")
  const [attachCategoryResults, setAttachCategoryResults] = useState<SellingLink[]>([])
  const [attachCategoryLoading, setAttachCategoryLoading] = useState(false)
  const [attachProductQuery, setAttachProductQuery] = useState("")
  const [attachProductResults, setAttachProductResults] = useState<SellingLink[]>([])
  const [attachProductLoading, setAttachProductLoading] = useState(false)
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
      const productData = {
        id: selectedItem.id,
        category_id: selectedItem.category_id ?? "",
        name: selectedItem.name ?? "",
        slug: selectedItem.slug ?? "",
        description: selectedItem.description ?? "",
        image_url: selectedItem.image_url ?? "",
        is_public: !!selectedItem.is_public,
      }
      setDraft(productData)
      setOriginalProductData({ ...productData })
      setHasUnsavedProductChanges(false)
    } else {
      setDraft({})
      setOriginalProductData(null)
      setHasUnsavedProductChanges(false)
    }
  }, [selectedItemId])

  useEffect(() => {
    if (selectedItemId) {
      refreshProductLinks(selectedItemId)
    } else {
      setProductLinks([])
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

  async function refreshCategoryLinks(categoryId: string) {
    const res = await fetch(`/api/selling-links?category_id=${encodeURIComponent(categoryId)}`)
    const data = await res.json()
    setCategoryLinks(Array.isArray(data) ? data : [])
  }

  async function refreshProductLinks(itemId: string) {
    const res = await fetch(`/api/selling-links?item_id=${encodeURIComponent(itemId)}`)
    const data = await res.json()
    setProductLinks(Array.isArray(data) ? data : [])
  }

  async function attachLinkToCategory(linkId: string) {
    if (!editingCategoryId) return
    const res = await fetch("/api/selling-links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "attach", target: "category", target_id: editingCategoryId, selling_link_id: linkId }),
    })
    const data = await res.json()
    if (data?.error) return toast.error(data.error)
    toast.success("Link associato alla categoria")
    setIsAttachCategoryOpen(false)
    setAttachCategoryQuery("")
    await refreshCategoryLinks(editingCategoryId)
  }

  async function detachLinkFromCategory(linkId: string) {
    if (!editingCategoryId) return
    const res = await fetch(`/api/selling-links?type=detach&target=category&target_id=${encodeURIComponent(editingCategoryId)}&selling_link_id=${encodeURIComponent(linkId)}`, { method: "DELETE" })
    const data = await res.json()
    if (data?.error) return toast.error(data.error)
    toast.success("Associazione rimossa")
    await refreshCategoryLinks(editingCategoryId)
  }

  async function attachLinkToProduct(linkId: string) {
    if (!selectedItemId) return
    const res = await fetch("/api/selling-links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "attach", target: "item", target_id: selectedItemId, selling_link_id: linkId }),
    })
    const data = await res.json()
    if (data?.error) return toast.error(data.error)
    toast.success("Link associato al prodotto")
    setIsAttachProductOpen(false)
    setAttachProductQuery("")
    await refreshProductLinks(selectedItemId)
  }

  async function detachLinkFromProduct(linkId: string) {
    if (!selectedItemId) return
    const res = await fetch(`/api/selling-links?type=detach&target=item&target_id=${encodeURIComponent(selectedItemId)}&selling_link_id=${encodeURIComponent(linkId)}`, { method: "DELETE" })
    const data = await res.json()
    if (data?.error) return toast.error(data.error)
    toast.success("Associazione rimossa")
    await refreshProductLinks(selectedItemId)
  }

  // search selling links when attach modals are open
  useEffect(() => {
    if (!isAttachCategoryOpen) return
    let active = true
    setAttachCategoryLoading(true)
    const controller = new AbortController()
    const timeout = setTimeout(async () => {
      try {
        const url = attachCategoryQuery.trim() ? `/api/selling-links?q=${encodeURIComponent(attachCategoryQuery.trim())}` : "/api/selling-links"
        const res = await fetch(url, { signal: controller.signal })
        const data = await res.json()
        if (!active) return
        setAttachCategoryResults(Array.isArray(data) ? data : [])
      } catch {
        if (!active) return
        setAttachCategoryResults([])
      } finally {
        if (active) setAttachCategoryLoading(false)
      }
    }, 250)
    return () => {
      active = false
      controller.abort()
      clearTimeout(timeout)
    }
  }, [attachCategoryQuery, isAttachCategoryOpen])

  useEffect(() => {
    if (!isAttachProductOpen) return
    let active = true
    setAttachProductLoading(true)
    const controller = new AbortController()
    const timeout = setTimeout(async () => {
      try {
        const url = attachProductQuery.trim() ? `/api/selling-links?q=${encodeURIComponent(attachProductQuery.trim())}` : "/api/selling-links"
        const res = await fetch(url, { signal: controller.signal })
        const data = await res.json()
        if (!active) return
        setAttachProductResults(Array.isArray(data) ? data : [])
      } catch {
        if (!active) return
        setAttachProductResults([])
      } finally {
        if (active) setAttachProductLoading(false)
      }
    }, 250)
    return () => {
      active = false
      controller.abort()
      clearTimeout(timeout)
    }
  }, [attachProductQuery, isAttachProductOpen])

  async function createCategory(payload: { name: string; slug: string; is_public: boolean }) {
    const res = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        name: payload.name, 
        slug: payload.slug,
        is_public: payload.is_public, 
        expert_id: categoryDraft.expert_id || null, 
        category_description: categoryDraft.category_description || null 
      }),
    })
    const created = await res.json()
    setCategories((prev) => [created, ...prev])
    toast.success("Categoria creata")
  }

  async function updateCategory(id: string, payload: { name: string; slug: string; is_public: boolean; expert_id: string; category_description: string }, skipToast = false) {
    const res = await fetch("/api/categories", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        name: payload.name,
        slug: payload.slug,
        is_public: payload.is_public,
        expert_id: payload.expert_id || null,
        category_description: payload.category_description || null,
      }),
    })
    const updated = await res.json()
    setCategories((prev) => prev.map((c) => (c.id === id ? updated : c)))
    if (!skipToast) {
      toast.success("Categoria aggiornata")
    }
  }

  // Check if category data has unsaved changes
  function checkForUnsavedChanges() {
    if (!originalCategoryData) return false
    
    return (
      categoryDraft.name !== originalCategoryData.name ||
      categoryDraft.slug !== originalCategoryData.slug ||
      categoryDraft.is_public !== originalCategoryData.is_public ||
      categoryDraft.expert_id !== originalCategoryData.expert_id ||
      categoryDraft.category_description !== originalCategoryData.category_description
    )
  }

  // Update unsaved changes state whenever categoryDraft changes
  useEffect(() => {
    setHasUnsavedChanges(checkForUnsavedChanges())
  }, [categoryDraft, originalCategoryData])

  // Check if product data has unsaved changes
  function checkForUnsavedProductChanges() {
    if (!originalProductData) return false
    
    return (
      draft.name !== originalProductData.name ||
      draft.slug !== originalProductData.slug ||
      draft.description !== originalProductData.description ||
      draft.image_url !== originalProductData.image_url ||
      draft.category_id !== originalProductData.category_id ||
      draft.is_public !== originalProductData.is_public
    )
  }

  // Update unsaved product changes state whenever draft changes
  useEffect(() => {
    setHasUnsavedProductChanges(checkForUnsavedProductChanges())
  }, [draft, originalProductData])

  // Save product changes
  async function saveProductChanges() {
    if (!hasUnsavedProductChanges || !draft.id) return
    
    await saveDetails()
    setHasUnsavedProductChanges(false)
    setOriginalProductData({ ...draft })
  }

  // Cancel product changes and revert to original data
  function cancelProductChanges() {
    if (!originalProductData) return
    
    setDraft({ ...originalProductData })
    setHasUnsavedProductChanges(false)
  }

  // Reset unsaved changes when sidebar closes
  useEffect(() => {
    if (!isEditCategorySidebarOpen) {
      setHasUnsavedChanges(false)
      setOriginalCategoryData(null)
    }
  }, [isEditCategorySidebarOpen])

  // Keyboard shortcuts for saving
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Check for Ctrl+S (Windows/Linux) or Cmd+S (Mac)
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault() // Prevent browser's default save dialog
        
        // console.log('Ctrl+S pressed', {
        //   isEditCategorySidebarOpen,
        //   hasUnsavedChanges,
        //   editingCategoryId,
        //   selectedItemId,
        //   hasUnsavedProductChanges
        // })
        
        // Save category changes if category sidebar is open and has unsaved changes
        if (isEditCategorySidebarOpen && hasUnsavedChanges && editingCategoryId) {
          console.log('Saving category changes')
          saveCategoryChanges()
          return
        }
        
        // Save product changes if product details are open and has unsaved changes
        if (selectedItemId && hasUnsavedProductChanges) {
          console.log('Saving product changes')
          saveProductChanges()
          return
        }
        
        console.log('No action taken - conditions not met')
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isEditCategorySidebarOpen, hasUnsavedChanges, editingCategoryId, selectedItemId, hasUnsavedProductChanges, saveCategoryChanges, saveProductChanges])

  // Reset unsaved product changes when details panel closes
  useEffect(() => {
    if (!selectedItemId) {
      setHasUnsavedProductChanges(false)
      setOriginalProductData(null)
    }
  }, [selectedItemId])

  // Save category changes
  async function saveCategoryChanges() {
    if (!editingCategoryId || !hasUnsavedChanges) return
    
    await updateCategory(editingCategoryId, categoryDraft, false) // show toast
    setHasUnsavedChanges(false)
    setOriginalCategoryData({ ...categoryDraft })
  }

  // Cancel category changes and revert to original data
  function cancelCategoryChanges() {
    if (!originalCategoryData) return
    
    setCategoryDraft({ ...originalCategoryData })
    setHasUnsavedChanges(false)
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
    if (editingCategoryId === id) setEditingCategoryId(null)
    toast.success("Categoria eliminata")
  }

  async function createItem(payload: {
    category_id: string
    name: string
    slug: string
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
        slug: draft.slug ?? null,
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
    setEditingCategoryId(null)
    setCategoryDraft({ name: "", slug: "", is_public: true, expert_id: "", category_description: "" })
    setIsAddCategoryOpen(true)
    toast.message("Compila i campi e salva")
  }
  function closeAddCategory() {
    setIsAddCategoryOpen(false)
  }
  async function saveAddCategory() {
    if (!categoryDraft.name) return
    if (editingCategoryId) {
      await updateCategory(editingCategoryId, categoryDraft)
    } else {
      await createCategory({ name: categoryDraft.name, slug: categoryDraft.slug, is_public: categoryDraft.is_public })
    }
    setIsAddCategoryOpen(false)
    setEditingCategoryId(null)
  }

  type Expert = { id: string; nome: string | null; img_url: string | null }

  function ToggleSwitch({ checked, onChange, label }: { checked: boolean; onChange: (checked: boolean) => void; label: string }) {
    return (
      <div className="flex items-center gap-3">
        <button
          type="button"
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
            checked ? 'bg-indigo-600' : 'bg-gray-200'
          }`}
          onClick={() => onChange(!checked)}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
              checked ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
        <label className="text-sm text-gray-700 cursor-pointer" onClick={() => onChange(!checked)}>
          {label}
        </label>
      </div>
    )
  }

  function ExpertPicker({ selectedExpertId, onPick }: { selectedExpertId?: string | null; onPick: (e: Expert | null) => void }) {
    const [open, setOpen] = useState(false)
    useEffect(() => {
      function handler() {
        setOpen(true)
      }
      document.addEventListener('open-expert-picker', handler)
      return () => document.removeEventListener('open-expert-picker', handler)
    }, [])
    const [query, setQuery] = useState("")
    const [results, setResults] = useState<Expert[]>([])
    const [loading, setLoading] = useState(false)

    useEffect(() => {
      if (!open) return
      let active = true
      setLoading(true)
      const controller = new AbortController()
      const timeout = setTimeout(async () => {
        try {
          const url = query.trim() ? `/api/experts-search?q=${encodeURIComponent(query.trim())}` : `/api/experts-search`
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
    }, [query, open])

    return (
      <div className="block text-sm">
        
        

        {open && (
          <>
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 z-40" role="button" tabIndex={-1} onClick={() => setOpen(false)} />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="w-full max-w-2xl rounded-xl bg-white border border-gray-200 shadow-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                  <h3 className="text-lg font-medium text-gray-900">Seleziona esperto</h3>
                  <button className="inline-flex items-center p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100" title="Chiudi" onClick={() => setOpen(false)}>
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="px-6 py-4 space-y-4">
                  <input
                    autoFocus
                    placeholder="Cerca per nome…"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors duration-200"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  <div className="max-h-80 overflow-auto border border-gray-200 rounded-lg divide-y divide-gray-200">
                    {loading ? (
                      <div className="p-4 text-sm text-gray-700">Caricamento…</div>
                    ) : results.length === 0 ? (
                      <div className="p-4 text-sm text-gray-700">Nessun risultato</div>
                    ) : (
                      <div>
                        {results.map((r) => (
                          <button
                            key={r.id}
                            className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-3 transition-colors duration-200"
                            onClick={() => {
                              onPick(r)
                              setOpen(false)
                            }}
                          >
                            {r.img_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={r.img_url} alt={r.nome || "Expert"} className="h-8 w-8 rounded-full object-cover" />
                            ) : (
                              <div className="h-8 w-8 rounded-full bg-gray-200" />
                            )}
                            <span className="text-sm font-medium text-gray-900">{r.nome || "(senza nome)"}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    )
  }

  function SelectedExpertPreview({ expertId }: { expertId: string }) {
    const [expert, setExpert] = useState<Expert | null>(null)
    useEffect(() => {
      let active = true
      ;(async () => {
        try {
          const res = await fetch(`/api/experts-search?id=${encodeURIComponent(expertId)}`)
          const data = await res.json()
          if (!active) return
          setExpert(Array.isArray(data) && data.length > 0 ? data[0] : null)
        } catch {
          if (!active) return
          setExpert(null)
        }
      })()
      return () => {
        active = false
      }
    }, [expertId])
    if (!expert) return null
    return (
      <div className="mt-2 flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
        {expert.img_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={expert.img_url} alt={expert.nome || "Expert"} className="h-8 w-8 rounded-full object-cover" />
        ) : (
          <div className="h-8 w-8 rounded-full bg-gray-200" />
        )}
        <span className="text-sm font-medium text-gray-900">{expert.nome || "(senza nome)"}</span>
      </div>
    )
  }

  function openAddItem(categoryId: string) {
    setItemDraft({ category_id: categoryId, name: "", slug: "", description: "", image_url: "", is_public: true, uploading: false })
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
      slug: itemDraft.slug,
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
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-medium text-gray-900 mb-2">Categorie</h1>
          <p className="text-gray-600">Gestisci le categorie e i prodotti del tuo catalogo</p>
        </div>

        <div className="mb-8">
          <button 
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg font-medium transition-colors duration-200 shadow-sm" 
            onClick={openAddCategory}
          >
            <Plus className="h-4 w-4" />
            <span>Nuova categoria</span>
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-gray-700">Caricamento…</div>
          </div>
        ) : (
          <div className="space-y-6">
            {categories.map((c) => {
              const related = items.filter((i) => i.category_id === c.id)
              return (
                <div key={c.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <details className="group">
                    <summary className="cursor-pointer select-none p-6 flex items-center justify-between hover:bg-gray-50 transition-colors duration-200">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-medium text-gray-900 truncate">{c.name}</h3>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            {related.length} prodotti
                          </span>
                          {c.is_public && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              Pubblica
                            </span>
                          )}
                        </div>
                        {c.category_description && (
                          <p className="text-sm text-gray-600 truncate">{c.category_description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <Link
                          href={`/categories/${c.id}/table`}
                          className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors duration-200"
                          title="Editor tabellare"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Tabella
                        </Link>
                        <button
                          className="inline-flex items-center p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors duration-200"
                          title="Modifica categoria"
                          onClick={(e) => {
                            e.preventDefault()
                            setEditingCategoryId(c.id)
                            const originalData = {
                              name: c.name || "",
                              slug: c.slug || "",
                              is_public: !!c.is_public,
                              expert_id: c.expert_id || "",
                              category_description: c.category_description || "",
                            }
                            setCategoryDraft({ ...originalData })
                            setOriginalCategoryData({ ...originalData })
                            setHasUnsavedChanges(false)
                            setIsEditCategorySidebarOpen(true)
                            refreshCategoryLinks(c.id)
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          className="inline-flex items-center p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors duration-200"
                          title="Nuovo prodotto"
                          onClick={(e) => { e.preventDefault(); openAddItem(c.id) }}
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                        <button
                          className="inline-flex items-center p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors duration-200"
                          title={c.is_public ? "Nascondi" : "Pubblica"}
                          onClick={(e) => {
                            e.preventDefault()
                            toggleCategoryVisibility(c.id, c.is_public)
                          }}
                        >
                          {c.is_public ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                        <button
                          className="inline-flex items-center p-1.5 text-red-400 hover:text-red-600 rounded-md hover:bg-red-50 transition-colors duration-200"
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
                    <div className="border-t border-gray-200 bg-gray-50 p-6">
                      {related.length === 0 ? (
                        <div className="text-center py-8">
                          <div className="text-gray-700 text-sm">Nessun prodotto in questa categoria</div>
                          <button 
                            className="mt-3 inline-flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                            onClick={() => openAddItem(c.id)}
                          >
                            <Plus className="h-4 w-4" />
                            Aggiungi il primo prodotto
                          </button>
                        </div>
                      ) : (
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                          {related.map((i) => (
                            <div 
                              key={i.id} 
                              className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow duration-200 cursor-pointer relative"
                              onClick={() => openDetails(i)}
                            >
                              <div className="flex items-start gap-3">
                                <div className="h-16 w-16 flex-shrink-0 rounded-lg bg-gray-100 overflow-hidden">
                                  {i.image_url ? (
                                    <img src={i.image_url} alt={i.name ?? "Prodotto"} className="h-full w-full object-cover" />
                                  ) : (
                                    <div className="h-full w-full flex items-center justify-center text-xs text-gray-700">N/A</div>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h4 className="text-sm font-medium text-gray-900 hover:text-indigo-600 truncate transition-colors duration-200">
                                    {i.name}
                                  </h4>
                                  <div className="flex items-center gap-2 mt-2">
                                    {i.is_public && (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                        Pubblico
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center justify-end gap-1 mt-3 relative z-10">
                                <button 
                                  className="inline-flex items-center p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors duration-200" 
                                  title={i.is_public ? "Nascondi" : "Pubblica"} 
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    toggleItemVisibility(i.id, i.is_public)
                                  }}
                                >
                                  {i.is_public ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                                </button>
                                <button 
                                  className="inline-flex items-center p-1.5 text-red-400 hover:text-red-600 rounded-md hover:bg-red-50 transition-colors duration-200" 
                                  title="Elimina" 
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    removeItem(i.id)
                                  }}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </details>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {selectedItem && (
        <>
          <div
            className="fixed inset-0 bg-gray-500 bg-opacity-75 z-40"
            role="button"
            tabIndex={-1}
            onClick={closeDetails}
          />
          <aside
            className="fixed top-0 right-0 h-screen bg-white border-l border-gray-200 z-50 flex flex-col shadow-xl"
            style={{ width: detailsWidth * 2 }}
          >
            <div
              className="absolute left-0 top-0 h-full w-1 cursor-col-resize bg-transparent"
              onMouseDown={(e) => {
                isResizingRef.current = true
                startXRef.current = e.clientX
                startWidthRef.current = detailsWidth * 2
                document.body.style.cursor = "col-resize"
              }}
            />
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-medium text-gray-900">Dettagli prodotto</h3>
                {hasUnsavedProductChanges && (
                  <div className="flex items-center gap-2">
                    <button
                      className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 transition-colors duration-200"
                      onClick={saveProductChanges}
                      title={`Salva modifiche (${navigator.platform.toLowerCase().includes('mac') ? '⌘' : 'Ctrl'}+S)`}
                    >
                      <Save className="h-3 w-3" />
                      Salva
                    </button>
                    <button
                      className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors duration-200"
                      onClick={cancelProductChanges}
                    >
                      Annulla
                    </button>
                  </div>
                )}
              </div>
              <button className="inline-flex items-center p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100" title="Chiudi" onClick={closeDetails}>
                <X className="h-5 w-5" />
              </button>
            </div>
            
            {/* Two column layout */}
            <div className="flex-1 flex overflow-hidden">
              {/* Left column - Product info */}
              <div className="w-1/2 px-6 py-6 space-y-6 overflow-auto border-r border-gray-200">
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-3">Immagine prodotto</h4>
                  <div className="flex items-start gap-4">
                    <div className="h-20 w-28 rounded-lg bg-gray-100 overflow-hidden flex items-center justify-center">
                      {draft.image_url ? (
                        <img src={draft.image_url} alt={draft.name || "Prodotto"} className="h-full w-full object-cover" />
                      ) : (
                        <div className="text-xs text-gray-700">Nessuna immagine</div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="inline-flex items-center gap-2 bg-white border border-gray-300 rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer transition-colors duration-200">
                        <Upload className="h-4 w-4" />
                        <span>Carica</span>
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
                        <>
                          <button 
                            className="inline-flex items-center p-2 text-blue-400 hover:text-blue-600 rounded-md hover:bg-blue-50 transition-colors duration-200" 
                            title="Apri immagine in nuova tab" 
                            onClick={() => draft.image_url && window.open(draft.image_url, '_blank')}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </button>
                          <button 
                            className="inline-flex items-center p-2 text-red-400 hover:text-red-600 rounded-md hover:bg-red-50 transition-colors duration-200" 
                            title="Rimuovi immagine" 
                            onClick={removeImageFromStorage}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Nome</label>
                  <input 
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors duration-200" 
                    value={draft.name ?? ""} 
                    onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} 
                    placeholder="Nome del prodotto"
                  />
                </div>
                
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">Slug</label>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded transition-colors duration-200"
                      onClick={() => setDraft((d) => ({ ...d, slug: generateSlug(d.name || "") }))}
                      title="Genera slug automaticamente dal nome"
                    >
                      <Hash className="h-3 w-3" />
                      Auto
                    </button>
                  </div>
                  <input 
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors duration-200" 
                    value={draft.slug ?? ""} 
                    onChange={(e) => setDraft((d) => ({ ...d, slug: e.target.value }))} 
                    placeholder="slug-prodotto"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Categoria</label>
                  <select 
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors duration-200" 
                    value={draft.category_id ?? ""} 
                    onChange={(e) => setDraft((d) => ({ ...d, category_id: e.target.value }))}
                  >
                    <option value="">Seleziona categoria</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                
                <ToggleSwitch
                  checked={!!draft.is_public}
                  onChange={(checked) => setDraft((d) => ({ ...d, is_public: checked }))}
                  label="Prodotto pubblico"
                />

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium text-gray-900">Selling links associati</h4>
                    <button
                      type="button"
                      className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors duration-200"
                      onClick={() => setIsAttachProductOpen(true)}
                    >
                      Associa link
                    </button>
                  </div>
                  {productLinks.length === 0 ? (
                    <div className="text-sm text-gray-500">Nessun link associato</div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {productLinks.map((l) => (
                        <span key={l.id} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-gray-100 text-gray-800 text-xs">
                          {l.name || "(senza nome)"}
                          <button className="ml-1 text-red-500 hover:text-red-700" title="Rimuovi" onClick={() => detachLinkFromProduct(l.id)}>
                            <Unlink className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              
              {/* Right column - Description */}
              <div className="w-1/2 px-6 py-6 flex flex-col">
                <label className="block text-sm font-medium text-gray-700 mb-2">Descrizione</label>
                <textarea 
                  className="flex-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors duration-200 resize-none" 
                  value={draft.description ?? ""} 
                  onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} 
                  placeholder="Descrizione del prodotto"
                />
              </div>
            </div>
          </aside>
        </>
      )}

      {isAddCategoryOpen && (
        <>
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 z-40" role="button" tabIndex={-1} onClick={closeAddCategory} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-lg rounded-xl bg-white border border-gray-200 shadow-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">{editingCategoryId ? "Modifica categoria" : "Nuova categoria"}</h3>
                <button className="inline-flex items-center p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100" title="Chiudi" onClick={closeAddCategory}>
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="px-6 py-6 space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Nome categoria</label>
                  <input 
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors duration-200" 
                    value={categoryDraft.name} 
                    onChange={(e) => setCategoryDraft((d) => ({ ...d, name: e.target.value }))} 
                    placeholder="Nome della categoria"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">Slug</label>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded transition-colors duration-200"
                      onClick={() => setCategoryDraft((d) => ({ ...d, slug: generateSlug(d.name) }))}
                      title="Genera slug automaticamente dal nome"
                    >
                      <Hash className="h-3 w-3" />
                      Auto
                    </button>
                  </div>
                  <input 
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors duration-200" 
                    value={categoryDraft.slug} 
                    onChange={(e) => setCategoryDraft((d) => ({ ...d, slug: e.target.value }))} 
                    placeholder="slug-categoria"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Descrizione</label>
                  <textarea 
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors duration-200 resize-none" 
                    rows={3} 
                    value={categoryDraft.category_description} 
                    onChange={(e) => setCategoryDraft((d) => ({ ...d, category_description: e.target.value }))} 
                    placeholder="Descrizione della categoria"
                  />
                </div>
                <ExpertPicker
                  selectedExpertId={categoryDraft.expert_id}
                  onPick={(exp) => setCategoryDraft((d) => ({ ...d, expert_id: exp?.id || "" }))}
                />
                <ToggleSwitch
                  checked={!!categoryDraft.is_public}
                  onChange={(checked) => setCategoryDraft((d) => ({ ...d, is_public: checked }))}
                  label="Categoria pubblica"
                />

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium text-gray-900">Selling links associati</h4>
                    <button
                      type="button"
                      className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors duration-200"
                      onClick={() => setIsAttachCategoryOpen(true)}
                    >
                      Associa link
                    </button>
                  </div>
                  {categoryLinks.length === 0 ? (
                    <div className="text-sm text-gray-500">Nessun link associato</div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {categoryLinks.map((l) => (
                        <span key={l.id} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-gray-100 text-gray-800 text-xs">
                          {l.name || "(senza nome)"}
                          <button className="ml-1 text-red-500 hover:text-red-700" title="Rimuovi" onClick={() => detachLinkFromCategory(l.id)}>
                            <Unlink className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                <button 
                  className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors duration-200" 
                  onClick={closeAddCategory}
                >
                  Annulla
                </button>
                <button 
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors duration-200" 
                  onClick={saveAddCategory} 
                  disabled={!categoryDraft.name}
                >
                  <Save className="h-4 w-4" />
                  {editingCategoryId ? "Salva modifiche" : "Crea categoria"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {isEditCategorySidebarOpen && editingCategoryId && (
        <>
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 z-40" role="button" tabIndex={-1} onClick={() => setIsEditCategorySidebarOpen(false)} />
          <aside
            className="fixed top-0 right-0 h-screen bg-white border-l border-gray-200 z-50 flex flex-col shadow-xl"
            style={{ width: detailsWidth * 2 }}
          >
            <div
              className="absolute left-0 top-0 h-full w-1 cursor-col-resize bg-transparent"
              onMouseDown={(e) => {
                isResizingRef.current = true
                startXRef.current = e.clientX
                startWidthRef.current = detailsWidth * 2
                document.body.style.cursor = "col-resize"
              }}
            />
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-medium text-gray-900">Modifica categoria</h3>
                {hasUnsavedChanges && (
                  <div className="flex items-center gap-2">
                    <button
                      className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 transition-colors duration-200"
                      onClick={saveCategoryChanges}
                      title={`Salva modifiche (${navigator.platform.toLowerCase().includes('mac') ? '⌘' : 'Ctrl'}+S)`}
                    >
                      <Save className="h-3 w-3" />
                      Salva
                    </button>
                    <button
                      className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors duration-200"
                      onClick={cancelCategoryChanges}
                    >
                      Annulla
                    </button>
                  </div>
                )}
              </div>
              <button className="inline-flex items-center p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100" title="Chiudi" onClick={() => setIsEditCategorySidebarOpen(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            
            {/* Two column layout */}
            <div className="flex-1 flex overflow-hidden">
              {/* Left column - Category info */}
              <div className="w-1/2 px-6 py-6 space-y-6 overflow-auto border-r border-gray-200">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Nome categoria</label>
                  <input 
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors duration-200" 
                    value={categoryDraft.name} 
                    onChange={(e) => setCategoryDraft((d) => ({ ...d, name: e.target.value }))} 
                    placeholder="Nome della categoria"
                  />
                </div>
                
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">Slug</label>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded transition-colors duration-200"
                      onClick={() => setCategoryDraft((d) => ({ ...d, slug: generateSlug(d.name) }))}
                      title="Genera slug automaticamente dal nome"
                    >
                      <Hash className="h-3 w-3" />
                      Auto
                    </button>
                  </div>
                  <input 
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors duration-200" 
                    value={categoryDraft.slug} 
                    onChange={(e) => setCategoryDraft((d) => ({ ...d, slug: e.target.value }))} 
                    placeholder="slug-categoria"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Esperto associato</label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors duration-200"
                      onClick={() => document.dispatchEvent(new Event('open-expert-picker'))}
                    >
                      {categoryDraft.expert_id ? "Cambia esperto" : "Seleziona esperto…"}
                    </button>
                    {categoryDraft.expert_id && (
                      <button
                        type="button"
                        className="inline-flex items-center p-1.5 text-red-400 hover:text-red-600 rounded-md hover:bg-red-50 transition-colors duration-200"
                        title="Rimuovi selezione"
                        onClick={() => setCategoryDraft((d) => ({ ...d, expert_id: "" }))}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  {categoryDraft.expert_id && (
                    <SelectedExpertPreview key={categoryDraft.expert_id} expertId={categoryDraft.expert_id} />
                  )}
                  <ExpertPicker
                    selectedExpertId={categoryDraft.expert_id}
                    onPick={(exp) => setCategoryDraft((d) => ({ ...d, expert_id: exp?.id || "" }))}
                  />
                </div>
                
                <ToggleSwitch
                  checked={!!categoryDraft.is_public}
                  onChange={(checked) => setCategoryDraft((d) => ({ ...d, is_public: checked }))}
                  label="Categoria pubblica"
                />
              </div>
              
              {/* Right column - Description */}
              <div className="w-1/2 px-6 py-6 flex flex-col">
                <label className="block text-sm font-medium text-gray-700 mb-2">Descrizione</label>
                <textarea 
                  className="flex-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors duration-200 resize-none" 
                  value={categoryDraft.category_description} 
                  onChange={(e) => setCategoryDraft((d) => ({ ...d, category_description: e.target.value }))} 
                  placeholder="Descrizione della categoria"
                />
              </div>
            </div>
          </aside>
          {/* Expert picker modal embedded in ExpertPicker component; nothing to render here */}
          {isAttachCategoryOpen && (
            <>
              <div className="fixed inset-0 bg-gray-500 bg-opacity-75 z-40" role="button" tabIndex={-1} onClick={() => setIsAttachCategoryOpen(false)} />
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="w-full max-w-lg rounded-xl bg-white border border-gray-200 shadow-xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                    <h3 className="text-lg font-medium text-gray-900">Associa link alla categoria</h3>
                    <button className="inline-flex items-center p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100" title="Chiudi" onClick={() => setIsAttachCategoryOpen(false)}>
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  <div className="px-6 py-6 space-y-4">
                    <input
                      autoFocus
                      placeholder="Cerca link…"
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors duration-200"
                      value={attachCategoryQuery}
                      onChange={(e) => setAttachCategoryQuery(e.target.value)}
                    />
                    <div className="max-h-80 overflow-auto border border-gray-200 rounded-lg divide-y divide-gray-200">
                      {attachCategoryLoading ? (
                        <div className="p-4 text-sm text-gray-700">Caricamento…</div>
                      ) : attachCategoryResults.length === 0 ? (
                        <div className="p-4 text-sm text-gray-700">Nessun risultato</div>
                      ) : (
                        <div>
                          {attachCategoryResults.map((r) => (
                            <button
                              key={r.id}
                              className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-3 transition-colors duration-200"
                              onClick={() => attachLinkToCategory(r.id)}
                            >
                              <span className="text-sm font-medium text-gray-900">{r.name || "(senza nome)"}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {isAddItemOpen && (
        <>
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 z-40" role="button" tabIndex={-1} onClick={closeAddItem} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-lg rounded-xl bg-white border border-gray-200 shadow-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">Nuovo prodotto</h3>
                <button className="inline-flex items-center p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100" title="Chiudi" onClick={closeAddItem}>
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="px-6 py-6 space-y-6">
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-3">Immagine prodotto</h4>
                  <div className="flex items-start gap-4">
                    <div className="h-24 w-32 rounded-lg bg-gray-100 overflow-hidden flex items-center justify-center">
                      {itemDraft.image_url ? (
                        <img src={itemDraft.image_url} alt={itemDraft.name || "Prodotto"} className="h-full w-full object-cover" />
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
                          if (file) uploadItemImage(file)
                        }}
                      />
                    </label>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Nome prodotto</label>
                  <input 
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors duration-200" 
                    value={itemDraft.name} 
                    onChange={(e) => setItemDraft((d) => ({ ...d, name: e.target.value }))} 
                    placeholder="Nome del prodotto"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">Slug</label>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded transition-colors duration-200"
                      onClick={() => setItemDraft((d) => ({ ...d, slug: generateSlug(d.name) }))}
                      title="Genera slug automaticamente dal nome"
                    >
                      <Hash className="h-3 w-3" />
                      Auto
                    </button>
                  </div>
                  <input 
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors duration-200" 
                    value={itemDraft.slug} 
                    onChange={(e) => setItemDraft((d) => ({ ...d, slug: e.target.value }))} 
                    placeholder="slug-prodotto"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Descrizione</label>
                  <textarea 
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors duration-200 resize-none" 
                    rows={3} 
                    value={itemDraft.description} 
                    onChange={(e) => setItemDraft((d) => ({ ...d, description: e.target.value }))} 
                    placeholder="Descrizione del prodotto"
                  />
                </div>
                <ToggleSwitch
                  checked={!!itemDraft.is_public}
                  onChange={(checked) => setItemDraft((d) => ({ ...d, is_public: checked }))}
                  label="Prodotto pubblico"
                />
              </div>
              <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                <button 
                  className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors duration-200" 
                  onClick={closeAddItem}
                >
                  Annulla
                </button>
                <button 
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors duration-200" 
                  onClick={saveAddItem} 
                  disabled={!itemDraft.name || !itemDraft.category_id || itemDraft.uploading}
                >
                  <Save className="h-4 w-4" />
                  Crea prodotto
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {isAttachProductOpen && selectedItemId && (
        <>
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 z-40" role="button" tabIndex={-1} onClick={() => setIsAttachProductOpen(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-lg rounded-xl bg-white border border-gray-200 shadow-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">Associa link al prodotto</h3>
                <button className="inline-flex items-center p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100" title="Chiudi" onClick={() => setIsAttachProductOpen(false)}>
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="px-6 py-6 space-y-4">
                <input
                  autoFocus
                  placeholder="Cerca link…"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors duration-200"
                  value={attachProductQuery}
                  onChange={(e) => setAttachProductQuery(e.target.value)}
                />
                <div className="max-h-80 overflow-auto border border-gray-200 rounded-lg divide-y divide-gray-200">
                  {attachProductLoading ? (
                    <div className="p-4 text-sm text-gray-700">Caricamento…</div>
                  ) : attachProductResults.length === 0 ? (
                    <div className="p-4 text-sm text-gray-700">Nessun risultato</div>
                  ) : (
                    <div>
                      {attachProductResults.map((r) => (
                        <button
                          key={r.id}
                          className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-3 transition-colors duration-200"
                          onClick={() => attachLinkToProduct(r.id)}
                        >
                          <span className="text-sm font-medium text-gray-900">{r.name || "(senza nome)"}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}


