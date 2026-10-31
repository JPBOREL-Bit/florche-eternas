'use client'
import { useState } from 'react'

type Cliente = {
  id: string
  nombre: string
  email: string
  plan: string
  estado: 'activo' | 'pausado' | 'pendiente'
  sitio: string
  tiene_panel: boolean
  creado: string
  notas: string
  storage_usado: number
  storage_max: number
}

const PLANES = ['Mantenimiento', 'Básico', 'Avanzado', 'Pro', 'Ultra']

const ESTADO_COLORS = {
  activo: 'bg-[#14532D]/30 text-[#22C55E] border-[#22C55E]/20',
  pausado: 'bg-[#450A0A]/30 text-[#EF4444] border-[#EF4444]/20',
  pendiente: 'bg-[#422006]/30 text-[#EAB308] border-[#EAB308]/20',
}

export default function ClientesTab() {
  const [clientes, setClientes] = useState<Cliente[]>([
    {
      id: 'demo-1',
      nombre: 'Cliente Demo',
      email: 'demo@vexorade.com',
      plan: 'Mantenimiento',
      estado: 'activo',
      sitio: 'demo',
      tiene_panel: true,
      creado: new Date().toLocaleDateString('es-AR'),
      notas: 'Cuenta de demostración. Eliminar antes de operar con clientes reales.',
      storage_usado: 120,
      storage_max: 500,
    },
  ])
  const [modal, setModal] = useState<'crear' | 'editar' | 'aviso' | null>(null)
  const [seleccionado, setSeleccionado] = useState<Cliente | null>(null)
  const [form, setForm] = useState({ nombre: '', email: '', plan: 'Mantenimiento', sitio: '', tiene_panel: false, notas: '', storage_max: 500 })
  const [aviso, setAviso] = useState('')
  const [msg, setMsg] = useState('')

  function mostrar(texto: string) { setMsg(texto); setTimeout(() => setMsg(''), 3000) }

  function guardarCliente() {
    if (!form.nombre || !form.email) return
    if (seleccionado) {
      setClientes(prev => prev.map(c => c.id === seleccionado.id ? { ...c, ...form } : c))
      mostrar('Cliente actualizado.')
    } else {
      const nuevo: Cliente = { id: Date.now().toString(), ...form, estado: 'pendiente', creado: new Date().toLocaleDateString('es-AR'), storage_usado: 0 }
      setClientes(prev => [...prev, nuevo])
      mostrar('Cliente agregado.')
    }
    setModal(null); setSeleccionado(null)
    setForm({ nombre: '', email: '', plan: 'Mantenimiento', sitio: '', tiene_panel: false, notas: '', storage_max: 500 })
  }

  function abrirEditar(c: Cliente) {
    setSeleccionado(c)
    setForm({ nombre: c.nombre, email: c.email, plan: c.plan, sitio: c.sitio, tiene_panel: c.tiene_panel, notas: c.notas, storage_max: c.storage_max })
    setModal('editar')
  }

  function toggleEstado(id: string) {
    setClientes(prev => prev.map(c => c.id === id
      ? { ...c, estado: c.estado === 'activo' ? 'pausado' : 'activo' }
      : c))
  }

  function enviarAviso() {
    if (!aviso.trim()) return
    mostrar(`Aviso enviado a ${seleccionado?.nombre}.`)
    setAviso(''); setModal(null); setSeleccionado(null)
  }

  function eliminar(id: string) {
    if (!confirm('¿Eliminar este cliente? Esta acción no se puede deshacer.')) return
    setClientes(prev => prev.filter(c => c.id !== id))
    mostrar('Cliente eliminado.')
  }

  return (
    <div className="max-w-6xl flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[#FAFAFA] font-bold text-base">Clientes</h2>
          <p className="text-[#71717A] text-xs mt-0.5">{clientes.length} clientes registrados</p>
        </div>
        <button onClick={() => { setSeleccionado(null); setForm({ nombre: '', email: '', plan: 'Mantenimiento', sitio: '', tiene_panel: false, notas: '', storage_max: 500 }); setModal('crear') }}
          className="flex items-center gap-1.5 bg-[#FAFAFA] hover:bg-white text-[#09090B] text-xs font-semibold px-3 py-2 rounded-lg transition-colors">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>
          Agregar cliente
        </button>
      </div>

      {msg && <div className="bg-[#14532D]/20 border border-[#22C55E]/20 text-[#22C55E] text-xs px-4 py-2.5 rounded-lg">{msg}</div>}

      {clientes.length === 0 ? (
        <div className="bg-[#18181B] border border-[#27272A] rounded-xl px-6 py-16 text-center">
          <p className="text-[#71717A] text-sm">No hay clientes registrados.</p>
          <p className="text-[#3F3F46] text-xs mt-1">Agregá el primero cuando cobres.</p>
        </div>
      ) : (
        <div className="bg-[#18181B] border border-[#27272A] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#27272A]">
                  {['Cliente', 'Plan', 'Sitio', 'Storage', 'Estado', 'Acciones'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-[#52525B] font-semibold uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#27272A]">
                {clientes.map(c => {
                  const storagePct = Math.round((c.storage_usado / c.storage_max) * 100)
                  return (
                    <tr key={c.id} className="hover:bg-[#1C1C1F] transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-[#FAFAFA] font-medium">{c.nombre}</p>
                        <p className="text-[#52525B] font-mono">{c.email}</p>
                      </td>
                      <td className="px-4 py-3 text-[#A1A1AA]">{c.plan}</td>
                      <td className="px-4 py-3">
                        {c.sitio ? (
                          <div className="flex items-center gap-1.5">
                            <a href={`/${c.sitio}`} target="_blank" className="text-[#2563EB] hover:underline font-mono">/{c.sitio}</a>
                            {c.tiene_panel && <span className="bg-[#1E3A5F] text-[#DBEAFE] px-1.5 py-0.5 rounded text-[10px]">panel</span>}
                          </div>
                        ) : <span className="text-[#3F3F46]">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-[#27272A] rounded-full h-1.5">
                            <div className={`h-1.5 rounded-full ${storagePct > 85 ? 'bg-[#EF4444]' : storagePct > 60 ? 'bg-[#EAB308]' : 'bg-[#22C55E]'}`} style={{width:`${storagePct}%`}}/>
                          </div>
                          <span className={storagePct > 85 ? 'text-[#EF4444]' : 'text-[#52525B]'}>{storagePct}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full border font-medium capitalize text-[10px] ${ESTADO_COLORS[c.estado]}`}>{c.estado}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => abrirEditar(c)} title="Editar" className="p-1.5 text-[#52525B] hover:text-[#FAFAFA] hover:bg-[#27272A] rounded transition-colors">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"/></svg>
                          </button>
                          {c.sitio && (
                            <button onClick={() => { setSeleccionado(c); setModal('aviso') }} title="Enviar aviso al panel" className="p-1.5 text-[#52525B] hover:text-[#2563EB] hover:bg-[#1E3A5F]/30 rounded transition-colors">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"/></svg>
                            </button>
                          )}
                          <button onClick={() => toggleEstado(c.id)} title={c.estado === 'activo' ? 'Pausar sitio' : 'Activar sitio'} className={`p-1.5 rounded transition-colors ${c.estado === 'activo' ? 'text-[#52525B] hover:text-[#EF4444] hover:bg-[#450A0A]/30' : 'text-[#52525B] hover:text-[#22C55E] hover:bg-[#14532D]/30'}`}>
                            {c.estado === 'activo'
                              ? <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5"/></svg>
                              : <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z"/></svg>
                            }
                          </button>
                          <button onClick={() => eliminar(c.id)} title="Eliminar" className="p-1.5 text-[#52525B] hover:text-[#EF4444] hover:bg-[#450A0A]/30 rounded transition-colors">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"/></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal crear/editar */}
      {(modal === 'crear' || modal === 'editar') && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center px-4">
          <div className="bg-[#18181B] border border-[#27272A] rounded-xl w-full max-w-md p-6">
            <h3 className="text-[#FAFAFA] font-bold text-sm mb-5">{modal === 'crear' ? 'Agregar cliente' : 'Editar cliente'}</h3>
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 flex flex-col gap-1.5">
                  <label className="text-xs text-[#A1A1AA]">Nombre del cliente *</label>
                  <input value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})} className="bg-[#09090B] border border-[#27272A] focus:border-[#2563EB] text-[#FAFAFA] rounded-lg px-3 py-2.5 text-sm outline-none transition-colors" placeholder="Nombre o empresa"/>
                </div>
                <div className="col-span-2 flex flex-col gap-1.5">
                  <label className="text-xs text-[#A1A1AA]">Email *</label>
                  <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="bg-[#09090B] border border-[#27272A] focus:border-[#2563EB] text-[#FAFAFA] rounded-lg px-3 py-2.5 text-sm outline-none transition-colors" placeholder="correo@cliente.com"/>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-[#A1A1AA]">Plan</label>
                  <select value={form.plan} onChange={e => setForm({...form, plan: e.target.value})} className="bg-[#09090B] border border-[#27272A] focus:border-[#2563EB] text-[#FAFAFA] rounded-lg px-3 py-2.5 text-sm outline-none transition-colors">
                    {PLANES.map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-[#A1A1AA]">Storage máx (MB)</label>
                  <input type="number" value={form.storage_max} onChange={e => setForm({...form, storage_max: Number(e.target.value)})} className="bg-[#09090B] border border-[#27272A] focus:border-[#2563EB] text-[#FAFAFA] rounded-lg px-3 py-2.5 text-sm outline-none transition-colors"/>
                </div>
                <div className="col-span-2 flex flex-col gap-1.5">
                  <label className="text-xs text-[#A1A1AA]">Slug del sitio (vexorade.com/...)</label>
                  <input value={form.sitio} onChange={e => setForm({...form, sitio: e.target.value.toLowerCase().replace(/\s/g, '-')})} className="bg-[#09090B] border border-[#27272A] focus:border-[#2563EB] text-[#FAFAFA] rounded-lg px-3 py-2.5 text-sm outline-none transition-colors font-mono" placeholder="nombre-del-sitio"/>
                </div>
                <div className="col-span-2 flex items-center gap-2.5">
                  <input type="checkbox" id="panel" checked={form.tiene_panel} onChange={e => setForm({...form, tiene_panel: e.target.checked})} className="w-4 h-4 rounded border-[#27272A] bg-[#09090B] accent-[#2563EB]"/>
                  <label htmlFor="panel" className="text-xs text-[#A1A1AA]">Este cliente tiene panel de administración propio</label>
                </div>
                <div className="col-span-2 flex flex-col gap-1.5">
                  <label className="text-xs text-[#A1A1AA]">Notas internas</label>
                  <textarea value={form.notas} onChange={e => setForm({...form, notas: e.target.value})} rows={2} className="bg-[#09090B] border border-[#27272A] focus:border-[#2563EB] text-[#FAFAFA] rounded-lg px-3 py-2.5 text-sm outline-none transition-colors resize-none" placeholder="Notas visibles solo para vos"/>
                </div>
              </div>
              <div className="flex gap-2 justify-end pt-2 border-t border-[#27272A]">
                <button onClick={() => setModal(null)} className="text-[#71717A] hover:text-[#FAFAFA] text-xs px-4 py-2 rounded-lg hover:bg-[#27272A] transition-colors">Cancelar</button>
                <button onClick={guardarCliente} className="bg-[#2563EB] hover:bg-[#1d4ed8] text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors">
                  {modal === 'crear' ? 'Agregar' : 'Guardar cambios'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal aviso */}
      {modal === 'aviso' && seleccionado && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center px-4">
          <div className="bg-[#18181B] border border-[#27272A] rounded-xl w-full max-w-sm p-6">
            <h3 className="text-[#FAFAFA] font-bold text-sm mb-1">Enviar aviso a {seleccionado.nombre}</h3>
            <p className="text-[#71717A] text-xs mb-4">El mensaje aparecerá en el panel de administración del cliente.</p>
            <textarea value={aviso} onChange={e => setAviso(e.target.value)} rows={4} placeholder="Escribí el mensaje para el cliente..." className="w-full bg-[#09090B] border border-[#27272A] focus:border-[#2563EB] text-[#FAFAFA] rounded-lg px-3 py-2.5 text-sm outline-none transition-colors resize-none mb-4"/>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setModal(null)} className="text-[#71717A] hover:text-[#FAFAFA] text-xs px-4 py-2 rounded-lg hover:bg-[#27272A] transition-colors">Cancelar</button>
              <button onClick={enviarAviso} className="bg-[#2563EB] hover:bg-[#1d4ed8] text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors">Enviar aviso</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
