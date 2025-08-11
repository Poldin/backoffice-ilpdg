"use client"

import { Suspense, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { getSupabaseBrowser } from "@/app/lib/supabase/client"

function LoginInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleEmailPasswordLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const supabase = getSupabaseBrowser()
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) return setError(error.message)
    router.replace("/profile")
  }

  return (
    <div className="p-6 max-w-md mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Accedi</h1>

      <form onSubmit={handleEmailPasswordLogin} className="space-y-3">
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
        <div>
          <label className="block text-sm font-medium mb-1">Password</label>
          <input
            type="password"
            className="w-full border rounded px-3 py-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button
          type="submit"
          className="w-full bg-black text-white rounded px-4 py-2 disabled:opacity-50"
          disabled={loading}
        >
          {loading ? "Attendere…" : "Accedi"}
        </button>
      </form>

      <div className="mt-4 text-sm">
        <Link className="underline" href="/reset-password">Hai dimenticato la password?</Link>
      </div>

      {error && (
        <div className="mt-4 text-red-600 text-sm" role="status">{error}</div>
      )}
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="p-6">Caricamento…</div>}>
      <LoginInner />
    </Suspense>
  )
}


