import { NextResponse } from 'next/server'
import { adminGuard } from '@/lib/adminGuard'
import { refreshTasks } from '@/lib/refreshTasks'

// Asks RunningHub for the current status of up to MAX_BATCH unfinished render tasks and updates
// render_tasks (logic: lib/refreshTasks.ts). It only READS from RunningHub, so it costs no coins.
// The page calls this repeatedly in small batches to stay within serverless time limits.
export const dynamic = 'force-dynamic'

const MAX_BATCH = 5

export async function POST(req: Request) {
    const denied = adminGuard(req)
    if (denied) return denied
    try {
        const body = await req.json().catch(() => ({}))
        const jobIds: string[] = Array.isArray(body.jobIds) ? body.jobIds.map(String).slice(0, MAX_BATCH) : []
        if (!jobIds.length) return NextResponse.json({ success: false, error: 'jobIds (max 5) is required' }, { status: 400 })
        const results = await refreshTasks(jobIds)
        return NextResponse.json({ success: true, checked: results.length, results })
    } catch (e: unknown) {
        return NextResponse.json({ success: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 })
    }
}
