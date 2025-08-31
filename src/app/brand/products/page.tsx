"use client"

import { useState, useEffect } from "react"
import { Plus, Upload, RefreshCw, Search, Edit, Trash2 } from "lucide-react"
import Link from "next/link"
import { getSupabaseBrowser } from "@/app/lib/supabase/client"
import AddProductDialog from "@/app/components/AddProductDialog"
import EditProductDialog from "@/app/components/EditProductDialog"
import ConfirmDialog from "@/app/components/ui/ConfirmDialog"
import SyncAPIDialog from "@/app/components/SyncAPIDialog"

type Product = {
  id: string
  name: string | null
  description: string | null
  price: number | null
  price_currency: string | null
  selling_url: string | null
  created_at: string
  edited_at: string | null
  profile_id: string | null
  data: unknown | null
  fee_perc: number | null
}

const ITEMS_PER_PAGE = 50

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [searchTerm, setSearchTerm] = useState("")
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [productToEdit, setProductToEdit] = useState<string | null>(null)
  const [productToDelete, setProductToDelete] = useState<Product | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set())
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false)
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false)
  const [showSyncAPIDialog, setShowSyncAPIDialog] = useState(false)

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE)

  useEffect(() => {
    fetchProducts()
  }, [currentPage, searchTerm])

  async function fetchProducts() {
    try {
      setLoading(true)
      setError(null)
      
      const supabase = getSupabaseBrowser()
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session?.user?.id) {
        throw new Error("Non autenticato")
      }

      // Ottieni il profile_id dell'utente corrente
      const { data: profile } = await supabase
        .from('profile')
        .select('id')
        .eq('user_id', session.user.id)
        .single()

      if (!profile) {
        throw new Error("Profilo non trovato")
      }

      let query = supabase
        .from('products')
        .select('*', { count: 'exact' })
        .eq('profile_id', profile.id)
        .order('created_at', { ascending: false })

      // Aggiungi filtro di ricerca se presente
      if (searchTerm) {
        query = query.or(`name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`)
      }

      // Paginazione
      const from = (currentPage - 1) * ITEMS_PER_PAGE
      const to = from + ITEMS_PER_PAGE - 1
      query = query.range(from, to)

      const { data, error: fetchError, count } = await query

      if (fetchError) throw fetchError

      setProducts(data || [])
      setTotalCount(count || 0)

    } catch (err) {
      console.error('Error fetching products:', err)
      setError(err instanceof Error ? err.message : 'Errore nel caricamento dei prodotti')
    } finally {
      setLoading(false)
    }
  }

  function formatPrice(price: number | null, currency: string | null) {
    if (price === null) return '-'
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: currency || 'EUR'
    }).format(price)
  }

  function formatFeePercentage(feePerc: number | null) {
    if (feePerc === null) return '-'
    return `${feePerc}%`
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  const handleProductAdded = () => {
    // Ricarica la lista dei prodotti dopo aver aggiunto un nuovo prodotto
    fetchProducts()
  }

  const handleProductUpdated = () => {
    // Ricarica la lista dei prodotti dopo aver modificato un prodotto
    fetchProducts()
  }

  const handleEditClick = (product: Product) => {
    setProductToEdit(product.id)
    setShowEditDialog(true)
  }

  const handleEditClose = () => {
    setShowEditDialog(false)
    setProductToEdit(null)
  }

  const handleDeleteClick = (product: Product) => {
    setProductToDelete(product)
    setShowDeleteDialog(true)
  }

  const handleDeleteConfirm = async () => {
    if (!productToDelete) return

    setDeleteLoading(true)

    try {
      const supabase = getSupabaseBrowser()
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session?.user?.id) {
        throw new Error("Non autenticato")
      }

      // Ottieni il profile_id dell'utente corrente
      const { data: profile } = await supabase
        .from('profile')
        .select('id')
        .eq('user_id', session.user.id)
        .single()

      if (!profile) {
        throw new Error("Profilo non trovato")
      }

      // Prima elimina le immagini associate dal storage
      const { data: productImages } = await supabase
        .from('product_images')
        .select('img_url')
        .eq('product_id', productToDelete.id)

      if (productImages && productImages.length > 0) {
        // Estrai i path delle immagini e eliminale dal storage
        const imagePaths = productImages
          .map(img => extractStoragePath(img.img_url))
          .filter(path => path !== null) as string[]

        if (imagePaths.length > 0) {
          await supabase.storage
            .from('images')
            .remove(imagePaths)
        }

        // Elimina i record delle immagini dal database
        await supabase
          .from('product_images')
          .delete()
          .eq('product_id', productToDelete.id)
      }

      // Elimina il prodotto (verifica che appartenga all'utente)
      const { error: deleteError } = await supabase
        .from('products')
        .delete()
        .eq('id', productToDelete.id)
        .eq('profile_id', profile.id)

      if (deleteError) {
        throw deleteError
      }

      // Ricarica la lista dei prodotti
      fetchProducts()
      
      // Chiudi il dialog
      setShowDeleteDialog(false)
      setProductToDelete(null)

    } catch (err) {
      console.error('Error deleting product:', err)
      // Qui potresti aggiungere un toast di errore
      alert(err instanceof Error ? err.message : 'Errore nell\'eliminazione del prodotto')
    } finally {
      setDeleteLoading(false)
    }
  }

  const handleDeleteCancel = () => {
    setShowDeleteDialog(false)
    setProductToDelete(null)
  }

  // Funzioni per la selezione massiva
  const handleSelectProduct = (productId: string) => {
    setSelectedProducts(prev => {
      const newSet = new Set(prev)
      if (newSet.has(productId)) {
        newSet.delete(productId)
      } else {
        newSet.add(productId)
      }
      return newSet
    })
  }

  const handleSelectAll = () => {
    if (selectedProducts.size === products.length && products.length > 0) {
      // Se tutti sono selezionati, deseleziona tutti
      setSelectedProducts(new Set())
    } else {
      // Altrimenti seleziona tutti
      setSelectedProducts(new Set(products.map(p => p.id)))
    }
  }

  const isAllSelected = products.length > 0 && selectedProducts.size === products.length
  const isIndeterminate = selectedProducts.size > 0 && selectedProducts.size < products.length

  // Gestione eliminazione massiva
  const handleBulkDeleteClick = () => {
    if (selectedProducts.size > 0) {
      setShowBulkDeleteDialog(true)
    }
  }

  const handleBulkDeleteConfirm = async () => {
    if (selectedProducts.size === 0) return

    setBulkDeleteLoading(true)

    try {
      const supabase = getSupabaseBrowser()
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session?.user?.id) {
        throw new Error("Non autenticato")
      }

      // Ottieni il profile_id dell'utente corrente
      const { data: profile } = await supabase
        .from('profile')
        .select('id')
        .eq('user_id', session.user.id)
        .single()

      if (!profile) {
        throw new Error("Profilo non trovato")
      }

      // Per ogni prodotto selezionato, elimina immagini e prodotto
      for (const productId of selectedProducts) {
        // Elimina le immagini associate dal storage
        const { data: productImages } = await supabase
          .from('product_images')
          .select('img_url')
          .eq('product_id', productId)

        if (productImages && productImages.length > 0) {
          // Estrai i path delle immagini e eliminale dal storage
          const imagePaths = productImages
            .map(img => extractStoragePath(img.img_url))
            .filter(path => path !== null) as string[]

          if (imagePaths.length > 0) {
            await supabase.storage
              .from('images')
              .remove(imagePaths)
          }

          // Elimina i record delle immagini dal database
          await supabase
            .from('product_images')
            .delete()
            .eq('product_id', productId)
        }

        // Elimina il prodotto (verifica che appartenga all'utente)
        await supabase
          .from('products')
          .delete()
          .eq('id', productId)
          .eq('profile_id', profile.id)
      }

      // Ricarica la lista dei prodotti
      fetchProducts()
      
      // Reset selezioni e chiudi dialog
      setSelectedProducts(new Set())
      setShowBulkDeleteDialog(false)

    } catch (err) {
      console.error('Error bulk deleting products:', err)
      alert(err instanceof Error ? err.message : 'Errore nell\'eliminazione dei prodotti')
    } finally {
      setBulkDeleteLoading(false)
    }
  }

  const handleBulkDeleteCancel = () => {
    setShowBulkDeleteDialog(false)
  }

  // Navigazione al dettaglio prodotto
  const handleRowClick = (productId: string, event: React.MouseEvent) => {
    // Non navigare se si clicca su checkbox o bottoni azione
    const target = event.target as HTMLElement
    if (target.closest('input[type="checkbox"]') || target.closest('button') || target.closest('a')) {
      return
    }
    
    // Naviga alla pagina dettaglio
    window.location.href = `/brand/products/${productId}`
  }

  // Reset selezioni quando cambia la ricerca o la pagina
  useEffect(() => {
    setSelectedProducts(new Set())
  }, [searchTerm, currentPage])

  // Funzione helper per estrarre il path dal public URL (copiata da AddProductDialog)
  function extractStoragePath(publicUrl?: string | null): string | null {
    if (!publicUrl) return null
    const base = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/images/`
    if (publicUrl.startsWith(base)) return publicUrl.slice(base.length)
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">Prodotti</h1>
                <p className="mt-1 text-sm text-gray-500">
                  Gestisci i tuoi prodotti e le loro informazioni
                </p>
              </div>
              
              {/* Action Buttons */}
              <div className="flex items-center gap-3">
                {selectedProducts.size > 0 ? (
                  // Azioni per selezione massiva
                  <>
                    <span className="text-sm text-gray-700">
                      {selectedProducts.size} prodotto{selectedProducts.size !== 1 ? 'i' : ''} selezionato{selectedProducts.size !== 1 ? 'i' : ''}
                    </span>
                    <button 
                      onClick={handleBulkDeleteClick}
                      className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Elimina Selezionati
                    </button>
                    <button 
                      onClick={() => setSelectedProducts(new Set())}
                      className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      Deseleziona
                    </button>
                  </>
                ) : (
                  // Azioni normali
                  <>
                    <button 
                      onClick={() => setShowSyncAPIDialog(true)}
                      className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Sync API
                    </button>
                    
                    <button className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                      <Upload className="h-4 w-4 mr-2" />
                      Importa CSV
                    </button>
                    
                    <button 
                      onClick={() => setShowAddDialog(true)}
                      className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Aggiungi Prodotto
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search and Filters */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              placeholder="Cerca prodotti..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                setCurrentPage(1) // Reset to first page when searching
              }}
            />
          </div>
        </div>

        {/* Table */}
        <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
              <p className="mt-2 text-sm text-gray-500">Caricamento prodotti...</p>
            </div>
          ) : error ? (
            <div className="p-8 text-center">
              <p className="text-red-600 text-sm">{error}</p>
              <button 
                onClick={fetchProducts}
                className="mt-2 text-indigo-600 hover:text-indigo-500 text-sm font-medium"
              >
                Riprova
              </button>
            </div>
          ) : products.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-500 text-sm">
                {searchTerm ? 'Nessun prodotto trovato per la ricerca.' : 'Non hai ancora prodotti.'}
              </p>
              {!searchTerm && (
                <button 
                  onClick={() => setShowAddDialog(true)}
                  className="mt-4 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Aggiungi il tuo primo prodotto
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                        <input
                          type="checkbox"
                          checked={isAllSelected}
                          ref={(el) => {
                            if (el) el.indeterminate = isIndeterminate
                          }}
                          onChange={handleSelectAll}
                          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                        />
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Prodotto
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Prezzo
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Fee %
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Data Creazione
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        URL Vendita
                      </th>
                      <th className="relative px-6 py-3">
                        <span className="sr-only">Azioni</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {products.map((product) => (
                      <tr 
                        key={product.id} 
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={(e) => handleRowClick(product.id, e)}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={selectedProducts.has(product.id)}
                            onChange={() => handleSelectProduct(product.id)}
                            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              <Link 
                                href={`/brand/products/${product.id}`}
                                className="hover:text-indigo-600"
                              >
                                {product.name || 'Senza nome'}
                              </Link>
                            </div>
                            {product.description && (
                              <div className="text-sm text-gray-500 max-w-xs truncate">
                                {product.description}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatPrice(product.price, product.price_currency)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatFeePercentage(product.fee_perc)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(product.created_at)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {product.selling_url ? (
                            <a 
                              href={product.selling_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-indigo-600 hover:text-indigo-500 truncate max-w-xs block"
                            >
                              {product.selling_url}
                            </a>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleEditClick(product)
                              }}
                              className="text-indigo-600 hover:text-indigo-900"
                              title="Modifica prodotto"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button 
                              className="text-red-600 hover:text-red-900"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDeleteClick(product)
                              }}
                              title="Elimina prodotto"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="bg-white px-4 py-3 border-t border-gray-200 sm:px-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 flex justify-between sm:hidden">
                      <button
                        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                        className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Precedente
                      </button>
                      <button
                        onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                        disabled={currentPage === totalPages}
                        className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Successivo
                      </button>
                    </div>
                    <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm text-gray-700">
                          Mostra <span className="font-medium">{((currentPage - 1) * ITEMS_PER_PAGE) + 1}</span> a{' '}
                          <span className="font-medium">
                            {Math.min(currentPage * ITEMS_PER_PAGE, totalCount)}
                          </span>{' '}
                          di <span className="font-medium">{totalCount}</span> risultati
                        </p>
                      </div>
                      <div>
                        <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                          <button
                            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                            disabled={currentPage === 1}
                            className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Precedente
                          </button>
                          
                          {/* Page numbers */}
                          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                            const pageNum = i + 1
                            return (
                              <button
                                key={pageNum}
                                onClick={() => setCurrentPage(pageNum)}
                                className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                                  currentPage === pageNum
                                    ? 'z-10 bg-indigo-50 border-indigo-500 text-indigo-600'
                                    : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                                }`}
                              >
                                {pageNum}
                              </button>
                            )
                          })}
                          
                          <button
                            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                            disabled={currentPage === totalPages}
                            className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Successivo
                          </button>
                        </nav>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Add Product Dialog */}
      <AddProductDialog
        isOpen={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        onProductAdded={handleProductAdded}
      />

      {/* Edit Product Dialog */}
      <EditProductDialog
        isOpen={showEditDialog}
        onClose={handleEditClose}
        onProductUpdated={handleProductUpdated}
        productId={productToEdit}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showDeleteDialog}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        title="Elimina Prodotto"
        message={`Sei sicuro di voler eliminare il prodotto "${productToDelete?.name || 'Senza nome'}"? Questa azione non può essere annullata e verranno eliminate anche tutte le immagini associate.`}
        confirmText="Elimina"
        cancelText="Annulla"
        variant="danger"
        loading={deleteLoading}
      />

      {/* Bulk Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showBulkDeleteDialog}
        onClose={handleBulkDeleteCancel}
        onConfirm={handleBulkDeleteConfirm}
        title="Elimina Prodotti Selezionati"
        message={`Sei sicuro di voler eliminare ${selectedProducts.size} prodotto${selectedProducts.size !== 1 ? 'i' : ''}? Questa azione non può essere annullata e verranno eliminate anche tutte le immagini associate.`}
        confirmText={`Elimina ${selectedProducts.size} prodotto${selectedProducts.size !== 1 ? 'i' : ''}`}
        cancelText="Annulla"
        variant="danger"
        loading={bulkDeleteLoading}
      />

      {/* Sync API Dialog */}
      <SyncAPIDialog
        isOpen={showSyncAPIDialog}
        onClose={() => setShowSyncAPIDialog(false)}
      />
    </div>
  )
}
