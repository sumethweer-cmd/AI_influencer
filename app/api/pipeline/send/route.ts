import { NextResponse } from 'next/server'
import { adminGuard } from '@/lib/adminGuard'
import { sendContent, SendError } from '@/lib/sendJob'

// Sends a content (all segments) or a subset of its segments (repair) to RunningHub as ONE task.
// THIS SPENDS COINS once RunningHub runs it, so it requires { confirm: true } and (when set)
// the PIPELINE_ADMIN_TOKEN header. Pictures come from the content's Picture slots. Logic: lib/sendJob.ts
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: Request) {
    const denied = adminGuard(req)
    if (denied) return denied
    try {
        const body = await req.json().catch(() => ({}))
        if (body.confirm !== true && body.dryRun !== true) return NextResponse.json({ success: false, error: 'ต้องยืนยัน (confirm) ก่อนสั่งเจน เพราะเสียเหรียญ' }, { status: 400 })
        const out = await sendContent({
            contentId: String(body.contentId || ''),
            workflowRowId: body.workflowRowId ? String(body.workflowRowId) : undefined,
            segFrom: body.segFrom,
            segCount: body.segCount,
            prompt: typeof body.prompt === 'string' ? body.prompt : undefined,
            unshift: body.unshift,
            continuity: body.continuity && typeof body.continuity === 'object' ? body.continuity : undefined,
            resolution: typeof body.resolution === 'string' ? body.resolution : undefined,
            dryRun: body.dryRun === true,
        })
        return NextResponse.json({ success: true, ...out })
    } catch (e: unknown) {
        const status = e instanceof SendError ? e.status : 500
        return NextResponse.json({ success: false, error: e instanceof Error ? e.message : String(e) }, { status })
    }
}
