"use client"

import { useEffect, useState } from "react"
import {  Trash2, Plus, Save, X, UserCheck, UserX, Edit3, RefreshCw, Upload, ImageIcon } from "lucide-react"
import Image from "next/image"
import { getSupabaseBrowser } from "@/app/lib/supabase/client"
import { toast } from "sonner"

type User = {
  id: string
  email: string
  email_confirmed_at: string | null
  created_at: string
  last_sign_in_at: string | null
  user_metadata: {
    email?: string
    [key: string]: string | undefined
  }
  app_metadata: {
    provider?: string
    [key: string]: string | undefined
  }
  banned_until?: string | null
}

type Profile = {
  id: string
  user_id: string | null
  nome: string | null
  bio: string | null
  img_url: string | null
  role: "super_admin" | "admin" | "expert" | null
  created_at: string
  edited_at: string | null
}

type UserWithProfile = {
  user: User
  profile: Profile | null
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserWithProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<UserWithProfile | null>(null)
  const [draft, setDraft] = useState<{
    email: string
    nome: string
    bio: string
    role: "super_admin" | "admin" | "expert"
    img_url: string
    sending: boolean
    uploading: boolean
  }>({ email: "", nome: "", bio: "", role: "expert", img_url: "", sending: false, uploading: false })

  useEffect(() => {
    loadUsers()
  }, [])

  async function loadUsers() {
    try {
      const res = await fetch("/api/users")
      const data = await res.json()
      setUsers(Array.isArray(data) ? data : [])
    } catch {
      toast.error("Errore nel caricamento degli utenti")
      setUsers([])
    } finally {
      setLoading(false)
    }
  }

  function openAdd() {
    setDraft({ email: "", nome: "", bio: "", role: "expert", img_url: "", sending: false, uploading: false })
    setIsAddOpen(true)
  }

  function closeAdd() {
    setIsAddOpen(false)
  }

  function openEdit(userWithProfile: UserWithProfile) {
    setEditingUser(userWithProfile)
    setDraft({
      email: userWithProfile.user.email,
      nome: userWithProfile.profile?.nome || "",
      bio: userWithProfile.profile?.bio || "",
      role: userWithProfile.profile?.role || "expert",
      img_url: userWithProfile.profile?.img_url || "",
      sending: false,
      uploading: false
    })
    setIsEditOpen(true)
  }

  function closeEdit() {
    setIsEditOpen(false)
    setEditingUser(null)
  }

  // Funzione per sanitizzare i nomi dei file (copiata da cover)
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

  async function uploadProfileImage(file: File) {
    setDraft(d => ({ ...d, uploading: true }))
    const supabase = getSupabaseBrowser()
    const safeName = sanitizeFileName(file.name)
    const path = `profiles/${Date.now()}-${safeName}`
    
    const { error } = await supabase.storage.from("images").upload(path, file, {
      cacheControl: "3600",
      upsert: true,
      contentType: file.type,
    })
    
    if (error) {
      toast.error(`Upload fallito: ${error.message}`)
      setDraft(d => ({ ...d, uploading: false }))
      return
    }
    
    const { data } = supabase.storage.from("images").getPublicUrl(path)
    setDraft(d => ({ ...d, img_url: data.publicUrl, uploading: false }))
    toast.success("Immagine caricata")
  }

  async function removeProfileImage() {
    const confirmed = window.confirm("Confermi la rimozione dell'immagine profilo?")
    if (!confirmed) return
    
    setDraft(d => ({ ...d, img_url: "" }))
    toast.success("Immagine rimossa")
  }

  async function createUser() {
    if (!draft.email || !draft.nome) {
      toast.error("Email e nome sono obbligatori")
      return
    }

    setDraft(d => ({ ...d, sending: true }))

    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: draft.email,
          nome: draft.nome,
          bio: draft.bio,
          role: draft.role,
          img_url: draft.img_url
        })
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.message || "Errore nella creazione dell'utente")
      }

      await loadUsers()
      setIsAddOpen(false)
      toast.success("Utente creato e email di invito inviata")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Errore nella creazione dell'utente")
    } finally {
      setDraft(d => ({ ...d, sending: false }))
    }
  }

  async function updateUser() {
    if (!editingUser || !draft.nome) {
      toast.error("Nome è obbligatorio")
      return
    }

    setDraft(d => ({ ...d, sending: true }))

    try {
      const res = await fetch("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: editingUser.user.id,
          email: draft.email,
          nome: draft.nome,
          bio: draft.bio,
          role: draft.role,
          img_url: draft.img_url
        })
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.message || "Errore nell'aggiornamento dell'utente")
      }

      await loadUsers()
      setIsEditOpen(false)
      toast.success("Utente aggiornato")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Errore nell'aggiornamento dell'utente")
    } finally {
      setDraft(d => ({ ...d, sending: false }))
    }
  }

  async function deleteUser(userId: string, userName: string) {
    const confirmed = window.confirm(
      `Confermi l'eliminazione dell'utente "${userName}"? Questa azione è irreversibile.`
    )
    if (!confirmed) return

    try {
      const res = await fetch(`/api/users?userId=${userId}`, { method: "DELETE" })
      
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.message || "Errore nell'eliminazione dell'utente")
      }

      await loadUsers()
      toast.success("Utente eliminato")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Errore nell'eliminazione dell'utente")
    }
  }

  async function toggleUserStatus(userId: string, currentlyBanned: boolean) {
    try {
      const res = await fetch("/api/users/toggle-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, banned: !currentlyBanned })
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.message || "Errore nel cambio stato utente")
      }

      await loadUsers()
      toast.success(`Utente ${!currentlyBanned ? "disabilitato" : "riabilitato"}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Errore nel cambio stato utente")
    }
  }

  async function sendPasswordReset(email: string) {
    try {
      const res = await fetch("/api/users/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.message || "Errore nell'invio email reset password")
      }

      toast.success("Email di reset password inviata")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Errore nell'invio email reset password")
    }
  }

  function getRoleBadgeColor(role: string | null | undefined) {
    switch (role) {
      case "super_admin":
        return "bg-red-100 text-red-800"
      case "admin":
        return "bg-blue-100 text-blue-800"
      case "expert":
        return "bg-green-100 text-green-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  function formatDate(dateString: string | null) {
    if (!dateString) return "Mai"
    return new Date(dateString).toLocaleDateString("it-IT", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-medium text-gray-900 mb-2">Gestione Utenti</h1>
          <p className="text-gray-600">Gestisci gli utenti, i profili e le autorizzazioni del sistema</p>
        </div>

        <div className="mb-8">
          <button 
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg font-medium transition-colors duration-200 shadow-sm" 
            onClick={openAdd}
          >
            <Plus className="h-4 w-4" />
            <span>Nuovo utente</span>
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-gray-700">Caricamento…</div>
          </div>
        ) : users.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <div className="text-gray-700 mb-4">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Nessun utente</h3>
              <p className="text-sm text-gray-700">Inizia aggiungendo il primo utente al sistema.</p>
            </div>
            <button
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200"
              onClick={openAdd}
            >
              <Plus className="h-4 w-4" />
              <span>Aggiungi utente</span>
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {users.map((userWithProfile) => {
              const { user, profile } = userWithProfile
              const isBanned = !!(user.banned_until && new Date(user.banned_until) > new Date())
              
              return (
                <div key={user.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                  <div className="flex items-center gap-6 justify-between">
                    <div className="flex items-center gap-6 min-w-0 flex-1">
                      <div className="h-40 w-40 shrink-0 rounded-lg bg-gray-100 overflow-hidden flex items-center justify-center">
                        {profile?.img_url ? (
                          <Image
                            src={profile.img_url}
                            alt={profile.nome || user.email}
                            width={160}
                            height={160}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="text-2xl text-gray-400">
                            {(profile?.nome || user.email).charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-lg font-medium text-gray-900 truncate mb-1">
                          {profile?.nome || user.email}
                        </h3>
                        <p className="text-sm text-gray-600 truncate mb-2">{user.email}</p>
                        {profile?.bio && (
                          <p className="text-sm text-gray-500 truncate mb-2">{profile.bio}</p>
                        )}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(profile?.role)}`}>
                            {profile?.role || "Nessun ruolo"}
                          </span>
                          {user.email_confirmed_at ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              Verificato
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                              Non verificato
                            </span>
                          )}
                          {isBanned && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              Disabilitato
                            </span>
                          )}
                        </div>
                        <div className="mt-2 text-xs text-gray-500">
                          <p>Registrato: {formatDate(user.created_at)}</p>
                          <p>Ultimo accesso: {formatDate(user.last_sign_in_at)}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        className="inline-flex items-center p-1.5 text-blue-400 hover:text-blue-600 rounded-md hover:bg-blue-50 transition-colors duration-200"
                        title="Invia reset password"
                        onClick={() => sendPasswordReset(user.email)}
                      >
                        <RefreshCw className="h-4 w-4" />
                      </button>
                      <button
                        className="inline-flex items-center p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors duration-200"
                        title="Modifica"
                        onClick={() => openEdit(userWithProfile)}
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                      <button
                        className={`inline-flex items-center p-1.5 rounded-md transition-colors duration-200 ${
                          isBanned 
                            ? "text-green-400 hover:text-green-600 hover:bg-green-50" 
                            : "text-orange-400 hover:text-orange-600 hover:bg-orange-50"
                        }`}
                        title={isBanned ? "Riabilita utente" : "Disabilita utente"}
                        onClick={() => toggleUserStatus(user.id, isBanned)}
                      >
                        {isBanned ? <UserCheck className="h-4 w-4" /> : <UserX className="h-4 w-4" />}
                      </button>
                      <button 
                        className="inline-flex items-center p-1.5 text-red-400 hover:text-red-600 rounded-md hover:bg-red-50 transition-colors duration-200" 
                        title="Elimina utente" 
                        onClick={() => deleteUser(user.id, profile?.nome || user.email)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal Aggiungi Utente */}
      {isAddOpen && (
        <>
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 z-40" role="button" tabIndex={-1} onClick={closeAdd} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-lg max-h-[90vh] rounded-xl bg-white border border-gray-200 shadow-xl overflow-hidden flex flex-col">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">Aggiungi nuovo utente</h3>
                <button className="inline-flex items-center p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100" title="Chiudi" onClick={closeAdd}>
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="px-6 py-6 space-y-6 overflow-y-auto flex-1">
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-3">Immagine profilo</h4>
                  <div className="flex items-start gap-4">
                    <div className="h-full w-fit rounded-lg bg-gray-100 overflow-hidden flex items-center justify-center">
                      {draft.img_url ? (
                        <Image src={draft.img_url} alt="Profilo" className="h-full w-full object-cover" />
                      ) : (
                        <div className="text-2xl text-gray-400">
                          <ImageIcon className="h-8 w-8" />
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="inline-flex items-center gap-2 bg-white border border-gray-300 rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer transition-colors duration-200">
                        <Upload className="h-4 w-4" />
                        <span>{draft.uploading ? "Caricamento..." : "Carica immagine"}</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={draft.uploading}
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) uploadProfileImage(file)
                          }}
                        />
                      </label>
                      {draft.img_url && (
                        <button
                          type="button"
                          className="inline-flex items-center gap-2 text-sm text-red-600 hover:text-red-700 transition-colors duration-200"
                          onClick={removeProfileImage}
                        >
                          <X className="h-4 w-4" />
                          Rimuovi immagine
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
                  <input 
                    type="email"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors duration-200" 
                    value={draft.email} 
                    onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))} 
                    placeholder="email@esempio.com"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Nome *</label>
                    <input 
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors duration-200" 
                      value={draft.nome} 
                      onChange={(e) => setDraft((d) => ({ ...d, nome: e.target.value }))} 
                      placeholder="Nome completo"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Ruolo</label>
                    <select 
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors duration-200" 
                      value={draft.role} 
                      onChange={(e) => setDraft((d) => ({ ...d, role: e.target.value as "super_admin" | "admin" | "expert" }))}
                    >
                      <option value="expert">Expert</option>
                      <option value="admin">Admin</option>
                      <option value="super_admin">Super Admin</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Bio</label>
                  <textarea 
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors duration-200" 
                    value={draft.bio} 
                    onChange={(e) => setDraft((d) => ({ ...d, bio: e.target.value }))} 
                    placeholder="Breve descrizione (opzionale)"
                    rows={3}
                  />
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
                  onClick={createUser}
                  disabled={!draft.email || !draft.nome || draft.sending || draft.uploading}
                >
                  <Save className="h-4 w-4" />
                  {draft.sending ? "Creazione..." : "Crea utente"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Modal Modifica Utente */}
      {isEditOpen && editingUser && (
        <>
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 z-40" role="button" tabIndex={-1} onClick={closeEdit} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-lg max-h-[90vh] rounded-xl bg-white border border-gray-200 shadow-xl overflow-hidden flex flex-col">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">Modifica utente</h3>
                <button className="inline-flex items-center p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100" title="Chiudi" onClick={closeEdit}>
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="px-6 py-6 space-y-6 overflow-y-auto flex-1">
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-3">Immagine profilo</h4>
                  <div className="flex items-start gap-4">
                    <div className="h-20 w-20 rounded-lg bg-gray-100 overflow-hidden flex items-center justify-center">
                      {draft.img_url ? (
                        <Image src={draft.img_url} alt="Profilo" className="h-full w-full object-cover" />
                      ) : (
                        <div className="text-2xl text-gray-400">
                          <ImageIcon className="h-8 w-8" />
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="inline-flex items-center gap-2 bg-white border border-gray-300 rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer transition-colors duration-200">
                        <Upload className="h-4 w-4" />
                        <span>{draft.uploading ? "Caricamento..." : "Carica immagine"}</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={draft.uploading}
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) uploadProfileImage(file)
                          }}
                        />
                      </label>
                      {draft.img_url && (
                        <button
                          type="button"
                          className="inline-flex items-center gap-2 text-sm text-red-600 hover:text-red-700 transition-colors duration-200"
                          onClick={removeProfileImage}
                        >
                          <X className="h-4 w-4" />
                          Rimuovi immagine
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                  <input 
                    type="email"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-500 bg-gray-50 transition-colors duration-200" 
                    value={draft.email}
                    disabled
                  />
                  <p className="text-xs text-gray-500 mt-1">L&apos;email non può essere modificata</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Nome *</label>
                    <input 
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors duration-200" 
                      value={draft.nome} 
                      onChange={(e) => setDraft((d) => ({ ...d, nome: e.target.value }))} 
                      placeholder="Nome completo"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Ruolo</label>
                    <select 
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors duration-200" 
                      value={draft.role} 
                      onChange={(e) => setDraft((d) => ({ ...d, role: e.target.value as "super_admin" | "admin" | "expert" }))}
                    >
                      <option value="expert">Expert</option>
                      <option value="admin">Admin</option>
                      <option value="super_admin">Super Admin</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Bio</label>
                  <textarea 
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors duration-200" 
                    value={draft.bio} 
                    onChange={(e) => setDraft((d) => ({ ...d, bio: e.target.value }))} 
                    placeholder="Breve descrizione (opzionale)"
                    rows={3}
                  />
                </div>

              </div>
              <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                <button 
                  className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors duration-200" 
                  onClick={closeEdit}
                >
                  Annulla
                </button>
                <button
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors duration-200"
                  onClick={updateUser}
                  disabled={!draft.nome || draft.sending || draft.uploading}
                >
                  <Save className="h-4 w-4" />
                  {draft.sending ? "Aggiornamento..." : "Aggiorna utente"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
