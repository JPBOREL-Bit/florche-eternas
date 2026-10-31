import Link from 'next/link'
import { DEMOS } from '@/lib/demo'

export default function DemoIndex() {
  return (
    <main className="min-h-screen bg-[#09090B] px-4 sm:px-6 py-20">
      <div className="max-w-4xl mx-auto">
        <Link href="/" className="text-xs text-[#52525B] hover:text-[#A1A1AA]">← Volver al inicio</Link>
        <p className="text-xs font-semibold text-[#2563EB] uppercase tracking-widest mt-8 mb-2">Demos · Plan Mantenimiento</p>
        <h1 className="text-3xl font-bold text-[#FAFAFA] mb-3">Sitios de ejemplo</h1>
        <p className="text-sm text-[#71717A] mb-10">Cada demo tiene su sitio público y su panel de administración.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {DEMOS.map(d => (
            <div key={d.slug} className="bg-[#18181B] border border-[#27272A] rounded-xl p-5">
              <p className="text-[#FAFAFA] font-semibold text-sm mb-1">{d.nombre}</p>
              <p className="text-[#71717A] text-xs mb-4">{d.descripcion}</p>
              <div className="flex gap-2">
                <Link href={`/demo/${d.slug}`} className="text-xs font-semibold bg-[#FAFAFA] text-[#09090B] px-3 py-1.5 rounded-md">Ver sitio</Link>
                <Link href={`/demo/${d.slug}/admin`} className="text-xs font-semibold border border-[#3F3F46] text-[#D4D4D8] px-3 py-1.5 rounded-md">Panel admin</Link>
              </div>
              <p className="text-[#3F3F46] text-[10px] font-mono mt-3">/demo/{d.slug}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
