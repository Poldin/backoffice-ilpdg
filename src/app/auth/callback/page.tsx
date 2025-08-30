"use client"

import { Suspense, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { getSupabaseBrowser } from "@/app/lib/supabase/client"

function CallbackInner() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const run = async () => {
      const supabase = getSupabaseBrowser()
      const { } = await supabase.auth.getSession()
      const next = searchParams.get("redirect") || "/"
      router.replace(next)
    }
    run()
  }, [router, searchParams])

  return (
    <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center p-4">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-white mb-2">Accesso in corso…</h1>
        <p className="text-[#8b94a8]">Stiamo completando la tua registrazione</p>
      </div>
    </div>
  )
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center"><div className="text-white">Caricamento...</div></div>}>
      <CallbackInner />
    </Suspense>
  )
}


