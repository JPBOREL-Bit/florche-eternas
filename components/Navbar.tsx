'use client'
import { useState, useEffect } from 'react'

const LINKS = [
  { href: '#servicios', label: 'Servicios' },
  { href: '#planes', label: 'Planes' },
  { href: '#faq', label: 'FAQ' },
  { href: '#contacto', label: 'Contacto' },
]

export default function Navbar({ logoUrl }: { logoUrl?: string | null }) {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 12)
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [])
  return (
    <nav className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${scrolled ? 'bg-[#09090B]/90 backdrop-blur border-b border-[#27272A]' : 'bg-transparent'}`}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2">
          {logoUrl
            ? <img src={logoUrl} alt="Vexorade" className="h-7 w-auto" />
            : <div className="w-7 h-7 bg-[#2563EB] rounded-md flex items-center justify-center">
                <span className="text-white font-bold text-xs">V</span>
              </div>}
          <span className="font-semibold text-[#FAFAFA] text-sm">Vexorade</span>
        </a>
        <div className="hidden md:flex items-center gap-1">
          {LINKS.map(l => (
            <a key={l.href} href={l.href} className="px-3 py-1.5 text-sm text-[#A1A1AA] hover:text-[#FAFAFA] transition-colors rounded-md hover:bg-[#18181B]">{l.label}</a>
          ))}
        </div>
        <div className="hidden md:flex items-center gap-3">
          <a href="#planes" className="text-sm text-[#A1A1AA] hover:text-[#FAFAFA] transition-colors">Ver planes</a>
          <a href="#contacto" className="bg-[#FAFAFA] hover:bg-white text-[#09090B] text-sm font-semibold px-3.5 py-1.5 rounded-md transition-colors">Contactar</a>
        </div>
        <button className="md:hidden p-2 text-[#A1A1AA] hover:text-[#FAFAFA]" onClick={() => setOpen(!open)}>
          {open
            ? <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            : <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"/></svg>
          }
        </button>
      </div>
      {open && (
        <div className="md:hidden bg-[#09090B] border-t border-[#27272A] px-4 py-3 flex flex-col gap-1">
          {LINKS.map(l => (
            <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="px-3 py-2 text-sm text-[#A1A1AA] hover:text-[#FAFAFA] hover:bg-[#18181B] rounded-md">{l.label}</a>
          ))}
          <a href="#contacto" onClick={() => setOpen(false)} className="mt-2 bg-[#FAFAFA] text-[#09090B] text-sm font-semibold px-3 py-2 rounded-md text-center">Contactar</a>
        </div>
      )}
    </nav>
  )
}
