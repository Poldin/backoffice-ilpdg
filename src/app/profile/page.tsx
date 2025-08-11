"use client"

import { useEffect, useState } from "react"
import { getSupabaseBrowser } from "@/app/lib/supabase/client"
import type { Tables } from "@/app/lib/database.type"

type ProfileRow = Tables<"profile">

export default function ProfilePage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState<string | null>(null)
  const [profile, setProfile] = useState<ProfileRow | null>(null)

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
      setLoading(false)
    }
    run()
  }, [])

  return (
    <div className="p-4">
      <h1 className="text-xl font-semibold mb-4">Profilo</h1>

      {loading && <p>Caricamento…</p>}
      {!loading && error && <p className="text-red-600">{error}</p>}

      {!loading && !error && (
        <div className="space-y-2">
          <div>
            <span className="font-medium">Email:</span> {email ?? "—"}
          </div>
          <div>
            <span className="font-medium">Ruolo:</span> {profile?.role ?? "—"}
          </div>
          <div>
            <span className="font-medium">User ID:</span> {profile?.user_id ?? "—"}
          </div>
          <div className="text-xs text-black/60 dark:text-white/60">
            Creato: {profile?.created_at ?? "—"} {profile?.edited_at ? `(modificato: ${profile.edited_at})` : ""}
          </div>
        </div>
      )}
    </div>
  )
}


