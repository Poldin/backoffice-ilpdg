"use client"

import { useEffect, useRef, useState } from "react"
import { Eye, EyeOff, Check, X, Upload, Trash2, User, Loader2, Copy, Plus } from "lucide-react"
import { getSupabaseBrowser } from "@/app/lib/supabase/client"
import type { Tables } from "@/app/lib/database.type"
import { toast } from "sonner"
import Image from "next/image"

type ProfileRow = Tables<"profile">

interface PasswordValidation {
  length: boolean
  uppercase: boolean
  lowercase: boolean
  number: boolean
  special: boolean
}

export default function ProfilePage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState<string | null>(null)
  const [profile, setProfile] = useState<ProfileRow | null>(null)
  
  // Token management state
  const [tokens, setTokens] = useState<Array<{ id: string; created_at: string; nome: string | null }>>([])
  const [tokensLoading, setTokensLoading] = useState(false)
  const [newTokenName, setNewTokenName] = useState("")
  const tokenNameInputRef = useRef<HTMLInputElement | null>(null)
  const [tokenNameError, setTokenNameError] = useState(false)
  const [creatingToken, setCreatingToken] = useState(false)
  const [showTokenModal, setShowTokenModal] = useState(false)
  const [createdTokenValue, setCreatedTokenValue] = useState<string | null>(null)
  const [createdTokenName, setCreatedTokenName] = useState<string>("")
  
  // Stati per i campi editabili del profilo
  const [nome, setNome] = useState<string>("")
  const [bio, setBio] = useState<string>("")
  const [profileUpdateLoading, setProfileUpdateLoading] = useState(false)
  const [imageUploading, setImageUploading] = useState(false)
  
  // Stati per il cambio password
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState(false)

  const validatePassword = (password: string): PasswordValidation => {
    return {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /\d/.test(password),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(password)
    }
  }

  const validation = validatePassword(newPassword)
  const isPasswordValid = Object.values(validation).every(Boolean)
  const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isPasswordValid || !passwordsMatch) return

    setPasswordError(null)
    setPasswordLoading(true)

    try {
      const supabase = getSupabaseBrowser()
      
      // Cambia la password direttamente (l'utente è già autenticato)
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      })

      if (updateError) {
        throw updateError
      }

      toast.success("Password cambiata con successo!", {
        description: "La tua password è stata aggiornata"
      })
      
      setTimeout(() => {
        setShowPasswordModal(false)
        setNewPassword("")
        setConfirmPassword("")
        setPasswordSuccess(false)
      }, 2000)

    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Errore sconosciuto"
      setPasswordError(message)
      toast.error("Errore nel cambio password", {
        description: message
      })
    } finally {
      setPasswordLoading(false)
    }
  }

  const closePasswordModal = () => {
    setShowPasswordModal(false)
    setNewPassword("")
    setConfirmPassword("")
    setPasswordError(null)
    setPasswordSuccess(false)
  }

  // Funzione per l'autosave dei campi del profilo
  const updateProfileField = async (field: 'nome' | 'bio' | 'img_url', value: string | null) => {
    if (!profile) return

    setProfileUpdateLoading(true)

    try {
      const supabase = getSupabaseBrowser()
      
      const updateData = {
        [field]: value,
        edited_at: new Date().toISOString()
      }

      const { error: updateError } = await supabase
        .from("profile")
        .update(updateData)
        .eq("id", profile.id)

      if (updateError) {
        throw updateError
      }

      // Aggiorna il profilo locale
      setProfile(prev => prev ? { ...prev, [field]: value, edited_at: new Date().toISOString() } : null)
      
      toast.success(`${field === 'nome' ? 'Nome' : 'Descrizione'} aggiornato con successo`, {
        duration: 3000,
        description: "Le modifiche sono state salvate automaticamente"
      })

    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Errore sconosciuto"
      toast.error(`Errore nell'aggiornamento`, {
        description: message,
        duration: 5000
      })
    } finally {
      setProfileUpdateLoading(false)
    }
  }

  // Debounce per l'autosave
  useEffect(() => {
    if (!profile) return
    
    const timeoutId = setTimeout(() => {
      if (nome !== (profile.nome || '')) {
        updateProfileField('nome', nome)
      }
    }, 1000) // Autosave dopo 1 secondo di inattività

    return () => clearTimeout(timeoutId)
  }, [nome, profile])

  useEffect(() => {
    if (!profile) return
    
    const timeoutId = setTimeout(() => {
      if (bio !== (profile.bio || '')) {
        updateProfileField('bio', bio)
      }
    }, 1000) // Autosave dopo 1 secondo di inattività

    return () => clearTimeout(timeoutId)
  }, [bio, profile])

  // Funzioni per l'upload dell'immagine profilo
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

  async function uploadProfileImage(file: File) {
    if (!profile) return

    setImageUploading(true)

    try {
      const supabase = getSupabaseBrowser()
      const safeName = sanitizeFileName(file.name)
      const path = `profiles/${profile.id}/${Date.now()}-${safeName}`
      
      // Rimuovi l'immagine precedente se esiste
      if (profile.img_url) {
        const oldPath = extractStoragePath(profile.img_url)
        if (oldPath) {
          await supabase.storage.from("images").remove([oldPath])
        }
      }

      const { error } = await supabase.storage.from("images").upload(path, file, {
        cacheControl: "3600",
        upsert: true,
        contentType: file.type,
      })

      if (error) {
        throw error
      }

      const { data } = supabase.storage.from("images").getPublicUrl(path)
      
      // Aggiorna il database
      await updateProfileField('img_url', data.publicUrl)
      
      toast.success("Immagine profilo aggiornata", {
        description: "La tua foto profilo è stata caricata con successo"
      })

    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Errore sconosciuto"
      toast.error("Errore nell'upload dell'immagine", {
        description: message
      })
    } finally {
      setImageUploading(false)
    }
  }

  async function removeProfileImage() {
    if (!profile?.img_url) return

    setImageUploading(true)

    try {
      const supabase = getSupabaseBrowser()
      const path = extractStoragePath(profile.img_url)
      
      if (path) {
        const { error } = await supabase.storage.from("images").remove([path])
        if (error) {
          throw error
        }
      }

      // Aggiorna il database
      await updateProfileField('img_url', null)
      
      toast.success("Immagine profilo rimossa", {
        description: "La foto profilo è stata eliminata"
      })

    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Errore sconosciuto"
      toast.error("Errore nella rimozione dell'immagine", {
        description: message
      })
    } finally {
      setImageUploading(false)
    }
  }

  useEffect(() => {
    const run = async () => {
      const supabase = getSupabaseBrowser()
      const { data: sessionData } = await supabase.auth.getUser()
      if (!sessionData.user) {
        setError("Non sei autenticato. Accedi per vedere il profilo.")
        setLoading(false)
        return
      }
      setEmail(sessionData.user.email ?? null)
      const { data, error } = await supabase
        .from("profile")
        .select("*")
        .eq("user_id", sessionData.user.id)
        .single()
      if (error) setError(error.message)
      setProfile(data ?? null)
      
      // Inizializza i campi editabili con i valori del profilo
      if (data) {
        setNome(data.nome || '')
        setBio(data.bio || '')
      }
      
      setLoading(false)
    }
    run()
  }, [])

  // Load tokens after profile is available
  useEffect(() => {
    if (!loading && !error && profile) {
      void loadTokens()
    }
  }, [loading, error, profile])

  async function loadTokens() {
    try {
      setTokensLoading(true)
      const res = await fetch("/api/profile/tokens", { method: "GET" })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error || "Impossibile caricare i token")
      }
      const data = await res.json()
      setTokens(Array.isArray(data) ? data : [])
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Errore sconosciuto"
      toast.error("Errore nel caricamento dei token", { description: message })
    } finally {
      setTokensLoading(false)
    }
  }

  async function createToken(e: React.FormEvent) {
    e.preventDefault()
    const nome = newTokenName.trim()
    if (!nome) {
      setTokenNameError(true)
      tokenNameInputRef.current?.focus()
      return
    }
    setCreatingToken(true)
    try {
      const res = await fetch("/api/profile/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error || "Impossibile creare il token")
      }
      const data: { id: string; created_at: string; nome: string | null; token: string } = await res.json()
      setTokens(prev => [{ id: data.id, created_at: data.created_at, nome: data.nome }, ...prev])
      setCreatedTokenValue(data.token)
      setCreatedTokenName(data.nome || nome)
      setShowTokenModal(true)
      setNewTokenName("")
      setTokenNameError(false)
      toast.success("Token creato", { description: "Copia e conserva il token ora: non sarà più mostrato" })
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Errore sconosciuto"
      toast.error("Errore nella creazione del token", { description: message })
    } finally {
      setCreatingToken(false)
    }
  }

  async function deleteToken(id: string) {
    const confirmed = window.confirm("Eliminare questo token? L'azione è irreversibile.")
    if (!confirmed) return
    try {
      const res = await fetch(`/api/profile/tokens/${id}`, { method: "DELETE" })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error || "Impossibile eliminare il token")
      }
      setTokens(prev => prev.filter(t => t.id !== id))
      toast.success("Token eliminato")
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Errore sconosciuto"
      toast.error("Errore nell'eliminazione del token", { description: message })
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">Profilo</h1>
                <p className="mt-1 text-sm text-gray-500">
                  Gestisci le informazioni del tuo profilo e account
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {loading && (
          <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
              <p className="mt-2 text-sm text-gray-500">Caricamento profilo...</p>
            </div>
          </div>
        )}
        
        {!loading && error && (
          <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-8">
            <div className="text-center">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          </div>
        )}

        {!loading && !error && (
          <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Informazioni profilo</h2>
            </div>
            <div className="px-6 py-6 space-y-6">
              {/* Profile Information Fields */}
              <div className="space-y-6">
                {/* Profile Image */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-4">
                    Immagine profilo
                    {imageUploading && (
                      <span className="ml-2 text-xs text-gray-500">Caricando...</span>
                    )}
                  </label>
                  
                  <div className="flex items-start gap-6">
                    {/* Image Preview */}
                    <div className="flex-shrink-0">
                      <div className="w-24 h-24 rounded-lg bg-gray-50 border border-gray-300 overflow-hidden flex items-center justify-center">
                        {profile?.img_url ? (
                          <Image 
                            src={profile.img_url} 
                            width={96}
                            height={96}
                            alt="Profile" 
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <User className="w-8 h-8 text-gray-400" />
                        )}
                      </div>
                    </div>
                    
                    {/* Upload Controls */}
                    <div className="flex-1 space-y-3">
                      <div className="flex gap-3">
                        <label className="relative cursor-pointer">
                          <div className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed">
                            {imageUploading ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                              <Upload className="h-4 w-4 mr-2" />
                            )}
                            <span>{imageUploading ? "Caricando..." : "Carica immagine"}</span>
                          </div>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            disabled={imageUploading}
                            onChange={(e) => {
                              const file = e.target.files?.[0]
                              if (file) {
                                uploadProfileImage(file)
                              }
                              e.target.value = ""
                            }}
                          />
                        </label>
                        
                        {profile?.img_url && (
                          <button
                            onClick={removeProfileImage}
                            disabled={imageUploading}
                            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            <span>Rimuovi</span>
                          </button>
                        )}
                      </div>
                      
                      <p className="text-xs text-gray-500">
                        Formati supportati: JPG, PNG, GIF. Dimensione massima: 5MB.
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nome
                    {profileUpdateLoading && (
                      <span className="ml-2 text-xs text-gray-500">Salvando...</span>
                    )}
                  </label>
                  <input
                    type="text"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Inserisci il tuo nome"
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 text-gray-700 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Descrizione
                    {profileUpdateLoading && (
                      <span className="ml-2 text-xs text-gray-500">Salvando...</span>
                    )}
                  </label>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Descrivi brevemente te stesso o la tua attività..."
                    rows={4}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 text-gray-700 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm resize-vertical"
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    Le modifiche vengono salvate automaticamente dopo 1 secondo.
                  </p>
                </div>
              </div>

              {/* Account Details */}
              <div className="pt-6 border-t border-gray-200">
                <h3 className="text-sm font-medium text-gray-700 mb-4">Dettagli account</h3>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                  <div className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-md border border-gray-300">
                    {email ?? "—"}
                  </div>
                </div>
              </div>

              {/* Security Section */}
              <div className="pt-6 border-t border-gray-200">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">••••••••••••</span>
                    <button
                      onClick={() => setShowPasswordModal(true)}
                      className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      Cambia password
                    </button>
                  </div>
                </div>
              </div>
              
              {profile?.created_at && (
                <div className="pt-4 border-t border-gray-200">
                  <div className="text-xs text-gray-500">
                    <div className="mb-1">
                      <span className="font-medium">Account creato:</span> {new Date(profile.created_at).toLocaleString('it-IT')}
                    </div>
                    {profile.edited_at && (
                      <div>
                        <span className="font-medium">Ultima modifica:</span> {new Date(profile.edited_at).toLocaleString('it-IT')}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {!loading && !error && (
          <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden mt-6">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Token API</h2>
              <p className="text-sm text-gray-500 mt-1">Crea e gestisci i tuoi token personali. Il valore del token è visibile solo al momento della creazione.</p>
            </div>
            <div className="px-6 py-6 space-y-6">
              <form onSubmit={createToken} className="flex flex-col sm:flex-row gap-3">
                <input
                  ref={tokenNameInputRef}
                  type="text"
                  value={newTokenName}
                  onChange={(e) => { setNewTokenName(e.target.value); if (tokenNameError) setTokenNameError(false) }}
                  placeholder="Inserisci il nome del token"
                  className={`flex-1 px-3 py-2 border rounded-md leading-5 bg-white placeholder-gray-500 text-gray-700 focus:outline-none focus:ring-1 sm:text-sm ${tokenNameError ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:ring-indigo-500 focus:border-indigo-500'}`}
                />
                <button
                  type="submit"
                  disabled={creatingToken}
                  className="inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creatingToken ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Creando...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Crea token
                    </>
                  )}
                </button>
              </form>
              {tokenNameError && (
                <p className="text-xs text-red-600">Inserisci un nome per il token.</p>
              )}

              <div className="border border-gray-200 rounded-md overflow-hidden">
                <div className="min-w-full divide-y divide-gray-200">
                  <div className="bg-gray-50 px-4 py-2 text-xs font-medium text-gray-500 grid grid-cols-12">
                    <div className="col-span-6 sm:col-span-6">Nome</div>
                    <div className="col-span-4 sm:col-span-4">Creato il</div>
                    <div className="col-span-2 sm:col-span-2 text-right">Azioni</div>
                  </div>
                  {tokensLoading ? (
                    <div className="px-4 py-4 text-sm text-gray-500">Caricamento...</div>
                  ) : tokens.length === 0 ? (
                    <div className="px-4 py-6 text-sm text-gray-500">Nessun token creato.</div>
                  ) : (
                    tokens.map(t => (
                      <div key={t.id} className="px-4 py-3 grid grid-cols-12 items-center">
                        <div className="col-span-6 sm:col-span-6 text-sm text-gray-900 break-words">{t.nome || '—'}</div>
                        <div className="col-span-4 sm:col-span-4 text-sm text-gray-500">{new Date(t.created_at).toLocaleString('it-IT')}</div>
                        <div className="col-span-2 sm:col-span-2">
                          <div className="flex justify-end">
                            <button
                              onClick={() => deleteToken(t.id)}
                              className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                            >
                              <Trash2 className="h-4 w-4 mr-1.5" />
                              Elimina
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modale Cambio Password */}
        {showPasswordModal && (
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-xl">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Cambia Password</h3>
                <button
                  onClick={closePasswordModal}
                  className="text-gray-400 hover:text-gray-500 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handlePasswordChange} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? "text" : "password"}
                      className="block w-full px-3 py-2 pr-10 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 text-gray-700 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      placeholder="Inserisci la password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-500 transition-colors"
                    >
                      {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  
                  {newPassword && (
                    <div className="mt-3 space-y-2">
                      <div className="text-xs text-gray-500 mb-2">La password deve contenere:</div>
                      <div className="space-y-1">
                        {Object.entries({
                          length: "Almeno 8 caratteri",
                          uppercase: "Una lettera maiuscola",
                          lowercase: "Una lettera minuscola", 
                          number: "Un numero",
                          special: "Un carattere speciale"
                        }).map(([key, label]) => (
                          <div key={key} className="flex items-center text-xs">
                            <div className={`w-4 h-4 rounded-full mr-2 flex items-center justify-center ${
                              validation[key as keyof PasswordValidation] 
                                ? 'bg-green-500' 
                                : 'bg-gray-300'
                            }`}>
                              {validation[key as keyof PasswordValidation] && (
                                <Check className="w-2 h-2 text-white" />
                              )}
                            </div>
                            <span className={validation[key as keyof PasswordValidation] ? 'text-green-600' : 'text-gray-500'}>
                              {label}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Conferma password
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      className="block w-full px-3 py-2 pr-10 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 text-gray-700 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      placeholder="Ripeti la password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-500 transition-colors"
                    >
                      {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {confirmPassword && !passwordsMatch && (
                    <p className="text-red-600 text-xs mt-2">Le password non corrispondono</p>
                  )}
                  {confirmPassword && passwordsMatch && (
                    <p className="text-green-600 text-xs mt-2">Le password corrispondono</p>
                  )}
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={closePasswordModal}
                    className="flex-1 inline-flex justify-center items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    Annulla
                  </button>
                  <button
                    type="submit"
                    disabled={passwordLoading || !isPasswordValid || !passwordsMatch}
                    className="flex-1 inline-flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {passwordLoading ? "Cambiando..." : "Cambia Password"}
                  </button>
                </div>

                {passwordError && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-red-600 text-sm">{passwordError}</p>
                  </div>
                )}

                {passwordSuccess && (
                  <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
                    <p className="text-green-600 text-sm">Password cambiata con successo!</p>
                  </div>
                )}
              </form>
            </div>
          </div>
        )}

        {/* Modale Token Creato - visibile una sola volta */}
        {showTokenModal && (
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-lg w-full p-6 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Token creato</h3>
                <button
                  onClick={() => { setShowTokenModal(false); setCreatedTokenValue(null) }}
                  className="text-gray-400 hover:text-gray-500 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm text-gray-600 mb-4">Copia e conserva questo token ora. Per ragioni di sicurezza non sarà più mostrato in seguito.</p>
              <div className="mb-2 text-sm text-gray-900"><span className="font-medium">Nome:</span> {createdTokenName || '—'}</div>
              <div className="flex items-center gap-2">
                <code className="flex-1 block text-sm p-3 bg-gray-50 border border-gray-200 rounded-md overflow-x-auto">
                  {createdTokenValue || '—'}
                </code>
                <button
                  onClick={async () => {
                    if (createdTokenValue) {
                      try {
                        await navigator.clipboard.writeText(createdTokenValue)
                        toast.success("Token copiato negli appunti")
                      } catch {
                        toast.error("Impossibile copiare il token")
                      }
                    }
                  }}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-700 bg-white hover:bg-gray-50"
                >
                  <Copy className="h-4 w-4 mr-1.5" />
                  Copia
                </button>
              </div>
              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => { setShowTokenModal(false); setCreatedTokenValue(null) }}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  Ho salvato il token
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}


