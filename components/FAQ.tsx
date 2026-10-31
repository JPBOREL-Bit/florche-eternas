'use client'
import { useState } from 'react'

const FAQS = [
  { q: '¿Qué incluye el primer pago?', a: 'El primer mes incluye la creación completa de tu página web y el primer mes de alojamiento. No hay costos ocultos.' },
  { q: '¿Qué tipo de sitio puedo pedir?', a: 'Cualquier tipo compatible con tu plan: tiendas, reservas, usuarios con login, blogs, menús digitales y más. Vos describís, nosotros construimos.' },
  { q: '¿Cuánto tarda en estar lista mi web?', a: 'El plan Mantenimiento se entrega en 24 horas. Los planes Avanzado y Pro en 3 días hábiles. Ultra puede tomar hasta 5 días.' },
  { q: '¿Qué pasa si llego al límite de almacenamiento?', a: 'No perdés el acceso a tu sitio ni a tu panel. Solo se bloquean las operaciones que aumenten el espacio. Podés optimizar archivos o contactarnos para ampliar.' },
  { q: '¿Puedo cambiar de plan en cualquier momento?', a: 'Sí. Podés escalar a un plan superior cuando quieras. Coordinamos la migración sin tiempo de inactividad.' },
  { q: '¿Necesito saber programar o diseñar?', a: 'No. Te pedimos que nos cuentes qué necesitás en lenguaje llano. Nosotros nos encargamos de todo lo técnico.' },
  { q: '¿Hay contrato de permanencia?', a: 'No. El servicio es mes a mes. Podés dar de baja cuando quieras sin penalidades.' },
]

export default function FAQ() {
  const [open, setOpen] = useState<number | null>(null)
  return (
    <section id="faq" className="py-24 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto">
        <div className="mb-12">
          <p className="text-xs font-semibold text-[#2563EB] uppercase tracking-widest mb-2">FAQ</p>
          <h2 className="text-3xl font-bold text-[#FAFAFA]">Preguntas frecuentes</h2>
        </div>
        <div className="divide-y divide-[#27272A]">
          {FAQS.map((f, i) => (
            <div key={i}>
              <button
                className="w-full flex items-center justify-between gap-4 py-4 text-left cursor-pointer group"
                onClick={() => setOpen(open === i ? null : i)}
              >
                <span className={`text-sm font-medium transition-colors ${open === i ? 'text-[#FAFAFA]' : 'text-[#D4D4D8] group-hover:text-[#FAFAFA]'}`}>{f.q}</span>
                <svg className={`w-4 h-4 text-[#52525B] shrink-0 transition-transform duration-200 ${open === i ? 'rotate-45' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15"/>
                </svg>
              </button>
              {open === i && <p className="pb-4 text-sm text-[#A1A1AA] leading-relaxed">{f.a}</p>}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
