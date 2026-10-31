import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const password = process.env.ADMIN_PASSWORD
  const session = req.cookies.get('vex_admin')?.value
  if (!password || session !== password) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabase = {
    configured: Boolean(url && key),
    reachable: false,
    tablesReady: false,
    error: null as string | null,
  }

  if (supabase.configured) {
    try {
      const client = createClient(url as string, key as string, { auth: { persistSession: false } })
      const { error } = await client.from('plans').select('id').limit(1)
      if (error) {
        supabase.reachable = error.code !== 'PGRST301'
        supabase.error = error.code === '42P01' || error.message.includes('does not exist')
          ? 'Las tablas todavía no existen. Ejecutá supabase/schema.sql.'
          : error.message
      } else {
        supabase.reachable = true
        supabase.tablesReady = true
      }
    } catch {
      supabase.error = 'No se pudo conectar con Supabase.'
    }
  }

  return NextResponse.json({
    web: { status: 'ok' },
    supabase,
    whatsapp: { configured: Boolean(process.env.NEXT_PUBLIC_WHATSAPP_NUMBER) },
    checkedAt: new Date().toISOString(),
  })
}
