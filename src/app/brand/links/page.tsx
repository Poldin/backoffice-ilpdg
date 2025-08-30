"use client"

import { useState, useEffect } from "react"
import { Plus, Search, Edit, Trash2, ExternalLink, Eye } from "lucide-react"
import Image from "next/image"
import { getSupabaseBrowser } from "@/app/lib/supabase/client"

type SellingLink = {
  id: string
  name: string | null
  descrizione: string | null
  link: string | null
  calltoaction: string | null
  img_url: string | null
  created_at: string
}

export default function LinksPage() {
  const [links, setLinks] = useState<SellingLink[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")

  useEffect(() => {
    fetchLinks()
  }, [searchTerm])

  async function fetchLinks() {
    try {
      setLoading(true)
      setError(null)
      
      const supabase = getSupabaseBrowser()
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session?.user?.id) {
        throw new Error("Non autenticato")
      }

      let query = supabase
        .from('selling_links')
        .select('*')
        .order('created_at', { ascending: false })

      // Aggiungi filtro di ricerca se presente
      if (searchTerm) {
        query = query.or(`name.ilike.%${searchTerm}%,descrizione.ilike.%${searchTerm}%`)
      }

      const { data, error: fetchError } = await query

      if (fetchError) throw fetchError

      setLinks(data || [])

    } catch (err) {
      console.error('Error fetching links:', err)
      setError(err instanceof Error ? err.message : 'Errore nel caricamento dei link')
    } finally {
      setLoading(false)
    }
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">Link di Vendita</h1>
                <p className="mt-1 text-sm text-gray-500">
                  Gestisci i tuoi link di vendita e promozioni
                </p>
              </div>
              
              <button className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                <Plus className="h-4 w-4 mr-2" />
                Aggiungi Link
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              placeholder="Cerca link..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="mt-2 text-sm text-gray-500">Caricamento link...</p>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-600 text-sm">{error}</p>
            <button 
              onClick={fetchLinks}
              className="mt-2 text-indigo-600 hover:text-indigo-500 text-sm font-medium"
            >
              Riprova
            </button>
          </div>
        ) : links.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-sm">
              {searchTerm ? 'Nessun link trovato per la ricerca.' : 'Non hai ancora link di vendita.'}
            </p>
            {!searchTerm && (
              <button className="mt-4 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700">
                <Plus className="h-4 w-4 mr-2" />
                Aggiungi il tuo primo link
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {links.map((link) => (
              <div key={link.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
                {/* Link Image */}
                <div className="aspect-w-16 aspect-h-9 bg-gray-200">
                  {link.img_url ? (
                    <Image
                      src={link.img_url}
                      alt={link.name || 'Link image'}
                      width={400}
                      height={192}
                      className="w-full h-48 object-cover"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-48 bg-gray-100">
                      <ExternalLink className="h-12 w-12 text-gray-400" />
                    </div>
                  )}
                </div>

                {/* Link Content */}
                <div className="p-6">
                  <div className="mb-4">
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      {link.name || 'Link senza nome'}
                    </h3>
                    {link.descrizione && (
                      <p className="text-sm text-gray-600 line-clamp-3">
                        {link.descrizione}
                      </p>
                    )}
                  </div>

                  {/* Call to Action */}
                  {link.calltoaction && (
                    <div className="mb-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                        {link.calltoaction}
                      </span>
                    </div>
                  )}

                  {/* Link URL */}
                  {link.link && (
                    <div className="mb-4">
                      <a 
                        href={link.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-indigo-600 hover:text-indigo-500 truncate block"
                      >
                        {link.link}
                      </a>
                    </div>
                  )}

                  {/* Date */}
                  <div className="text-xs text-gray-500 mb-4">
                    Creato il {formatDate(link.created_at)}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                    <div className="flex items-center gap-2">
                      {link.link && (
                        <a
                          href={link.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Visualizza
                        </a>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <button 
                        className="text-indigo-600 hover:text-indigo-900"
                        onClick={() => {
                          // TODO: Implement edit functionality
                          console.log('Edit link:', link.id)
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button 
                        className="text-red-600 hover:text-red-900"
                        onClick={() => {
                          // TODO: Implement delete functionality
                          console.log('Delete link:', link.id)
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
