import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import { serviceDb, esAdmin, BUCKET, asegurarBucket } from '@/lib/serverDb'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { data } = await serviceDb()
      .from('page_sections').select('content').eq('key', 'logo_url').maybeSingle()
    return NextResponse.json({ url: data?.content ?? null })
  } catch {
    return NextResponse.json({ url: null })
  }
}

export async function POST(req: NextRequest) {
  if (!(await esAdmin())) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const form = await req.formData()
  const file = form.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: 'Falta el archivo' }, { status: 400 })
  if (!file.type.startsWith('image/')) return NextResponse.json({ error: 'Solo se aceptan imágenes' }, { status: 400 })
  if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: 'El archivo supera 5 MB' }, { status: 400 })

  const input = Buffer.from(await file.arrayBuffer())
  const out = await sharp(input)
    .resize({ width: 512, height: 512, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 85 })
    .toBuffer()

  const db = serviceDb()
  await asegurarBucket(db)
  const name = `logo-${Date.now()}.webp`

  const { error: upErr } = await db.storage.from(BUCKET).upload(name, out, { contentType: 'image/webp', upsert: false })
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

  const url = db.storage.from(BUCKET).getPublicUrl(name).data.publicUrl
  const { error: dbErr } = await db.from('page_sections').upsert(
    { key: 'logo_url', title: 'Logo', content: url, active: true, updated_at: new Date().toISOString() },
    { onConflict: 'key' }
  )
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })

  return NextResponse.json({ url, bytes: out.length })
}
