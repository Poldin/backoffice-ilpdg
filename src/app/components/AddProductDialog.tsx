"use client"

import { useState } from 'react'
import { Save, X, Upload, DollarSign, Link as LinkIcon, FileText, Tag, Trash2, Loader2 } from 'lucide-react'
import Dialog from './ui/Dialog'
import { getSupabaseBrowser } from '@/app/lib/supabase/client'

interface AddProductDialogProps {
  isOpen: boolean
  onClose: () => void
  onProductAdded: () => void
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
}

const CURRENCIES = [
  { value: 'EUR', label: '€ Euro' },
  { value: 'USD', label: '$ Dollaro' },
  { value: 'GBP', label: '£ Sterlina' },
]

export default function AddProductDialog({ isOpen, onClose, onProductAdded }: AddProductDialogProps) {
  const [formData, setFormData] = useState<ProductFormData>({
    name: '',
    description: '',
    price: '',
    price_currency: 'EUR',
    selling_url: ''
  })
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [images, setImages] = useState<ProductImage[]>([])
  const [imageUploading, setImageUploading] = useState(false)

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

  // Funzioni per gestire le immagini (adattate da profile)
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
          uploading: false
        })
      }
    }

    setImages(prev => [...prev, ...newImages])
  }

  const removeImage = (index: number) => {
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

  const uploadImagesToStorage = async (productId: string) => {
    if (!images.length) return

    setImageUploading(true)
    const supabase = getSupabaseBrowser()
    const uploadedImages: { img_url: string }[] = []

    try {
      for (const image of images) {
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

      // Salva le immagini nella tabella product_images
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
      console.error('Error uploading images:', err)
      throw err
    } finally {
      setImageUploading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
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

      // Prepara i dati del prodotto
      const productData = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        price: formData.price ? parseFloat(formData.price) : null,
        price_currency: formData.price_currency || null,
        selling_url: formData.selling_url.trim() || null,
        profile_id: profile.id,
        data: null
      }

      // Inserisci il prodotto
      const { data: insertedProduct, error: insertError } = await supabase
        .from('products')
        .insert([productData])
        .select('id')
        .single()

      if (insertError) {
        throw insertError
      }

      // Upload delle immagini se presenti
      if (images.length > 0 && insertedProduct) {
        await uploadImagesToStorage(insertedProduct.id)
      }

      // Reset form e chiudi dialog
      setFormData({
        name: '',
        description: '',
        price: '',
        price_currency: 'EUR',
        selling_url: ''
      })
      
      // Pulisci le immagini
      images.forEach(img => {
        if (img.img_url.startsWith('blob:')) {
          URL.revokeObjectURL(img.img_url)
        }
      })
      setImages([])
      
      onProductAdded()
      onClose()
      
    } catch (err) {
      console.error('Error creating product:', err)
      setError(err instanceof Error ? err.message : 'Errore nella creazione del prodotto')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!loading) {
      onClose()
      // Reset form quando si chiude
      setFormData({
        name: '',
        description: '',
        price: '',
        price_currency: 'EUR',
        selling_url: ''
      })
      
      // Pulisci le immagini
      images.forEach(img => {
        if (img.img_url.startsWith('blob:')) {
          URL.revokeObjectURL(img.img_url)
        }
      })
      setImages([])
      setError(null)
    }
  }

  return (
    <Dialog
      isOpen={isOpen}
      onClose={handleClose}
      title="Aggiungi Nuovo Prodotto"
      size="custom"
      customSize={{
        height: '95vh',
        minWidth: '60vw',
        maxWidth: '90vw'
      }}
    >
      <form onSubmit={handleSubmit} className="flex flex-col h-full">
        {/* Content Area */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="grid grid-cols-1 gap-6">
            
            {/* Form Fields */}
            <div className="space-y-6">
              
              {/* Nome Prodotto */}
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                  <Tag className="h-4 w-4 inline mr-1" />
                  Nome Prodotto *
                </label>
                <input
                  type="text"
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm text-gray-700"
                  placeholder="Inserisci il nome del prodotto"
                  required
                />
              </div>

              {/* Descrizione */}
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                  <FileText className="h-4 w-4 inline mr-1" />
                  Descrizione
                </label>
                <textarea
                  id="description"
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
                  <label htmlFor="price" className="block text-sm font-medium text-gray-700 mb-2">
                    <DollarSign className="h-4 w-4 inline mr-1" />
                    Prezzo
                  </label>
                  <input
                    type="number"
                    id="price"
                    step="0.01"
                    min="0"
                    value={formData.price}
                    onChange={(e) => handleInputChange('price', e.target.value)}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm text-gray-700"
                    placeholder="0.00"
                  />
                </div>
                
                <div>
                  <label htmlFor="currency" className="block text-sm font-medium text-gray-700 mb-2">
                    Valuta
                  </label>
                  <select
                    id="currency"
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
                <label htmlFor="selling_url" className="block text-sm font-medium text-gray-700 mb-2">
                  <LinkIcon className="h-4 w-4 inline mr-1" />
                  URL di Vendita
                </label>
                <input
                  type="url"
                  id="selling_url"
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
                    id="image-upload"
                  />
                  <label htmlFor="image-upload" className="cursor-pointer">
                    <Upload className="mx-auto h-12 w-12 text-gray-400" />
                    <p className="mt-2 text-sm text-gray-600">
                      Clicca per selezionare le immagini
                    </p>
                    <p className="text-xs text-gray-500">
                      Supporta selezione multipla • JPG, PNG, GIF • Max 5MB per immagine
                    </p>
                  </label>
                </div>

                {/* Preview Immagini */}
                {images.length > 0 && (
                  <div className="mt-4">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      {images.map((image, index) => (
                        <div key={index} className="relative group">
                          <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                            <img
                              src={image.img_url}
                              alt={`Preview ${index + 1}`}
                              className="w-full h-full object-cover"
                            />
                            {image.uploading && (
                              <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                                <Loader2 className="h-6 w-6 text-white animate-spin" />
                              </div>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => removeImage(index)}
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <p className="mt-2 text-xs text-gray-500">
                      {images.length} immagine{images.length !== 1 ? 'i' : ''} selezionata{images.length !== 1 ? 'e' : ''}
                    </p>
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
            disabled={loading}
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
                {imageUploading ? 'Caricando immagini...' : 'Creazione...'}
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                aggiungi
              </>
            )}
          </button>
        </div>
      </form>
    </Dialog>
  )
}
