import { supabaseAdmin } from '@/lib/supabase'
import { rhOutputs, rhStatus } from '@/lib/runninghub'

// Asks RunningHub for the current status of unfinished render tasks and updates render_tasks.
// Read-only toward RunningHub (status/outputs): it never submits or cancels, so it costs no coins.
// Used by /api/pipeline/refresh (button, 5 at a time) and /api/pipeline/dispatch (auto tick).

const ACTIVE = ['QUEUED', 'RUNNING']

type TaskRow = { id: string; job_id: string; status: string; running_at: string | null; finished_at: string | null }
export type RefreshResult = { job_id: string; from: string; to: string | null; error?: string }

export async function refreshTasks(jobIds: string[]): Promise<RefreshResult[]> {
    if (!supabaseAdmin) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set on the server')
    if (!jobIds.length) return []
    const { data, error } = await supabaseAdmin
        .from('render_tasks')
        .select('id,job_id,status,running_at,finished_at')
        .eq('provider', 'runninghub')
        .in('job_id', jobIds)
        .in('status', ACTIVE)
    if (error) throw error

    const results: RefreshResult[] = []
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
            if ((st === 'SUCCESS' || st === 'FAILED' || st === 'CANCELLED') && !row.finished_at) patch.finished_at = now
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
    return results
}

/** job_ids of every RunningHub task that is not finished yet. */
export async function activeJobIds(): Promise<string[]> {
    if (!supabaseAdmin) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set on the server')
    const { data, error } = await supabaseAdmin.from('render_tasks').select('job_id').eq('provider', 'runninghub').in('status', ACTIVE)
    if (error) throw error
    return (data || []).map((r: { job_id: string }) => r.job_id)
}
