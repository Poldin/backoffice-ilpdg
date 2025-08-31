"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Edit, ExternalLink, Calendar, DollarSign, Package, Percent } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { getSupabaseBrowser } from "@/app/lib/supabase/client"
import EditProductDialog from "@/app/components/EditProductDialog"
import type { ReactElement } from "react"

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

type ProductImage = {
  id: number
  img_url: string | null
  product_id: string | null
  created_at: string
}

export default function ProductDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [product, setProduct] = useState<Product | null>(null)
  const [images, setImages] = useState<ProductImage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showEditDialog, setShowEditDialog] = useState(false)

  const productId = params.id as string

  useEffect(() => {
    if (productId) {
      fetchProduct()
    }
  }, [productId])

  async function fetchProduct() {
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

      // Fetch product
      const { data: productData, error: productError } = await supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .eq('profile_id', profile.id) // Assicurati che l'utente possa vedere solo i suoi prodotti
        .single()

      if (productError) {
        if (productError.code === 'PGRST116') {
          throw new Error("Prodotto non trovato")
        }
        throw productError
      }

      setProduct(productData)

      // Fetch product images
      const { data: imagesData, error: imagesError } = await supabase
        .from('product_images')
        .select('*')
        .eq('product_id', productId)
        .order('created_at', { ascending: true })

      if (imagesError) {
        console.error('Error fetching images:', imagesError)
        // Non bloccare la pagina se le immagini non si caricano
      } else {
        setImages(imagesData || [])
      }

    } catch (err) {
      console.error('Error fetching product:', err)
      const message = err instanceof Error ? err.message : 'Errore nel caricamento del prodotto'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  function formatPrice(price: number | null, currency: string | null) {
    if (price === null) return 'Prezzo non specificato'
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: currency || 'EUR'
    }).format(price)
  }

  function formatFeePercentage(feePerc: number | null) {
    if (feePerc === null) return 'Non specificata'
    return `${feePerc}%`
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const handleProductUpdated = () => {
    // Ricarica i dati del prodotto dopo la modifica
    fetchProduct()
  }

  const handleEditClose = () => {
    setShowEditDialog(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-sm text-gray-500">Caricamento prodotto...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 text-sm mb-4">{error}</p>
          <button 
            onClick={() => router.push('/brand/products')}
            className="text-indigo-600 hover:text-indigo-500 text-sm font-medium"
          >
            Torna ai prodotti
          </button>
        </div>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 text-sm mb-4">Prodotto non trovato</p>
          <button 
            onClick={() => router.push('/brand/products')}
            className="text-indigo-600 hover:text-indigo-500 text-sm font-medium"
          >
            Torna ai prodotti
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Link 
                  href="/brand/products"
                  className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-gray-700"
                >
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Torna ai prodotti
                </Link>
                <div className="h-5 w-px bg-gray-300" />
                <div>
                  <h1 className="text-2xl font-semibold text-gray-900">
                    {product.name || 'Prodotto senza nome'}
                  </h1>
                  <p className="mt-1 text-sm text-gray-500">
                    ID: {product.id}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                {product.selling_url && (
                  <a
                    href={product.selling_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Vedi su Store
                  </a>
                )}
                
                <button
                  onClick={() => setShowEditDialog(true)}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Modifica
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Product Images */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Immagini Prodotto</h3>
                {images.length > 0 && (
                  <p className="text-sm text-gray-500 mt-1">{images.length} img • Scorri orizzontalmente per vedere tutte</p>
                )}
              </div>
              <div className="p-6">
                {images.length === 0 ? (
                  <div className="text-center py-12">
                    <Package className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">Nessuna immagine</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Questo prodotto non ha ancora immagini associate.
                    </p>
                  </div>
                ) : (
                  <div className="relative">
                    {/* Galleria orizzontale scorrevole */}
                    <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin gallery-scroll">
                      {images.map((image, index) => (
                        <div key={image.id} className="flex-shrink-0 group">
                          <div className="w-64 h-64 bg-gray-200 rounded-lg overflow-hidden shadow-sm border border-gray-200 group-hover:shadow-md transition-all duration-200">
                            {image.img_url ? (
                              <Image
                                src={image.img_url}
                                alt={`${product.name} - Immagine ${index + 1}`}
                                width={256}
                                height={256}
                                className="w-full h-full object-cover image-hover-scale"
                                sizes="256px"
                              />
                            ) : (
                              <div className="flex items-center justify-center h-full">
                                <Package className="h-12 w-12 text-gray-400" />
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {/* Indicatori di scroll */}
                    {images.length > 2 && (
                      <div className="flex justify-center mt-4 space-x-1">
                        {images.map((_, index) => (
                          <div
                            key={index}
                            className="w-2 h-2 rounded-full bg-gray-300"
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Descrizione</h3>
              </div>
              <div className="p-6">
                {product.description ? (
                  <div className="prose prose-sm max-w-none text-gray-700">
                    {product.description.split('\n').map((paragraph, index) => (
                      <p key={index} className="mb-4 last:mb-0">
                        {paragraph}
                      </p>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 italic">Nessuna descrizione disponibile.</p>
                )}
              </div>
            </div>

            {/* Additional Data */}
            {!!product.data && typeof product.data === 'object' && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Dati Aggiuntivi</h3>
                </div>
                <div className="p-6">
                  <pre className="text-sm text-gray-700 bg-gray-50 rounded-md p-4 overflow-x-auto">
                    {JSON.stringify(product.data, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            
            {/* Product Info Card */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Informazioni Prodotto</h3>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <DollarSign className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Prezzo</p>
                    <p className="text-sm text-gray-500">
                      {formatPrice(product.price, product.price_currency)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Percent className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Fee Percentuale</p>
                    <p className="text-sm text-gray-500">
                      {formatFeePercentage(product.fee_perc)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Data Creazione</p>
                    <p className="text-sm text-gray-500">
                      {formatDate(product.created_at)}
                    </p>
                  </div>
                </div>

                {product.edited_at && (
                  <div className="flex items-center gap-3">
                    <Edit className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Ultima Modifica</p>
                      <p className="text-sm text-gray-500">
                        {formatDate(product.edited_at)}
                      </p>
                    </div>
                  </div>
                )}

                {product.selling_url && (
                  <div className="flex items-center gap-3">
                    <ExternalLink className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">URL Vendita</p>
                      <a 
                        href={product.selling_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-indigo-600 hover:text-indigo-500 truncate block max-w-full"
                      >
                        {product.selling_url}
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Stats Card */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Statistiche</h3>
              </div>
              <div className="p-6">
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Immagini Associate</span>
                    <span className="text-sm font-medium text-gray-900">{images.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Stato</span>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Attivo
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Product Dialog */}
      <EditProductDialog
        isOpen={showEditDialog}
        onClose={handleEditClose}
        onProductUpdated={handleProductUpdated}
        productId={productId}
      />
    </div>
  )
}
