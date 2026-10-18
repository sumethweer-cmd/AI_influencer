import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { adminGuard } from '@/lib/adminGuard'
import { rhOutputs, rhStatus } from '@/lib/runninghub'

// Asks RunningHub for the current status of up to MAX_BATCH unfinished
// render tasks and updates render_tasks. It only READS from RunningHub
// (status/outputs) — it never submits or cancels a job, so it costs no coins.
// The page calls this repeatedly in small batches to stay within serverless
// time limits. Result files are NOT downloaded here: only the URL is stored.
export const dynamic = 'force-dynamic'

const MAX_BATCH = 5
const ACTIVE = ['QUEUED', 'RUNNING']

type TaskRow = {
    id: string
    job_id: string
    status: string
    running_at: string | null
    finished_at: string | null
}

export async function POST(req: Request) {
    const denied = adminGuard(req)
    if (denied) return denied
    try {
        if (!supabaseAdmin) {
            return NextResponse.json({ success: false, error: 'SUPABASE_SERVICE_ROLE_KEY is not set on the server' }, { status: 500 })
        }
        const body = await req.json().catch(() => ({}))
        const jobIds: string[] = Array.isArray(body.jobIds) ? body.jobIds.map(String).slice(0, MAX_BATCH) : []
        if (!jobIds.length) {
            return NextResponse.json({ success: false, error: 'jobIds (max 5) is required' }, { status: 400 })
        }

        const { data, error } = await supabaseAdmin
            .from('render_tasks')
            .select('id,job_id,status,running_at,finished_at')
            .eq('provider', 'runninghub')
            .in('job_id', jobIds)
            .in('status', ACTIVE)
        if (error) throw error

        const results: Array<{ job_id: string; from: string; to: string | null; error?: string }> = []
        for (const row of (data || []) as TaskRow[]) {
            try {
                const st = await rhStatus(row.job_id)
                if (!st) {
                    results.push({ job_id: row.job_id, from: row.status, to: null, error: 'status not recognised' })
                    continue
                }
                const now = new Date().toISOString()
                const patch: Record<string, unknown> = { status: st, updated_at: now }
                if (st === 'RUNNING' && !row.running_at) patch.running_at = now
                if (st === 'SUCCESS' || st === 'FAILED' || st === 'CANCELLED') {
                    if (!row.finished_at) patch.finished_at = now
                }
                if (st === 'SUCCESS') {
                    const out = await rhOutputs(row.job_id)
                    if (out.fileUrl) patch.file_url = out.fileUrl
                    if (out.runSeconds != null) patch.run_seconds = out.runSeconds
                    if (out.coins != null) patch.coins = out.coins
                }
                const { error: upErr } = await supabaseAdmin.from('render_tasks').update(patch).eq('id', row.id)
                if (upErr) throw upErr
                results.push({ job_id: row.job_id, from: row.status, to: st })
            } catch (e: unknown) {
                results.push({ job_id: row.job_id, from: row.status, to: null, error: e instanceof Error ? e.message : String(e) })
            }
        }

        return NextResponse.json({ success: true, checked: results.length, results })
    } catch (e: unknown) {
        return NextResponse.json({ success: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 })
    }
}
