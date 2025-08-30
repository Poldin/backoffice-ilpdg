"use client"

import { Suspense, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { User, Building2, ArrowLeft, Check, Mail, Eye, EyeOff } from "lucide-react"
import { getSupabaseBrowser } from "@/app/lib/supabase/client"

type UserType = "creator" | "brand" | null

interface PasswordValidation {
  length: boolean
  uppercase: boolean
  lowercase: boolean
  number: boolean
  special: boolean
}

function RegisterInner() {
  const router = useRouter()
  
  // Inizializza lo stato dal localStorage se disponibile
  const getInitialState = () => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('registration-state')
      if (saved) {
        try {
          return JSON.parse(saved)
        } catch {
          return {}
        }
      }
    }
    return {}
  }

  const initialState = getInitialState()
  
  const [step, setStep] = useState<"type" | "details" | "otp">(initialState.step || "type")
  const [userType, setUserType] = useState<UserType>(initialState.userType || null)
  const [email, setEmail] = useState(initialState.email || "")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [otp, setOtp] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  // Salva lo stato nel localStorage quando cambia
  const saveState = (newState: unknown) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('registration-state', JSON.stringify(newState))
    }
  }

  // Pulisce lo stato dal localStorage
  const clearState = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('registration-state')
    }
  }

  const validatePassword = (password: string): PasswordValidation => {
    return {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /\d/.test(password),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(password)
    }
  }

  const validation = validatePassword(password)
  const isPasswordValid = Object.values(validation).every(Boolean)
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0

  const handleTypeSelection = (type: UserType) => {
    setUserType(type)
    setStep("details")
    saveState({ step: "details", userType: type, email })
  }

  const handleDetailsSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isPasswordValid || !passwordsMatch) return

    setError(null)
    setLoading(true)

    try {
      const supabase = getSupabaseBrowser()
      
      // Salva lo stato prima di procedere
      saveState({ step: "otp", userType, email, password })
      
      // Invia OTP numerico invece di registrazione diretta
      const { data, error: otpError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
          data: {
            user_type: userType
          }
        }
      })

      if (otpError) {
        throw otpError
      }

      // Vai al step OTP
      setStep("otp")
      
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Errore sconosciuto"
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (otp.length !== 6) {
      setError("Inserisci un codice di 6 cifre")
      return
    }

    setError(null)
    setLoading(true)

    try {
      const supabase = getSupabaseBrowser()
      
      // Verifica l'OTP
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: 'email'
      })

      if (verifyError) {
        throw verifyError
      }

      if (data?.user && data?.session) {
        // Ora che l'email è verificata, aggiorna la password dell'utente
        const savedState = localStorage.getItem('registration-state')
        if (savedState) {
          const { password: savedPassword } = JSON.parse(savedState)
          if (savedPassword) {
            await supabase.auth.updateUser({ 
              password: savedPassword 
            })
          }
        }

        // Crea il profilo
        await createProfile(data.user.id)
        clearState()
        router.replace("/profile")
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Errore sconosciuto"
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const createProfile = async (userId: string) => {
    const supabase = getSupabaseBrowser()
    // Map user types to roles: "creator" -> "expert", "brand" -> "admin"
    const role = userType === "creator" ? "expert" : "admin"
    
    const { error } = await supabase
      .from('profile')
      .insert([
        {
          user_id: userId,
          role: role,
          nome: email.split('@')[0] // Temporary name from email
        }
      ])

    if (error) {
      console.error('Error creating profile:', error)
      throw new Error('Errore nella creazione del profilo')
    }
  }

  const resendOtp = async () => {
    setLoading(true)
    try {
      const supabase = getSupabaseBrowser()
      
      // Reinvia l'OTP
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
          data: {
            user_type: userType
          }
        }
      })
      
      if (error) throw error
      setError(null)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Errore sconosciuto"
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  if (step === "type") {
    return (
      <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">
              Crea il tuo account
            </h1>
            <p className="text-[#8b94a8]">
              Scegli il tipo di account che fa per te
            </p>
          </div>

          <div className="space-y-4">
            <button
              onClick={() => handleTypeSelection("creator")}
              className="w-full p-6 bg-[#1a1f36] border border-[#2d3748] rounded-lg hover:border-[#625df5] hover:bg-[#1e2444] transition-all duration-200 text-left group"
            >
              <div className="flex items-start">
                <div className="w-12 h-12 bg-[#625df5]/10 rounded-lg flex items-center justify-center mr-4 group-hover:bg-[#625df5]/20 transition-all">
                  <User className="w-6 h-6 text-[#625df5]" strokeWidth={2.5} />
                </div>
                <div>
                  <h3 className="text-white font-semibold text-lg mb-1">
                    Creator, Esperti o Privati
                  </h3>
                  <p className="text-[#8b94a8] text-sm">
                    Per professionisti e creatori di contenuti che vogliono condividere la loro expertise
                  </p>
                </div>
              </div>
            </button>

            <button
              onClick={() => handleTypeSelection("brand")}
              className="w-full p-6 bg-[#1a1f36] border border-[#2d3748] rounded-lg hover:border-[#625df5] hover:bg-[#1e2444] transition-all duration-200 text-left group"
            >
              <div className="flex items-start">
                <div className="w-12 h-12 bg-[#625df5]/10 rounded-lg flex items-center justify-center mr-4 group-hover:bg-[#625df5]/20 transition-all">
                  <Building2 className="w-6 h-6 text-[#625df5]" strokeWidth={2.5} />
                </div>
                <div>
                  <h3 className="text-white font-semibold text-lg mb-1">
                    Brand o E-commerce
                  </h3>
                  <p className="text-[#8b94a8] text-sm">
                    Per aziende e negozi online che vogliono promuovere i loro prodotti e servizi
                  </p>
                </div>
              </div>
            </button>
          </div>

          <div className="mt-6 text-center">
            <p className="text-[#8b94a8] text-sm">
              Hai già un account?{' '}
              <Link href="/login" className="text-[#625df5] hover:underline">
                Accedi
              </Link>
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (step === "details") {
    return (
      <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <button 
              onClick={() => setStep("type")}
              className="text-[#8b94a8] hover:text-white mb-4 flex items-center mx-auto"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Indietro
            </button>
            <h1 className="text-3xl font-bold text-white mb-2">
              Crea il tuo account
            </h1>
            <p className="text-[#8b94a8]">
              {userType === "creator" ? "Creator, Esperti o Privati" : "Brand o E-commerce"}
            </p>
          </div>

          <form onSubmit={handleDetailsSubmit} className="space-y-6">
            <div>
              <label className="block text-white text-sm font-medium mb-2">
                Email
              </label>
              <input
                type="email"
                className="w-full px-4 py-3 bg-[#1a1f36] border border-[#2d3748] rounded-lg text-white placeholder-[#8b94a8] focus:border-[#625df5] focus:outline-none focus:ring-1 focus:ring-[#625df5] transition-colors"
                placeholder="email@esempio.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-white text-sm font-medium mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  className="w-full px-4 py-3 pr-12 bg-[#1a1f36] border border-[#2d3748] rounded-lg text-white placeholder-[#8b94a8] focus:border-[#625df5] focus:outline-none focus:ring-1 focus:ring-[#625df5] transition-colors"
                  placeholder="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8b94a8] hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              
              {password && (
                <div className="mt-3 space-y-2">
                  <div className="text-xs text-[#8b94a8] mb-2">La password deve contenere:</div>
                  <div className="space-y-1">
                    {Object.entries({
                      length: "Almeno 8 caratteri",
                      uppercase: "Una lettera maiuscola",
                      lowercase: "Una lettera minuscola", 
                      number: "Un numero",
                      special: "Un carattere speciale"
                    }).map(([key, label]) => (
                      <div key={key} className="flex items-center text-xs">
                        <div className={`w-4 h-4 rounded-full mr-2 flex items-center justify-center ${
                          validation[key as keyof PasswordValidation] 
                            ? 'bg-green-500' 
                            : 'bg-[#2d3748]'
                        }`}>
                          {validation[key as keyof PasswordValidation] && (
                            <Check className="w-2 h-2 text-white" />
                          )}
                        </div>
                        <span className={validation[key as keyof PasswordValidation] ? 'text-green-400' : 'text-[#8b94a8]'}>
                          {label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-white text-sm font-medium mb-2">
                Conferma Password
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  className="w-full px-4 py-3 pr-12 bg-[#1a1f36] border border-[#2d3748] rounded-lg text-white placeholder-[#8b94a8] focus:border-[#625df5] focus:outline-none focus:ring-1 focus:ring-[#625df5] transition-colors"
                  placeholder="ripeti password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8b94a8] hover:text-white transition-colors"
                >
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {confirmPassword && !passwordsMatch && (
                <p className="text-red-400 text-xs mt-2">Le password non corrispondono</p>
              )}
              {confirmPassword && passwordsMatch && (
                <p className="text-green-400 text-xs mt-2">Le password corrispondono</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || !isPasswordValid || !passwordsMatch}
              className="w-full py-3 bg-[#625df5] text-white rounded-lg font-medium hover:bg-[#5a54f0] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "Creazione account..." : "Crea account"}
            </button>
          </form>

          {error && (
            <div className="mt-4 p-3 bg-red-500 bg-opacity-10 border border-red-500 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="mt-6 text-center">
            <p className="text-[#8b94a8] text-sm">
              Hai già un account?{' '}
              <Link href="/login" className="text-[#625df5] hover:underline">
                Accedi
              </Link>
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (step === "otp") {
    return (
      <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-[#625df5]/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mail className="w-8 h-8 text-[#625df5]" strokeWidth={2} />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">
              Verifica la tua email
            </h1>
            <p className="text-[#8b94a8] mb-4">
              Abbiamo inviato un codice di verifica a
            </p>
            <p className="text-white font-medium mb-4">{email}</p>
            <p className="text-[#8b94a8] text-sm">
              Inserisci il codice di 6 cifre che hai ricevuto via email.
            </p>
          </div>

          <form onSubmit={handleOtpSubmit} className="space-y-6">
            <div>
              <label className="block text-white text-sm font-medium mb-2">
                Codice di verifica
              </label>
              <input
                type="text"
                className="w-full px-4 py-3 bg-[#1a1f36] border border-[#2d3748] rounded-lg text-white placeholder-[#8b94a8] focus:border-[#625df5] focus:outline-none focus:ring-1 focus:ring-[#625df5] transition-colors text-center text-2xl tracking-wider"
                placeholder="000000"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                maxLength={6}
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading || otp.length !== 6}
              className="w-full py-3 bg-[#625df5] text-white rounded-lg font-medium hover:bg-[#5a54f0] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "Verifica in corso..." : "Verifica codice"}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-[#8b94a8] text-sm mb-2">
              Non hai ricevuto il codice?
            </p>
            <button
              onClick={resendOtp}
              disabled={loading}
              className="text-[#625df5] hover:underline text-sm disabled:opacity-50"
            >
              Invia di nuovo
            </button>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-500 bg-opacity-10 border border-red-500 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}
        </div>
      </div>
    )
  }

  return null
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center"><div className="text-white">Caricamento...</div></div>}>
      <RegisterInner />
    </Suspense>
  )
}
