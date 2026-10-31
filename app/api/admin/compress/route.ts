import { NextResponse } from 'next/server'
import sharp from 'sharp'
import { serviceDb, esAdmin, BUCKET, asegurarBucket } from '@/lib/serverDb'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST() {
  if (!(await esAdmin())) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const db = serviceDb()
  await asegurarBucket(db)

  const { data: files, error } = await db.storage.from(BUCKET).list('', { limit: 1000 })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: logoRow } = await db.from('page_sections').select('content').eq('key', 'logo_url').maybeSingle()

  let revisados = 0
  let comprimidos = 0
  let antesBytes = 0
  let despuesBytes = 0

  for (const f of files ?? []) {
    if (!f.name || !/\.(png|jpe?g|webp|gif)$/i.test(f.name)) continue
    revisados++

    const dl = await db.storage.from(BUCKET).download(f.name)
    if (dl.error || !dl.data) continue

    const input = Buffer.from(await dl.data.arrayBuffer())
    const out = await sharp(input).webp({ quality: 80 }).toBuffer()
    antesBytes += input.length

    if (out.length >= input.length) {
      despuesBytes += input.length
      continue
    }

    const newName = `${f.name.replace(/\.[^.]+$/, '')}.webp`
    await db.storage.from(BUCKET).upload(newName, out, { contentType: 'image/webp', upsert: true })
    if (newName !== f.name) await db.storage.from(BUCKET).remove([f.name])

    const newUrl = db.storage.from(BUCKET).getPublicUrl(newName).data.publicUrl
    if (logoRow?.content && logoRow.content.endsWith(f.name)) {
      await db.from('page_sections').update({ content: newUrl, updated_at: new Date().toISOString() }).eq('key', 'logo_url')
    }

    despuesBytes += out.length
    comprimidos++
  }

  return NextResponse.json({
    revisados,
    comprimidos,
    antesBytes,
    despuesBytes,
    liberadoBytes: antesBytes - despuesBytes,
  })
}
