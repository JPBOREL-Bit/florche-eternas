import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Vexorade — Tu página web, sin complicaciones',
  description: 'Creamos tu página web desde USD 15. Tiendas, reservas, catálogos, blogs y más. Infraestructura compartida con administración propia.',
  keywords: 'páginas web, desarrollo web, sitios web baratos, Vexorade, web económica Argentina',
  openGraph: {
    title: 'Vexorade — Tu página web, sin complicaciones',
    description: 'Tu página web desde USD 15 el primer mes.',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
