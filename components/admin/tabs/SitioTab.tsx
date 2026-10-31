'use client'
import { useState } from 'react'
import LogoPanel from './LogoPanel'

const SECCIONES = [
  { key: 'hero_badge', label: 'Hero — Badge', value: 'Desde USD 15 el primer mes · sin permanencia' },
  { key: 'hero_titulo', label: 'Hero — Título línea 1', value: 'Tu página web,' },
  { key: 'hero_titulo2', label: 'Hero — Título línea 2', value: 'sin complicaciones.' },
  { key: 'hero_descripcion', label: 'Hero — Descripción', value: 'Creamos tu sitio web desde cero — tiendas, reservas, catálogos, blogs y más.' },
  { key: 'contacto_titulo', label: 'Contacto — Título', value: '¿Tenés dudas?' },
  { key: 'contacto_descripcion', label: 'Contacto — Descripción', value: 'Escribinos y te respondemos en el día. Sin compromiso.' },
  { key: 'email', label: 'Email de contacto', value: 'vexorade.web@gmail.com' },
  { key: 'whatsapp', label: 'Número WhatsApp', value: '' },
]

export default function SitioTab() {
  const [secciones, setSecciones] = useState(SECCIONES)
  const [colores, setColores] = useState({ primario: '#2563EB', fondo: '#09090B', texto: '#FAFAFA' })
  const [msg, setMsg] = useState('')

  function actualizar(key: string, value: string) {
    setSecciones(prev => prev.map(s => s.key === key ? { ...s, value } : s))
  }

  function guardar() {
    setMsg('Cambios guardados. Conectá Supabase para que sean permanentes.')
    setTimeout(() => setMsg(''), 4000)
  }

  return (
    <div className="max-w-3xl flex flex-col gap-6">
      <div>
        <h2 className="text-[#FAFAFA] font-bold text-base">Editor del sitio</h2>
        <p className="text-[#71717A] text-xs mt-0.5">Editar textos, colores y configuración del sitio público.</p>
      </div>

      {msg && <div className="bg-[#14532D]/20 border border-[#22C55E]/20 text-[#22C55E] text-xs px-4 py-2.5 rounded-lg">{msg}</div>}

      {/* Textos */}
      <div className="bg-[#18181B] border border-[#27272A] rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-[#27272A]">
          <p className="text-xs font-semibold text-[#A1A1AA] uppercase tracking-wider">Textos de la web</p>
        </div>
        <div className="p-5 flex flex-col gap-4">
          {secciones.map(s => (
            <div key={s.key} className="flex flex-col gap-1.5">
              <label className="text-xs text-[#71717A]">{s.label}</label>
              {s.value.length > 60 || s.key.includes('descripcion')
                ? <textarea value={s.value} onChange={e => actualizar(s.key, e.target.value)} rows={2} className="bg-[#09090B] border border-[#27272A] focus:border-[#2563EB] text-[#FAFAFA] rounded-lg px-3 py-2.5 text-sm outline-none transition-colors resize-none"/>
                : <input value={s.value} onChange={e => actualizar(s.key, e.target.value)} className="bg-[#09090B] border border-[#27272A] focus:border-[#2563EB] text-[#FAFAFA] rounded-lg px-3 py-2.5 text-sm outline-none transition-colors"/>
              }
            </div>
          ))}
        </div>
      </div>

      {/* Colores */}
      <div className="bg-[#18181B] border border-[#27272A] rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-[#27272A]">
          <p className="text-xs font-semibold text-[#A1A1AA] uppercase tracking-wider">Colores</p>
        </div>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { key: 'primario', label: 'Color primario (acento)' },
            { key: 'fondo', label: 'Color de fondo' },
            { key: 'texto', label: 'Color de texto' },
          ].map(c => (
            <div key={c.key} className="flex flex-col gap-1.5">
              <label className="text-xs text-[#71717A]">{c.label}</label>
              <div className="flex items-center gap-2">
                <input type="color" value={colores[c.key as keyof typeof colores]} onChange={e => setColores({...colores, [c.key]: e.target.value})} className="w-10 h-10 rounded-lg border border-[#27272A] bg-transparent cursor-pointer"/>
                <input value={colores[c.key as keyof typeof colores]} onChange={e => setColores({...colores, [c.key]: e.target.value})} className="flex-1 bg-[#09090B] border border-[#27272A] focus:border-[#2563EB] text-[#FAFAFA] rounded-lg px-3 py-2.5 text-xs font-mono outline-none transition-colors"/>
              </div>
            </div>
          ))}
        </div>
      </div>

      <LogoPanel />

      <div className="flex justify-end">
        <button onClick={guardar} className="bg-[#2563EB] hover:bg-[#1d4ed8] text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors">
          Guardar cambios
        </button>
      </div>
    </div>
  )
}
