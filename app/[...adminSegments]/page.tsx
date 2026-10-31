import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import LoginPageClient from '@/components/admin/LoginPageClient'
import AdminDashboardClient from '@/components/admin/AdminDashboardClient'

export default async function AdminPage({ params }: { params: Promise<{ adminSegments: string[] }> }) {
  const { adminSegments } = await params
  const segments = adminSegments || []
  const adminRoute = process.env.ADMIN_ROUTE
  const adminPassword = process.env.ADMIN_PASSWORD

  // Si no hay ruta admin configurada, nada responde acá. Nunca fallamos "abierto".
  if (!adminRoute || !adminPassword) {
    notFound()
  }

  // El primer segmento TIENE que ser exactamente la ruta configurada.
  // Cualquier otra URL (/imagenes, /planes, /loquesea) no coincide y da 404.
  if (segments[0] !== adminRoute) {
    notFound()
  }

  const isLogin = segments[1] === 'login' && segments.length === 2
  const isRoot = segments.length === 1

  if (!isLogin && !isRoot) {
    notFound()
  }

  if (isLogin) {
    return <LoginPageClient adminBase={adminRoute} />
  }

  // Verificación real de sesión acá, en el servidor — no confiamos solo en el middleware.
  const cookieStore = await cookies()
  const session = cookieStore.get('vex_admin')

  if (!session || session.value !== adminPassword) {
    return <LoginPageClient adminBase={adminRoute} />
  }

  return <AdminDashboardClient adminBase={adminRoute} />
}
