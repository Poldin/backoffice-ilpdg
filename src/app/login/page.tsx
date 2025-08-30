"use client"

import { Suspense, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Eye, EyeOff } from "lucide-react"
import { getSupabaseBrowser } from "@/app/lib/supabase/client"

function LoginInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  async function handleEmailPasswordLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const supabase = getSupabaseBrowser()
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) return setError(error.message)

    // Sync session cookies server-side so middleware can read them
    try {
      const access_token = data.session?.access_token
      const refresh_token = data.session?.refresh_token
      if (access_token && refresh_token) {
        await fetch('/api/auth/set-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ access_token, refresh_token })
        })
      }
    } catch {}

    router.replace("/profile")
  }

  return (
    <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            Accedi al tuo account
          </h1>
          <p className="text-[#8b94a8]">
            Inserisci le tue credenziali e accedi.
          </p>
        </div>

        <form onSubmit={handleEmailPasswordLogin} className="space-y-6">
          <div>
            <label className="block text-white text-sm font-medium mb-2">
              Email
            </label>
            <input
              type="email"
              className="w-full px-4 py-3 bg-[#1a1f36] border border-[#2d3748] rounded-lg text-white placeholder-[#8b94a8] focus:border-[#625df5] focus:outline-none focus:ring-1 focus:ring-[#625df5] transition-colors"
              placeholder="email@esempio.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-white text-sm font-medium mb-2">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                className="w-full px-4 py-3 pr-12 bg-[#1a1f36] border border-[#2d3748] rounded-lg text-white placeholder-[#8b94a8] focus:border-[#625df5] focus:outline-none focus:ring-1 focus:ring-[#625df5] transition-colors"
                placeholder="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8b94a8] hover:text-white transition-colors"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>
          <button
            type="submit"
            className="w-full py-3 bg-[#625df5] text-white rounded-lg font-medium hover:bg-[#5a54f0] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            disabled={loading}
          >
            {loading ? "Accesso in corso..." : "Accedi"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link className="text-[#625df5] hover:underline text-sm" href="/reset-password">
            Hai dimenticato la password?
          </Link>
        </div>

        <div className="mt-6 text-center">
          <p className="text-[#8b94a8] text-sm">
            Non hai ancora un account?{' '}
            <Link href="/register" className="text-[#625df5] hover:underline">
              Registrati
            </Link>
          </p>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-500 bg-opacity-10 border border-red-500 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center"><div className="text-white">Caricamento...</div></div>}>
      <LoginInner />
    </Suspense>
  )
}


