import Navbar from '@/components/Navbar'
import PlanCard from '@/components/PlanCard'
import FAQ from '@/components/FAQ'
import Reveal from '@/components/ui/Reveal'
import Analytics from '@/components/Analytics'
import { DEFAULT_PLANS } from '@/lib/plans'
import { getContactLink } from '@/lib/contact'
import { logoPublico } from '@/lib/serverDb'

const SERVICES = [
  { title: 'Tienda online', desc: 'Catálogo de productos, carrito y panel de gestión propio.', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z"/></svg> },
  { title: 'Reservas y turnos', desc: 'Sistema de agenda online para negocios y profesionales.', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"/></svg> },
  { title: 'Usuarios y áreas privadas', desc: 'Login con contraseña para que tus clientes accedan a su cuenta.', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"/></svg> },
  { title: 'Blog y noticias', desc: 'Publicá contenido y posicioná tu marca en buscadores.', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V18a2.25 2.25 0 002.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6v-3z"/></svg> },
  { title: 'Menú digital', desc: 'Para restaurantes y bares. Actualizá precios en tiempo real.', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8.25v-1.5m0 1.5c-1.355 0-2.697.056-4.024.166C6.845 8.51 6 9.473 6 10.608v2.513m6-4.87c1.355 0 2.697.055 4.024.165C17.155 8.51 18 9.473 18 10.608v2.513m-3-4.87v-1.5m-6 1.5v-1.5m12 9.75l-1.5.75a3.354 3.354 0 01-3 0 3.354 3.354 0 00-3 0 3.354 3.354 0 01-3 0 3.354 3.354 0 00-3 0 3.354 3.354 0 01-3 0L3 16.5"/></svg> },
  { title: 'Portfolio profesional', desc: 'Mostrá tu trabajo y conseguí más clientes.', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0"/></svg> },
]

const STEPS = [
  { n: '01', title: 'Elegís tu plan', desc: 'El primer mes incluye la creación completa de tu página.' },
  { n: '02', title: 'Nos contás tu idea', desc: 'Por WhatsApp o email, en lenguaje llano. Sin tecnicismos.' },
  { n: '03', title: 'Recibís tu web', desc: 'En 24 a 72 horas en línea. Ajustamos hasta que estés conforme.' },
]

export default async function Home() {
  const logo = await logoPublico()
  const contactLink = getContactLink('general')
  return (
    <main className="bg-[#09090B] min-h-screen">
      <Analytics />
      <Navbar logoUrl={logo} />

      {/* HERO */}
      <section className="relative pt-32 pb-24 px-4 sm:px-6 overflow-hidden">
        {/* Fondo sutil */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[400px] bg-[#2563EB]/5 rounded-full blur-[120px]" />
          <div className="absolute inset-0 opacity-[0.015]" style={{backgroundImage:'linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)',backgroundSize:'72px 72px'}} />
        </div>
        <div className="max-w-6xl mx-auto relative">
          <Reveal>
            <div className="inline-flex items-center gap-2 border border-[#27272A] bg-[#18181B] rounded-full px-3 py-1 text-xs text-[#A1A1AA] mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] blink" />
              Desde USD 15 el primer mes · sin permanencia
            </div>
          </Reveal>
          <Reveal delay={80}>
            <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold text-[#FAFAFA] leading-[1.05] tracking-tight max-w-3xl mb-6">
              Tu página web,<br/>
              <span className="text-[#2563EB]">sin complicaciones.</span>
            </h1>
          </Reveal>
          <Reveal delay={160}>
            <p className="text-[#71717A] text-lg max-w-xl leading-relaxed mb-10">
              Creamos tu sitio web desde cero — tiendas, reservas, catálogos, blogs y más.
              Describís lo que necesitás, nosotros lo construimos y mantenemos.
            </p>
          </Reveal>
          <Reveal delay={240}>
            <div className="flex flex-col sm:flex-row gap-3 mb-16">
              <a href="#planes" className="inline-flex items-center justify-center gap-2 bg-[#2563EB] hover:bg-[#1d4ed8] text-white font-semibold px-5 py-2.5 rounded-lg text-sm transition-colors">
                Ver planes y precios
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"/></svg>
              </a>
              <a href={contactLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 bg-[#18181B] hover:bg-[#27272A] border border-[#27272A] hover:border-[#3F3F46] text-[#D4D4D8] font-semibold px-5 py-2.5 rounded-lg text-sm transition-colors">
                <svg className="w-4 h-4 text-[#25D366]" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.555 4.116 1.524 5.847L.057 23.882a.75.75 0 00.933.933l6.036-1.467A11.953 11.953 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22.5c-1.969 0-3.81-.537-5.388-1.471l-.385-.224-3.995.97.987-3.878-.247-.4A10.463 10.463 0 011.5 12C1.5 6.21 6.21 1.5 12 1.5S22.5 6.21 22.5 12 17.79 22.5 12 22.5z"/></svg>
                Hablar por WhatsApp
              </a>
            </div>
          </Reveal>
          <Reveal delay={320}>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-[#27272A] rounded-xl overflow-hidden border border-[#27272A]">
              {[
                { n: '5', label: 'planes disponibles' },
                { n: '24h', label: 'entrega mínima' },
                { n: '0', label: 'contratos largos' },
                { n: '100%', label: 'a medida' },
              ].map((s, i) => (
                <div key={i} className="bg-[#09090B] px-6 py-5">
                  <p className="text-2xl font-bold text-[#FAFAFA]">{s.n}</p>
                  <p className="text-xs text-[#52525B] mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* SERVICIOS */}
      <section id="servicios" className="py-24 px-4 sm:px-6 border-t border-[#18181B]">
        <div className="max-w-6xl mx-auto">
          <Reveal>
            <div className="mb-12">
              <p className="text-xs font-semibold text-[#2563EB] uppercase tracking-widest mb-2">Servicios</p>
              <h2 className="text-3xl font-bold text-[#FAFAFA] mb-3">¿Qué podemos hacer?</h2>
              <p className="text-[#71717A] max-w-lg text-sm">Cualquier tipo de web dentro de los límites de tu plan. Si no sabés cuál necesitás, escribinos.</p>
            </div>
          </Reveal>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {SERVICES.map((s, i) => (
              <Reveal key={i} delay={i * 60}>
                <div className="bg-[#18181B] border border-[#27272A] hover:border-[#3F3F46] rounded-xl p-5 transition-colors group h-full">
                  <div className="w-9 h-9 rounded-lg bg-[#27272A] group-hover:bg-[#2563EB]/10 border border-[#3F3F46] flex items-center justify-center text-[#71717A] group-hover:text-[#2563EB] transition-colors mb-4">
                    {s.icon}
                  </div>
                  <h3 className="text-[#FAFAFA] font-semibold text-sm mb-1.5">{s.title}</h3>
                  <p className="text-[#71717A] text-sm leading-relaxed">{s.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* CÓMO FUNCIONA */}
      <section className="py-24 px-4 sm:px-6 border-t border-[#18181B]">
        <div className="max-w-6xl mx-auto">
          <Reveal>
            <div className="mb-12">
              <p className="text-xs font-semibold text-[#2563EB] uppercase tracking-widest mb-2">Proceso</p>
              <h2 className="text-3xl font-bold text-[#FAFAFA]">Tres pasos y listo</h2>
            </div>
          </Reveal>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {STEPS.map((step, i) => (
              <Reveal key={i} delay={i * 80}>
                <div className="bg-[#18181B] border border-[#27272A] rounded-xl p-6 h-full">
                  <p className="text-4xl font-bold text-[#27272A] mb-4 font-mono">{step.n}</p>
                  <h3 className="text-[#FAFAFA] font-semibold mb-2">{step.title}</h3>
                  <p className="text-[#71717A] text-sm leading-relaxed">{step.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* PLANES */}
      <section id="planes" className="py-24 px-4 sm:px-6 border-t border-[#18181B]">
        <div className="max-w-6xl mx-auto">
          <Reveal>
            <div className="mb-12">
              <p className="text-xs font-semibold text-[#2563EB] uppercase tracking-widest mb-2">Precios</p>
              <h2 className="text-3xl font-bold text-[#FAFAFA] mb-3">Planes y precios</h2>
              <p className="text-[#71717A] max-w-lg text-sm">El primer mes incluye la creación completa de tu página. Sin contrato de permanencia.</p>
            </div>
          </Reveal>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {DEFAULT_PLANS.filter(p => p.active).map((plan, i) => (
              <Reveal key={plan.id} delay={i * 60}>
                <PlanCard plan={plan} />
              </Reveal>
            ))}
          </div>
          <Reveal>
            <p className="text-center text-sm text-[#52525B] mt-8">
              ¿Necesitás algo diferente?{' '}
              <a href={contactLink} target="_blank" rel="noopener noreferrer" className="text-[#2563EB] hover:underline">Contactanos</a>
            </p>
          </Reveal>
        </div>
      </section>

      {/* GARANTÍAS */}
      <section className="py-24 px-4 sm:px-6 border-t border-[#18181B]">
        <div className="max-w-6xl mx-auto">
          <Reveal>
            <div className="mb-12">
              <p className="text-xs font-semibold text-[#22C55E] uppercase tracking-widest mb-2">Por qué elegirnos</p>
              <h2 className="text-3xl font-bold text-[#FAFAFA]">Sin letra chica</h2>
            </div>
          </Reveal>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { title: 'Sin contratos largos', desc: 'Mes a mes. Podés cancelar cuando quieras sin penalidades.' },
              { title: 'Mantenimiento incluido', desc: 'Actualizaciones técnicas de la plataforma sin costo adicional.' },
              { title: 'Soporte humano', desc: 'Respondemos en el día. Sin bots ni tickets que tardan semanas.' },
              { title: 'Tu contenido es tuyo', desc: 'Todo lo que subís te pertenece. Nunca retenemos tu información.' },
            ].map((g, i) => (
              <Reveal key={i} delay={i * 60}>
                <div className="flex gap-4 bg-[#18181B] border border-[#27272A] hover:border-[#3F3F46] rounded-xl p-5 transition-colors">
                  <div className="w-8 h-8 rounded-lg bg-[#14532D]/30 border border-[#22C55E]/20 flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4 text-[#22C55E]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>
                  </div>
                  <div>
                    <h3 className="text-[#FAFAFA] font-semibold text-sm mb-1">{g.title}</h3>
                    <p className="text-[#71717A] text-sm leading-relaxed">{g.desc}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <div className="border-t border-[#18181B]"><FAQ /></div>

      {/* CONTACTO */}
      <section id="contacto" className="py-24 px-4 sm:px-6 border-t border-[#18181B]">
        <div className="max-w-3xl mx-auto">
          <Reveal>
            <div className="bg-[#18181B] border border-[#27272A] rounded-2xl p-8 sm:p-12 text-center">
              <p className="text-xs font-semibold text-[#2563EB] uppercase tracking-widest mb-4">Contacto</p>
              <h2 className="text-3xl font-bold text-[#FAFAFA] mb-3">¿Tenés dudas?</h2>
              <p className="text-[#71717A] mb-8 text-sm max-w-md mx-auto">Escribinos y te respondemos en el día. Sin compromiso.</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <a href={contactLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 bg-[#2563EB] hover:bg-[#1d4ed8] text-white font-semibold px-5 py-2.5 rounded-lg text-sm transition-colors">
                  <svg className="w-4 h-4 text-[#25D366]" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.555 4.116 1.524 5.847L.057 23.882a.75.75 0 00.933.933l6.036-1.467A11.953 11.953 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22.5c-1.969 0-3.81-.537-5.388-1.471l-.385-.224-3.995.97.987-3.878-.247-.4A10.463 10.463 0 011.5 12C1.5 6.21 6.21 1.5 12 1.5S22.5 6.21 22.5 12 17.79 22.5 12 22.5z"/></svg>
                  Escribir por WhatsApp
                </a>
                <a href="mailto:vexorade.web@gmail.com" className="inline-flex items-center justify-center gap-2 bg-[#27272A] hover:bg-[#3F3F46] border border-[#3F3F46] text-[#D4D4D8] font-semibold px-5 py-2.5 rounded-lg text-sm transition-colors">
                  vexorade.web@gmail.com
                </a>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-[#18181B] py-8 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6 mb-6">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-[#2563EB] rounded-md flex items-center justify-center">
                <span className="text-white font-bold text-xs">V</span>
              </div>
              <span className="font-semibold text-[#FAFAFA] text-sm">Vexorade</span>
            </div>
            <div className="flex flex-wrap justify-center gap-4 text-xs text-[#52525B]">
              <a href="#servicios" className="hover:text-[#A1A1AA] transition-colors">Servicios</a>
              <a href="#planes" className="hover:text-[#A1A1AA] transition-colors">Planes</a>
              <a href="#faq" className="hover:text-[#A1A1AA] transition-colors">FAQ</a>
              <a href="#contacto" className="hover:text-[#A1A1AA] transition-colors">Contacto</a>
            </div>
          </div>
          <div className="border-t border-[#18181B] pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#52525B]">
            <p>© {new Date().getFullYear()} Vexorade. Todos los derechos reservados.</p>
            <div className="flex gap-4">
              <a href="/privacidad" className="hover:text-[#A1A1AA] transition-colors">Privacidad</a>
              <a href="/terminos" className="hover:text-[#A1A1AA] transition-colors">Términos</a>
              <a href="/cookies" className="hover:text-[#A1A1AA] transition-colors">Cookies</a>
              <a href="/aviso-legal" className="hover:text-[#A1A1AA] transition-colors">Aviso legal</a>
            </div>
          </div>
        </div>
      </footer>
    </main>
  )
}
