"use client"

import { useState, useEffect } from 'react'
import { getSupabaseBrowser } from '@/app/lib/supabase/client'
import { type UserRole, isValidRole } from '@/app/lib/acl'

export function useUserRole() {
  const [userRole, setUserRole] = useState<UserRole | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchUserRole() {
      try {
        setLoading(true)
        setError(null)
        
        const supabase = getSupabaseBrowser()
        const { data: { session } } = await supabase.auth.getSession()
        
        if (session?.user?.id) {
          const { data: profile, error: profileError } = await supabase
            .from('profile')
            .select('role')
            .eq('user_id', session.user.id)
            .single()
          
          if (profileError) {
            throw profileError
          }
          
          if (profile?.role && isValidRole(profile.role)) {
            setUserRole(profile.role)
          } else {
            setError('Ruolo utente non valido')
          }
        } else {
          setUserRole(null)
        }
      } catch (err) {
        console.error('Error fetching user role:', err)
        setError(err instanceof Error ? err.message : 'Errore nel caricamento del ruolo utente')
      } finally {
        setLoading(false)
      }
    }

    fetchUserRole()

    // Ascolta i cambiamenti di auth
    const supabase = getSupabaseBrowser()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setUserRole(null)
        setLoading(false)
      } else if (event === 'SIGNED_IN' && session) {
        fetchUserRole()
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  return { userRole, loading, error }
}
