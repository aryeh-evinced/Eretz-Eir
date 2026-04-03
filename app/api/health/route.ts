import { NextResponse } from 'next/server'
import { checkHealth } from '@/lib/supabase/health'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const health = await checkHealth()
  const status = health.ok ? 200 : 503

  return NextResponse.json(health, { status })
}
