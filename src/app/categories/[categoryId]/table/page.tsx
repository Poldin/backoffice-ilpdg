"use client"

import { Fragment, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { Check, Circle, Loader2, Plus, Trash2, ArrowLeft, Upload } from "lucide-react"
import { toast } from "sonner"
import type { Category, CategoryItem } from "@/app/lib/types"
import { getSupabaseBrowser } from "@/app/lib/supabase/client"
import Image from "next/image"
type RowState = "idle" | "saving" | "saved" | "error"

type Editable = Pick<CategoryItem, "id" | "name" | "description" | "image_url" | "is_public"> & {
  // category_id is stable and comes from the URL
  category_id: string
}

export default function CategoryTableEditorPage() {
  const params = useParams<{ categoryId: string }>()
  const categoryId = params?.categoryId

  const [category, setCategory] = useState<Category | null>(null)
  const [rows, setRows] = useState<Editable[]>([])
  const [states, setStates] = useState<Record<string, RowState>>({})
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [uploading, setUploading] = useState<Record<string, boolean>>({})

  // Debounce timers per row
  const timersRef = useRef<Record<string, NodeJS.Timeout>>({})

  useEffect(() => {
    let active = true
    setLoading(true)
    ;(async () => {
      try {
        const res = await fetch("/api/categories")
        const data = await res.json()
        if (!active) return
        const cats: Category[] = data.categories ?? []
        const items: CategoryItem[] = data.items ?? []
        const cat = cats.find((c) => c.id === categoryId) || null
        setCategory(cat || null)
        const filtered = items
          .filter((i) => i.category_id === categoryId)
          .map<Editable>((i) => ({
            id: i.id,
            category_id: categoryId!,
            name: i.name,
            description: i.description,
            image_url: i.image_url,
            is_public: i.is_public,
          }))
        setRows(filtered)
        setStates(Object.fromEntries(filtered.map((r) => [r.id, "idle" as RowState])))
      } catch {
        toast.error("Errore nel caricamento")
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [categoryId])

  function markState(id: string, s: RowState) {
    setStates((prev) => ({ ...prev, [id]: s }))
  }

  async function persistRow(row: Editable) {
    markState(row.id, "saving")
    try {
      const res = await fetch("/api/categories", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "item",
          id: row.id,
          category_id: row.category_id,
          name: row.name ?? null,
          description: row.description ?? null,
          image_url: row.image_url ?? null,
          is_public: row.is_public ?? true,
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      markState(row.id, "saved")
      // fade back to idle
      setTimeout(() => markState(row.id, "idle"), 800)
    } catch {
      markState(row.id, "error")
      toast.error("Salvataggio fallito")
    }
  }

  function scheduleSave(row: Editable) {
    // clear previous
    const t = timersRef.current[row.id]
    if (t) clearTimeout(t)
    timersRef.current[row.id] = setTimeout(() => persistRow(row), 500)
  }

  function updateCell(id: string, patch: Partial<Editable>) {
    setRows((prev) => {
      const next = prev.map((r) => (r.id === id ? { ...r, ...patch } : r))
      const changed = next.find((r) => r.id === id)!
      scheduleSave(changed)
      return next
    })
  }

  async function addRow() {
    if (!categoryId) return
    setCreating(true)
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "item",
          category_id: categoryId,
          name: "",
          description: "",
          image_url: "",
          is_public: true,
        }),
      })
      const created: CategoryItem | { error?: string } = await res.json()
      if (!res.ok || (created as { error?: string })?.error) throw new Error((created as { error?: string })?.error || "Errore")
      const row: Editable = {
        id: (created as CategoryItem).id,
        category_id: categoryId,
        name: (created as CategoryItem).name,
        description: (created as CategoryItem).description,
        image_url: (created as CategoryItem).image_url,
        is_public: (created as CategoryItem).is_public,
      }
      setRows((prev) => [row, ...prev])
      setStates((prev) => ({ ...prev, [row.id]: "idle" }))
    } catch {
      toast.error("Creazione riga fallita")
    } finally {
      setCreating(false)
    }
  }

  async function deleteRow(id: string) {
    const ok = window.confirm("Eliminare questa riga?")
    if (!ok) return
    try {
      const res = await fetch(`/api/categories?id=${encodeURIComponent(id)}&type=item`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      setRows((prev) => prev.filter((r) => r.id !== id))
      setStates((prev) => {
        const { [id]: _, ...rest } = prev
        return rest
      })
    } catch {
      toast.error("Eliminazione fallita")
    }
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

  function extractStoragePath(publicUrl?: string | null): string | null {
    if (!publicUrl) return null
    const base = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/images/`
    if (publicUrl.startsWith(base)) return publicUrl.slice(base.length)
    return null
  }

  async function uploadImage(rowId: string, file: File) {
    try {
      setUploading((u) => ({ ...u, [rowId]: true }))
      const supabase = getSupabaseBrowser()
      const safe = sanitizeFileName(file.name)
      const path = `products/${rowId}/${Date.now()}-${safe}`
      const { error } = await supabase.storage.from("images").upload(path, file, {
        cacheControl: "3600",
        upsert: true,
        contentType: file.type,
      })
      if (error) throw new Error(error.message)
      const { data } = supabase.storage.from("images").getPublicUrl(path)
      updateCell(rowId, { image_url: data.publicUrl || "" })
      toast.success("Immagine aggiornata")
    } catch (e) {
      const extra = e instanceof Error && e.message ? `: ${e.message}` : ""
      toast.error(`Upload fallito${extra}`)
    } finally {
      setUploading((u) => ({ ...u, [rowId]: false }))
    }
  }

  async function removeImage(rowId: string) {
    try {
      const row = rows.find((r) => r.id === rowId)
      const supabase = getSupabaseBrowser()
      const path = extractStoragePath(row?.image_url || undefined)
      if (path) {
        await supabase.storage.from("images").remove([path])
      }
      updateCell(rowId, { image_url: "" })
      toast.success("Immagine rimossa")
    } catch {
      toast.error("Rimozione immagine fallita")
    }
  }

  const title = useMemo(() => category?.name || "Categoria", [category?.name])

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Link href="/categories" className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors duration-200">
              <ArrowLeft className="h-4 w-4" />
              <span>Torna alle categorie</span>
            </Link>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-medium text-gray-900 mb-2">{title}</h1>
              <p className="text-gray-600">Editor tabellare per modifica rapida dei prodotti</p>
            </div>
            <button
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg font-medium transition-colors duration-200 shadow-sm disabled:opacity-50"
              onClick={addRow}
              disabled={creating}
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              <span>Nuovo prodotto</span>
            </button>
          </div>
        </div>

        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">💡 Le modifiche vengono salvate automaticamente dopo 0.5 secondi di inattività.</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center gap-3 text-gray-700">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Caricamento prodotti...</span>
            </div>
          </div>
        ) : rows.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <div className="text-gray-700 mb-4">
              <Circle className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Nessun prodotto</h3>
              <p className="text-sm text-gray-700">Inizia aggiungendo il tuo primo prodotto a questa categoria.</p>
            </div>
            <button
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200"
              onClick={addRow}
              disabled={creating}
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              <span>Aggiungi prodotto</span>
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-[1200px] w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-6 py-4 text-sm font-medium text-gray-900 w-[24rem]">Nome</th>
                    <th className="text-left px-6 py-4 text-sm font-medium text-gray-900 w-[26rem]">Immagine</th>
                    <th className="text-left px-6 py-4 text-sm font-medium text-gray-900 w-[10rem]">Visibilità</th>
                    <th className="text-left px-6 py-4 text-sm font-medium text-gray-900 w-[10rem]">Stato</th>
                    <th className="text-right px-6 py-4 text-sm font-medium text-gray-900 w-[8rem]">Azioni</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {rows.map((r) => (
                    <Fragment key={r.id}>
                      <tr className="hover:bg-gray-50 transition-colors duration-200">
                        <td className="px-6 py-4 align-top">
                          <input
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors duration-200"
                            value={r.name ?? ""}
                            onChange={(e) => updateCell(r.id, { name: e.target.value })}
                            placeholder="Nome del prodotto"
                          />
                        </td>
                        <td className="px-6 py-4 align-top">
                          <div className="flex items-start gap-4">
                            <div className="h-16 w-20 rounded-lg bg-gray-100 overflow-hidden flex items-center justify-center">
                              {r.image_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <Image src={r.image_url} alt={r.name || "Immagine"} className="h-full w-full object-cover" />
                              ) : (
                                <div className="text-xs text-gray-700">N/A</div>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <label className="inline-flex items-center gap-2 bg-white border border-gray-300 rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer transition-colors duration-200">
                                {uploading[r.id] ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                                <span>Carica</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  disabled={!!uploading[r.id]}
                                  onChange={(e) => {
                                    const file = e.target.files?.[0]
                                    if (file) uploadImage(r.id, file)
                                  }}
                                />
                              </label>
                              {r.image_url && (
                                <button 
                                  className="inline-flex items-center p-2 text-red-400 hover:text-red-600 rounded-md hover:bg-red-50 transition-colors duration-200" 
                                  title="Rimuovi immagine" 
                                  onClick={() => removeImage(r.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 align-top">
                          <label className="inline-flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={!!r.is_public}
                              onChange={(e) => updateCell(r.id, { is_public: e.target.checked })}
                              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                            />
                            <span className="text-sm text-gray-700">Pubblica</span>
                          </label>
                        </td>
                        <td className="px-6 py-4 align-top">
                          {states[r.id] === "saving" && (
                            <span className="inline-flex items-center gap-2 text-orange-600 bg-orange-50 px-2.5 py-1 rounded-full text-xs font-medium">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Salvando
                            </span>
                          )}
                          {states[r.id] === "saved" && (
                            <span className="inline-flex items-center gap-2 text-green-600 bg-green-50 px-2.5 py-1 rounded-full text-xs font-medium">
                              <Check className="h-3 w-3" />
                              Salvato
                            </span>
                          )}
                          {states[r.id] === "error" && (
                            <span className="inline-flex items-center gap-2 text-red-600 bg-red-50 px-2.5 py-1 rounded-full text-xs font-medium">
                              <Circle className="h-3 w-3" />
                              Errore
                            </span>
                          )}
                          {states[r.id] === "idle" && (
                            <span className="inline-flex items-center gap-2 text-gray-700 bg-gray-50 px-2.5 py-1 rounded-full text-xs font-medium">
                              <Circle className="h-3 w-3" />
                              Pronto
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 align-top text-right">
                          <button 
                            className="inline-flex items-center p-2 text-red-400 hover:text-red-600 rounded-md hover:bg-red-50 transition-colors duration-200" 
                            title="Elimina prodotto" 
                            onClick={() => deleteRow(r.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                      <tr className="bg-gray-50">
                        <td className="px-6 py-4" colSpan={5}>
                          <div className="space-y-2">
                            <label className="block text-sm font-medium text-gray-700">Descrizione</label>
                            <textarea
                              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors duration-200 resize-none"
                              rows={6}
                              value={r.description ?? ""}
                              onChange={(e) => updateCell(r.id, { description: e.target.value })}
                              placeholder="Descrizione dettagliata del prodotto..."
                            />
                          </div>
                        </td>
                      </tr>
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}


