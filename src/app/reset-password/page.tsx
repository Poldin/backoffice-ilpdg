"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { getSupabaseBrowser } from "@/app/lib/supabase/client"

// This page handles both "request reset" (send email) and "set new password" when coming from Supabase email link
export default function ResetPasswordPage() {
  const router = useRouter()
  const supabase = getSupabaseBrowser()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [hasRecoverySession, setHasRecoverySession] = useState(false)

  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession()
      setHasRecoverySession(Boolean(data.session))
    }
    checkSession()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSendResetEmail(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setMessage(null)
    setLoading(true)
    const baseUrl = typeof window !== "undefined" ? window.location.origin : ""
    const redirectTo = `${baseUrl}/reset-password`
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
    setLoading(false)
    if (error) return setError(error.message)
    setMessage("Se l'email esiste, riceverai un link per reimpostare la password.")
  }

  async function handleUpdatePassword(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setMessage(null)
    if (password.length < 6) return setError("La password deve avere almeno 6 caratteri")
    if (password !== confirmPassword) return setError("Le password non coincidono")

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) return setError(error.message)
    setMessage("Password aggiornata. Ora puoi accedere.")
    setTimeout(() => router.replace("/login"), 1200)
  }

  return (
    <div className="p-6 max-w-md mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Recupero password</h1>

      {!hasRecoverySession ? (
        <form onSubmit={handleSendResetEmail} className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              className="w-full border rounded px-3 py-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="w-full bg-black text-white rounded px-4 py-2 disabled:opacity-50" disabled={loading}>
            {loading ? "Invio…" : "Invia email di reset"}
          </button>
        </form>
      ) : (
        <form onSubmit={handleUpdatePassword} className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Nuova password</label>
            <input
              type="password"
              className="w-full border rounded px-3 py-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Conferma password</label>
            <input
              type="password"
              className="w-full border rounded px-3 py-2"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="w-full bg-black text-white rounded px-4 py-2 disabled:opacity-50" disabled={loading}>
            {loading ? "Aggiornamento…" : "Aggiorna password"}
          </button>
        </form>
      )}

      {message && <div className="mt-4 text-green-700 text-sm" role="status">{message}</div>}
      {error && <div className="mt-4 text-red-600 text-sm" role="alert">{error}</div>}
    </div>
  )
}


