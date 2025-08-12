"use client"

import { Fragment, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { Check, Circle, Loader2, Plus, Trash2, ArrowLeft, Upload } from "lucide-react"
import { toast } from "sonner"
import type { Category, CategoryItem } from "@/app/lib/types"
import { getSupabaseBrowser } from "@/app/lib/supabase/client"

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
      } catch (e) {
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
    } catch (e) {
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
    } catch (e) {
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
        const { [id]: _removed, ...rest } = prev
        return rest
      })
    } catch (e) {
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
    } catch (e) {
      toast.error("Rimozione immagine fallita")
    }
  }

  const title = useMemo(() => category?.name || "Categoria", [category?.name])

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Link href="/categories" className="inline-flex items-center gap-2 rounded-md border px-3 py-2">
            <ArrowLeft className="h-4 w-4" />
            <span>Liste</span>
          </Link>
          <h1 className="text-xl font-semibold truncate">{title} — editor tabellare</h1>
        </div>
        <button
          className="inline-flex items-center gap-2 rounded-md border px-3 py-2 disabled:opacity-50"
          onClick={addRow}
          disabled={creating}
          title="Nuova riga"
        >
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          <span>Nuova riga</span>
        </button>
      </div>

      <div className="mb-2 text-sm text-black/60 dark:text-white/60">Modifica veloce in tabella. Salvataggio automatico dopo 0.5s.</div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Caricamento…</div>
      ) : rows.length === 0 ? (
        <div className="text-sm text-black/60 dark:text-white/60">Nessun elemento. Aggiungi una riga.</div>
      ) : (
        <div className="overflow-auto border rounded-md">
          <table className="min-w-[1100px] w-full text-sm">
            <thead className="bg-black/5 dark:bg-white/10">
              <tr>
                <th className="text-left p-2 w-[20rem]">Nome</th>
                <th className="text-left p-2 w-[22rem]">Immagine</th>
                <th className="text-left p-2 w-[8rem]">Pubblico</th>
                <th className="text-left p-2 w-[8rem]">Stato</th>
                <th className="text-right p-2 w-[6rem]">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <Fragment key={r.id}>
                  <tr className="border-t">
                    <td className="p-2 align-top">
                      <input
                        className="w-full rounded-md border px-2 py-1 bg-transparent"
                        value={r.name ?? ""}
                        onChange={(e) => updateCell(r.id, { name: e.target.value })}
                        placeholder="Nome…"
                      />
                    </td>
                    <td className="p-2 align-top">
                      <div className="flex items-start gap-3">
                        <div className="h-14 w-20 rounded bg-black/5 dark:bg-white/10 overflow-hidden flex items-center justify-center">
                          {r.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={r.image_url} alt={r.name || "Immagine"} className="h-full w-full object-cover" />
                          ) : (
                            <div className="text-[10px] text-black/50 dark:text-white/50">N/A</div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="inline-flex items-center gap-2 rounded-md border px-2 py-1 cursor-pointer" title="Carica">
                            {uploading[r.id] ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                            <span className="text-sm">Carica</span>
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
                            <button className="rounded-md border px-2 py-1" title="Rimuovi immagine" onClick={() => removeImage(r.id)}>
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="p-2 align-top">
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={!!r.is_public}
                          onChange={(e) => updateCell(r.id, { is_public: e.target.checked })}
                        />
                        <span>Pubblica</span>
                      </label>
                    </td>
                    <td className="p-2 align-top">
                      {states[r.id] === "saving" && (
                        <span className="inline-flex items-center gap-1 text-black/60 dark:text-white/60"><Loader2 className="h-3 w-3 animate-spin" /> Salvando…</span>
                      )}
                      {states[r.id] === "saved" && (
                        <span className="inline-flex items-center gap-1 text-green-600"><Check className="h-3 w-3" /> Salvato</span>
                      )}
                      {states[r.id] === "error" && (
                        <span className="inline-flex items-center gap-1 text-red-600"><Circle className="h-3 w-3" /> Errore</span>
                      )}
                    </td>
                    <td className="p-2 align-top text-right">
                      <button className="p-2 rounded-md border" title="Elimina" onClick={() => deleteRow(r.id)}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                  <tr className="">
                    <td className="p-2" colSpan={5}>
                      {/* <label className="block text-xs mb-1 text-black/60 dark:text-white/60">Descrizione</label> */}
                      <textarea
                        className="w-full rounded-md border px-3 py-2 bg-transparent min-h-[8rem]"
                        rows={8}
                        value={r.description ?? ""}
                        onChange={(e) => updateCell(r.id, { description: e.target.value })}
                        placeholder="Descrizione…"
                      />
                    </td>
                  </tr>
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}


