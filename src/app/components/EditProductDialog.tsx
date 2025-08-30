"use client"

import { useState, useEffect } from 'react'
import { Save, X, Upload, DollarSign, Link as LinkIcon, FileText, Tag, Trash2, Loader2 } from 'lucide-react'
import Dialog from './ui/Dialog'
import { getSupabaseBrowser } from '@/app/lib/supabase/client'

interface EditProductDialogProps {
  isOpen: boolean
  onClose: () => void
  onProductUpdated: () => void
  productId: string | null
}

interface ProductFormData {
  name: string
  description: string
  price: string
  price_currency: string
  selling_url: string
}

interface ProductImage {
  id?: number
  img_url: string
  file?: File
  uploading?: boolean
  isExisting?: boolean // Per distinguere immagini esistenti da nuove
}

const CURRENCIES = [
  { value: 'EUR', label: '€ Euro' },
  { value: 'USD', label: '$ Dollaro' },
  { value: 'GBP', label: '£ Sterlina' },
]

export default function EditProductDialog({ isOpen, onClose, onProductUpdated, productId }: EditProductDialogProps) {
  const [formData, setFormData] = useState<ProductFormData>({
    name: '',
    description: '',
    price: '',
    price_currency: 'EUR',
    selling_url: ''
  })
  
  const [loading, setLoading] = useState(false)
  const [loadingProduct, setLoadingProduct] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [images, setImages] = useState<ProductImage[]>([])
  const [imageUploading, setImageUploading] = useState(false)

  // Carica i dati del prodotto quando si apre il dialog
  useEffect(() => {
    if (isOpen && productId) {
      loadProductData()
    }
  }, [isOpen, productId])

  const loadProductData = async () => {
    if (!productId) return

    setLoadingProduct(true)
    setError(null)

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

      // Carica i dati del prodotto
      const { data: product, error: productError } = await supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .eq('profile_id', profile.id) // Assicurati che l'utente possa modificare solo i suoi prodotti
        .single()

      if (productError) {
        if (productError.code === 'PGRST116') {
          throw new Error("Prodotto non trovato")
        }
        throw productError
      }

      // Popola il form con i dati del prodotto
      setFormData({
        name: product.name || '',
        description: product.description || '',
        price: product.price ? product.price.toString() : '',
        price_currency: product.price_currency || 'EUR',
        selling_url: product.selling_url || ''
      })

      // Carica le immagini esistenti
      const { data: productImages, error: imagesError } = await supabase
        .from('product_images')
        .select('*')
        .eq('product_id', productId)
        .order('created_at', { ascending: true })

      if (imagesError) {
        console.error('Error fetching images:', imagesError)
      } else {
        const existingImages: ProductImage[] = (productImages || []).map(img => ({
          id: img.id,
          img_url: img.img_url || '',
          isExisting: true
        }))
        setImages(existingImages)
      }

    } catch (err) {
      console.error('Error loading product:', err)
      setError(err instanceof Error ? err.message : 'Errore nel caricamento del prodotto')
    } finally {
      setLoadingProduct(false)
    }
  }

  const handleInputChange = (field: keyof ProductFormData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const validateForm = (): string | null => {
    if (!formData.name.trim()) {
      return 'Il nome del prodotto è obbligatorio'
    }
    
    if (formData.price && isNaN(parseFloat(formData.price))) {
      return 'Il prezzo deve essere un numero valido'
    }
    
    if (formData.selling_url && !formData.selling_url.startsWith('http')) {
      return 'L\'URL di vendita deve iniziare con http:// o https://'
    }
    
    return null
  }

  // Funzioni per gestire le immagini (simili a AddProductDialog)
  function sanitizeFileName(name: string): string {
    const withoutDiacritics = name
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
    const safe = withoutDiacritics
      .replace(/[^a-zA-Z0-9._-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+/, "")
      .replace(/\.+$/, "")
      .toLowerCase()
    const match = safe.match(/^(.*?)(\.[a-z0-9]+)$/i)
    const base = match ? match[1] : safe
    const ext = match ? match[2] : ""
    const trimmedBase = base.slice(-100)
    return `${trimmedBase}${ext}`
  }

  function extractStoragePath(publicUrl?: string | null): string | null {
    if (!publicUrl) return null
    const base = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/images/`
    if (publicUrl.startsWith(base)) return publicUrl.slice(base.length)
    return null
  }

  const handleImageUpload = async (files: FileList) => {
    if (!files.length) return

    const newImages: ProductImage[] = []
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (file.type.startsWith('image/')) {
        const tempUrl = URL.createObjectURL(file)
        newImages.push({
          img_url: tempUrl,
          file: file,
          uploading: false,
          isExisting: false
        })
      }
    }

    setImages(prev => [...prev, ...newImages])
  }

  const removeImage = async (index: number) => {
    const imageToRemove = images[index]
    
    // Se è un'immagine esistente, eliminala dal database e storage
    if (imageToRemove.isExisting && imageToRemove.id) {
      try {
        const supabase = getSupabaseBrowser()
        
        // Elimina dal storage
        const storagePath = extractStoragePath(imageToRemove.img_url)
        if (storagePath) {
          await supabase.storage.from('images').remove([storagePath])
        }
        
        // Elimina dal database
        await supabase
          .from('product_images')
          .delete()
          .eq('id', imageToRemove.id)
        
      } catch (error) {
        console.error('Error removing existing image:', error)
        // Continua comunque con la rimozione dalla UI
      }
    }

    setImages(prev => {
      const newImages = [...prev]
      // Revoca l'URL temporaneo se presente
      if (newImages[index].img_url.startsWith('blob:')) {
        URL.revokeObjectURL(newImages[index].img_url)
      }
      newImages.splice(index, 1)
      return newImages
    })
  }

  const uploadNewImages = async (productId: string) => {
    const newImages = images.filter(img => !img.isExisting && img.file)
    if (!newImages.length) return

    setImageUploading(true)
    const supabase = getSupabaseBrowser()

    try {
      const uploadedImages: { img_url: string }[] = []

      for (const image of newImages) {
        if (image.file) {
          const safeName = sanitizeFileName(image.file.name)
          const path = `products/${productId}/${Date.now()}-${safeName}`
          
          const { error: uploadError } = await supabase.storage
            .from("images")
            .upload(path, image.file, {
              cacheControl: "3600",
              upsert: true,
              contentType: image.file.type,
            })

          if (uploadError) {
            throw uploadError
          }

          const { data } = supabase.storage.from("images").getPublicUrl(path)
          uploadedImages.push({ img_url: data.publicUrl })
        }
      }

      // Salva le nuove immagini nella tabella product_images
      if (uploadedImages.length > 0) {
        const imageRecords = uploadedImages.map(img => ({
          product_id: productId,
          img_url: img.img_url
        }))

        const { error: dbError } = await supabase
          .from('product_images')
          .insert(imageRecords)

        if (dbError) {
          throw dbError
        }
      }

    } catch (err) {
      console.error('Error uploading new images:', err)
      throw err
    } finally {
      setImageUploading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!productId) return
    
    const validationError = validateForm()
    if (validationError) {
      setError(validationError)
      return
    }
    
    setLoading(true)
    setError(null)
    
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

      // Prepara i dati di aggiornamento del prodotto
      const updateData = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        price: formData.price ? parseFloat(formData.price) : null,
        price_currency: formData.price_currency || null,
        selling_url: formData.selling_url.trim() || null,
        edited_at: new Date().toISOString()
      }

      // Aggiorna il prodotto
      const { error: updateError } = await supabase
        .from('products')
        .update(updateData)
        .eq('id', productId)
        .eq('profile_id', profile.id)

      if (updateError) {
        throw updateError
      }

      // Upload delle nuove immagini se presenti
      const newImages = images.filter(img => !img.isExisting)
      if (newImages.length > 0) {
        await uploadNewImages(productId)
      }

      // Reset form e chiudi dialog
      resetForm()
      onProductUpdated()
      onClose()
      
    } catch (err) {
      console.error('Error updating product:', err)
      setError(err instanceof Error ? err.message : 'Errore nell\'aggiornamento del prodotto')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      price: '',
      price_currency: 'EUR',
      selling_url: ''
    })
    
    // Pulisci le immagini temporanee
    images.forEach(img => {
      if (img.img_url.startsWith('blob:')) {
        URL.revokeObjectURL(img.img_url)
      }
    })
    setImages([])
    setError(null)
  }

  const handleClose = () => {
    if (!loading && !imageUploading) {
      resetForm()
      onClose()
    }
  }

  return (
    <Dialog
      isOpen={isOpen}
      onClose={handleClose}
      title="Modifica Prodotto"
      size="custom"
      customSize={{
        height: '95vh',
        minWidth: '60vw',
        maxWidth: '90vw'
      }}
    >
      {loadingProduct ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="mt-2 text-sm text-gray-500">Caricamento prodotto...</p>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
          {/* Content Area */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <div className="grid grid-cols-1 gap-6">
              
              {/* Form Fields */}
              <div className="space-y-6">
                
                {/* Nome Prodotto */}
                <div>
                  <label htmlFor="edit-name" className="block text-sm font-medium text-gray-700 mb-2">
                    <Tag className="h-4 w-4 inline mr-1" />
                    Nome Prodotto *
                  </label>
                  <input
                    type="text"
                    id="edit-name"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm text-gray-700"
                    placeholder="Inserisci il nome del prodotto"
                    required
                  />
                </div>

                {/* Descrizione */}
                <div>
                  <label htmlFor="edit-description" className="block text-sm font-medium text-gray-700 mb-2">
                    <FileText className="h-4 w-4 inline mr-1" />
                    Descrizione
                  </label>
                  <textarea
                    id="edit-description"
                    rows={6}
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm text-gray-700"
                    placeholder="Descrivi il prodotto..."
                  />
                </div>

                {/* Prezzo e Valuta */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="edit-price" className="block text-sm font-medium text-gray-700 mb-2">
                      <DollarSign className="h-4 w-4 inline mr-1" />
                      Prezzo
                    </label>
                    <input
                      type="number"
                      id="edit-price"
                      step="0.01"
                      min="0"
                      value={formData.price}
                      onChange={(e) => handleInputChange('price', e.target.value)}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm text-gray-700"
                      placeholder="0.00"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="edit-currency" className="block text-sm font-medium text-gray-700 mb-2">
                      Valuta
                    </label>
                    <select
                      id="edit-currency"
                      value={formData.price_currency}
                      onChange={(e) => handleInputChange('price_currency', e.target.value)}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm text-gray-700"
                    >
                      {CURRENCIES.map((currency) => (
                        <option key={currency.value} value={currency.value}>
                          {currency.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* URL di Vendita */}
                <div>
                  <label htmlFor="edit-selling_url" className="block text-sm font-medium text-gray-700 mb-2">
                    <LinkIcon className="h-4 w-4 inline mr-1" />
                    URL di Vendita
                  </label>
                  <input
                    type="url"
                    id="edit-selling_url"
                    value={formData.selling_url}
                    onChange={(e) => handleInputChange('selling_url', e.target.value)}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm text-gray-700"
                    placeholder="https://esempio.com/prodotto"
                  />
                </div>

                {/* Upload Immagini */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Upload className="h-4 w-4 inline mr-1" />
                    Immagini Prodotto
                    {imageUploading && (
                      <span className="ml-2 text-xs text-gray-500">Caricando...</span>
                    )}
                  </label>
                  
                  {/* Upload Area */}
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={(e) => {
                        if (e.target.files) {
                          handleImageUpload(e.target.files)
                        }
                        e.target.value = ""
                      }}
                      className="hidden"
                      id="edit-image-upload"
                    />
                    <label htmlFor="edit-image-upload" className="cursor-pointer">
                      <Upload className="mx-auto h-12 w-12 text-gray-400" />
                      <p className="mt-2 text-sm text-gray-600">
                        Clicca per aggiungere nuove immagini
                      </p>
                      <p className="text-xs text-gray-500">
                        Supporta selezione multipla • JPG, PNG, GIF • Max 5MB per immagine
                      </p>
                    </label>
                  </div>

                  {/* Preview Immagini */}
                  {images.length > 0 && (
                    <div className="mt-4">
                      <div className="mb-3 flex items-center justify-between">
                        <p className="text-sm text-gray-700 font-medium">
                          {images.length} immagine{images.length !== 1 ? 'i' : ''} • 
                          {images.filter(img => img.isExisting).length} esistenti, {images.filter(img => !img.isExisting).length} nuove
                        </p>
                        <p className="text-xs text-gray-500">Scorri orizzontalmente per vedere tutte</p>
                      </div>
                      
                      {/* Galleria orizzontale scorrevole */}
                      <div className="flex gap-3 overflow-x-auto pb-3 scrollbar-thin gallery-scroll">
                        {images.map((image, index) => (
                          <div key={index} className="flex-shrink-0 relative group">
                            <div className="w-32 h-32 bg-gray-100 rounded-lg overflow-hidden shadow-sm border border-gray-200 group-hover:shadow-md transition-all duration-200">
                              <img
                                src={image.img_url}
                                alt={`Preview ${index + 1}`}
                                className="w-full h-full object-cover image-hover-scale"
                              />
                              {image.uploading && (
                                <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                                  <Loader2 className="h-4 w-4 text-white animate-spin" />
                                </div>
                              )}
                              {image.isExisting && (
                                <div className="absolute top-1 left-1 bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded text-[10px] font-medium">
                                  Esistente
                                </div>
                              )}
                              {!image.isExisting && (
                                <div className="absolute top-1 left-1 bg-green-500 text-white text-xs px-1.5 py-0.5 rounded text-[10px] font-medium">
                                  Nuova
                                </div>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => removeImage(index)}
                              className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 shadow-sm"
                              title="Rimuovi immagine"
                            >
                              <X className="h-3 w-3" />
                            </button>
                            <div className="mt-1 text-xs text-gray-500 text-center max-w-32 truncate">
                              #{index + 1}
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      {/* Indicatori di scroll */}
                      {images.length > 4 && (
                        <div className="flex justify-center mt-2 space-x-1">
                          {Array.from({ length: Math.min(images.length, 8) }).map((_, index) => (
                            <div
                              key={index}
                              className="w-1.5 h-1.5 rounded-full bg-gray-300"
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="px-6 py-3 bg-red-50 border-t border-red-200">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex justify-end gap-3 px-6 py-4 bg-gray-50 border-t border-gray-200">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading || imageUploading}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <X className="h-4 w-4 mr-2" />
              Annulla
            </button>
            
            <button
              type="submit"
              disabled={loading || imageUploading || !formData.name.trim()}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading || imageUploading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  {imageUploading ? 'Caricando immagini...' : 'Aggiornamento...'}
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Aggiorna Prodotto
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </Dialog>
  )
}
