'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPageClient({ adminBase }: { adminBase: string }) {
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    if (res.ok) { router.push(`/${adminBase}`); router.refresh() }
    else { setError('Contraseña incorrecta.') }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#09090B] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-7 h-7 bg-[#2563EB] rounded-md flex items-center justify-center">
            <span className="text-white font-bold text-xs">V</span>
          </div>
          <span className="font-semibold text-[#FAFAFA] text-sm">Vexorade</span>
          <span className="text-[#3F3F46] text-xs">/ admin</span>
        </div>

        <div className="bg-[#18181B] border border-[#27272A] rounded-xl p-7">
          <h1 className="text-[#FAFAFA] font-bold text-lg mb-1">Iniciar sesión</h1>
          <p className="text-[#71717A] text-xs mb-6">Panel de administración de Vexorade.</p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[#A1A1AA]">Contraseña</label>
              <div className="relative">
                <input
                  type={show ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoFocus
                  required
                  placeholder="••••••••••••••••"
                  className="w-full bg-[#09090B] border border-[#27272A] focus:border-[#2563EB] text-[#FAFAFA] rounded-lg px-3 py-2.5 pr-10 text-sm outline-none transition-colors placeholder-[#3F3F46]"
                />
                <button
                  type="button"
                  onClick={() => setShow(!show)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#52525B] hover:text-[#A1A1AA] transition-colors"
                  tabIndex={-1}
                >
                  {show
                    ? <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"/></svg>
                    : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"/><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                  }
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-[#450A0A] border border-[#EF4444]/30 rounded-lg px-3 py-2">
                <svg className="w-3.5 h-3.5 text-[#EF4444] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"/></svg>
                <p className="text-[#EF4444] text-xs">{error}</p>
              </div>
            )}

            <button type="submit" disabled={loading} className="bg-[#2563EB] hover:bg-[#1d4ed8] disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors">
              {loading ? 'Ingresando...' : 'Ingresar al panel'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
