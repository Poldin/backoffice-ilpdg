"use client"

import { useEffect, useMemo, useState } from "react"
import { Eye, EyeOff, Trash2, Upload, Plus, Save, X } from "lucide-react"
import { getSupabaseBrowser } from "@/app/lib/supabase/client"
import { toast } from "sonner"

type Cover = {
  id: string
  created_at: string
  name: string | null
  image_url: string | null
  is_public: boolean | null
}

export default function CoverPage() {
  const [items, setItems] = useState<Cover[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<Partial<Cover>>({ name: "", image_url: "", is_public: true })
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [draft, setDraft] = useState<{ name: string; image_url: string; uploading: boolean }>(
    { name: "", image_url: "", uploading: false }
  )

  useEffect(() => {
    ;(async () => {
      const res = await fetch("/api/cover")
      const data = await res.json()
      setItems(data)
      setLoading(false)
    })()
  }, [])

  async function create(payload: { name: string; image_url: string }) {
    const res = await fetch("/api/cover", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: payload.name, image_url: payload.image_url, is_public: true }),
    })
    const data = await res.json()
    setItems((prev) => [data, ...prev])
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
    setDraft({ name: "", image_url: "", uploading: false })
    setIsAddOpen(true)
  }
  function closeAdd() {
    setIsAddOpen(false)
  }
  async function saveAdd() {
    if (!draft.name || !draft.image_url) return
    await create({ name: draft.name, image_url: draft.image_url })
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
                  </div>
                </div>
                <div className="flex items-center gap-2">
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
                  <div className="mb-1">Nome</div>
                  <input className="w-full rounded-md border px-3 py-2 bg-transparent" value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
                </label>
              </div>
              <div className="p-4 border-t border-black/10 dark:border-white/10 flex items-center justify-end gap-2">
                <button className="rounded-md border p-2" title="Chiudi" onClick={closeAdd}><X className="h-4 w-4" /></button>
                <button
                  className="rounded-md bg-indigo-600 text-white p-2 disabled:opacity-50"
                  title="Salva"
                  onClick={saveAdd}
                  disabled={!draft.name || !draft.image_url || draft.uploading}
                >
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


