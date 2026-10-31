import Analytics from '@/components/Analytics'

export default function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#09090B]">
      <Analytics />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-20">
        <div className="mb-2">
          <a href="/" className="inline-flex items-center gap-1.5 text-xs text-[#52525B] hover:text-[#A1A1AA] transition-colors mb-8 block">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"/></svg>
            Volver al inicio
          </a>
        </div>
        <div className="mb-10 pb-10 border-b border-[#27272A]">
          <h1 className="text-3xl font-bold text-[#FAFAFA] mb-2">{title}</h1>
          <p className="text-xs text-[#52525B]">Última actualización: {updated}</p>
        </div>
        <div className="prose-custom text-[#A1A1AA] text-sm leading-relaxed space-y-6">
          {children}
        </div>
        <div className="mt-16 pt-8 border-t border-[#27272A] text-xs text-[#52525B]">
          <p>Para consultas: <a href="mailto:vexorade.web@gmail.com" className="text-[#2563EB] hover:underline">vexorade.web@gmail.com</a></p>
        </div>
      </div>
    </div>
  )
}
