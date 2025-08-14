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
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-medium text-gray-900 mb-2">Profilo</h1>
          <p className="text-gray-600">Informazioni del tuo account</p>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-gray-700">Caricamento…</div>
          </div>
        )}
        
        {!loading && error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {!loading && !error && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">Dettagli account</h2>
            </div>
            <div className="px-6 py-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <div className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-md">
                    {email ?? "—"}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ruolo</label>
                  <div className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-md">
                    {profile?.role ?? "—"}
                  </div>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">User ID</label>
                <div className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-md font-mono">
                  {profile?.user_id ?? "—"}
                </div>
              </div>
              
              {profile?.created_at && (
                <div className="pt-4 border-t border-gray-200">
                  <div className="text-xs text-gray-600">
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
      </div>
    </div>
  )
}


