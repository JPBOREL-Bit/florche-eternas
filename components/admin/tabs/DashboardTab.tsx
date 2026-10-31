'use client'
import { useCallback, useEffect, useState } from 'react'

function mb(bytes: number) { return (bytes / 1024 / 1024).toFixed(2) }

type Status = {
  web: { status: string }
  supabase: { configured: boolean; reachable: boolean; tablesReady: boolean; error: string | null }
  whatsapp: { configured: boolean }
  checkedAt: string
}

function Fila({ label, ok, texto }: { label: string; ok: boolean; texto: string }) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <span className="text-sm text-[#A1A1AA]">{label}</span>
      <div className="flex items-center gap-1.5 text-right">
        <span className={`w-1.5 h-1.5 rounded-full ${ok ? 'bg-[#22C55E]' : 'bg-[#EAB308]'}`} />
        <span className={`text-xs font-medium ${ok ? 'text-[#22C55E]' : 'text-[#EAB308]'}`}>{texto}</span>
      </div>
    </div>
  )
}

export default function DashboardTab({ setActive }: { setActive: (k: string) => void }) {
  const [status, setStatus] = useState<Status | null>(null)
  const [error, setError] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [comprimiendo, setComprimiendo] = useState(false)
  const [resultado, setResultado] = useState<string | null>(null)

  async function comprimirTodo() {
    setComprimiendo(true)
    setResultado(null)
    try {
      const res = await fetch('/api/admin/compress', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setResultado(
        data.comprimidos === 0
          ? `Revisé ${data.revisados} archivos. No había nada para comprimir.`
          : `Comprimí ${data.comprimidos} de ${data.revisados} archivos. Liberaste ${mb(data.liberadoBytes)} MB.`
      )
    } catch (e) {
      setResultado(`No se pudo comprimir: ${e instanceof Error ? e.message : 'error desconocido'}`)
    } finally {
      setComprimiendo(false)
    }
  }

  const verificar = useCallback(async () => {
    setCargando(true)
    try {
      const res = await fetch('/api/admin/status', { cache: 'no-store' })
      if (!res.ok) throw new Error()
      setStatus(await res.json())
      setError(false)
    } catch {
      setError(true)
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    verificar()
    const id = setInterval(verificar, 15000)
    return () => clearInterval(id)
  }, [verificar])

  const dbTexto = !status ? 'Verificando…'
    : !status.supabase.configured ? 'Sin configurar'
    : status.supabase.tablesReady ? 'Conectada'
    : status.supabase.error ?? 'Sin verificar'

  const dbOk = Boolean(status?.supabase.tablesReady)
  const waOk = Boolean(status?.whatsapp.configured)

  return (
    <div className="max-w-5xl flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[#FAFAFA] font-bold text-base">Resumen</h2>
          <p className="text-[#71717A] text-xs mt-0.5">
            {status ? `Última verificación ${new Date(status.checkedAt).toLocaleTimeString('es-AR')} · se actualiza cada 15 segundos` : 'Verificando…'}
          </p>
        </div>
        <button onClick={verificar} disabled={cargando} className="text-xs font-semibold px-3 py-2 rounded-lg border border-[#27272A] text-[#A1A1AA] hover:text-[#FAFAFA] disabled:opacity-50">
          {cargando ? 'Verificando…' : 'Verificar ahora'}
        </button>
      </div>

      {error && (
        <div className="bg-[#450A0A]/30 border border-[#EF4444]/30 text-[#EF4444] text-xs rounded-lg px-4 py-2.5">
          No se pudo consultar el estado. Revisá que la sesión siga activa.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-[#18181B] border border-[#27272A] rounded-xl p-5">
          <p className="text-xs font-semibold text-[#A1A1AA] uppercase tracking-widest mb-3">Estado del sistema</p>
          <div className="flex flex-col divide-y divide-[#27272A]">
            <Fila label="Sitio web" ok texto="Operativo" />
            <Fila label="Panel admin" ok texto="Operativo" />
            <Fila label="Base de datos (Supabase)" ok={dbOk} texto={dbTexto} />
            <Fila label="WhatsApp" ok={waOk} texto={waOk ? 'Configurado' : 'Sin configurar'} />
          </div>
          {status && !waOk && (
            <p className="text-[11px] text-[#71717A] mt-3">Si ya cargaste NEXT_PUBLIC_WHATSAPP_NUMBER en Render, hacé un Manual Deploy: esa variable se aplica al compilar.</p>
          )}
        </div>

        <div className="bg-[#18181B] border border-[#27272A] rounded-xl p-5">
          <p className="text-xs font-semibold text-[#A1A1AA] uppercase tracking-widest mb-3">Accesos rápidos</p>
          <div className="flex flex-col gap-2">
            {[
              { label: 'Agregar cliente', tab: 'clientes' },
              { label: 'Editar planes', tab: 'planes' },
              { label: 'Editar textos del sitio', tab: 'sitio' },
              { label: 'Modo mantenimiento', tab: 'mantenimiento' },
            ].map(a => (
              <button key={a.tab} onClick={() => setActive(a.tab)} className="flex items-center justify-between px-3 py-2.5 bg-[#09090B] border border-[#27272A] hover:border-[#3F3F46] rounded-lg text-sm text-[#A1A1AA] hover:text-[#FAFAFA] transition-colors">
                {a.label}
                <span className="text-[#3F3F46]">→</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-[#18181B] border border-[#27272A] rounded-xl p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-[#FAFAFA]">Comprimir archivos</p>
            <p className="text-xs text-[#71717A] mt-1">Optimiza las imágenes guardadas en el almacenamiento de Vexorade (logo y medios). Convierte a WebP solo si queda más liviana.</p>
          </div>
          <button onClick={comprimirTodo} disabled={comprimiendo} className="shrink-0 text-xs font-semibold px-3 py-2 rounded-lg bg-[#FAFAFA] text-[#09090B] hover:bg-white disabled:opacity-50">
            {comprimiendo ? 'Comprimiendo…' : 'Comprimir todo'}
          </button>
        </div>
        {resultado && <p className="text-xs text-[#A1A1AA] border-t border-[#27272A] pt-3">{resultado}</p>}
      </div>
    </div>
  )
}
