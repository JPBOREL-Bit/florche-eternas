import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const adminRoute = process.env.ADMIN_ROUTE || 'admin'
  const res = NextResponse.redirect(new URL(`/${adminRoute}/login`, req.url))
  res.cookies.delete('vex_admin')
  return res
}
