'use client'
import { useEffect, useState } from 'react'

export default function LogoPanel() {
  const [url, setUrl] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'err'; texto: string } | null>(null)

  useEffect(() => {
    fetch('/api/admin/logo', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => setUrl(d.url ?? null))
      .catch(() => {})
  }, [])

  async function subir(file: File) {
    setCargando(true)
    setMsg(null)
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/admin/logo', { method: 'POST', body: fd })
    const data = await res.json()
    if (res.ok) {
      setUrl(data.url)
      setMsg({ tipo: 'ok', texto: `Logo guardado. Pesa ${(data.bytes / 1024).toFixed(0)} KB después de optimizarlo.` })
    } else {
      setMsg({ tipo: 'err', texto: data.error ?? 'No se pudo subir el logo.' })
    }
    setCargando(false)
  }

  return (
    <div className="bg-[#18181B] border border-[#27272A] rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-[#27272A]">
        <p className="text-xs font-semibold text-[#A1A1AA] uppercase tracking-wider">Logo</p>
      </div>
      <div className="p-5 flex items-center gap-5">
        <div className="w-20 h-20 rounded-xl bg-[#09090B] border border-[#27272A] flex items-center justify-center overflow-hidden">
          {url
            ? <img src={url} alt="Logo" className="w-full h-full object-contain p-2" />
            : <span className="text-[#3F3F46] text-xs">Sin logo</span>}
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-[#71717A] text-xs">PNG, JPG, WebP o GIF de hasta 5 MB. Se optimiza automáticamente.</p>
          <label className={`inline-flex w-fit items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg cursor-pointer transition-colors ${cargando ? 'bg-[#27272A] text-[#52525B]' : 'bg-[#FAFAFA] text-[#09090B] hover:bg-white'}`}>
            {cargando ? 'Subiendo…' : 'Cambiar logo'}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={cargando}
              onChange={e => { const f = e.target.files?.[0]; if (f) subir(f); e.target.value = '' }}
            />
          </label>
          {msg && <p className={`text-xs ${msg.tipo === 'ok' ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>{msg.texto}</p>}
        </div>
      </div>
    </div>
  )
}
