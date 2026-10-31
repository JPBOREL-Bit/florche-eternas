import Script from 'next/script'
import { UMAMI_SRC, UMAMI_ID } from '@/lib/analytics'

// Se usa solo en la web pública y las páginas legales. No se carga en el panel admin ni en las demos.
export default function Analytics() {
  return <Script src={UMAMI_SRC} data-website-id={UMAMI_ID} strategy="afterInteractive" />
}
