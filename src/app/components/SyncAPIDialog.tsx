"use client"

import { useEffect, useRef, useState } from "react"
import { Copy, Plus, Trash2, Loader2, RefreshCw, Code2, Key, Globe } from "lucide-react"
import Dialog from "@/app/components/ui/Dialog"
import { toast } from "sonner"

interface SyncAPIDialogProps {
  isOpen: boolean
  onClose: () => void
}

interface Token {
  id: string
  created_at: string
  nome: string | null
}

export default function SyncAPIDialog({ isOpen, onClose }: SyncAPIDialogProps) {
  // Token management state
  const [tokens, setTokens] = useState<Token[]>([])
  const [tokensLoading, setTokensLoading] = useState(false)
  const [newTokenName, setNewTokenName] = useState("")
  const tokenNameInputRef = useRef<HTMLInputElement | null>(null)
  const [tokenNameError, setTokenNameError] = useState(false)
  const [creatingToken, setCreatingToken] = useState(false)
  const [showTokenModal, setShowTokenModal] = useState(false)
  const [createdTokenValue, setCreatedTokenValue] = useState<string | null>(null)
  const [createdTokenName, setCreatedTokenName] = useState<string>("")

  const BASE_URL = "https://backoffice-ilpdg.vercel.app"

  // Load tokens when dialog opens
  useEffect(() => {
    if (isOpen) {
      loadTokens()
    }
  }, [isOpen])

  async function loadTokens() {
    try {
      setTokensLoading(true)
      const res = await fetch("/api/profile/tokens", { method: "GET" })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error || "Impossibile caricare i token")
      }
      const data = await res.json()
      setTokens(Array.isArray(data) ? data : [])
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Errore sconosciuto"
      toast.error("Errore nel caricamento dei token", { description: message })
    } finally {
      setTokensLoading(false)
    }
  }

  async function createToken(e: React.FormEvent) {
    e.preventDefault()
    const nome = newTokenName.trim()
    if (!nome) {
      setTokenNameError(true)
      tokenNameInputRef.current?.focus()
      return
    }
    setCreatingToken(true)
    try {
      const res = await fetch("/api/profile/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error || "Impossibile creare il token")
      }
      const data: { id: string; created_at: string; nome: string | null; token: string } = await res.json()
      setTokens(prev => [{ id: data.id, created_at: data.created_at, nome: data.nome }, ...prev])
      setCreatedTokenValue(data.token)
      setCreatedTokenName(data.nome || nome)
      setShowTokenModal(true)
      setNewTokenName("")
      setTokenNameError(false)
      toast.success("Token creato", { description: "Copia e conserva il token ora: non sarà più mostrato" })
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Errore sconosciuto"
      toast.error("Errore nella creazione del token", { description: message })
    } finally {
      setCreatingToken(false)
    }
  }

  async function deleteToken(id: string) {
    const confirmed = window.confirm("Eliminare questo token? L'azione è irreversibile.")
    if (!confirmed) return
    try {
      const res = await fetch(`/api/profile/tokens/${id}`, { method: "DELETE" })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error || "Impossibile eliminare il token")
      }
      setTokens(prev => prev.filter(t => t.id !== id))
      toast.success("Token eliminato")
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Errore sconosciuto"
      toast.error("Errore nell'eliminazione del token", { description: message })
    }
  }

  const copyToClipboard = async (text: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(successMessage)
    } catch {
      toast.error("Impossibile copiare negli appunti")
    }
  }

  const createProductExample = `{
  "name": "Nome del prodotto",
  "description": "Descrizione del prodotto",
  "price": 29.99,
  "price_currency": "EUR",
  "selling_url": "https://example.com/product",
  "fee_perc": 10
}`

  const updateProductExample = `{
  "name": "Nome prodotto aggiornato",
  "description": "Descrizione aggiornata", 
  "price": 35.99,
  "price_currency": "EUR",
  "selling_url": "https://example.com/updated-product",
  "fee_perc": 15
}`

  const createEndpoint = `${BASE_URL}/api/products`
  const updateEndpoint = `${BASE_URL}/api/products/{product_id}`
  const getEndpoint = `${BASE_URL}/api/products`

  return (
    <>
      <Dialog
        isOpen={isOpen}
        onClose={onClose}
        title="API Sync - Configurazione"
        size="custom"
        customSize={{
          height: '95vh',
          minWidth: '60vw',
          maxWidth: '90vw'
        }}
      >
        <div className="flex flex-col h-full">
          {/* Content Area */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-8">
            
            {/* Introduzione */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  <RefreshCw className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-blue-900 mb-2">
                    API per Gestione Prodotti
                  </h3>
                                     <p className="text-blue-800 text-sm leading-relaxed">
                     Utilizza le nostre API REST per leggere, creare e modificare prodotti in bulk. 
                     Con paginazione a 100 elementi per pagina, perfetto per sincronizzazioni automatiche e integrazioni con sistemi esterni.
                   </p>
                </div>
              </div>
            </div>

            {/* Base URL Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-gray-600" />
                <h3 className="text-lg font-semibold text-gray-900">Base URL</h3>
              </div>
              
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <code className="text-sm font-mono text-gray-800 bg-white px-3 py-2 rounded border">
                    {BASE_URL}
                  </code>
                  <button
                    onClick={() => copyToClipboard(BASE_URL, "Base URL copiata")}
                    className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-700 bg-white hover:bg-gray-50"
                  >
                    <Copy className="h-4 w-4 mr-1.5" />
                    Copia
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Tutte le chiamate API devono utilizzare questa base URL
                </p>
              </div>
            </div>

            {/* API Endpoints */}
            <div className="space-y-6">
              <div className="flex items-center gap-2">
                <Code2 className="h-5 w-5 text-gray-600" />
                <h3 className="text-lg font-semibold text-gray-900">Endpoints Disponibili</h3>
              </div>

                             {/* GET Products */}
               <div className="border border-gray-200 rounded-lg overflow-hidden">
                 <div className="bg-purple-50 px-4 py-3 border-b border-gray-200">
                   <div className="flex items-center justify-between">
                     <div className="flex items-center gap-3">
                       <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                         GET
                       </span>
                       <code className="text-sm font-mono text-gray-800">/api/products</code>
                     </div>
                     <button
                       onClick={() => copyToClipboard(getEndpoint, "Endpoint GET copiato")}
                       className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-xs text-gray-700 bg-white hover:bg-gray-50"
                     >
                       <Copy className="h-3 w-3 mr-1" />
                       Copia
                     </button>
                   </div>
                 </div>
                 <div className="p-4 space-y-4">
                   <p className="text-sm text-gray-700">
                     <strong>Descrizione:</strong> Recupera l&apos;elenco dei prodotti con paginazione (100 elementi per pagina).
                   </p>
                   
                   <div>
                     <h4 className="text-sm font-medium text-gray-900 mb-2">Headers richiesti:</h4>
                     <div className="bg-gray-50 rounded p-3 text-sm font-mono text-gray-800">
                       <div>Authorization: Bearer YOUR_API_TOKEN</div>
                     </div>
                   </div>

                   <div>
                     <h4 className="text-sm font-medium text-gray-900 mb-2">Parametri query opzionali:</h4>
                     <div className="bg-gray-50 rounded p-3 text-sm text-gray-800">
                       <div className="space-y-2">
                         <div><code className="text-purple-600">page</code> - Numero della pagina (default: 1)</div>
                         <div><code className="text-purple-600">search</code> - Cerca per nome o descrizione</div>
                         <div><code className="text-purple-600">limit</code> - Elementi per pagina (max: 100, default: 100)</div>
                       </div>
                     </div>
                   </div>

                   <div>
                     <h4 className="text-sm font-medium text-gray-900 mb-2">Esempi di chiamata:</h4>
                     <div className="space-y-2">
                       <div>
                         <p className="text-xs text-gray-600 mb-1">Prima pagina (100 prodotti):</p>
                         <div className="bg-gray-50 rounded p-2">
                           <code className="text-sm text-gray-800">GET {getEndpoint}?page=1&limit=100</code>
                           <button
                             onClick={() => copyToClipboard(`${getEndpoint}?page=1&limit=100`, "URL prima pagina copiato")}
                             className="ml-2 inline-flex items-center px-2 py-1 border border-gray-300 rounded text-xs text-gray-700 bg-white hover:bg-gray-50"
                           >
                             <Copy className="h-3 w-3 mr-1" />
                             Copia
                           </button>
                         </div>
                       </div>
                       <div>
                         <p className="text-xs text-gray-600 mb-1">Seconda pagina:</p>
                         <div className="bg-gray-50 rounded p-2">
                           <code className="text-sm text-gray-800">GET {getEndpoint}?page=2&limit=100</code>
                           <button
                             onClick={() => copyToClipboard(`${getEndpoint}?page=2&limit=100`, "URL seconda pagina copiato")}
                             className="ml-2 inline-flex items-center px-2 py-1 border border-gray-300 rounded text-xs text-gray-700 bg-white hover:bg-gray-50"
                           >
                             <Copy className="h-3 w-3 mr-1" />
                             Copia
                           </button>
                         </div>
                       </div>
                       <div>
                         <p className="text-xs text-gray-600 mb-1">Con ricerca:</p>
                         <div className="bg-gray-50 rounded p-2">
                           <code className="text-sm text-gray-800">GET {getEndpoint}?page=1&search=prodotto&limit=100</code>
                           <button
                             onClick={() => copyToClipboard(`${getEndpoint}?page=1&search=prodotto&limit=100`, "URL con ricerca copiato")}
                             className="ml-2 inline-flex items-center px-2 py-1 border border-gray-300 rounded text-xs text-gray-700 bg-white hover:bg-gray-50"
                           >
                             <Copy className="h-3 w-3 mr-1" />
                             Copia
                           </button>
                         </div>
                       </div>
                     </div>
                   </div>

                   <div>
                     <h4 className="text-sm font-medium text-gray-900 mb-2">Formato risposta:</h4>
                     <div className="bg-gray-50 rounded p-3">
                       <pre className="text-sm text-gray-800 overflow-x-auto">
{`{
  "products": [
    {
      "id": "uuid",
      "name": "Nome prodotto",
      "description": "Descrizione",
      "price": 29.99,
      "price_currency": "EUR",
      "selling_url": "https://example.com",
      "fee_perc": 10,
      "created_at": "2024-01-01T00:00:00Z",
      "edited_at": "2024-01-01T00:00:00Z"
    }
  ],
  "pagination": {
    "current_page": 1,
    "total_pages": 10,
    "total_count": 950,
    "per_page": 100,
    "has_next": true,
    "has_prev": false
  }
}`}
                       </pre>
                     </div>
                   </div>
                 </div>
               </div>

               {/* CREATE Product */}
               <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-green-50 px-4 py-3 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        POST
                      </span>
                      <code className="text-sm font-mono text-gray-800">/api/products</code>
                    </div>
                    <button
                      onClick={() => copyToClipboard(createEndpoint, "Endpoint POST copiato")}
                      className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-xs text-gray-700 bg-white hover:bg-gray-50"
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      Copia
                    </button>
                  </div>
                </div>
                <div className="p-4 space-y-4">
                  <p className="text-sm text-gray-700">
                    <strong>Descrizione:</strong> Crea un nuovo prodotto nel sistema.
                  </p>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 mb-2">Headers richiesti:</h4>
                    <div className="bg-gray-50 rounded p-3 text-sm font-mono text-gray-800">
                      <div>Authorization: Bearer YOUR_API_TOKEN</div>
                      <div>Content-Type: application/json</div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-gray-900 mb-2">Esempio Body:</h4>
                    <div className="bg-gray-50 rounded p-3">
                      <pre className="text-sm text-gray-800 overflow-x-auto">
                        {createProductExample}
                      </pre>
                    </div>
                    <button
                      onClick={() => copyToClipboard(createProductExample, "Esempio POST copiato")}
                      className="mt-2 inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-xs text-gray-700 bg-white hover:bg-gray-50"
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      Copia esempio
                    </button>
                  </div>
                </div>
              </div>

              {/* UPDATE Product */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-blue-50 px-4 py-3 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        PUT
                      </span>
                      <code className="text-sm font-mono text-gray-800">/api/products/{"{product_id}"}</code>
                    </div>
                    <button
                      onClick={() => copyToClipboard(updateEndpoint, "Endpoint PUT copiato")}
                      className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-xs text-gray-700 bg-white hover:bg-gray-50"
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      Copia
                    </button>
                  </div>
                </div>
                <div className="p-4 space-y-4">
                  <p className="text-sm text-gray-700">
                    <strong>Descrizione:</strong> Modifica un prodotto esistente. Sostituisci {"{product_id}"} con l&apos;ID del prodotto.
                  </p>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 mb-2">Headers richiesti:</h4>
                    <div className="bg-gray-50 rounded p-3 text-sm font-mono text-gray-800">
                      <div>Authorization: Bearer YOUR_API_TOKEN</div>
                      <div>Content-Type: application/json</div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-gray-900 mb-2">Esempio Body:</h4>
                    <div className="bg-gray-50 rounded p-3">
                      <pre className="text-sm text-gray-800 overflow-x-auto">
                        {updateProductExample}
                      </pre>
                    </div>
                    <button
                      onClick={() => copyToClipboard(updateProductExample, "Esempio PUT copiato")}
                      className="mt-2 inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-xs text-gray-700 bg-white hover:bg-gray-50"
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      Copia esempio
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Token Management Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Key className="h-5 w-5 text-gray-600" />
                <h3 className="text-lg font-semibold text-gray-900">Token API</h3>
              </div>
              
              <p className="text-sm text-gray-600">
                Crea e gestisci i tuoi token personali per autenticare le chiamate API. 
                Il valore del token è visibile solo al momento della creazione.
              </p>

              {/* Create Token Form */}
              <form onSubmit={createToken} className="flex flex-col sm:flex-row gap-3">
                <input
                  ref={tokenNameInputRef}
                  type="text"
                  value={newTokenName}
                  onChange={(e) => { setNewTokenName(e.target.value); if (tokenNameError) setTokenNameError(false) }}
                  placeholder="Inserisci il nome del token"
                  className={`flex-1 px-3 py-2 border rounded-md leading-5 bg-white placeholder-gray-500 text-gray-700 focus:outline-none focus:ring-1 sm:text-sm ${tokenNameError ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:ring-indigo-500 focus:border-indigo-500'}`}
                />
                <button
                  type="submit"
                  disabled={creatingToken}
                  className="inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creatingToken ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Creando...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Crea token
                    </>
                  )}
                </button>
              </form>
              {tokenNameError && (
                <p className="text-xs text-red-600">Inserisci un nome per il token.</p>
              )}

              {/* Tokens Table */}
              <div className="border border-gray-200 rounded-md overflow-hidden">
                <div className="min-w-full divide-y divide-gray-200">
                  <div className="bg-gray-50 px-4 py-2 text-xs font-medium text-gray-500 grid grid-cols-12">
                    <div className="col-span-6 sm:col-span-6">Nome</div>
                    <div className="col-span-4 sm:col-span-4">Creato il</div>
                    <div className="col-span-2 sm:col-span-2 text-right">Azioni</div>
                  </div>
                  {tokensLoading ? (
                    <div className="px-4 py-4 text-sm text-gray-500">Caricamento...</div>
                  ) : tokens.length === 0 ? (
                    <div className="px-4 py-6 text-sm text-gray-500">Nessun token creato.</div>
                  ) : (
                    tokens.map(t => (
                      <div key={t.id} className="px-4 py-3 grid grid-cols-12 items-center">
                        <div className="col-span-6 sm:col-span-6 text-sm text-gray-900 break-words">{t.nome || '—'}</div>
                        <div className="col-span-4 sm:col-span-4 text-sm text-gray-500">{new Date(t.created_at).toLocaleString('it-IT')}</div>
                        <div className="col-span-2 sm:col-span-2">
                          <div className="flex justify-end">
                            <button
                              onClick={() => deleteToken(t.id)}
                              className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                            >
                              <Trash2 className="h-4 w-4 mr-1.5" />
                              Elimina
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

                         {/* Note importanti */}
             <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
               <h4 className="text-sm font-medium text-yellow-800 mb-2">Note importanti:</h4>
               <ul className="text-sm text-yellow-700 space-y-1 list-disc list-inside">
                 <li>GET: Paginazione con massimo 100 elementi per pagina, perfetto per operazioni bulk</li>
                 <li>POST/PUT: Tutti i campi tranne &quot;name&quot; sono opzionali</li>
                 <li>Il token API deve essere incluso nell&apos;header Authorization per tutte le chiamate</li>
                 <li>Le risposte seguono il formato JSON standard con codici HTTP appropriati</li>
                 <li>Per migliaia di prodotti, utilizza la paginazione GET in loop</li>
               </ul>
             </div>
          </div>
        </div>
      </Dialog>

      {/* Token Creation Modal */}
      {showTokenModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-lg w-full p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Token creato</h3>
              <button
                onClick={() => { setShowTokenModal(false); setCreatedTokenValue(null) }}
                className="text-gray-400 hover:text-gray-500 transition-colors"
              >
                ✕
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-4">Copia e conserva questo token ora. Per ragioni di sicurezza non sarà più mostrato in seguito.</p>
            <div className="mb-2 text-sm text-gray-900"><span className="font-medium">Nome:</span> {createdTokenName || '—'}</div>
            <div className="flex items-center gap-2">
              <code className="flex-1 block text-sm p-3 bg-gray-50 border border-gray-200 rounded-md overflow-x-auto">
                {createdTokenValue || '—'}
              </code>
              <button
                onClick={async () => {
                  if (createdTokenValue) {
                    await copyToClipboard(createdTokenValue, "Token copiato negli appunti")
                  }
                }}
                className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-700 bg-white hover:bg-gray-50"
              >
                <Copy className="h-4 w-4 mr-1.5" />
                Copia
              </button>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => { setShowTokenModal(false); setCreatedTokenValue(null) }}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
              >
                Ho salvato il token
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
