'use client'
import { useState } from 'react'
import DashboardTab from './tabs/DashboardTab'
import PlanesTab from './tabs/PlanesTab'
import ClientesTab from './tabs/ClientesTab'
import SitioTab from './tabs/SitioTab'
import MantenimientoTab from './tabs/MantenimientoTab'

type Tab = { key: string; label: string; badge?: number }
const TABS: Tab[] = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'planes', label: 'Planes' },
  { key: 'clientes', label: 'Clientes' },
  { key: 'sitio', label: 'Sitio' },
  { key: 'mantenimiento', label: 'Mantenimiento' },
]

function Icon({ name }: { name: string }) {
  const icons: Record<string, React.ReactNode> = {
    dashboard: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
    planes: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z"/></svg>,
    clientes: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"/></svg>,
    sitio: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418"/></svg>,
    mantenimiento: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l5.654-4.654m5.65-4.65l4.654-5.654a2.548 2.548 0 013.586 3.586l-5.654 4.654m-4.65 5.65l4.65-4.65m-4.65 4.65L7.765 20.25m0 0l-4.654-4.654"/></svg>,
  }
  return <>{icons[name] || null}</>
}

export default function AdminDashboardClient({ adminBase }: { adminBase: string }) {
  const [active, setActive] = useState('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen bg-[#09090B] flex">
      {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setSidebarOpen(false)}/>}

      {/* Sidebar */}
      <aside className={`w-52 shrink-0 bg-[#09090B] border-r border-[#18181B] flex flex-col fixed md:static inset-y-0 left-0 z-50 transition-transform duration-200 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="h-14 px-4 flex items-center gap-2 border-b border-[#18181B]">
          <div className="w-6 h-6 bg-[#2563EB] rounded-md flex items-center justify-center shrink-0">
            <span className="text-white font-bold text-[10px]">V</span>
          </div>
          <div>
            <p className="text-[#FAFAFA] font-semibold text-xs">Vexorade</p>
            <p className="text-[#52525B] text-[10px] font-mono">admin</p>
          </div>
        </div>

        <nav className="flex-1 py-3 px-2 flex flex-col gap-0.5">
          {TABS.map(tab => (
            <button key={tab.key} onClick={() => { setActive(tab.key); setSidebarOpen(false) }}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium w-full text-left transition-colors ${
                active === tab.key ? 'bg-[#18181B] text-[#FAFAFA]' : 'text-[#71717A] hover:text-[#A1A1AA] hover:bg-[#18181B]/50'
              }`}>
              <Icon name={tab.key}/>
              {tab.label}
              {tab.badge && <span className="ml-auto bg-[#EF4444] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{tab.badge}</span>}
            </button>
          ))}
        </nav>

        <div className="p-2 border-t border-[#18181B]">
          <a href="/" target="_blank" className="flex items-center gap-2.5 px-3 py-2 rounded-md text-xs text-[#71717A] hover:text-[#A1A1AA] hover:bg-[#18181B]/50 transition-colors w-full">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"/></svg>
            Ver sitio web
          </a>
          <form action="/api/auth/logout" method="POST">
            <button className="flex items-center gap-2.5 px-3 py-2 rounded-md text-xs text-[#71717A] hover:text-[#EF4444] hover:bg-[#450A0A]/30 transition-colors w-full">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75"/></svg>
              Cerrar sesión
            </button>
          </form>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-14 border-b border-[#18181B] px-4 md:px-6 flex items-center justify-between sticky top-0 bg-[#09090B] z-30">
          <div className="flex items-center gap-3">
            <button className="md:hidden p-1.5 text-[#71717A] hover:text-[#FAFAFA]" onClick={() => setSidebarOpen(true)}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"/></svg>
            </button>
            <h1 className="text-[#FAFAFA] font-semibold text-sm">{TABS.find(t => t.key === active)?.label}</h1>
          </div>
          <span className="text-[#3F3F46] text-xs font-mono hidden sm:block">/{adminBase}</span>
        </header>
        <div className="flex-1 p-4 md:p-6 overflow-y-auto">
          {active === 'dashboard' && <DashboardTab setActive={setActive}/>}
          {active === 'planes' && <PlanesTab/>}
          {active === 'clientes' && <ClientesTab/>}
          {active === 'sitio' && <SitioTab/>}
          {active === 'mantenimiento' && <MantenimientoTab/>}
        </div>
      </div>
    </div>
  )
}
