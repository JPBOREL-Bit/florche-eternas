'use client'
import { useState } from 'react'

export default function MantenimientoTab() {
  const [activo, setActivo] = useState(false)
  const [mensaje, setMensaje] = useState('Sitio en mantenimiento. Volvemos pronto.')
  const [confirmando, setConfirmando] = useState(false)
  const [msg, setMsg] = useState('')

  function toggleMantenimiento() {
    if (!activo && !confirmando) { setConfirmando(true); return }
    setActivo(!activo)
    setConfirmando(false)
    setMsg(activo ? 'Sitio restaurado. La web pública está en línea.' : 'Modo mantenimiento activado. La web pública está pausada.')
    setTimeout(() => setMsg(''), 4000)
  }

  return (
    <div className="max-w-2xl flex flex-col gap-5">
      <div>
        <h2 className="text-[#FAFAFA] font-bold text-base">Mantenimiento global</h2>
        <p className="text-[#71717A] text-xs mt-0.5">Pausar o reactivar toda la web pública de Vexorade.</p>
      </div>

      {msg && (
        <div className={`text-xs px-4 py-2.5 rounded-lg border ${activo ? 'bg-[#450A0A]/30 border-[#EF4444]/20 text-[#EF4444]' : 'bg-[#14532D]/20 border-[#22C55E]/20 text-[#22C55E]'}`}>{msg}</div>
      )}

      {/* Estado actual */}
      <div className={`bg-[#18181B] border rounded-xl p-6 ${activo ? 'border-[#EF4444]/30' : 'border-[#27272A]'}`}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[#FAFAFA] font-semibold text-sm">Estado del sitio</p>
            <p className="text-[#71717A] text-xs mt-0.5">vexorade.com</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${activo ? 'bg-[#EF4444]' : 'bg-[#22C55E]'}`}/>
            <span className={`text-sm font-semibold ${activo ? 'text-[#EF4444]' : 'text-[#22C55E]'}`}>
              {activo ? 'En mantenimiento' : 'Operativo'}
            </span>
          </div>
        </div>

        {activo && (
          <div className="bg-[#09090B] border border-[#27272A] rounded-lg p-4 mb-4">
            <p className="text-xs text-[#71717A] mb-1">Mensaje que ven los visitantes</p>
            <p className="text-[#FAFAFA] text-sm">{mensaje}</p>
          </div>
        )}

        {!activo ? (
          <div>
            <div className="flex flex-col gap-1.5 mb-4">
              <label className="text-xs text-[#A1A1AA]">Mensaje para los visitantes durante el mantenimiento</label>
              <textarea value={mensaje} onChange={e => setMensaje(e.target.value)} rows={2} className="bg-[#09090B] border border-[#27272A] focus:border-[#2563EB] text-[#FAFAFA] rounded-lg px-3 py-2.5 text-sm outline-none resize-none transition-colors"/>
            </div>

            {!confirmando ? (
              <button onClick={toggleMantenimiento} className="flex items-center gap-2 bg-[#450A0A]/30 hover:bg-[#450A0A]/60 border border-[#EF4444]/20 hover:border-[#EF4444]/40 text-[#EF4444] text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l5.654-4.654m5.65-4.65l4.654-5.654a2.548 2.548 0 013.586 3.586l-5.654 4.654m-4.65 5.65l4.65-4.65m-4.65 4.65L7.765 20.25"/></svg>
                Activar modo mantenimiento
              </button>
            ) : (
              <div className="bg-[#450A0A]/20 border border-[#EF4444]/20 rounded-xl p-4">
                <p className="text-[#FAFAFA] font-semibold text-sm mb-1">¿Confirmar?</p>
                <p className="text-[#A1A1AA] text-xs mb-4">Todos los visitantes verán el mensaje de mantenimiento. Los clientes con sitio activo no serán afectados.</p>
                <div className="flex gap-2">
                  <button onClick={() => setConfirmando(false)} className="text-[#71717A] hover:text-[#FAFAFA] text-xs px-4 py-2 rounded-lg hover:bg-[#27272A] transition-colors">Cancelar</button>
                  <button onClick={toggleMantenimiento} className="bg-[#EF4444] hover:bg-red-600 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors">
                    Sí, activar mantenimiento
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <button onClick={toggleMantenimiento} className="flex items-center gap-2 bg-[#14532D]/30 hover:bg-[#14532D]/60 border border-[#22C55E]/20 hover:border-[#22C55E]/40 text-[#22C55E] text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5.636 5.636a9 9 0 1012.728 0M12 3v9"/></svg>
            Restaurar sitio
          </button>
        )}
      </div>

      {/* Advertencia */}
      <div className="bg-[#18181B] border border-[#27272A] rounded-xl p-5">
        <p className="text-xs font-semibold text-[#A1A1AA] uppercase tracking-wider mb-3">Importante</p>
        <div className="flex flex-col gap-2 text-xs text-[#71717A]">
          <div className="flex items-start gap-2"><span className="text-[#EAB308] shrink-0 mt-0.5">•</span> El modo mantenimiento pausa la web pública de Vexorade, no los sitios individuales de tus clientes.</div>
          <div className="flex items-start gap-2"><span className="text-[#EAB308] shrink-0 mt-0.5">•</span> Para pausar el sitio de un cliente específico, hacelo desde la pestaña Clientes.</div>
          <div className="flex items-start gap-2"><span className="text-[#EAB308] shrink-0 mt-0.5">•</span> El panel de administración seguirá accesible durante el mantenimiento.</div>
        </div>
      </div>
    </div>
  )
}
