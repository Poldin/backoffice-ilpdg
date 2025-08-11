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
      await supabase.auth.getSession()
      const next = searchParams.get("redirect") || "/"
      router.replace(next)
    }
    run()
  }, [router, searchParams])

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold">Accesso in corso…</h1>
    </div>
  )
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<div className="p-6">Caricamento…</div>}>
      <CallbackInner />
    </Suspense>
  )
}


