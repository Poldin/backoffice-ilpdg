"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { getSupabaseBrowser } from "@/app/lib/supabase/client"

export default function LogoutPage() {
  const router = useRouter()

  useEffect(() => {
    const run = async () => {
      const supabase = getSupabaseBrowser()
      await supabase.auth.signOut()
      router.replace("/")
    }
    run()
  }, [router])

  return (
    <div className="p-4">
      <h1 className="text-xl font-semibold mb-2">Logout</h1>
      <p>Reindirizzamento…</p>
    </div>
  )
}


