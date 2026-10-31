import { notFound } from 'next/navigation'
import { getDemo } from '@/lib/demo'
import DemoSiteView from '@/components/demo/DemoSite'

export default async function DemoSitio({ params }: { params: Promise<{ type: string }> }) {
  const { type } = await params
  const demo = getDemo(type)
  if (!demo) notFound()
  return <DemoSiteView demo={demo} />
}
