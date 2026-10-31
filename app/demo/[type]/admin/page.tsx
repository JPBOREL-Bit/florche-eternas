import { notFound } from 'next/navigation'
import { getDemo } from '@/lib/demo'
import DemoAdmin from '@/components/demo/DemoAdmin'

export default async function DemoAdminPage({ params }: { params: Promise<{ type: string }> }) {
  const { type } = await params
  const demo = getDemo(type)
  if (!demo) notFound()
  return <DemoAdmin demo={demo} />
}
