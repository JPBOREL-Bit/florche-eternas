'use client'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import type { DemoSite, DemoItem } from '@/lib/demo'
import { useDemoStore } from '@/lib/demoStore'

type Vista = 'resumen' | 'seccion' | 'ajustes'

export default function DemoAdmin({ demo }: { demo: DemoSite }) {
  const t = demo.theme
  const [vista, setVista] = useState<Vista>('resumen')
  const { items, setItems, nombre, setNombre } = useDemoStore(demo)
  const [q, setQ] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [editTitulo, setEditTitulo] = useState('')
  const [nuevo, setNuevo] = useState({ titulo: '', detalle: '', precio: '', categoria: demo.categorias[0] || '' })
  const [aviso, setAviso] = useState('')

  const filtrados = useMemo(() => items.filter(i => i.titulo.toLowerCase().includes(q.toLowerCase())), [items, q])
  const activos = items.filter(i => i.estado === 'activo').length
  const max = Math.max(...demo.serie)

  function flash(s: string) { setAviso(s); setTimeout(() => setAviso(''), 2500) }

  function agregar() {
    if (!nuevo.titulo.trim()) return
    const colores = ['#60A5FA', '#34D399', '#F472B6', '#FBBF24', '#A78BFA']
    setItems(prev => [...prev, {
      id: Date.now().toString(),
      titulo: nuevo.titulo,
      detalle: nuevo.detalle || 'Sin descripción',
      precio: nuevo.precio ? Number(nuevo.precio) : undefined,
      categoria: nuevo.categoria || undefined,
      color: colores[prev.length % colores.length],
      estado: 'activo',
    }])
    setNuevo({ titulo: '', detalle: '', precio: '', categoria: demo.categorias[0] || '' })
    flash('Agregado. Así se vería en el sitio público.')
  }

  function toggle(id: string) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, estado: i.estado === 'activo' ? 'pausado' : 'activo' } : i))
  }

  function borrar(id: string) {
    setItems(prev => prev.filter(i => i.id !== id))
    flash('Eliminado.')
  }

  function guardarEdicion(id: string) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, titulo: editTitulo || i.titulo } : i))
    setEditId(null)
    flash('Cambios guardados.')
  }

  const tabs: { key: Vista; label: string }[] = [
    { key: 'resumen', label: 'Resumen' },
    { key: 'seccion', label: demo.seccion },
    { key: 'ajustes', label: 'Ajustes' },
  ]

  const card = { background: '#18181B', borderColor: '#27272A' }
  const input = 'w-full bg-[#09090B] border border-[#27272A] focus:border-[#3F3F46] text-[#FAFAFA] rounded-lg px-3 py-2 text-sm outline-none'

  return (
    <div className="min-h-screen bg-[#09090B] text-[#FAFAFA] flex">
      <aside className="w-56 shrink-0 border-r border-[#18181B] p-4 hidden md:flex flex-col gap-1">
        <div className="mb-5">
          <p className="text-sm font-bold">{nombre}</p>
          <p className="text-[10px] text-[#52525B] font-mono">/demo/{demo.slug}</p>
        </div>
        {tabs.map(tb => (
          <button key={tb.key} onClick={() => setVista(tb.key)} className={`text-left text-xs px-3 py-2 rounded-md transition-colors ${vista === tb.key ? 'bg-[#18181B] text-[#FAFAFA]' : 'text-[#71717A] hover:text-[#A1A1AA]'}`}>{tb.label}</button>
        ))}
        <div className="mt-auto flex flex-col gap-1">
          <Link href={`/demo/${demo.slug}`} className="text-xs text-[#2563EB] px-3 py-2">Ver sitio público</Link>
          <Link href="/demo" className="text-xs text-[#71717A] px-3 py-2">Todas las demos</Link>
        </div>
      </aside>

      <main className="flex-1 p-5 md:p-8 max-w-5xl">
        <div className="md:hidden flex gap-2 mb-5 overflow-x-auto">
          {tabs.map(tb => (
            <button key={tb.key} onClick={() => setVista(tb.key)} className={`text-xs px-3 py-1.5 rounded-md border border-[#27272A] whitespace-nowrap ${vista === tb.key ? 'bg-[#18181B]' : 'text-[#71717A]'}`}>{tb.label}</button>
          ))}
        </div>

        <div className="bg-[#1E3A5F]/30 border border-[#2563EB]/30 text-[#DBEAFE] text-xs rounded-lg px-4 py-2.5 mb-6">
          Panel de demostración. Los cambios se ven en esta sesión pero no se guardan.
        </div>

        {aviso && <div className="bg-[#14532D]/30 border border-[#22C55E]/20 text-[#22C55E] text-xs rounded-lg px-4 py-2.5 mb-6">{aviso}</div>}

        {vista === 'resumen' && (
          <div className="flex flex-col gap-5">
            <h1 className="text-lg font-bold">Resumen</h1>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {demo.metricas.map(m => (
                <div key={m.label} className="border rounded-xl p-4" style={card}>
                  <p className="text-xs text-[#71717A] mb-2">{m.label}</p>
                  <p className="text-2xl font-bold">{m.value}</p>
                </div>
              ))}
            </div>
            <div className="border rounded-xl p-5" style={card}>
              <p className="text-xs font-semibold text-[#A1A1AA] uppercase tracking-wider mb-4">Evolución · últimas 7 semanas</p>
              <div className="flex items-end gap-2 h-40">
                {demo.serie.map((v, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
                    <span className="text-[10px] text-[#71717A] opacity-0 group-hover:opacity-100 transition-opacity">{v}</span>
                    <div className="w-full rounded-t-md bg-[#2563EB] hover:bg-[#3B82F6] transition-colors" style={{ height: `${(v / max) * 100}%` }} />
                    <span className="text-[10px] text-[#52525B]">S{i + 1}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="border rounded-xl p-5" style={card}>
              <p className="text-xs font-semibold text-[#A1A1AA] uppercase tracking-wider mb-3">Actividad reciente</p>
              {items.slice(0, 4).map(i => (
                <div key={i.id} className="flex items-center justify-between py-2 border-b border-[#27272A] last:border-0 text-sm">
                  <span className="text-[#D4D4D8]">{i.titulo}</span>
                  <span className={`text-xs ${i.estado === 'activo' ? 'text-[#22C55E]' : 'text-[#EAB308]'}`}>{i.estado === 'activo' ? 'Publicado' : 'Pausado'}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {vista === 'seccion' && (
          <div className="flex flex-col gap-5">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <h1 className="text-lg font-bold">{demo.seccion}</h1>
                <p className="text-xs text-[#71717A]">{activos} publicados · {items.length - activos} pausados</p>
              </div>
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar" className="bg-[#18181B] border border-[#27272A] rounded-lg px-3 py-2 text-sm outline-none w-56" />
            </div>

            <div className="border rounded-xl p-5 flex flex-col gap-3" style={card}>
              <p className="text-xs font-semibold text-[#A1A1AA] uppercase tracking-wider">Agregar nuevo</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input className={input} placeholder="Título" value={nuevo.titulo} onChange={e => setNuevo({ ...nuevo, titulo: e.target.value })} />
                <input className={input} placeholder="Descripción" value={nuevo.detalle} onChange={e => setNuevo({ ...nuevo, detalle: e.target.value })} />
                <input className={input} placeholder="Precio (opcional)" type="number" value={nuevo.precio} onChange={e => setNuevo({ ...nuevo, precio: e.target.value })} />
                {demo.categorias.length > 0 && (
                  <select className={input} value={nuevo.categoria} onChange={e => setNuevo({ ...nuevo, categoria: e.target.value })}>
                    {demo.categorias.map(c => <option key={c}>{c}</option>)}
                  </select>
                )}
              </div>
              <button onClick={agregar} className="self-start bg-[#FAFAFA] text-[#09090B] text-xs font-semibold px-4 py-2 rounded-lg">Agregar</button>
            </div>

            <div className="border rounded-xl overflow-hidden divide-y divide-[#27272A]" style={card}>
              {filtrados.length === 0 && <p className="px-5 py-8 text-sm text-[#71717A] text-center">No hay resultados.</p>}
              {filtrados.map(i => (
                <div key={i.id} className={`flex items-center gap-4 px-5 py-3.5 ${i.estado === 'pausado' ? 'opacity-60' : ''}`}>
                  <div style={{ background: i.color }} className="w-9 h-9 rounded-lg shrink-0" />
                  <div className="flex-1 min-w-0">
                    {editId === i.id ? (
                      <div className="flex gap-2">
                        <input className={input} value={editTitulo} onChange={e => setEditTitulo(e.target.value)} />
                        <button onClick={() => guardarEdicion(i.id)} className="text-xs bg-[#2563EB] px-3 rounded-lg">OK</button>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm font-medium truncate">{i.titulo}</p>
                        <p className="text-xs text-[#71717A] truncate">{i.detalle}{i.categoria ? ` · ${i.categoria}` : ''}</p>
                      </>
                    )}
                  </div>
                  {i.precio !== undefined && <p className="text-sm font-semibold hidden sm:block">USD {i.precio}</p>}
                  <div className="flex gap-1.5 shrink-0">
                    <button onClick={() => toggle(i.id)} className="text-xs px-2.5 py-1.5 rounded-md border border-[#27272A] text-[#A1A1AA] hover:text-[#FAFAFA]">{i.estado === 'activo' ? 'Pausar' : 'Publicar'}</button>
                    <button onClick={() => { setEditId(i.id); setEditTitulo(i.titulo) }} className="text-xs px-2.5 py-1.5 rounded-md border border-[#27272A] text-[#A1A1AA] hover:text-[#FAFAFA]">Editar</button>
                    <button onClick={() => borrar(i.id)} className="text-xs px-2.5 py-1.5 rounded-md border border-[#27272A] text-[#71717A] hover:text-[#EF4444]">Borrar</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {vista === 'ajustes' && (
          <div className="flex flex-col gap-5 max-w-lg">
            <h1 className="text-lg font-bold">Ajustes del sitio</h1>
            <div className="border rounded-xl p-5 flex flex-col gap-4" style={card}>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-[#A1A1AA]">Nombre del negocio</label>
                <input className={input} value={nombre} onChange={e => setNombre(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-[#A1A1AA]">Titular principal</label>
                <input className={input} defaultValue={demo.hero.titulo} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-[#A1A1AA]">Color de acento</label>
                <div className="flex items-center gap-3">
                  <div style={{ background: t.accent }} className="w-8 h-8 rounded-md border border-[#27272A]" />
                  <span className="text-xs font-mono text-[#71717A]">{t.accent}</span>
                </div>
              </div>
              <button onClick={() => flash('Ajustes guardados en esta sesión.')} className="self-start bg-[#FAFAFA] text-[#09090B] text-xs font-semibold px-4 py-2 rounded-lg">Guardar</button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
