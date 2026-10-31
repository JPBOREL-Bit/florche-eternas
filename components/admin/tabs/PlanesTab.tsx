'use client'
import { useState } from 'react'
import { DEFAULT_PLANS } from '@/lib/plans'
import type { Plan } from '@/lib/types'

const VACIO: Omit<Plan, 'id'> = {
  name: '', slug: '', price_first_month: 0, price_monthly: 0,
  description: '', features: [], order: 0, active: true, highlighted: false,
}

export default function PlanesTab() {
  const [planes, setPlanes] = useState<Plan[]>(DEFAULT_PLANS)
  const [editando, setEditando] = useState<Plan | Omit<Plan, 'id'> | null>(null)
  const [msg, setMsg] = useState('')

  function mostrar(t: string) { setMsg(t); setTimeout(() => setMsg(''), 3000) }

  function guardar() {
    if (!editando || !editando.name) return
    if ('id' in editando) {
      setPlanes(prev => prev.map(p => p.id === editando.id ? editando : p))
      mostrar('Plan actualizado.')
    } else {
      setPlanes(prev => [...prev, { ...editando, id: Date.now().toString(), order: prev.length + 1 }])
      mostrar('Plan creado.')
    }
    setEditando(null)
  }

  function toggleActivo(id: string) {
    setPlanes(prev => prev.map(p => p.id === id ? { ...p, active: !p.active } : p))
  }

  function destacar(id: string) {
    setPlanes(prev => prev.map(p => ({ ...p, highlighted: p.id === id ? !p.highlighted : false })))
  }

  function mover(id: string, dir: -1 | 1) {
    const i = planes.findIndex(p => p.id === id)
    const j = i + dir
    if (j < 0 || j >= planes.length) return
    const arr = [...planes];
    [arr[i], arr[j]] = [arr[j], arr[i]]
    setPlanes(arr.map((p, idx) => ({ ...p, order: idx + 1 })))
  }

  function eliminar(id: string) {
    if (!confirm('¿Eliminar este plan? Los clientes asociados quedarán sin plan.')) return
    setPlanes(prev => prev.filter(p => p.id !== id))
    mostrar('Plan eliminado.')
  }

  const input = 'w-full bg-[#09090B] border border-[#27272A] focus:border-[#2563EB] text-[#FAFAFA] rounded-lg px-3 py-2 text-sm outline-none transition-colors'

  return (
    <div className="max-w-5xl flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[#FAFAFA] font-bold text-base">Planes</h2>
          <p className="text-[#71717A] text-xs mt-0.5">{planes.length} planes · el orden define cómo se muestran en la web</p>
        </div>
        <button onClick={() => setEditando({ ...VACIO })} className="bg-[#FAFAFA] hover:bg-white text-[#09090B] text-xs font-semibold px-3 py-2 rounded-lg transition-colors">
          Nuevo plan
        </button>
      </div>

      {msg && <div className="bg-[#14532D]/20 border border-[#22C55E]/20 text-[#22C55E] text-xs px-4 py-2.5 rounded-lg">{msg}</div>}

      <div className="bg-[#18181B] border border-[#27272A] rounded-xl overflow-hidden divide-y divide-[#27272A]">
        {planes.map((p, i) => (
          <div key={p.id} className={`flex items-center gap-4 px-5 py-4 ${!p.active ? 'opacity-50' : ''}`}>
            <div className="flex flex-col">
              <button onClick={() => mover(p.id, -1)} disabled={i === 0} className="text-[#52525B] hover:text-[#FAFAFA] disabled:opacity-20 text-[10px] leading-none py-0.5">▲</button>
              <button onClick={() => mover(p.id, 1)} disabled={i === planes.length - 1} className="text-[#52525B] hover:text-[#FAFAFA] disabled:opacity-20 text-[10px] leading-none py-0.5">▼</button>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-[#FAFAFA] font-semibold text-sm">{p.name}</p>
                {p.highlighted && <span className="bg-[#1E3A5F] text-[#DBEAFE] text-[10px] font-semibold px-2 py-0.5 rounded">Destacado</span>}
                {!p.active && <span className="bg-[#27272A] text-[#71717A] text-[10px] font-semibold px-2 py-0.5 rounded">Oculto</span>}
              </div>
              <p className="text-[#71717A] text-xs mt-0.5 truncate">{p.description}</p>
            </div>
            <div className="text-right shrink-0 hidden sm:block">
              <p className="text-[#FAFAFA] text-sm font-semibold">USD {p.price_first_month}</p>
              <p className="text-[#52525B] text-xs">luego USD {p.price_monthly}/mes</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={() => destacar(p.id)} className={`text-xs px-2.5 py-1.5 rounded-md border transition-colors ${p.highlighted ? 'border-[#2563EB] text-[#2563EB]' : 'border-[#27272A] text-[#71717A] hover:text-[#FAFAFA]'}`}>Destacar</button>
              <button onClick={() => toggleActivo(p.id)} className="text-xs px-2.5 py-1.5 rounded-md border border-[#27272A] text-[#71717A] hover:text-[#FAFAFA] transition-colors">{p.active ? 'Ocultar' : 'Mostrar'}</button>
              <button onClick={() => setEditando({ ...p })} className="text-xs px-2.5 py-1.5 rounded-md border border-[#27272A] text-[#71717A] hover:text-[#FAFAFA] transition-colors">Editar</button>
              <button onClick={() => eliminar(p.id)} className="text-xs px-2.5 py-1.5 rounded-md border border-[#27272A] text-[#71717A] hover:text-[#EF4444] hover:border-[#EF4444]/30 transition-colors">Borrar</button>
            </div>
          </div>
        ))}
      </div>

      {editando && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center px-4">
          <div className="bg-[#18181B] border border-[#27272A] rounded-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-[#FAFAFA] font-bold text-sm mb-5">{'id' in editando ? 'Editar plan' : 'Nuevo plan'}</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 flex flex-col gap-1.5">
                <label className="text-xs text-[#A1A1AA]">Nombre</label>
                <input className={input} value={editando.name} onChange={e => setEditando({ ...editando, name: e.target.value, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })}/>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-[#A1A1AA]">Precio primer mes (USD)</label>
                <input type="number" className={input} value={editando.price_first_month} onChange={e => setEditando({ ...editando, price_first_month: Number(e.target.value) })}/>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-[#A1A1AA]">Precio mensual (USD)</label>
                <input type="number" className={input} value={editando.price_monthly} onChange={e => setEditando({ ...editando, price_monthly: Number(e.target.value) })}/>
              </div>
              <div className="col-span-2 flex flex-col gap-1.5">
                <label className="text-xs text-[#A1A1AA]">Descripción</label>
                <textarea rows={2} className={`${input} resize-none`} value={editando.description} onChange={e => setEditando({ ...editando, description: e.target.value })}/>
              </div>
              <div className="col-span-2 flex flex-col gap-1.5">
                <label className="text-xs text-[#A1A1AA]">Características (una por línea)</label>
                <textarea rows={6} className={`${input} resize-none`} value={editando.features.join('\n')} onChange={e => setEditando({ ...editando, features: e.target.value.split('\n') })}/>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-5 mt-5 border-t border-[#27272A]">
              <button onClick={() => setEditando(null)} className="text-[#71717A] hover:text-[#FAFAFA] text-xs px-4 py-2 rounded-lg hover:bg-[#27272A] transition-colors">Cancelar</button>
              <button onClick={guardar} className="bg-[#2563EB] hover:bg-[#1d4ed8] text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors">Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
