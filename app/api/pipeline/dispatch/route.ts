import { NextResponse } from 'next/server'
import { adminGuard } from '@/lib/adminGuard'
import { runTick, verifyCronSecret } from '@/lib/dispatcher'

// One dispatcher tick. Called by pg_cron/pg_net every 30 minutes while the dispatcher is enabled
// (header x-cron-secret, checked against Supabase Vault), or by hand from the page ("รันตอนนี้",
// header x-admin-token when PIPELINE_ADMIN_TOKEN is set). Logic and safety rules: lib/dispatcher.ts
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: Request) {
    const cron = req.headers.get('x-cron-secret')
    let manual = false
    if (cron) {
        if (!(await verifyCronSecret(cron))) return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 })
    } else {
        const denied = adminGuard(req)
        if (denied) return denied
        manual = true
    }
    try {
        const result = await runTick(manual)
        return NextResponse.json({ success: true, ...result })
    } catch (e: unknown) {
        return NextResponse.json({ success: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 })
    }
}
