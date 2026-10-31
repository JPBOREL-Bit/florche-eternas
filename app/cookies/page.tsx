import LegalPage from '@/components/LegalPage'
export default function Cookies() {
  return (
    <LegalPage title="Política de Cookies" updated="29 de octubre de 2026">
      <section><h2 className="text-[#FAFAFA] font-semibold text-base mb-2">¿Qué son?</h2><p>Las cookies son archivos que algunos sitios guardan en el navegador para recordar preferencias o facilitar funciones técnicas.</p></section>
      <section><h2 className="text-[#FAFAFA] font-semibold text-base mb-2">Uso actual</h2><p>El sitio no instala cookies de seguimiento ni de publicidad. Las estadísticas de Umami se registran sin cookies. No utilizamos Google Analytics ni píxeles publicitarios.</p></section>
      <section><h2 className="text-[#FAFAFA] font-semibold text-base mb-2">Gestión</h2><p>Podés administrar o eliminar cookies desde tu navegador. La desactivación de cookies técnicas puede afectar algunas funciones del sitio.</p></section>
      <section><h2 className="text-[#FAFAFA] font-semibold text-base mb-2">Cambios futuros</h2><p>Si se incorporan herramientas de analítica o publicidad, se revisará esta política y se implementarán los mecanismos de consentimiento necesarios.</p></section>
    </LegalPage>
  )
}
