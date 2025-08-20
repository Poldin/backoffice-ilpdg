"use client"

import { useEffect, useRef, useState } from "react"
import { Plus, Pencil, Trash2, Save, X, Upload, ExternalLink, Hash, Link2, Unlink } from "lucide-react"
import { toast } from "sonner"
import { getSupabaseBrowser } from "@/app/lib/supabase/client"
import { generateSlug } from "@/app/lib/utils/slug"

type SellingLink = {
  id: string
  created_at: string
  name: string | null
  link: string | null
  descrizione: string | null
  img_url: string | null
  calltoaction: string | null
}

type SimpleRef = { id: string; name: string | null }

export default function SellingLinksPage() {
  const [links, setLinks] = useState<SellingLink[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null)
  const selectedLink = links.find((l) => l.id === selectedLinkId) || null
  const [draft, setDraft] = useState<Partial<SellingLink>>({})
  const [isAddLinkOpen, setIsAddLinkOpen] = useState(false)
  const [linkDraft, setLinkDraft] = useState<{
    name: string
    link: string
    descrizione: string
    img_url: string
    calltoaction: string
    uploading: boolean
  }>({ name: "", link: "", descrizione: "", img_url: "", calltoaction: "", uploading: false })
  const [detailsWidth, setDetailsWidth] = useState<number>(560)
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null)
  const [originalLinkData, setOriginalLinkData] = useState<Partial<SellingLink> | null>(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [attachments, setAttachments] = useState<{ categories: SimpleRef[]; products: SimpleRef[] }>({ categories: [], products: [] })
  const [isAttachCategoryOpen, setIsAttachCategoryOpen] = useState(false)
  const [isAttachProductOpen, setIsAttachProductOpen] = useState(false)
  const [attachCategoryQuery, setAttachCategoryQuery] = useState("")
  const [attachCategoryResults, setAttachCategoryResults] = useState<SimpleRef[]>([])
  const [attachCategoryLoading, setAttachCategoryLoading] = useState(false)
  const [attachProductQuery, setAttachProductQuery] = useState("")
  const [attachProductResults, setAttachProductResults] = useState<SimpleRef[]>([])
  const [attachProductLoading, setAttachProductLoading] = useState(false)
  const isResizingRef = useRef(false)
  const startXRef = useRef(0)
  const startWidthRef = useRef(560)

  useEffect(() => {
    ;(async () => {
      const res = await fetch("/api/selling-links")
      const data = await res.json()
      setLinks(Array.isArray(data) ? data : [])
      setLoading(false)
    })()
  }, [])

  useEffect(() => {
    // load saved details width
    try {
      const stored = localStorage.getItem("selling-links:detailsWidth")
      if (stored) setDetailsWidth(Math.min(800, Math.max(360, parseInt(stored))))
    } catch {}
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem("selling-links:detailsWidth", String(detailsWidth))
    } catch {}
  }, [detailsWidth])

  useEffect(() => {
    if (selectedLink) {
      const linkData = {
        id: selectedLink.id,
        name: selectedLink.name ?? "",
        link: selectedLink.link ?? "",
        descrizione: selectedLink.descrizione ?? "",
        img_url: selectedLink.img_url ?? "",
        calltoaction: selectedLink.calltoaction ?? "",
      }
      setDraft(linkData)
      setOriginalLinkData({ ...linkData })
      setHasUnsavedChanges(false)
    } else {
      setDraft({})
      setOriginalLinkData(null)
      setHasUnsavedChanges(false)
    }
  }, [selectedLinkId])

  useEffect(() => {
    if (selectedLinkId) {
      refreshAttachments(selectedLinkId)
    } else {
      setAttachments({ categories: [], products: [] })
    }
  }, [selectedLinkId])

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

  // search categories when attach modal is open
  useEffect(() => {
    if (!isAttachCategoryOpen) return
    let active = true
    setAttachCategoryLoading(true)
    const controller = new AbortController()
    const timeout = setTimeout(async () => {
      try {
        const url = attachCategoryQuery.trim() ? `/api/categories-search?q=${encodeURIComponent(attachCategoryQuery.trim())}` : "/api/categories-search"
        const res = await fetch(url, { signal: controller.signal })
        const data = await res.json()
        if (!active) return
        // Filter out already associated categories
        const filteredData = Array.isArray(data) ? data.filter(category => 
          !attachments.categories.some(existing => existing.id === category.id)
        ) : []
        setAttachCategoryResults(filteredData)
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
  }, [attachCategoryQuery, isAttachCategoryOpen, attachments.categories])

  useEffect(() => {
    if (!isAttachProductOpen) return
    let active = true
    setAttachProductLoading(true)
    const controller = new AbortController()
    const timeout = setTimeout(async () => {
      try {
        const url = attachProductQuery.trim() ? `/api/products-search?q=${encodeURIComponent(attachProductQuery.trim())}` : "/api/products-search"
        const res = await fetch(url, { signal: controller.signal })
        const data = await res.json()
        if (!active) return
        // Filter out already associated products
        const filteredData = Array.isArray(data) ? data.filter(product => 
          !attachments.products.some(existing => existing.id === product.id)
        ) : []
        setAttachProductResults(filteredData)
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
  }, [attachProductQuery, isAttachProductOpen, attachments.products])

  // Check if link data has unsaved changes
  function checkForUnsavedChanges() {
    if (!originalLinkData) return false
    
    return (
      draft.name !== originalLinkData.name ||
      draft.link !== originalLinkData.link ||
      draft.descrizione !== originalLinkData.descrizione ||
      draft.img_url !== originalLinkData.img_url ||
      draft.calltoaction !== originalLinkData.calltoaction
    )
  }

  // Update unsaved changes state whenever draft changes
  useEffect(() => {
    setHasUnsavedChanges(checkForUnsavedChanges())
  }, [draft, originalLinkData])

  // Keyboard shortcuts for saving
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Check for Ctrl+S (Windows/Linux) or Cmd+S (Mac)
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault() // Prevent browser's default save dialog
        
        // Save link changes if details panel is open and has unsaved changes
        if (selectedLinkId && hasUnsavedChanges) {
          saveLinkChanges()
          return
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [selectedLinkId, hasUnsavedChanges])

  // Reset unsaved changes when details panel closes
  useEffect(() => {
    if (!selectedLinkId) {
      setHasUnsavedChanges(false)
      setOriginalLinkData(null)
    }
  }, [selectedLinkId])

  async function refreshAttachments(linkId: string) {
    const res = await fetch(`/api/selling-links?selling_link_id=${encodeURIComponent(linkId)}`)
    const data = await res.json()
    setAttachments({
      categories: Array.isArray(data?.categories) ? data.categories : [],
      products: Array.isArray(data?.products) ? data.products : [],
    })
  }

  async function attachLinkToCategory(linkId: string, categoryId: string) {
    const res = await fetch("/api/selling-links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "attach", target: "category", target_id: categoryId, selling_link_id: linkId }),
    })
    const data = await res.json()
    if (data?.error) return toast.error(data.error)
    toast.success("Link associato alla categoria")
    setIsAttachCategoryOpen(false)
    setAttachCategoryQuery("")
    await refreshAttachments(linkId)
  }

  async function detachLinkFromCategory(linkId: string, categoryId: string) {
    const res = await fetch(`/api/selling-links?type=detach&target=category&target_id=${encodeURIComponent(categoryId)}&selling_link_id=${encodeURIComponent(linkId)}`, { method: "DELETE" })
    const data = await res.json()
    if (data?.error) return toast.error(data.error)
    toast.success("Associazione rimossa")
    await refreshAttachments(linkId)
  }

  async function attachLinkToProduct(linkId: string, productId: string) {
    const res = await fetch("/api/selling-links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "attach", target: "item", target_id: productId, selling_link_id: linkId }),
    })
    const data = await res.json()
    if (data?.error) return toast.error(data.error)
    toast.success("Link associato al prodotto")
    setIsAttachProductOpen(false)
    setAttachProductQuery("")
    await refreshAttachments(linkId)
  }

  async function detachLinkFromProduct(linkId: string, productId: string) {
    const res = await fetch(`/api/selling-links?type=detach&target=item&target_id=${encodeURIComponent(productId)}&selling_link_id=${encodeURIComponent(linkId)}`, { method: "DELETE" })
    const data = await res.json()
    if (data?.error) return toast.error(data.error)
    toast.success("Associazione rimossa")
    await refreshAttachments(linkId)
  }

  async function createLink(payload: { name: string; link: string; descrizione: string; img_url: string; calltoaction: string }) {
    const res = await fetch("/api/selling-links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    const created = await res.json()
    if (created?.error) return toast.error(created.error)
    setLinks((prev) => [created, ...prev])
    toast.success("Link creato")
  }

  async function updateLink(id: string, payload: { name: string; link: string; descrizione: string; img_url: string; calltoaction: string }, skipToast = false) {
    const res = await fetch("/api/selling-links", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...payload }),
    })
    const updated = await res.json()
    if (updated?.error) return toast.error(updated.error)
    setLinks((prev) => prev.map((l) => (l.id === id ? updated : l)))
    if (!skipToast) {
      toast.success("Link aggiornato")
    }
  }

  // Save link changes
  async function saveLinkChanges() {
    if (!hasUnsavedChanges || !draft.id) return
    
    await saveDetails()
    setHasUnsavedChanges(false)
    setOriginalLinkData({ ...draft })
  }

  // Cancel link changes and revert to original data
  function cancelLinkChanges() {
    if (!originalLinkData) return
    
    setDraft({ ...originalLinkData })
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

  async function removeLink(id: string) {
    const ok = window.confirm("Confermi l'eliminazione del link?")
    if (!ok) return
    const res = await fetch(`/api/selling-links?id=${id}`, { method: "DELETE" })
    const data = await res.json()
    if (data?.error) return toast.error(data.error)
    setLinks((prev) => prev.filter((l) => l.id !== id))
    if (selectedLinkId === id) setSelectedLinkId(null)
    toast.success("Link eliminato")
  }

  function openDetails(link: SellingLink) {
    setSelectedLinkId(link.id)
  }

  function closeDetails() {
    setSelectedLinkId(null)
  }

  async function saveDetails() {
    if (!draft.id) return
    const res = await fetch("/api/selling-links", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: draft.id,
        name: draft.name ?? null,
        link: draft.link ?? null,
        descrizione: draft.descrizione ?? null,
        img_url: draft.img_url ?? null,
        calltoaction: draft.calltoaction ?? null,
      }),
    })
    const updated = await res.json()
    if (updated?.error) return toast.error(updated.error)
    setLinks((prev) => prev.map((l) => (l.id === updated.id ? updated : l)))
    toast.success("Dettagli salvati")
  }

  function openAddLink() {
    setEditingLinkId(null)
    setLinkDraft({ name: "", link: "", descrizione: "", img_url: "", calltoaction: "", uploading: false })
    setIsAddLinkOpen(true)
    toast.message("Compila i campi e salva")
  }
  function closeAddLink() {
    setIsAddLinkOpen(false)
  }
  async function saveAddLink() {
    if (!linkDraft.name) return
    if (editingLinkId) {
      await updateLink(editingLinkId, linkDraft)
    } else {
      await createLink({ name: linkDraft.name, link: linkDraft.link, descrizione: linkDraft.descrizione, img_url: linkDraft.img_url, calltoaction: linkDraft.calltoaction })
    }
    setIsAddLinkOpen(false)
    setEditingLinkId(null)
  }

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

  async function uploadLinkImage(file: File) {
    setLinkDraft((d) => ({ ...d, uploading: true }))
    const supabase = getSupabaseBrowser()
    const safeName = sanitizeFileName(file.name)
    const path = `selling-links/${Date.now()}-${safeName}`
    const { error } = await supabase.storage.from("images").upload(path, file, {
      cacheControl: "3600",
      upsert: true,
      contentType: file.type,
    })
    if (error) {
      toast.error(`Upload fallito: ${error.message}`)
      setLinkDraft((d) => ({ ...d, uploading: false }))
      return
    }
    const { data } = supabase.storage.from("images").getPublicUrl(path)
    setLinkDraft((d) => ({ ...d, img_url: data.publicUrl, uploading: false }))
    toast.success("Immagine caricata")
  }

  function extractStoragePath(publicUrl?: string | null): string | null {
    if (!publicUrl) return null
    const base = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/images/`
    if (publicUrl.startsWith(base)) return publicUrl.slice(base.length)
    return null
  }

  async function uploadImage(file: File) {
    if (!selectedLinkId) return
    const supabase = getSupabaseBrowser()
    const safeName = sanitizeFileName(file.name)
    const path = `selling-links/${selectedLinkId}/${Date.now()}-${safeName}`
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
    setDraft((d) => ({ ...d, img_url: data.publicUrl }))
    toast.success("Immagine aggiornata")
  }

  async function removeImageFromStorage() {
    const supabase = getSupabaseBrowser()
    const path = extractStoragePath(draft.img_url || undefined)
    if (!path) {
      setDraft((d) => ({ ...d, img_url: "" }))
      return
    }
    await supabase.storage.from("images").remove([path])
    setDraft((d) => ({ ...d, img_url: "" }))
    toast.success("Immagine rimossa")
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-medium text-gray-900 mb-2">Selling Links</h1>
          <p className="text-gray-600">Gestisci link di vendita e associazioni con categorie e prodotti</p>
        </div>

        <div className="mb-8">
          <button 
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg font-medium transition-colors duration-200 shadow-sm" 
            onClick={openAddLink}
          >
            <Plus className="h-4 w-4" />
            <span>Nuovo link</span>
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-gray-700">Caricamento…</div>
          </div>
        ) : (
          <div className="space-y-6">
            {links.map((l) => {
              return (
                <div key={l.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <details className="group">
                    <summary className="cursor-pointer select-none p-6 flex items-center justify-between hover:bg-gray-50 transition-colors duration-200">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-medium text-gray-900 truncate">{l.name}</h3>
                          {l.calltoaction && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {l.calltoaction}
                            </span>
                          )}
                        </div>
                        {l.descrizione && (
                          <p className="text-sm text-gray-600 truncate">{l.descrizione}</p>
                        )}
                        {l.link && (
                          <div className="mt-2">
                            <a href={l.link} target="_blank" rel="noreferrer" className="inline-flex items-center text-xs text-blue-600 hover:underline">
                              <ExternalLink className="h-3 w-3 mr-1" /> {l.link}
                            </a>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <button
                          className="inline-flex items-center p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors duration-200"
                          title="Modifica link"
                          onClick={(e) => {
                            e.preventDefault()
                            openDetails(l)
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          className="inline-flex items-center p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors duration-200"
                          title="Associa"
                          onClick={(e) => {
                            e.preventDefault()
                            setIsAttachCategoryOpen(true)
                            setAttachCategoryQuery("")
                            setSelectedLinkId(l.id)
                            refreshAttachments(l.id)
                          }}
                        >
                          <Link2 className="h-4 w-4" />
                        </button>
                        <button
                          className="inline-flex items-center p-1.5 text-red-400 hover:text-red-600 rounded-md hover:bg-red-50 transition-colors duration-200"
                          title="Elimina"
                          onClick={(e) => {
                            e.preventDefault()
                            removeLink(l.id)
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </summary>
                    <div className="border-t border-gray-200 bg-gray-50 p-6">
                      <div className="flex items-start gap-6">
                        <div className="h-32 w-32 flex-shrink-0 rounded-lg bg-gray-100 overflow-hidden">
                          {l.img_url ? (
                            <img src={l.img_url} alt={l.name ?? "Link"} className="h-full w-full object-cover" />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center text-xs text-gray-700">Nessuna immagine</div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0 space-y-4">
                          <div>
                            <h4 className="text-sm font-medium text-gray-900 mb-2">Associazioni correnti</h4>
                            <div className="space-y-2">
                              <div>
                                <div className="text-xs text-gray-600 mb-1">Categorie</div>
                                <div className="flex flex-wrap gap-1">
                                  {attachments.categories.length === 0 ? (
                                    <div className="text-sm text-gray-500">Nessuna categoria associata</div>
                                  ) : (
                                    attachments.categories.map((c) => (
                                      <span key={c.id} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-gray-100 text-gray-800 text-xs">
                                        {c.name || "(senza nome)"}
                                      </span>
                                    ))
                                  )}
                                </div>
                              </div>
                              <div>
                                <div className="text-xs text-gray-600 mb-1">Prodotti</div>
                                <div className="flex flex-wrap gap-1">
                                  {attachments.products.length === 0 ? (
                                    <div className="text-sm text-gray-500">Nessun prodotto associato</div>
                                  ) : (
                                    attachments.products.map((p) => (
                                      <span key={p.id} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-gray-100 text-gray-800 text-xs">
                                        {p.name || "(senza nome)"}
                                      </span>
                                    ))
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </details>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {selectedLink && (
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
                <h3 className="text-lg font-medium text-gray-900">Dettagli link</h3>
                {hasUnsavedChanges && (
                  <div className="flex items-center gap-2">
                    <button
                      className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 transition-colors duration-200"
                      onClick={saveLinkChanges}
                      title={`Salva modifiche (${navigator.platform.toLowerCase().includes('mac') ? '⌘' : 'Ctrl'}+S)`}
                    >
                      <Save className="h-3 w-3" />
                      Salva
                    </button>
                    <button
                      className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors duration-200"
                      onClick={cancelLinkChanges}
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
              {/* Left column - Link info */}
              <div className="w-1/2 px-6 py-6 space-y-6 overflow-auto border-r border-gray-200">
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-3">Immagine link</h4>
                  <div className="flex items-start gap-4">
                    <div className="h-20 w-28 rounded-lg bg-gray-100 overflow-hidden flex items-center justify-center">
                      {draft.img_url ? (
                        <img src={draft.img_url} alt={draft.name || "Link"} className="h-full w-full object-cover" />
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
                      {draft.img_url && (
                        <>
                          <button 
                            className="inline-flex items-center p-2 text-blue-400 hover:text-blue-600 rounded-md hover:bg-blue-50 transition-colors duration-200" 
                            title="Apri immagine in nuova tab" 
                            onClick={() => draft.img_url && window.open(draft.img_url, '_blank')}
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
                    placeholder="Nome del link"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">URL</label>
                  <input 
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors duration-200" 
                    value={draft.link ?? ""} 
                    onChange={(e) => setDraft((d) => ({ ...d, link: e.target.value }))} 
                    placeholder="https://…"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Call to Action</label>
                  <input 
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors duration-200" 
                    value={draft.calltoaction ?? ""} 
                    onChange={(e) => setDraft((d) => ({ ...d, calltoaction: e.target.value }))} 
                    placeholder="Acquista ora, Scopri di più…"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Descrizione</label>
                  <textarea 
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors duration-200 resize-none" 
                    rows={5}
                    value={draft.descrizione ?? ""} 
                    onChange={(e) => setDraft((d) => ({ ...d, descrizione: e.target.value }))} 
                    placeholder="Descrizione del link"
                  />
                </div>
              </div>
              
              {/* Right column - Associations */}
              <div className="w-1/2 px-6 py-6 space-y-6 overflow-auto">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium text-gray-900">Associazioni</h4>
                    <button
                      type="button"
                      className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors duration-200"
                      onClick={() => setIsAttachCategoryOpen(true)}
                    >
                      Associa
                    </button>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <div className="text-xs text-gray-600 mb-2">Categorie</div>
                      {attachments.categories.length === 0 ? (
                        <div className="text-sm text-gray-500">Nessuna categoria associata</div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {attachments.categories.map((c) => (
                            <span key={c.id} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-gray-100 text-gray-800 text-xs">
                              {c.name || "(senza nome)"}
                              <button className="ml-1 text-red-500 hover:text-red-700" title="Rimuovi" onClick={() => detachLinkFromCategory(selectedLink.id, c.id)}>
                                <Unlink className="h-3 w-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="text-xs text-gray-600 mb-2">Prodotti</div>
                      {attachments.products.length === 0 ? (
                        <div className="text-sm text-gray-500">Nessun prodotto associato</div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {attachments.products.map((p) => (
                            <span key={p.id} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-gray-100 text-gray-800 text-xs">
                              {p.name || "(senza nome)"}
                              <button className="ml-1 text-red-500 hover:text-red-700" title="Rimuovi" onClick={() => detachLinkFromProduct(selectedLink.id, p.id)}>
                                <Unlink className="h-3 w-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </>
      )}

      {isAddLinkOpen && (
        <>
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 z-40" role="button" tabIndex={-1} onClick={closeAddLink} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-lg rounded-xl bg-white border border-gray-200 shadow-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">{editingLinkId ? "Modifica link" : "Nuovo link"}</h3>
                <button className="inline-flex items-center p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100" title="Chiudi" onClick={closeAddLink}>
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="px-6 py-6 space-y-6">
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-3">Immagine link</h4>
                  <div className="flex items-start gap-4">
                    <div className="h-24 w-32 rounded-lg bg-gray-100 overflow-hidden flex items-center justify-center">
                      {linkDraft.img_url ? (
                        <img src={linkDraft.img_url} alt={linkDraft.name || "Link"} className="h-full w-full object-cover" />
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
                          if (file) uploadLinkImage(file)
                        }}
                      />
                    </label>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Nome link</label>
                  <input 
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors duration-200" 
                    value={linkDraft.name} 
                    onChange={(e) => setLinkDraft((d) => ({ ...d, name: e.target.value }))} 
                    placeholder="Nome del link"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">URL</label>
                  <input 
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors duration-200" 
                    value={linkDraft.link} 
                    onChange={(e) => setLinkDraft((d) => ({ ...d, link: e.target.value }))} 
                    placeholder="https://…"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Call to Action</label>
                  <input 
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors duration-200" 
                    value={linkDraft.calltoaction} 
                    onChange={(e) => setLinkDraft((d) => ({ ...d, calltoaction: e.target.value }))} 
                    placeholder="Acquista ora, Scopri di più…"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Descrizione</label>
                  <textarea 
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors duration-200 resize-none" 
                    rows={3} 
                    value={linkDraft.descrizione} 
                    onChange={(e) => setLinkDraft((d) => ({ ...d, descrizione: e.target.value }))} 
                    placeholder="Descrizione del link"
                  />
                </div>
              </div>
              <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                <button 
                  className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors duration-200" 
                  onClick={closeAddLink}
                >
                  Annulla
                </button>
                <button 
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors duration-200" 
                  onClick={saveAddLink} 
                  disabled={!linkDraft.name || linkDraft.uploading}
                >
                  <Save className="h-4 w-4" />
                  {editingLinkId ? "Salva modifiche" : "Crea link"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {isAttachCategoryOpen && selectedLinkId && (
        <>
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 z-40" role="button" tabIndex={-1} onClick={() => setIsAttachCategoryOpen(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-lg rounded-xl bg-white border border-gray-200 shadow-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">Associa link</h3>
                <button className="inline-flex items-center p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100" title="Chiudi" onClick={() => setIsAttachCategoryOpen(false)}>
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="px-6 py-6 space-y-4">
                <div className="flex items-center gap-4 mb-4">
                  <button
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors duration-200 ${
                      !isAttachProductOpen ? 'bg-indigo-100 text-indigo-700' : 'text-gray-700 hover:bg-gray-100'
                    }`}
                    onClick={() => {
                      setIsAttachProductOpen(false)
                      setIsAttachCategoryOpen(true)
                    }}
                  >
                    Categorie
                  </button>
                  <button
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors duration-200 ${
                      isAttachProductOpen ? 'bg-indigo-100 text-indigo-700' : 'text-gray-700 hover:bg-gray-100'
                    }`}
                    onClick={() => {
                      setIsAttachCategoryOpen(false)
                      setIsAttachProductOpen(true)
                    }}
                  >
                    Prodotti
                  </button>
                </div>
                <input
                  autoFocus
                  placeholder="Cerca categorie…"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors duration-200"
                  value={attachCategoryQuery}
                  onChange={(e) => setAttachCategoryQuery(e.target.value)}
                />
                <div className="max-h-80 overflow-auto border border-gray-200 rounded-lg divide-y divide-gray-200">
                  {attachCategoryLoading ? (
                    <div className="p-4 text-sm text-gray-700">Caricamento…</div>
                  ) : attachCategoryResults.length === 0 ? (
                    <div className="p-4 text-sm text-gray-700">
                      {attachCategoryQuery.trim() ? "Nessun risultato" : "Tutte le categorie sono già associate"}
                    </div>
                  ) : (
                    <div>
                      {attachCategoryResults.map((r) => (
                        <button
                          key={r.id}
                          className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-3 transition-colors duration-200"
                          onClick={() => attachLinkToCategory(selectedLinkId, r.id)}
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

      {isAttachProductOpen && selectedLinkId && (
        <>
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 z-40" role="button" tabIndex={-1} onClick={() => setIsAttachProductOpen(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-lg rounded-xl bg-white border border-gray-200 shadow-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">Associa link ai prodotti</h3>
                <button className="inline-flex items-center p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100" title="Chiudi" onClick={() => setIsAttachProductOpen(false)}>
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="px-6 py-6 space-y-4">
                <div className="flex items-center gap-4 mb-4">
                  <button
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors duration-200 ${
                      !isAttachProductOpen ? 'bg-indigo-100 text-indigo-700' : 'text-gray-700 hover:bg-gray-100'
                    }`}
                    onClick={() => {
                      setIsAttachProductOpen(false)
                      setIsAttachCategoryOpen(true)
                    }}
                  >
                    Categorie
                  </button>
                  <button
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors duration-200 ${
                      isAttachProductOpen ? 'bg-indigo-100 text-indigo-700' : 'text-gray-700 hover:bg-gray-100'
                    }`}
                    onClick={() => {
                      setIsAttachCategoryOpen(false)
                      setIsAttachProductOpen(true)
                    }}
                  >
                    Prodotti
                  </button>
                </div>
                <input
                  autoFocus
                  placeholder="Cerca prodotti…"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors duration-200"
                  value={attachProductQuery}
                  onChange={(e) => setAttachProductQuery(e.target.value)}
                />
                <div className="max-h-80 overflow-auto border border-gray-200 rounded-lg divide-y divide-gray-200">
                  {attachProductLoading ? (
                    <div className="p-4 text-sm text-gray-700">Caricamento…</div>
                  ) : attachProductResults.length === 0 ? (
                    <div className="p-4 text-sm text-gray-700">
                      {attachProductQuery.trim() ? "Nessun risultato" : "Tutti i prodotti sono già associati"}
                    </div>
                  ) : (
                    <div>
                      {attachProductResults.map((r) => (
                        <button
                          key={r.id}
                          className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-3 transition-colors duration-200"
                          onClick={() => attachLinkToProduct(selectedLinkId, r.id)}
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




